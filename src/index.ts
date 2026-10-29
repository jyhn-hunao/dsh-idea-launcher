// Host 半。
// M0 的 ping 保留；M2 新增进程接缝的只读/控制路由：
//   GET  /idea-launcher/api/ping         插件存活与版本
//   GET  /idea-launcher/api/runtime      PTY 能力探针（platform / defaultShell / subprocess 是否可用）
//   POST /idea-launcher/api/run          起一个 PTY 实例（M2 阶段直接吃 command，M4 改吃配置名）
//   POST /idea-launcher/api/stop         两段式停止：soft=SIGINT→宽限→terminate；hard=直接 terminate
//   GET  /idea-launcher/api/instances    实例快照（状态/pid/退出码）
//   GET  /idea-launcher/api/logs         某实例的合并输出（since 偏移增量）
// 所有路由都用 ctx.effect 持有 disposer；卸载时先停掉所有实例，避免留孤儿进程。
import type { IncomingMessage, ServerResponse } from 'node:http'
import { delimiter, join } from 'node:path'
import { InstanceRegistry } from './runtime/instance.ts'
import { ProcessDriver, type SubprocessLike } from './runtime/process.ts'
import { LogRing } from './runtime/log-ring.ts'
import { loadIdeaConfigs } from './parser/extract.ts'
import { readOverlay } from './config/overlay.ts'
import { resolveProjectRoot, type SessionsLike } from './config/project-root.ts'
import { mapToLaunchPlan } from './mapper/index.ts'
import { withProjectJdk } from './mapper/jdk.ts'
import {
  buildJavaArgv,
  classpathBuildArgv,
  compileArgv,
  inspectFastJava,
  readClasspath,
  stampFastJava,
  type FastJavaSpec,
} from './runtime/fast-java.ts'
import type { ConfigType, IdeaConfig, LaunchPlan } from './types.ts'

export const name = 'dsh-idea-launcher'
export const version = '0.2.0'

/** 依赖的 Service；subprocess 是可选依赖（没有它进程能力直接报 503，不静默降级） */
export const inject = ['webServer']

const ROUTE_PREFIX = '/idea-launcher/api'
const LOG_LIMIT_BYTES = 2 * 1024 * 1024
const STOP_GRACE_MS = 5000
const MAX_BODY_BYTES = 1024 * 1024

interface WebRouteLike {
  kind: 'prefix' | 'exact'
  path: string
  handler: (req: IncomingMessage, res: ServerResponse) => Promise<void> | void
}

interface HostContextLike {
  webServer: { register(route: WebRouteLike): () => void }
  effect(callback: () => () => void, label?: string): void
  get?(name: string): unknown
}

/** ctx.sessions 的最小面：只需要 sessionId → SessionHeader.cwd（实现在 config/project-root.ts）。 */

/** resolveLaunch 的输出：要么 argv 要么 command，二选一。 */
interface ResolvedLaunch {
  argv?: string[]
  command?: string
  cwd: string
  env?: Record<string, string>
  configName: string
  configType: ConfigType
  plan?: LaunchPlan
  /** 配置入口才有：快速启动要用到项目根（缓存目录在 .dsh 下） */
  projectRoot?: string
}

export function apply(ctx: HostContextLike): void {
  const startedAt = Date.now()
  const registry = new InstanceRegistry()
  const logs = new Map<string, LogRing>()

  // 事件链：记录"谁在什么时候对哪个实例做了什么"，用于回答"为什么服务停了"这类问题。
  // 有界（最近 200 条），只读暴露在 /events。
  const lifecycle: Array<{ at: number; kind: string; id?: string; detail?: string }> = []
  const pushEvent = (kind: string, id?: string, detail?: string): void => {
    lifecycle.push({ at: Date.now(), kind, id, detail })
    if (lifecycle.length > 200) lifecycle.shift()
  }

  // 1. subprocess 按可选服务取；没有就只在需要进程的接口上报 503（ping/runtime 仍可用）
  const subprocess = ctx.get?.('subprocess') as SubprocessLike | undefined
  // 2. sessions 用于把 sessionId 解析成该会话的项目根（SessionHeader.cwd）
  const sessions = ctx.get?.('sessions') as SessionsLike | undefined

  const route: WebRouteLike = {
    kind: 'prefix',
    path: ROUTE_PREFIX,
    handler: async (req, res) => {
      const url = new URL(req.url ?? '/', 'http://dsh.internal')
      const method = url.pathname.startsWith(`${ROUTE_PREFIX}/`)
        ? url.pathname.slice(ROUTE_PREFIX.length + 1)
        : undefined

      try {
        await dispatch(req, res, method, url)
      } catch (error) {
        fail(res, 500, 'internal-error', error instanceof Error ? error.message : String(error))
      }
    },
  }

  async function dispatch(req: IncomingMessage, res: ServerResponse, method: string | undefined, url: URL): Promise<void> {
    // 2. 只读探针
    if (req.method === 'GET' && method === 'ping') {
      ok(res, { ok: true, name, version, hostPid: process.pid, pluginStartedAt: startedAt, now: Date.now() })
      return
    }
    if (req.method === 'GET' && method === 'runtime') {
      const environment = subprocess ? await subprocess.terminalEnvironment() : undefined
      // 跟随会话是否可用，靠这里一眼看清：服务在不在、有哪些会话带 cwd
      const liveSessions = safeListSessions(sessions)
      ok(res, {
        ok: true,
        available: Boolean(subprocess),
        platform: environment?.platform ?? process.platform,
        defaultShell: environment?.defaultShell,
        stopGraceMs: STOP_GRACE_MS,
        sessionsAvailable: Boolean(sessions),
        sessions: liveSessions.slice(0, 10),
      })
      return
    }
    if (req.method === 'GET' && method === 'events') {
      const since = Number(url.searchParams.get('since') ?? '0')
      const from = Number.isFinite(since) && since > 0 ? Math.min(since, lifecycle.length) : 0
      ok(res, {
        ok: true,
        pluginStartedAt: startedAt,
        uptimeMs: Date.now() - startedAt,
        total: lifecycle.length,
        events: lifecycle.slice(from),
      })
      return
    }
    if (req.method === 'GET' && method === 'instances') {
      ok(res, { ok: true, instances: registry.list() })
      return
    }
    if (req.method === 'GET' && method === 'logs') {
      const id = url.searchParams.get('id') ?? ''
      const ring = logs.get(id)
      if (!ring) {
        fail(res, 404, 'not-found', `unknown instance "${id}"`)
        return
      }
      const since = Number(url.searchParams.get('since') ?? '0')
      const text = ring.snapshot()
      const offset = Number.isFinite(since) && since > 0 ? Math.min(since, text.length) : 0
      ok(res, { ok: true, id, text: text.slice(offset), offset: text.length })
      return
    }

    // 3. 控制面
    if (req.method === 'GET' && method === 'configs') {
      await handleConfigs(res, url)
      return
    }
    if (req.method === 'POST' && method === 'run') {
      await handleRun(req, res)
      return
    }
    if (req.method === 'GET' && method === 'inspect') {
      const id = url.searchParams.get('id') ?? ''
      const driver = registry.driver(id)
      if (!driver) {
        fail(res, 404, 'not-found', `unknown instance "${id}"`)
        return
      }
      ok(res, { ok: true, inspect: await driver.inspect() })
      return
    }
    if (req.method === 'POST' && method === 'stop') {
      await handleStop(req, res)
      return
    }
    if (req.method === 'POST' && method === 'stop-all') {
      // 全部停止：对每个活跃实例走同一套停止流程（先抢宽限期，直接 terminate）
      const running = registry.running()
      for (const entry of running) {
        pushEvent('stop-request', entry.id, 'all')
        registry.setState(entry.id, 'stopping', 'hard-killed')
        await entry.driver.hardStop()
        await entry.driver.waitExit(2000)
        registry.setState(entry.id, 'stopped', 'hard-killed')
      }
      ok(res, { ok: true, stopped: running.length, instances: registry.list() })
      return
    }
    if (req.method === 'POST' && method === 'clear') {
      const body = await readJson(req)
      const id = typeof body.id === 'string' ? body.id : ''
      const ring = logs.get(id)
      if (!ring) {
        fail(res, 404, 'not-found', `unknown instance "${id}"`)
        return
      }
      ring.clear()
      pushEvent('clear-log', id)
      ok(res, { ok: true })
      return
    }
    if (req.method === 'POST' && method === 'write') {
      const body = await readJson(req)
      const id = typeof body.id === 'string' ? body.id : ''
      const data = typeof body.data === 'string' ? body.data : ''
      const driver = registry.driver(id)
      if (!driver) {
        fail(res, 404, 'not-found', `unknown instance "${id}"`)
        return
      }
      await driver.write(data)
      ok(res, { ok: true })
      return
    }

    if (method === undefined) {
      fail(res, 404, 'not-found', 'missing method')
      return
    }
    fail(res, req.method === 'GET' || req.method === 'POST' ? 404 : 405, 'not-found', `unknown method "${method}"`)
  }

  /** GET /configs?path=|sessionId=：解析 + 映射一次给全 UI，前端不用自己拼两步。 */
  async function handleConfigs(res: ServerResponse, url: URL): Promise<void> {
    const resolved = resolveProjectRoot(url.searchParams.get('path'), url.searchParams.get('sessionId'), sessions)
    if ('error' in resolved) {
      fail(res, 400, 'bad-request', resolved.error)
      return
    }

    const projectRoot = resolved.projectRoot
    const parsed = await loadIdeaConfigs(projectRoot)
    const { overlay, diagnostics: overlayDiagnostics } = await readOverlay(projectRoot)

    const configs = await Promise.all(
      parsed.configs.map(async (config) => ({
        name: config.name,
        type: config.type,
        origin: config.origin,
        moduleName: config.moduleName,
        moduleRoot: config.moduleRoot,
        // 补项目 JDK：IDEA 配置本身不带 JDK，避免用 PATH 上错误的 java（mlw 的 UnsupportedClassVersionError）
        plan: await withProjectJdk(mapToLaunchPlan(config, projectRoot, overlay), projectRoot),
      })),
    )

    ok(res, {
      ok: true,
      projectRoot,
      rootSource: resolved.source,
      configs,
      diagnostics: [...parsed.diagnostics, ...overlayDiagnostics],
    })
  }

  async function handleRun(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // 3.1 没有 subprocess 能力时明确拒绝，不做单段式硬杀之类的静默降级
    if (!subprocess) {
      fail(res, 503, 'no-subprocess', 'ctx.subprocess 不可用：当前 Host 组合没有安装 subprocess provider')
      return
    }

    const body = await readJson(req)

    // 3.2 两种入口：projectRoot+configName（UI 走完整映射），或直接 command/argv（调试/探针）
    let launch: ResolvedLaunch
    try {
      launch = await resolveLaunch(body)
    } catch (error) {
      fail(res, 400, 'bad-request', error instanceof Error ? error.message : String(error))
      return
    }

    // 3.3 先建快照再起进程：起失败时实例留在 failed 里，UI 能看到原因而不是无声消失
    const instance = registry.create(launch.configName, launch.configType)
    const ring = new LogRing(LOG_LIMIT_BYTES)
    logs.set(instance.id, ring)

    // 3.4 立即返回：准备步骤（生成 classpath / 编译）可能要几十秒，
    //     不能卡住 HTTP 响应，否则 UI 看起来像按钮没反应。过程全部写进日志流。
    ok(res, { ok: true, instance: registry.get(instance.id), plan: launch.plan })

    // 3.5 后台准备并拉起进程（任何失败都写日志 + 标记实例 failed）
    void launchInstance(subprocess, registry, ring, instance.id, launch, body.shellActivity === true)
  }

  /** 起进程：先做（必要时）快速启动的准备步骤，再 spawn；失败回退 mvn 或标记失败。 */
  async function launchInstance(
    subprocess: SubprocessLike,
    registry: InstanceRegistry,
    ring: LogRing,
    instanceId: string,
    launch: ResolvedLaunch,
    shellActivity: boolean,
  ): Promise<void> {
    let argv = launch.argv
    let command = launch.command
    let usedFast = false

    const fast = launch.plan?.fastJava
    if (fast && launch.plan?.launchMode === 'java' && launch.projectRoot) {
      try {
        argv = await prepareFastJava(subprocess, ring, {
          projectRoot: launch.projectRoot,
          javaHome: launch.plan?.javaHome,
          moduleRoot: fast.moduleRoot,
          mainClass: fast.mainClass,
          vmParams: fast.vmParams,
          programParams: fast.programParams,
        })
        command = undefined
        usedFast = true
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        ring.append(`[idea-launcher] 快速启动准备失败，回退 mvn spring-boot:run：${reason}\r\n`)
        argv = launch.plan?.argv
        command = launch.plan?.command
      }
    }

    // 用户可能在准备阶段就点了停止
    const snapshot = registry.get(instanceId)
    if (!snapshot || snapshot.state === 'stopped' || snapshot.state === 'failed') {
      ring.append('[idea-launcher] 实例已被停止，取消启动\r\n')
      return
    }

    ring.append(`[idea-launcher] 启动 ${argv ? argv.join(' ') : (command ?? '')}\r\n`)
    ring.append(`[idea-launcher] cwd ${launch.cwd}\r\n`)
    if (usedFast) ring.append('[idea-launcher] 快速启动：直接 java -cp（已跳过 Maven 生命周期）\r\n')

    try {
      const driver = await ProcessDriver.start(subprocess, {
        command,
        argv,
        cwd: launch.cwd,
        shellActivity: shellActivity || undefined,
        env: launch.env,
        onData: (chunk) => ring.append(chunk),
        onExit: (exit) => {
          registry.applyExit(instanceId, exit)
          pushEvent(
            'exit',
            instanceId,
            `exitCode=${exit.exitCode} signal=${exit.signal ?? 'null'} stopPhase=${registry.get(instanceId)?.stopPhase ?? 'none'}`,
          )
          ring.append(`\r\n[idea-launcher] 进程退出 exitCode=${exit.exitCode} signal=${exit.signal}\r\n`)
        },
      })
      registry.attach(instanceId, driver)
      pushEvent('spawn', instanceId, `${usedFast ? 'fast-java' : 'maven'}: ${argv ? argv.join(' ') : (command ?? '')}`)
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      registry.fail(instanceId, reason)
      pushEvent('spawn-failed', instanceId, reason)
      ring.append(`[idea-launcher] 启动失败：${reason}\r\n`)
    }
  }

  /**
   * 快速启动的准备步骤（必要时才跑）：
   *   1. 依赖 classpath 缓存缺失 / pom 变更 → mvn dependency:build-classpath；
   *   2. 源码比上次编译新 → mvn compile；
   *   3. 读缓存 classpath，拼出 `java -cp target/classes;<deps> MainClass`。
   * 每步输出都写进同一个日志环，用户能看到为什么这次快/慢。
   */
  async function prepareFastJava(subprocess: SubprocessLike, ring: LogRing, spec: FastJavaSpec): Promise<string[]> {
    const before = await inspectFastJava(spec)
    for (const note of before.notes) ring.append(`[idea-launcher] ${note}\r\n`)

    if (before.needsClasspath) {
      await runPrepareStep(
        subprocess,
        classpathBuildArgv(spec, before.classpathPath),
        spec.moduleRoot,
        ring,
        '生成依赖 classpath',
        '依赖解析失败常见原因：兄弟模块尚未安装（在项目根执行 mvn -DskipTests install），或私有仓库 / settings.xml 未配置',
      )
      await stampFastJava(spec, { classpathAt: Date.now() })
    }
    if (before.needsCompile) {
      await runPrepareStep(subprocess, compileArgv(), spec.moduleRoot, ring, '编译')
      await stampFastJava(spec, { compiledAt: Date.now() })
    }

    const classpath = await readClasspath(before.classpathPath)
    return buildJavaArgv(spec, classpath)
  }

  /** 跑一步准备命令并等它退出；非 0 退出码视为失败（由调用方回退），并写一条可操作提示。 */
  async function runPrepareStep(
    subprocess: SubprocessLike,
    argv: string[],
    cwd: string,
    ring: LogRing,
    label: string,
    hint?: string,
  ): Promise<void> {
    ring.append(`[idea-launcher] ${label}：${argv.join(' ')}\r\n`)
    const driver = await ProcessDriver.start(subprocess, {
      argv,
      cwd,
      onData: (chunk) => ring.append(chunk),
      onExit: () => {},
    })
    const exited = await driver.waitExit(600_000)
    const outcome = driver.outcome()
    if (!exited) {
      await driver.hardStop()
      throw new Error(`${label}超时（10 分钟）`)
    }
    if (outcome && outcome.exitCode !== 0) {
      if (hint) ring.append(`[idea-launcher] 提示：${hint}\r\n`)
      throw new Error(`${label}失败 exitCode=${outcome.exitCode}`)
    }
  }

  /** 把 /run 请求体解析成可执行参数：配置入口走「解析→映射→覆盖层」，调试入口直接用。 */
  async function resolveLaunch(body: Record<string, unknown>): Promise<ResolvedLaunch> {
    const pathValue = typeof body.projectRoot === 'string' && body.projectRoot.length > 0 ? body.projectRoot : undefined
    const sessionIdValue = typeof body.sessionId === 'string' && body.sessionId.length > 0 ? body.sessionId : undefined
    const configName = typeof body.configName === 'string' && body.configName.length > 0 ? body.configName : undefined

    // 1. UI 入口：给配置名 +（项目根 或 会话 id），命令由解析/映射/覆盖层共同决定
    if (configName && (pathValue || sessionIdValue)) {
      const resolved = resolveProjectRoot(pathValue ?? null, sessionIdValue ?? null, sessions)
      if ('error' in resolved) throw new Error(resolved.error)
      const projectRoot = resolved.projectRoot

      const parsed = await loadIdeaConfigs(projectRoot)
      const config = parsed.configs.find((c) => c.name === configName)
      if (!config) throw new Error(`项目里没有名为 "${configName}" 的运行配置`)
      const { overlay } = await readOverlay(projectRoot)
      const plan = await withProjectJdk(mapToLaunchPlan(config, projectRoot, overlay), projectRoot)
      if (!plan) throw new Error(`配置 "${configName}" 是 ${config.type} 类型，M6 才支持编排`)
      return {
        argv: plan.argv,
        command: plan.command,
        cwd: plan.cwd,
        env: withJdkEnv(plan.env, plan.javaHome),
        configName: config.name,
        configType: config.type,
        plan,
        projectRoot,
      }
    }

    // 2. 调试入口：直接命令行/argv（探针、手动验证用）
    const argv = Array.isArray(body.argv) && body.argv.every((v) => typeof v === 'string') ? (body.argv as string[]) : undefined
    const command = typeof body.command === 'string' ? body.command.trim() : ''
    const cwd = typeof body.cwd === 'string' && body.cwd.length > 0 ? body.cwd : process.cwd()
    if (!command && !argv) throw new Error('需要 command / argv，或 projectRoot+configName')
    const configType = (typeof body.configType === 'string' ? body.configType : 'unsupported') as ConfigType
    return {
      argv,
      command: command || undefined,
      cwd,
      env: isStringRecord(body.env) ? body.env : undefined,
      configName: configName ?? argv?.[0] ?? command,
      configType,
    }
  }

  async function handleStop(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const body = await readJson(req)
    const id = typeof body.id === 'string' ? body.id : ''
    const mode = body.mode === 'hard' ? 'hard' : body.mode === 'ctrl-c' ? 'ctrl-c' : 'soft'
    const driver = registry.driver(id)
    if (!driver) {
      fail(res, 404, 'not-found', `unknown instance "${id}"`)
      return
    }

    // 3.3 进程已经自己退出（stopped/failed）时不再进入停止流程，否则会把状态改回 stopping，
    //     并给一个没发生过的 stopPhase——这正是端到端测出来的 bug
    const current = registry.get(id)
    if (current && (current.state === 'stopped' || current.state === 'failed')) {
      ok(res, { ok: true, instance: current, phase: 'already-exited' })
      return
    }

    // 3.4 两段式停止：先 SIGINT（或向 PTY 写 ^C），宽限期内没退再 terminate；
    //     每步都写进快照，UI 才能显示停在哪一段
    if (mode === 'hard') {
      pushEvent('stop-request', id, 'hard')
      registry.setState(id, 'stopping', 'hard-killed')
      await driver.hardStop()
      // terminate 之后等退出事实落地，再统一记为"用户停的"（exitCode 非 0 不算故障）
      await driver.waitExit(2000)
      registry.setState(id, 'stopped', 'hard-killed')
      ok(res, { ok: true, instance: registry.get(id), phase: 'hard-killed' })
      return
    }

    registry.setState(id, 'stopping', 'soft-killed')
    pushEvent('stop-request', id, mode === 'ctrl-c' ? 'ctrl-c' : 'soft')
    const signalled = mode === 'ctrl-c' ? await writeCtrlC(driver) : await driver.softStop()
    if (!signalled) {
      await driver.hardStop()
      registry.setState(id, 'stopped', 'hard-killed')
      ok(res, { ok: true, instance: registry.get(id), phase: 'hard-killed', degraded: 'signal-unsupported' })
      return
    }

    const exited = await driver.waitExit(STOP_GRACE_MS)
    if (!exited) {
      await driver.hardStop()
      registry.setState(id, 'stopped', 'hard-killed')
      ok(res, { ok: true, instance: registry.get(id), phase: 'hard-killed', degraded: 'grace-expired' })
      return
    }

    ok(res, { ok: true, instance: registry.get(id), phase: 'soft-killed' })
  }

  // 4. 注册路由，并登记卸载清理：插件重载/卸载时把所有还在跑的实例 terminate 掉
  ctx.effect(() => {
    const disposeRoute = ctx.webServer.register(route)
    return () => {
      disposeRoute()
      const running = registry.running()
      // 插件卸载会把所有实例强杀：这行事件是排查"服务为什么自己停了"的关键线索
      pushEvent('plugin-unload', undefined, `terminate ${running.length} running instance(s)`)
      for (const { driver } of running) void driver.hardStop()
    }
  }, 'dsh-idea-launcher: /idea-launcher/api routes')
}

/** 诊断用：列出宿主当前会话及其 cwd；任何异常都降级成空列表，不影响 /runtime 本身。 */
function safeListSessions(sessions: SessionsLike | undefined): Array<{ id: string; cwd?: string }> {
  if (!sessions?.list) return []
  try {
    return sessions.list().map((session) => ({ id: String(session.id), cwd: session.header?.cwd }))
  } catch {
    return []
  }
}

function ok(res: ServerResponse, body: unknown): void {
  writeJson(res, 200, body)
}

function fail(res: ServerResponse, status: number, code: string, message: string): void {
  writeJson(res, status, { ok: false, error: { code, message } })
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(text),
    'cache-control': 'no-store',
  })
  res.end(text)
}

async function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk
    size += buffer.length
    if (size > MAX_BODY_BYTES) throw new Error('请求体超过 1MB 上限')
    chunks.push(buffer)
  }
  if (size === 0) return {}
  const text = Buffer.concat(chunks).toString('utf8')
  const parsed: unknown = JSON.parse(text)
  return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {}
}

/** 项目 JDK 存在时，把 JAVA_HOME 与 PATH 指向它：Maven 与直启 java 都受用。 */
function withJdkEnv(
  env: Record<string, string> | undefined,
  javaHome: string | undefined,
): Record<string, string> | undefined {
  if (!javaHome) return env
  const bin = join(javaHome, 'bin')
  const path = env?.PATH ?? process.env.PATH ?? ''
  return { ...env, JAVA_HOME: javaHome, PATH: `${bin}${delimiter}${path}` }
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (typeof value !== 'object' || value === null) return false
  return Object.values(value).every((v) => typeof v === 'string')
}

/** 实验通道：把 ^C（0x03）写进 PTY，由终端驱动给前台进程组产生 SIGINT。 */
async function writeCtrlC(driver: ProcessDriver): Promise<boolean> {
  try {
    await driver.write('\u0003')
    return true
  } catch {
    return false
  }
}
