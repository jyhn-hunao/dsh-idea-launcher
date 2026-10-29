#!/usr/bin/env bash
# scaffold-dsh-idea-launcher.sh
# 在项目目录下执行：bash scaffold-dsh-idea-launcher.sh
set -euo pipefail

PLUGIN_DIR="dsh-idea-launcher"

if [ -e "$PLUGIN_DIR" ]; then
  echo "错误：$PLUGIN_DIR 已存在，请先删除或改名后再运行"
  exit 1
fi

mkdir -p "$PLUGIN_DIR"/src/{parser,mapper,runtime,config,ui} "$PLUGIN_DIR"/test/fixtures

cd "$PLUGIN_DIR"

# ============================================================
# package.json
# ============================================================
cat > package.json << 'EOF'
{
  "name": "dsh-idea-launcher",
  "version": "0.1.0",
  "type": "module",
  "description": "Reads IDEA run configurations and launches Java/Vue projects inside DeepSeek Harness with a bottom log panel.",
  "main": "lib/index.js",
  "exports": {
    ".": "./lib/index.js",
    "./client": "./lib/client.js"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json"
  },
  "dependencies": {
    "fast-xml-parser": "^4.4.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.0.0",
    "typescript": "^5.5.0"
  }
}
EOF

# ============================================================
# tsconfig.json
# ============================================================
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "lib",
    "rootDir": "src",
    "jsx": "react-jsx",
    "declaration": false,
    "sourceMap": false
  },
  "include": ["src/**/*"]
}
EOF

# ============================================================
# cordis.yml
# ============================================================
cat > cordis.yml << 'EOF'
# ⚠️ 需对照 dsh-plugin-dev 技能与真实 SDK 补全 manifest 字段。
# 下列字段为结构占位，实际键名以 DSH 当前版本为准。
name: dsh-idea-launcher
version: 0.1.0
type: dual-face          # host + client
host:
  entry: ./lib/index.js
  inject: [shell, slots, remote]
client:
  entry: ./lib/client.js
  inject: [slots, remote]
config:
  schema: ./lib/config/schema.js
EOF

# ============================================================
# src/types.ts
# ============================================================
cat > src/types.ts << 'EOF'
export type ConfigType = 'spring-boot' | 'java-app' | 'npm' | 'compound' | 'unsupported'

export type BeforeLaunchTask =
  | { kind: 'build'; command: string }
  | { kind: 'run-config'; configName: string }
  | { kind: 'browser'; url: string }
  | { kind: 'unsupported'; raw: string }

export interface IdeaConfig {
  name: string
  type: ConfigType
  origin: 'shared' | 'local'
  mainClass?: string
  vmParams?: string
  programParams?: string
  workDir?: string
  env: Record<string, string>
  packageJson?: string
  npmCommand?: string
  npmScript?: string
  nodeInterpreter?: string
  referencedConfigs?: string[]
  beforeLaunch: BeforeLaunchTask[]
  raw?: Record<string, unknown>
}

export type RunState = 'starting' | 'running' | 'stopping' | 'stopped' | 'failed'
export type StopPhase = 'none' | 'soft-killed' | 'hard-killed'

export type LogSourceMeta =
  | { kind: 'process'; stream: 'stdout' | 'stderr'; id: string }
  | { kind: 'file'; tabName: string; pattern: string; skipContent: boolean; id: string }

export interface RunInstance {
  id: string
  configName: string
  configType: ConfigType
  state: RunState
  stopPhase: StopPhase
  startedAt: number
  exitCode?: number
  signal?: string
  killedBySignal?: boolean
  logSources: LogSourceMeta[]
}

export interface LaunchSpec {
  command: string
  workdir: string
  env: Record<string, string>
  beforeLaunch: BeforeLaunchTask[]
  browserUrl?: string
}
EOF

# ============================================================
# src/parser/vars.ts
# ============================================================
cat > src/parser/vars.ts << 'EOF'
export function substituteVars(input: string, projectRoot: string): string {
  return input
    .replace(/\$PROJECT_DIR\$/g, projectRoot)
    .replace(/\$MODULE_DIR\$/g, projectRoot)
}
EOF

# ============================================================
# src/parser/scan.ts
# ============================================================
cat > src/parser/scan.ts << 'EOF'
import { readdir, readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'

export interface RawConfigSource {
  path: string
  origin: 'shared' | 'local'
  content: string
}

export async function scanSources(projectRoot: string): Promise<RawConfigSource[]> {
  const shared: RawConfigSource[] = []

  const rcDir = join(projectRoot, '.idea', 'runConfigurations')
  try {
    for (const f of await readdir(rcDir)) {
      if (!f.endsWith('.xml')) continue
      shared.push({
        path: join(rcDir, f),
        origin: 'shared',
        content: await readFile(join(rcDir, f), 'utf8'),
      })
    }
  } catch { /* 目录不存在 */ }

  const runDir = join(projectRoot, '.run')
  try {
    for (const f of await readdir(runDir)) {
      if (!f.endsWith('.run.xml')) continue
      shared.push({
        path: join(runDir, f),
        origin: 'shared',
        content: await readFile(join(runDir, f), 'utf8'),
      })
    }
  } catch { /* 忽略 */ }

  const local: RawConfigSource[] = []
  const wsPath = join(projectRoot, '.idea', 'workspace.xml')
  try {
    await stat(wsPath)
    local.push({ path: wsPath, origin: 'local', content: await readFile(wsPath, 'utf8') })
  } catch { /* 忽略 */ }

  return [...shared, ...local]
}
EOF

# ============================================================
# src/parser/before-launch.ts
# ============================================================
cat > src/parser/before-launch.ts << 'EOF'
import type { BeforeLaunchTask } from '../types.js'
import { substituteVars } from './vars.js'

export function extractBeforeLaunch(node: any, projectRoot: string): BeforeLaunchTask[] {
  const tasks: BeforeLaunchTask[] = []
  for (const m of collectMethods(node)) {
    const name = m['@_name']
    if (name === 'Build' || name === 'BuildArtifacts') {
      tasks.push({ kind: 'build', command: '' })
    } else if (name === 'RunConfigurationTask') {
      const cn = m.option?.find?.((o: any) => o['@_name'] === 'run_configuration_name')?.['@_value']
      if (cn) tasks.push({ kind: 'run-config', configName: cn })
    } else if (name === 'browser' || name === 'LaunchWebBrowser') {
      const url = m.option?.find?.((o: any) => o['@_name'] === 'url')?.['@_value']
        ?? m['@_url'] ?? 'http://localhost:8080'
      tasks.push({ kind: 'browser', url: substituteVars(url, projectRoot) })
    } else {
      tasks.push({ kind: 'unsupported', raw: name ?? 'unknown' })
    }
  }
  return tasks
}

function collectMethods(node: any): any[] {
  const out: any[] = []
  const walk = (n: any) => {
    if (!n || typeof n !== 'object') return
    if (Array.isArray(n)) { n.forEach(walk); return }
    if (n.method) out.push(...(Array.isArray(n.method) ? n.method : [n.method]))
    for (const k of Object.keys(n)) if (k !== 'method') walk(n[k])
  }
  walk(node)
  return out
}
EOF

# ============================================================
# src/parser/compound.ts
# ============================================================
cat > src/parser/compound.ts << 'EOF'
import type { IdeaConfig } from '../types.js'

export function extractCompoundRefs(node: any): string[] {
  const list = Array.isArray(node.configuration) ? node.configuration : [node.configuration]
  return list
    .map((c: any) => c?.['@_name'])
    .filter((n: unknown): n is string => typeof n === 'string' && n.length > 0)
}

export function isCompound(cfg: IdeaConfig): boolean {
  return cfg.type === 'compound'
}
EOF

# ============================================================
# src/parser/extract.ts
# ============================================================
cat > src/parser/extract.ts << 'EOF'
import { XMLParser } from 'fast-xml-parser'
import type { IdeaConfig, ConfigType } from '../types.js'
import { extractBeforeLaunch } from './before-launch.js'
import { extractCompoundRefs } from './compound.js'
import { substituteVars } from './vars.js'

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => name === 'configuration' || name === 'option' || name === 'env',
})

const TYPE_MAP: Record<string, ConfigType> = {
  SpringBootApplicationConfigurationType: 'spring-boot',
  Application: 'java-app',
  'js.build_tools.npm': 'npm',
  CompoundRunConfigurationType: 'compound',
}

export function extractConfigs(
  xml: string,
  origin: 'shared' | 'local',
  projectRoot: string,
): IdeaConfig[] {
  let doc: any
  try { doc = parser.parse(xml) } catch { return [] }
  return findConfigNodes(doc)
    .map((n) => extractOne(n, origin, projectRoot))
    .filter((c): c is IdeaConfig => c !== null)
}

function findConfigNodes(doc: any): any[] {
  const out: any[] = []
  const walk = (node: any) => {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) { node.forEach(walk); return }
    if (node.configuration) {
      out.push(...(Array.isArray(node.configuration) ? node.configuration : [node.configuration]))
    }
    for (const k of Object.keys(node)) if (k !== 'configuration') walk(node[k])
  }
  walk(doc)
  return out
}

function getOpt(node: any, name: string): string | undefined {
  const opts = Array.isArray(node.option) ? node.option : node.option ? [node.option] : []
  return opts.find((o: any) => o['@_name'] === name)?.['@_value']
}

function getEnvs(node: any): Record<string, string> {
  const envs = node.envs?.env
  if (!envs) return {}
  const list = Array.isArray(envs) ? envs : [envs]
  return Object.fromEntries(list.map((e: any) => [e['@_name'], e['@_value'] ?? '']))
}

function extractOne(node: any, origin: 'shared' | 'local', projectRoot: string): IdeaConfig | null {
  const name = node['@_name']
  if (!name) return null
  const type = TYPE_MAP[node['@_type']] ?? 'unsupported'
  const workDir = substituteVars(getOpt(node, 'WORKING_DIRECTORY') ?? '$PROJECT_DIR$', projectRoot)

  const base: IdeaConfig = {
    name, type, origin, workDir,
    env: getEnvs(node),
    beforeLaunch: extractBeforeLaunch(node, projectRoot),
  }

  switch (type) {
    case 'spring-boot':
      return { ...base,
        mainClass: getOpt(node, 'SPRING_BOOT_MAIN_CLASS') ?? getOpt(node, 'MAIN_CLASS_NAME'),
        vmParams: getOpt(node, 'VM_PARAMETERS'),
        programParams: getOpt(node, 'PROGRAM_PARAMETERS'),
      }
    case 'java-app':
      return { ...base,
        mainClass: getOpt(node, 'MAIN_CLASS_NAME'),
        vmParams: getOpt(node, 'VM_PARAMETERS'),
        programParams: getOpt(node, 'PROGRAM_PARAMETERS'),
      }
    case 'npm':
      return { ...base,
        packageJson: substituteVars(node['package-json']?.['@_value'] ?? '$PROJECT_DIR$/package.json', projectRoot),
        npmCommand: node.command?.['@_value'],
        npmScript: node.scripts?.script?.['@_value'] ?? node.scripts?.script?.[0]?.['@_value'],
        nodeInterpreter: node['node-interpreter']?.['@_value'],
      }
    case 'compound':
      return { ...base, referencedConfigs: extractCompoundRefs(node) }
    default:
      return { ...base, raw: node }
  }
}
EOF

# ============================================================
# src/mapper/spring-boot.ts
# ============================================================
cat > src/mapper/spring-boot.ts << 'EOF'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { IdeaConfig, LaunchSpec } from '../types.js'

export function mapSpringBoot(cfg: IdeaConfig, projectRoot: string): LaunchSpec {
  const isGradle =
    existsSync(join(projectRoot, 'build.gradle')) ||
    existsSync(join(projectRoot, 'build.gradle.kts'))
  const workdir = cfg.workDir ?? projectRoot
  const env = { ...cfg.env }

  const buildTask = cfg.beforeLaunch.find((t) => t.kind === 'build')
  if (buildTask && buildTask.kind === 'build') {
    buildTask.command = isGradle ? './gradlew compileJava' : 'mvn -q compile'
  }

  let command: string
  if (isGradle) {
    command = './gradlew bootRun'
    const args: string[] = []
    if (cfg.vmParams) args.push(`-Dorg.gradle.jvmargs="${cfg.vmParams}"`)
    if (cfg.programParams) args.push(`--args="${cfg.programParams}"`)
    if (args.length) command += ' ' + args.join(' ')
  } else {
    command = 'mvn spring-boot:run'
    const args: string[] = []
    if (cfg.vmParams) args.push(`-Dspring-boot.run.jvmArguments="${cfg.vmParams}"`)
    if (cfg.programParams) args.push(`-Dspring-boot.run.arguments="${cfg.programParams}"`)
    if (args.length) command += ' ' + args.join(' ')
  }

  const browserTask = cfg.beforeLaunch.find((t) => t.kind === 'browser')
  const browserUrl = browserTask && browserTask.kind === 'browser' ? browserTask.url : undefined

  return { command, workdir, env, beforeLaunch: cfg.beforeLaunch, browserUrl }
}
EOF

# ============================================================
# src/mapper/java-app.ts
# ============================================================
cat > src/mapper/java-app.ts << 'EOF'
import type { IdeaConfig, LaunchSpec } from '../types.js'

// ⚠️ classpath 的构造依赖项目构建方式，首版为简化实现。
// Harness 应结合 Maven/Gradle 的 build 产物目录补全 classpath。
export function mapJavaApp(cfg: IdeaConfig, projectRoot: string): LaunchSpec {
  const workdir = cfg.workDir ?? projectRoot
  const env = { ...cfg.env }
  const vm = cfg.vmParams ?? ''
  const prog = cfg.programParams ?? ''
  const main = cfg.mainClass ?? ''
  const command = `java ${vm} -cp target/classes ${main} ${prog}`.trim()
  return { command, workdir, env, beforeLaunch: cfg.beforeLaunch }
}
EOF

# ============================================================
# src/mapper/npm.ts
# ============================================================
cat > src/mapper/npm.ts << 'EOF'
import { dirname } from 'node:path'
import type { IdeaConfig, LaunchSpec } from '../types.js'

export function mapNpm(cfg: IdeaConfig, projectRoot: string): LaunchSpec {
  const pkg = cfg.packageJson ?? `${projectRoot}/package.json`
  const workdir = dirname(pkg)
  const script = cfg.npmScript ?? 'dev'
  const command = `npm run ${script}`
  const browserTask = cfg.beforeLaunch.find((t) => t.kind === 'browser')
  const browserUrl = browserTask && browserTask.kind === 'browser' ? browserTask.url : undefined
  return { command, workdir, env: { ...cfg.env }, beforeLaunch: cfg.beforeLaunch, browserUrl }
}
EOF

# ============================================================
# src/mapper/index.ts
# ============================================================
cat > src/mapper/index.ts << 'EOF'
import type { IdeaConfig, LaunchSpec } from '../types.js'
import { mapSpringBoot } from './spring-boot.js'
import { mapJavaApp } from './java-app.js'
import { mapNpm } from './npm.js'

export function mapToLaunchSpec(cfg: IdeaConfig, projectRoot: string): LaunchSpec | null {
  switch (cfg.type) {
    case 'spring-boot': return mapSpringBoot(cfg, projectRoot)
    case 'java-app': return mapJavaApp(cfg, projectRoot)
    case 'npm': return mapNpm(cfg, projectRoot)
    default: return null  // compound / unsupported 不直接映射
  }
}
EOF

# ============================================================
# src/runtime/log-ring.ts
# ============================================================
cat > src/runtime/log-ring.ts << 'EOF'
export class LogRing {
  private chunks: string[] = []
  private size = 0
  constructor(private maxBytes = 2 * 1024 * 1024) {}

  append(text: string): void {
    this.chunks.push(text)
    this.size += Buffer.byteLength(text)
    while (this.size > this.maxBytes && this.chunks.length > 0) {
      const removed = this.chunks.shift()!
      this.size -= Buffer.byteLength(removed)
    }
  }

  snapshot(): string { return this.chunks.join('') }

  clear(): void { this.chunks = []; this.size = 0 }
}
EOF

# ============================================================
# src/runtime/events.ts
# ============================================================
cat > src/runtime/events.ts << 'EOF'
import type { RunInstance } from '../types.js'

export const EVT = {
  state: 'idea-launcher:state',
  logAppend: 'idea-launcher:log-append',
  logQuery: 'idea-launcher:log-query',
  instancesQuery: 'idea-launcher:instances-query',
} as const

export interface StatePayload { instance: RunInstance }
export interface LogAppendPayload { instanceId: string; sourceId: string; chunk: string }
export interface LogQueryPayload { instanceId: string; sourceId: string }
export interface LogQueryResult { baseline: string }
EOF

# ============================================================
# src/runtime/log-source.ts
# ============================================================
cat > src/runtime/log-source.ts << 'EOF'
import { LogRing } from './log-ring.js'

export class ProcessLogSource {
  readonly kind = 'process' as const
  readonly ring: LogRing
  constructor(public readonly stream: 'stdout' | 'stderr', maxBytes?: number) {
    this.ring = new LogRing(maxBytes)
  }
}

// ⚠️ 文件日志源需实现：
// - Ant 模式 → 实际文件路径（首版可用 fast-glob 近似，或用 minimatch 手动遍历）
// - skipContent=true 时只追新内容
// - 低频轮询（默认 1s）读取新增内容写入 ring
// - 需对照 dsh-shell / Node fs 能力确认是否可用 fs.watch
export class FileLogSource {
  readonly kind = 'file' as const
  readonly ring: LogRing
  constructor(
    public readonly tabName: string,
    public readonly pattern: string,
    public readonly skipContent: boolean,
    maxBytes?: number,
  ) {
    this.ring = new LogRing(maxBytes)
  }

  async startWatching(): Promise<void> {
    // TODO(harness): 实现文件监视，参考方案 6.1 节
  }

  async stopWatching(): Promise<void> {
    // TODO(harness)
  }
}
EOF

# ============================================================
# src/runtime/process.ts
# ============================================================
cat > src/runtime/process.ts << 'EOF'
import type { StopPhase } from '../types.js'

/**
 * ⚠️ 核心风险点，必须先跑通（方案第 3 步）。
 * 需对照真实 dsh-shell SDK 确认：
 *   1. ctx.shell.start 的真实签名与返回类型
 *   2. ShellProcess 是否暴露 pid
 *   3. kill() 是否可传 signal，还是只杀进程组
 *   4. readOutput() 的返回结构与 offset 语义
 *   5. 是否有 exited/done Promise 用于等待退出
 */
export class ProcessManager {
  constructor(private shell: any) {}

  async start(spec: { command: string; workdir: string; env: Record<string, string> }): Promise<any> {
    return this.shell.start({ command: spec.command, workdir: spec.workdir, env: spec.env })
  }

  /**
   * 两段式停止的第 1 段：尝试优雅终止。
   * 决策树：
   *   A. ShellProcess.kill 支持 signal 参数 → kill('SIGINT')
   *   B. ShellProcess 暴露 pid → 通过短命令 kill -INT <pid>（Unix）
   *   C. 均不可行 → 返回 false，上层降级为单段式
   */
  async softKill(proc: any): Promise<boolean> {
    if (typeof proc?.kill === 'function' && proc.kill.length >= 1) {
      try { await proc.kill('SIGINT'); return true } catch { /* fall through */ }
    }
    if (proc?.pid) {
      try {
        await this.shell.start({ command: `kill -INT ${proc.pid}`, workdir: '/', env: {} })
        return true
      } catch { /* fall through */ }
    }
    return false
  }

  async hardKill(proc: any): Promise<void> {
    await proc.kill()
  }

  async stop(proc: any, graceMs = 5000): Promise<StopPhase> {
    const softOk = await this.softKill(proc)
    if (softOk) {
      const exited = await Promise.race([
        waitExit(proc).then(() => true),
        sleep(graceMs).then(() => false),
      ])
      if (exited) return 'soft-killed'
    }
    await this.hardKill(proc)
    return 'hard-killed'
  }
}

function waitExit(proc: any): Promise<void> {
  return proc?.exited ?? proc?.done ?? Promise.resolve()
}
function sleep(ms: number) { return new Promise<void>((r) => setTimeout(r, ms)) }
EOF

# ============================================================
# src/runtime/instance.ts
# ============================================================
cat > src/runtime/instance.ts << 'EOF'
import type { RunInstance, IdeaConfig, RunState } from '../types.js'

// ⚠️ RunInstance 的完整生命周期需对照 SDK 补全：
// - 通过 ctx.shell.start 拿到的 ShellProcess 句柄存在哪里
// - 状态变更如何触发 idea-launcher:state 事件
// - ctx.effect 清理如何统一 stop 所有实例
export class InstanceRegistry {
  private instances = new Map<string, RunInstance>()

  create(cfg: IdeaConfig): RunInstance {
    const id = `${cfg.name}#${Date.now()}`
    const inst: RunInstance = {
      id,
      configName: cfg.name,
      configType: cfg.type,
      state: 'starting',
      stopPhase: 'none',
      startedAt: Date.now(),
      logSources: [],
    }
    this.instances.set(id, inst)
    return inst
  }

  updateState(id: string, state: RunState): void {
    const inst = this.instances.get(id)
    if (inst) inst.state = state
  }

  get(id: string): RunInstance | undefined { return this.instances.get(id) }
  list(): RunInstance[] { return [...this.instances.values()] }
  byConfigName(name: string): RunInstance[] {
    return this.list().filter((i) => i.configName === name)
  }
}
EOF

# ============================================================
# src/config/overlay.ts
# ============================================================
cat > src/config/overlay.ts << 'EOF'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'

export interface OverlayEntry {
  commandOverride?: string
  beforeLaunchOverride?: unknown[]
}

export type Overlay = Record<string, OverlayEntry>

export function overlayPath(projectRoot: string): string {
  return join(projectRoot, '.dsh', 'idea-launcher.json')
}

export async function readOverlay(projectRoot: string): Promise<Overlay> {
  try { return JSON.parse(await readFile(overlayPath(projectRoot), 'utf8')) } catch { return {} }
}

export async function writeOverlay(projectRoot: string, o: Overlay): Promise<void> {
  const p = overlayPath(projectRoot)
  await mkdir(dirname(p), { recursive: true })
  await writeFile(p, JSON.stringify(o, null, 2))
}
EOF

# ============================================================
# src/config/schema.ts
# ============================================================
cat > src/config/schema.ts << 'EOF'
// ⚠️ 需对照 dsh-plugin-dev 中 schemastery 的用法补全。
// 回退配置（无 IDEA 配置时使用）的字段：
//   name: string
//   type: 'java' | 'vue'
//   command: string
//   args?: string[]
//   cwd?: string
//   env?: Record<string, string>
export const fallbackSchemaPlaceholder = {}
EOF

# ============================================================
# src/compound-orchestrator.ts
# ============================================================
cat > src/compound-orchestrator.ts << 'EOF'
/**
 * ⚠️ Compound 编排需对照 SDK 补全。
 * 语义（方案 4.4 节）：
 *   1. 解析 referencedConfigs 列表
 *   2. 并行启动所有子配置
 *   3. 任一子实例 failed → 停止所有已启动子实例，Compound 标记 failed
 *   4. 全部 running → Compound running
 *   5. 停止 Compound → 对每个子实例执行两段式停止
 */
export async function runCompound(_refs: string[], _projectRoot: string): Promise<void> {
  throw new Error('TODO: implement compound orchestration')
}
EOF

# ============================================================
# src/index.ts (Host 入口)
# ============================================================
cat > src/index.ts << 'EOF'
// ⚠️ Host 入口，需对照真实 DSH SDK 补全 apply 签名与 ctx 类型。
// 主要职责：
//   1. 扫描三来源 → 解析配置 → 合并覆盖层
//   2. 提供 query 处理器：instances-query / log-query
//   3. 提供命令：start(configName) / stop(instanceId) / forceStop(instanceId) / rerun(instanceId)
//   4. 用 ctx.effect 注册清理：卸载时对所有活跃实例执行 stop
//   5. 通过 ctx.remote 推送 EVT.state / EVT.logAppend
//
// 实现参考骨架：
//
// import { scanSources } from './parser/scan.js'
// import { extractConfigs } from './parser/extract.js'
// import { mapToLaunchSpec } from './mapper/index.js'
// import { InstanceRegistry } from './runtime/instance.js'
// import { ProcessManager } from './runtime/process.js'
// import { EVT } from './runtime/events.js'
// import { readOverlay } from './config/overlay.js'
//
// export function apply(ctx: any, config: any) {
//   const registry = new InstanceRegistry()
//   const pm = new ProcessManager(ctx.shell)
//   // ... 注册 query/command
//   ctx.effect(() => () => { /* stop all instances */ })
// }

export function apply(_ctx: unknown, _config: unknown): void {
  // TODO(harness): 按注释补全
}
EOF

# ============================================================
# src/client.ts (Client 入口)
# ============================================================
cat > src/client.ts << 'EOF'
// ⚠️ Client 入口，需对照真实 @deepseek-ai/dsh-client-ui-slots 补全。
// 职责：
//   1. 向 conversation.session.header.actions 注册 LaunchControl（id: idea-launcher）
//   2. 向 shell.bottom 注册 RunPanel（id: idea-launcher-run-panel）
//   3. 通过 ctx.remote 订阅 EVT.state / EVT.logAppend，
//      通过 query 拉取 EVT.logQuery / EVT.instancesQuery 的 baseline
//
// 实现参考骨架：
//
// import { LaunchControl } from './ui/LaunchControl.js'
// import { RunPanel } from './ui/RunPanel.js'
//
// export const inject = ['slots', 'remote']
//
// export function apply(ctx: any) {
//   ctx.slots.inject('conversation.session.header.actions', () =>
//     ctx.slots.register(
//       { name: 'conversation.session.header.actions', id: 'idea-launcher', order: 100 },
//       LaunchControl,
//     )
//   )
//   ctx.slots.inject('shell.bottom', () =>
//     ctx.slots.register(
//       { name: 'shell.bottom', id: 'idea-launcher-run-panel' },
//       RunPanel,
//     )
//   )
// }

export function apply(_ctx: unknown): void {
  // TODO(harness): 按注释补全
}
EOF

# ============================================================
# src/ui/LaunchControl.tsx
# ============================================================
cat > src/ui/LaunchControl.tsx << 'EOF'
// ⚠️ 顶栏启动控件，需对照 SDK 的 PropsRuntime 与 slot 契约补全。
// 结构：
//   [配置下拉选择器] [启动/停止主按钮] [Rerun 图标按钮]
// 行为：
//   - 启动：调用 host start(configName)
//   - 停止（首次点击）：soft kill；再次点击：hard kill
//   - Rerun：仅 running 时可用；内部触发 host rerun(instanceId)
export function LaunchControl(): JSX.Element | null {
  return null
}

declare namespace JSX { interface Element {} }
EOF

# ============================================================
# src/ui/RunPanel.tsx
# ============================================================
cat > src/ui/RunPanel.tsx << 'EOF'
// ⚠️ 底部日志面板，需对照 SDK 的 shell.bottom 契约补全。
// 结构：
//   <TabBar />（配置标签页，Pin/Close）
//   <InstanceSelector />（同名多实例时显示）
//   <LogView />（当前 LogSource 的内容）
//   工具条：[吸底][暂停跟随][清空当前][全屏]
// 数据流：
//   - 挂载时 query EVT.instancesQuery 获取活跃实例列表
//   - 切换标签/实例时 query EVT.logQuery 拉 baseline
//   - 订阅 EVT.logAppend 增量追加
import { TabBar } from './TabBar.js'
import { InstanceSelector } from './InstanceSelector.js'
import { LogView } from './LogView.js'

export function RunPanel(): JSX.Element | null {
  return null
}

declare namespace JSX { interface Element {} }
EOF

# ============================================================
# src/ui/TabBar.tsx
# ============================================================
cat > src/ui/TabBar.tsx << 'EOF'
// 配置标签页栏：标题 = configName；每页支持 Pin / Close。
// Close 时如果仍有活跃实例，需要先触发 stop。
export function TabBar(): JSX.Element | null {
  return null
}

declare namespace JSX { interface Element {} }
EOF

# ============================================================
# src/ui/InstanceSelector.tsx
# ============================================================
cat > src/ui/InstanceSelector.tsx << 'EOF'
// 同名多实例切换器：当某个 configName 下有多个活跃 RunInstance 时显示。
// 每个选项展示：instanceId 短码 + 状态 + 启动时间。
export function InstanceSelector(): JSX.Element | null {
  return null
}

declare namespace JSX { interface Element {} }
EOF

# ============================================================
# src/ui/LogView.tsx
# ============================================================
cat > src/ui/LogView.tsx << 'EOF'
// 日志视图：
//   - 接收当前 LogSource 的 baseline + 增量文本
//   - 自动吸底；手动上滚时暂停跟随
//   - 工具条：[吸底][暂停跟随][清空当前][全屏]
export function LogView(): JSX.Element | null {
  return null
}

declare namespace JSX { interface Element {} }
EOF

# ============================================================
# test/fixtures/.gitkeep
# ============================================================
touch test/fixtures/.gitkeep

# ============================================================
# README
# ============================================================
cat > README.md << 'EOF'
# dsh-idea-launcher

读取 IDEA 运行配置，在 DSH 内启动 Java/Vue 项目并查看日志。

## 下一步（必须按顺序）

1. **加载 `dsh-plugin-dev` 技能**
   ```bash
   git clone https://github.com/wula1223/dsh-plugin-dev.git ~/.dsh/skills/dsh-plugin-dev