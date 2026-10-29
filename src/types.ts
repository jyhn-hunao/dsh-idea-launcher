// 共享类型：解析层的输入/输出契约。
// 设计原则：解析阶段只做「可证明的映射」，无法证明的一律留成显式诊断，不猜字段。
export type ConfigType = 'spring-boot' | 'java-app' | 'npm' | 'compound' | 'unsupported'

/** shared = runConfigurations/ 或 .run/（随仓库共享）；local = .idea/workspace.xml（本机） */
export type ConfigOrigin = 'shared' | 'local'

/**
 * Before Launch 任务。三种已实证（依据在各自字段注释里）：
 *   build      ← <option name="Make">                       （grape / ydcy 真实工程样本）
 *   run-config ← <option name="RunConfigurationTask">       （IntelliJ 源码 RunConfigurationBeforeRunProvider）
 *   browser    ← <option name="LaunchBrowser.Before.Run">   （IDEA 2025.1.1.1 类常量 + BaseState 属性）
 * 其余 option 保持 unsupported 并保留原始属性，不按名字猜语义。
 */
export type BeforeLaunchTask =
  | { kind: 'build'; option: string; command?: string }
  | { kind: 'run-config'; option: string; configName: string; configType?: string; target?: string }
  | { kind: 'browser'; option: string; url: string; browser?: string; withDebugger?: boolean }
  | { kind: 'unsupported'; option: string; attrs: Record<string, string> }

export type DiagnosticCode =
  | 'parse-error'
  | 'unknown-variable'
  | 'module-unresolved'
  | 'module-ambiguous'
  | 'before-launch-unrecognized'
  | 'before-launch-malformed'
  | 'compound-missing-ref'
  | 'compound-cycle'
  | 'duplicate-config'
  | 'command-assumption'
  | 'overlay-invalid'

export interface Diagnostic {
  level: 'error' | 'warn'
  code: DiagnosticCode
  message: string
  /** 关联对象：配置名 / 变量名 / 模块名，便于定位 */
  ref?: string
}

export interface IdeaConfig {
  name: string
  type: ConfigType
  origin: ConfigOrigin
  /** 配置所在文件，便于回溯（.run/*.run.xml 或 .idea/workspace.xml） */
  source?: string
  factoryName?: string
  /** <module name="..."/> 声明的模块名 */
  moduleName?: string
  /** 模块名解析出的模块根；未解析出时不填，并在 diagnostics 里说明原因 */
  moduleRoot?: string
  mainClass?: string
  vmParams?: string
  programParams?: string
  workDir: string
  env: Record<string, string>
  packageJson?: string
  npmCommand?: string
  npmScript?: string
  nodeInterpreter?: string
  /** Compound 配置引用的配置名（按声明顺序） */
  referencedConfigs?: string[]
  beforeLaunch: BeforeLaunchTask[]
  diagnostics: Diagnostic[]
}

/** Compound 展开结果：叶子配置按「先按引用顺序、同名去重」排列 */
export interface CompoundPlan {
  leaves: IdeaConfig[]
  diagnostics: Diagnostic[]
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
  /** PTY 子进程 pid（subprocess.spawnTerminal 返回）；未起来时为 undefined */
  pid?: number
  exitCode?: number
  signal?: string
  killedBySignal?: boolean
  logSources: LogSourceMeta[]
}

/**
 * 一条启动计划：由「解析出的 IdeaConfig + 工程事实」推出，交给进程层执行。
 * argv 与 command 二选一：argv 优先（不经 shell，避免引号问题）；command 走平台 shell（覆盖层手写命令用）。
 */
export interface LaunchPlan {
  argv?: string[]
  command?: string
  cwd: string
  env: Record<string, string>
  /** 人类可读命令，UI 展示与覆盖层编辑用 */
  display: string
  /** high=由工程事实直接推出；low=含假设（如模块未解析、classpath 近似） */
  confidence: 'high' | 'low'
  beforeLaunch: BeforeLaunchTask[]
  browserUrl?: string
  diagnostics: Diagnostic[]
  /** 快速启动所需信息（spring-boot 且模块根/主类都解析出来时提供）；Host 可据此跳过 Maven */
  fastJava?: { moduleRoot: string; mainClass: string; vmParams?: string; programParams?: string }
  /** 展示用：预计走 maven（argv）还是直接 java（fastJava）；Host 失败会回退 maven */
  launchMode?: 'maven' | 'java'
}
