// 进程驱动：唯一接缝是 ctx.subprocess.spawnTerminal（真 PTY）。
// 为什么不用 ctx.shell：ShellProcess 只有 kill()，没有 pid、不能发信号，
// 两段式停止（SIGINT 优雅停 → 宽限期 → terminate）在该接缝上无法实现。
// 依据：cordis_inspect_query host Service "shell" / "subprocess" 的契约。
export type TerminalSignal = 'SIGINT' | 'SIGTERM' | 'SIGKILL' | 'SIGTSTP' | 'SIGHUP'

export interface ProcessExit {
  exitCode: number | null
  signal: string | null
}

export interface TerminalHandleLike {
  readonly pid: number
  readonly output: NodeJS.ReadableStream
  readonly done: Promise<ProcessExit>
  signalForeground(signal: TerminalSignal): Promise<number>
  terminate(): Promise<void>
  write(data: string): Promise<void>
  /** provider 可选的观测能力，用于诊断「前台进程组是否可见」 */
  inspectForeground?(): Promise<{ processGroupId: number; inputWaiting: boolean } | undefined>
  inspectActivity?(): Promise<{ state: 'idle' | 'busy' | 'unknown'; revision: number }>
}

export interface SubprocessLike {
  terminalEnvironment(signal?: AbortSignal): Promise<{ platform: 'posix' | 'windows'; defaultShell?: string }>
  /** 把裸命令名（mvn / npm / node）解析成绝对路径；provider 不做 PATH 查找 */
  resolveExecutable?(command: string, env?: Readonly<Record<string, string>>, signal?: AbortSignal): Promise<string>
  spawnTerminal(spec: {
    argv: readonly string[]
    cwd: string
    env?: Record<string, string>
    rows: number
    cols: number
    terminalType: string
    graceMs: number
    /** 让 provider 按"交互式 shell"管理终端（前台组/信号语义相关） */
    shellActivity?: boolean
    signal?: AbortSignal
  }): Promise<TerminalHandleLike>
}

export interface StartOptions {
  /** IDEA 配置里那条命令；统一交给平台 shell 执行（与 IDEA 行为一致） */
  command?: string
  /** 直接 argv（不经 shell）；给定时优先于 command，避免引号/转义差异 */
  argv?: readonly string[]
  cwd: string
  env?: Record<string, string>
  /** 子进程输出（PTY 是合并流），已按 UTF-8 解码 */
  onData: (chunk: string) => void
  /** 进程退出事实；只回调一次 */
  onExit: (exit: ProcessExit) => void
  /** 交给 provider 的 shellActivity 标记；诊断信号语义时用 */
  shellActivity?: boolean
}

/**
 * 构造终端 argv。纯函数，便于单测：
 *   windows → cmd.exe /d /s /c "<command>"（/d 关 AutoRun，/s 保留整体引号语义）
 *   posix   → <shell> -c "<command>"
 */
export function buildTerminalArgv(
  platform: 'posix' | 'windows',
  shell: string | undefined,
  command: string,
): string[] {
  if (platform === 'windows') {
    return [shell ?? 'cmd.exe', '/d', '/s', '/c', command]
  }
  return [shell ?? '/bin/bash', '-c', command]
}

export class ProcessDriver {
  private exit: ProcessExit | undefined
  private terminated = false
  private readonly handle: TerminalHandleLike
  private readonly exited: Promise<ProcessExit>

  // 不用 TS 参数属性：Node 的类型剥离只支持"擦除"，参数属性是语法级改写，node --test 会直接拒绝
  private constructor(handle: TerminalHandleLike, exited: Promise<ProcessExit>) {
    this.handle = handle
    this.exited = exited
  }

  static async start(subprocess: SubprocessLike, options: StartOptions): Promise<ProcessDriver> {
    // 1. argv 优先：直接 argv 不经 shell，避免 Windows 引号/转义差异；否则交给平台 shell
    let argv: string[]
    if (options.argv && options.argv.length > 0) {
      argv = [...options.argv]
    } else {
      const environment = await subprocess.terminalEnvironment()
      argv = buildTerminalArgv(environment.platform, environment.defaultShell, options.command ?? '')
    }
    if (argv.length === 0) throw new Error('start 需要 command 或非空 argv')

    // 2. 可执行文件解析：provider 的 spawnTerminal 要求可执行的绝对路径（不做 PATH 查找），
    //    所以裸命令名必须先 resolveExecutable，否则会得到 "File not found"
    const env = { ...cleanEnv(process.env), ...options.env }
    // PTY 就是终端：补一个 TERM，让 Maven / Spring Boot 的 ANSI 检测走"支持颜色"分支
    if (!env.TERM) env.TERM = 'xterm-256color'
    if (subprocess.resolveExecutable && !isAbsoluteCommand(argv[0])) {
      argv[0] = await subprocess.resolveExecutable(argv[0], env)
    }

    // 3. 起真终端：继承宿主环境变量 + 配置里的 env（后者覆盖前者）
    const handle = await subprocess.spawnTerminal({
      argv,
      cwd: options.cwd,
      env,
      rows: 40,
      cols: 120,
      terminalType: 'xterm-256color',
      graceMs: 3000,
      shellActivity: options.shellActivity,
    })

    const driver = new ProcessDriver(handle, handle.done)

    // 3. 输出：PTY 合并流，不做 stdout/stderr 区分
    handle.output.on('data', (chunk: Buffer | string) => {
      options.onData(typeof chunk === 'string' ? chunk : chunk.toString('utf8'))
    })

    // 4. 退出事实只回调一次，同时记到 driver 供状态机读取
    void handle.done.then((exit) => {
      driver.exit = exit
      options.onExit(exit)
    })

    return driver
  }

  get pid(): number {
    return this.handle.pid
  }

  /**
   * 两段式停止第 1 段：向前台进程组投递 SIGINT。
   * 先探测前台组是否可见：Windows 上的 PTY provider 实测 inspectForeground() 返回 processGroupId=0
   * （拿不到前台组，也拿不到 pid），此时投递是空操作，直接返回 false 让上层降级为强杀，
   * 而不是假装发了信号、再白等一个宽限期。
   */
  async softStop(): Promise<boolean> {
    if (this.exit) return true
    if (!(await this.canSignalForeground())) return false
    try {
      await this.handle.signalForeground('SIGINT')
      return true
    } catch {
      return false
    }
  }

  /** 前台进程组是否可定位（能定位才谈得上发信号）。 */
  async canSignalForeground(): Promise<boolean> {
    if (!this.handle.inspectForeground) return false
    try {
      const foreground = await this.handle.inspectForeground()
      return Boolean(foreground && foreground.processGroupId > 0)
    } catch {
      return false
    }
  }

  /** 两段式停止第 2 段：terminate（幂等）。 */
  async hardStop(): Promise<void> {
    if (this.exit || this.terminated) return
    this.terminated = true
    await this.handle.terminate()
  }

  /** 等进程退出；超时返回 false 而不抛错（停止流程需要区分「退了」和「没退」）。 */
  async waitExit(timeoutMs: number): Promise<boolean> {
    if (this.exit) return true
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<boolean>((resolve) => {
      timer = setTimeout(() => resolve(false), timeoutMs)
    })
    try {
      return await Promise.race([this.exited.then(() => true), timeout])
    } finally {
      if (timer) clearTimeout(timer)
    }
  }

  /** 已记录的退出事实（未退出时为 undefined）。 */
  outcome(): ProcessExit | undefined {
    return this.exit
  }

  async write(text: string): Promise<void> {
    await this.handle.write(text)
  }

  /** 诊断用：provider 视角下的前台进程组与活动状态 */
  async inspect(): Promise<{
    foreground?: { processGroupId: number; inputWaiting: boolean }
    activity?: { state: 'idle' | 'busy' | 'unknown'; revision: number }
  }> {
    const foreground = this.handle.inspectForeground ? await this.handle.inspectForeground() : undefined
    const activity = this.handle.inspectActivity ? await this.handle.inspectActivity() : undefined
    return { foreground, activity }
  }
}

function cleanEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string') out[key] = value
  }
  return out
}

/** 绝对路径判断（Windows 盘符 / UNC / POSIX 根），用来决定是否需要 resolveExecutable。 */
function isAbsoluteCommand(command: string | undefined): boolean {
  if (!command) return false
  return /^[a-zA-Z]:[\\/]/.test(command) || command.startsWith('\\\\') || command.startsWith('/')
}
