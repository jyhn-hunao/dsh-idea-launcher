// Before Launch 任务解析。
// 真实形状（RunManagerImpl 实际写出的结构，IDEA 2025.1.1.1 反编译 + IntelliJ 源码核对）：
//   <method v="2">
//     <option name="<BeforeRunTaskProvider 的 Key>" enabled="true" ...任务自己的属性 />
//   </method>
// 已实证的三个 option 名与属性：
//   Make                      —— grape / ydcy 两份真实工程样本
//   RunConfigurationTask      —— IntelliJ 源码 RunConfigurationBeforeRunProvider：
//                                属性 run_configuration_name / run_configuration_type / run_configuration_target
//   LaunchBrowser.Before.Run  —— IDEA 2025.1.1.1 中 Key.create("LaunchBrowser.Before.Run")，
//                                state 属性 url / browser / withDebugger
// 未实证的 option 一律 unsupported 并保留原始属性；识别到但缺必填属性的落 malformed 诊断。
import type { BeforeLaunchTask, Diagnostic } from '../types.ts'

export interface BeforeLaunchResult {
  tasks: BeforeLaunchTask[]
  diagnostics: Diagnostic[]
}

const OPTION_BUILD = 'Make'
const OPTION_RUN_CONFIG = 'RunConfigurationTask'
const OPTION_BROWSER = 'LaunchBrowser.Before.Run'

export function extractBeforeLaunch(node: any, configName: string): BeforeLaunchResult {
  const tasks: BeforeLaunchTask[] = []
  const diagnostics: Diagnostic[] = []

  // 1. 收集 <method> 节点（可能单个，也可能多个；空 method 表示没有 Before Launch 任务）
  for (const method of toArray(node?.method)) {
    const options = toArray(method?.option)

    // 2. 没有子 option 的 method 是合法的「空任务」；老式 method 自带 name 属于未识别形状
    if (options.length === 0) {
      const legacyName = method?.['@_name']
      if (typeof legacyName === 'string' && legacyName.length > 0) {
        diagnostics.push(unrecognized(configName, legacyName, method))
        tasks.push({ kind: 'unsupported', option: legacyName, attrs: stripCommon(method) })
      }
      continue
    }

    // 3. 逐个 option 判定：enabled=false 的任务 IDEA 不执行，跳过且不告警
    for (const option of options) {
      const optionName = option?.['@_name']
      if (typeof optionName !== 'string' || optionName.length === 0) continue
      if (option?.['@_enabled'] === 'false') continue

      const parsed = parseOption(optionName, option, configName)
      if (parsed.task) tasks.push(parsed.task)
      if (parsed.diagnostic) diagnostics.push(parsed.diagnostic)
    }
  }

  return { tasks, diagnostics }
}

interface ParsedOption {
  task?: BeforeLaunchTask
  diagnostic?: Diagnostic
}

function parseOption(optionName: string, option: any, configName: string): ParsedOption {
  // 1. Make：构建任务（命令由映射层按项目构建方式补，解析层不猜）
  if (optionName === OPTION_BUILD) {
    return { task: { kind: 'build', option: optionName } }
  }

  // 2. RunConfigurationTask：先启动另一个配置。缺 name 就没有可执行目标，落 malformed
  if (optionName === OPTION_RUN_CONFIG) {
    const configName2 = attr(option, 'run_configuration_name')
    if (!configName2) {
      return { diagnostic: malformed(configName, optionName, 'run_configuration_name', option) }
    }
    return {
      task: {
        kind: 'run-config',
        option: optionName,
        configName: configName2,
        configType: attr(option, 'run_configuration_type'),
        target: attr(option, 'run_configuration_target'),
      },
    }
  }

  // 3. LaunchBrowser.Before.Run：主进程起来后开浏览器。缺 url 就没有可打开的地址，落 malformed
  if (optionName === OPTION_BROWSER) {
    const url = attr(option, 'url')
    if (!url) {
      return { diagnostic: malformed(configName, optionName, 'url', option) }
    }
    return {
      task: {
        kind: 'browser',
        option: optionName,
        url,
        browser: attr(option, 'browser'),
        withDebugger: attr(option, 'withDebugger') === 'true',
      },
    }
  }

  // 4. 其余：不认识就原样保留，等真实样本再补
  return {
    task: { kind: 'unsupported', option: optionName, attrs: stripCommon(option) },
    diagnostic: unrecognized(configName, optionName, option),
  }
}

function attr(node: any, name: string): string | undefined {
  const value = node?.[`@_${name}`]
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function unrecognized(configName: string, optionName: string, node: any): Diagnostic {
  const attrs = stripCommon(node)
  const shape = Object.keys(attrs).length > 0 ? JSON.stringify(attrs) : '（无额外属性）'
  return {
    level: 'warn',
    code: 'before-launch-unrecognized',
    ref: configName,
    message: `未识别的 Before Launch 任务 "${optionName}"，已保留原始属性：${shape}；首版不会执行它`,
  }
}

function malformed(configName: string, optionName: string, missing: string, node: any): Diagnostic {
  return {
    level: 'warn',
    code: 'before-launch-malformed',
    ref: configName,
    message: `已知任务 "${optionName}" 缺少必需属性 ${missing}，已跳过；原始属性：${JSON.stringify(stripCommon(node))}`,
  }
}

/** 原样保留属性（含 @_ 前缀），只去掉已经单独建模的 name/enabled，便于回报真实形状。 */
function stripCommon(node: any): Record<string, string> {
  const out: Record<string, string> = {}
  if (!node || typeof node !== 'object') return out
  for (const [key, value] of Object.entries(node)) {
    if (key === '@_name' || key === '@_enabled') continue
    if (typeof value === 'string') out[key] = value
  }
  return out
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return []
  return Array.isArray(value) ? value : [value]
}
