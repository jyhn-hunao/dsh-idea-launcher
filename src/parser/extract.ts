// 解析层编排：扫描 → 抽节点 → 逐字段解析（含变量/模块/诊断）→ 按来源合并。
// 一条硬约束：解析结果必须自带 diagnostics，UI/映射层才知道哪些字段是「解析不出来」而不是「本来就没有」。
import { XMLParser } from 'fast-xml-parser'
import type { ConfigOrigin, ConfigType, Diagnostic, IdeaConfig } from '../types.ts'
import { extractBeforeLaunch } from './before-launch.ts'
import { extractCompoundRefs } from './compound.ts'
import { loadModuleMap, resolveModuleRoot, type ModuleResolution } from './modules.ts'
import { loadMavenModules } from './maven-modules.ts'
import { scanSources, type SourceSelector } from './scan.ts'
import { substituteVars, type VarContext } from './vars.ts'

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) =>
    name === 'configuration' ||
    name === 'option' ||
    name === 'env' ||
    name === 'toRun' ||
    name === 'method',
})

const TYPE_MAP: Record<string, ConfigType> = {
  SpringBootApplicationConfigurationType: 'spring-boot',
  Application: 'java-app',
  'js.build_tools.npm': 'npm',
  CompoundRunConfigurationType: 'compound',
}

export interface ExtractContext {
  projectRoot: string
  userHome?: string
  /** 模块名 → 模块根（来自 .idea/modules.xml + iml） */
  moduleMap: Map<string, string>
  /** 模块名 → 解析结果缓存：同一模块被多个配置引用时只扫一次目录 */
  moduleCache: Map<string, ModuleResolution>
  /** Maven 模块表（根 pom 的 modules 声明）：artifactId / 目录名 / 相对路径 → 模块根 */
  mavenMap: Map<string, string>
}

export interface ExtractResult {
  configs: IdeaConfig[]
  diagnostics: Diagnostic[]
}

export interface SourceMeta {
  origin: ConfigOrigin
  selector: SourceSelector
  /** 配置所在文件，便于回溯 */
  path?: string
}

/** 解析单份 XML（.run.xml / runConfigurations/*.xml / workspace.xml 的 RunManager 子树）。 */
export async function extractConfigs(
  xml: string,
  source: SourceMeta,
  ctx: ExtractContext,
): Promise<ExtractResult> {
  const diagnostics: Diagnostic[] = []

  // 1. 解析 XML：解析失败只报诊断，不抛出（单文件坏掉不应拖垮整个配置列表）
  let doc: unknown
  try {
    doc = parser.parse(xml)
  } catch (error) {
    diagnostics.push({
      level: 'error',
      code: 'parse-error',
      ref: source.path,
      message: `XML 解析失败：${error instanceof Error ? error.message : String(error)}`,
    })
    return { configs: [], diagnostics }
  }

  // 2. 取 <configuration> 节点：workspace.xml 只能从 RunManager 子树取
  const nodes = pickConfigNodes(doc, source.selector)

  // 3. 逐个配置解析（模块解析需要 fs 访问，所以是异步）
  const configs: IdeaConfig[] = []
  for (const node of nodes) {
    const config = await extractOne(node, source, ctx)
    if (!config) continue
    configs.push(config)
    diagnostics.push(...config.diagnostics)
  }

  return { configs, diagnostics }
}

/** 读取一个项目目录下的全部 IDEA 运行配置，并按来源合并（shared 优先于 local）。 */
export async function loadIdeaConfigs(
  projectRoot: string,
  options: { userHome?: string } = {},
): Promise<ExtractResult> {
  const diagnostics: Diagnostic[] = []

  // 1. 先建立模块映射：后续每个配置的 $MODULE_DIR$ 与工作目录都依赖它
  const moduleMap = await loadModuleMap(projectRoot, options.userHome)
  diagnostics.push(...moduleMap.diagnostics)

  // Maven 模块表：比同名目录可靠，mlw 这种同名目录多处出现时必须靠它
  const mavenModules = await loadMavenModules(projectRoot)
  diagnostics.push(...mavenModules.diagnostics)

  // 2. 扫描三来源
  const sources = await scanSources(projectRoot)
  const ctx: ExtractContext = {
    projectRoot,
    userHome: options.userHome,
    moduleMap: moduleMap.roots,
    moduleCache: new Map(),
    mavenMap: mavenModules.byKey,
  }

  // 3. 逐个来源解析并收集
  const collected: IdeaConfig[] = []
  for (const source of sources) {
    const result = await extractConfigs(source.content, source, ctx)
    collected.push(...result.configs)
    diagnostics.push(...result.diagnostics)
  }

  // 4. 合并：同名配置 shared 优先；local 重名只留一条并告警（IDEA 也是共享配置优先）
  const merged = new Map<string, IdeaConfig>()
  for (const config of collected) {
    const existing = merged.get(config.name)
    if (!existing) {
      merged.set(config.name, config)
      continue
    }
    const winner = pickOriginWinner(existing, config)
    const loser = winner === existing ? config : existing
    merged.set(config.name, winner)
    diagnostics.push({
      level: 'warn',
      code: 'duplicate-config',
      ref: config.name,
      message: `配置重名："${config.name}" 同时出现在 ${existing.source ?? existing.origin} 与 ${config.source ?? config.origin}，已采用 ${winner.origin}，忽略 ${loser.origin}`,
    })
  }

  return { configs: [...merged.values()], diagnostics }
}

async function extractOne(node: any, source: SourceMeta, ctx: ExtractContext): Promise<IdeaConfig | null> {
  const name = node?.['@_name']
  if (typeof name !== 'string' || name.length === 0) return null

  // 1. 模块 → 模块根（解析不出来时留空并在诊断里说明，绝不拿项目根冒充）
  const diagnostics: Diagnostic[] = []
  const module = await resolveModuleOf(node, name, ctx, diagnostics)

  // 2. 变量上下文：模块根参与 $MODULE_DIR$
  const varContext: VarContext = { projectRoot: ctx.projectRoot, moduleRoot: module.root, userHome: ctx.userHome }

  // 3. 公共字段（含工作目录与 env）
  const config = buildBaseConfig(node, name, source, module, varContext, diagnostics)

  // 4. Before Launch 任务序列
  const beforeLaunch = extractBeforeLaunch(node, name)
  config.beforeLaunch = beforeLaunch.tasks
  diagnostics.push(...beforeLaunch.diagnostics)

  // 5. 按类型补字段
  return applyTypeFields(node, config, varContext, diagnostics)
}

interface ModuleOfConfig {
  name?: string
  root?: string
}

/** 解析 <module name="..."/>：权威来源 modules.xml，退化来源同名目录（唯一命中才用）。 */
async function resolveModuleOf(
  node: any,
  configName: string,
  ctx: ExtractContext,
  diagnostics: Diagnostic[],
): Promise<ModuleOfConfig> {
  const moduleName = toArray(node?.module)[0]?.['@_name']
  if (typeof moduleName !== 'string' || moduleName.length === 0) return {}

  // 1. 同一模块可能被多个配置引用，解析结果按模块名缓存，避免重复扫目录
  let resolution = ctx.moduleCache.get(moduleName)
  if (!resolution) {
    resolution = await resolveModuleRoot(moduleName, ctx.projectRoot, ctx.moduleMap, ctx.mavenMap)
    ctx.moduleCache.set(moduleName, resolution)
  }

  // 2. 按解析结果给出分级诊断：目录退化=warn，歧义/未找到=error
  if (resolution.root) {
    if (resolution.reason === 'dir-match') {
      diagnostics.push({
        level: 'warn',
        code: 'module-unresolved',
        ref: configName,
        message: `模块 "${moduleName}" 未在 .idea/modules.xml 中声明，已按项目内同名目录解析为 ${resolution.root}`,
      })
    }
    return { name: moduleName, root: resolution.root }
  }

  if (resolution.reason === 'ambiguous') {
    diagnostics.push({
      level: 'error',
      code: 'module-ambiguous',
      ref: configName,
      message: `模块 "${moduleName}" 在项目内匹配到多个目录：${(resolution.candidates ?? []).join('、')}`,
    })
    return { name: moduleName }
  }

  diagnostics.push({
    level: 'error',
    code: 'module-unresolved',
    ref: configName,
    message: `模块 "${moduleName}" 在 .idea/modules.xml 与项目目录中都找不到，工作目录将退回项目根`,
  })
  return { name: moduleName }
}

/** 公共字段：身份、来源、模块、工作目录、env。 */
function buildBaseConfig(
  node: any,
  name: string,
  source: SourceMeta,
  module: ModuleOfConfig,
  varContext: VarContext,
  diagnostics: Diagnostic[],
): IdeaConfig {
  // IDEA 默认工作目录是项目根；$PROJECT_DIR$ 缺省时由这里补
  const workDirRaw = getOpt(node, 'WORKING_DIRECTORY') ?? '$PROJECT_DIR$'

  return {
    name,
    type: TYPE_MAP[node?.['@_type']] ?? 'unsupported',
    origin: source.origin,
    source: source.path,
    factoryName: node?.['@_factoryName'],
    moduleName: module.name,
    moduleRoot: module.root,
    workDir: applyVars(workDirRaw, varContext, name, 'WORKING_DIRECTORY', diagnostics),
    env: getEnvs(node),
    beforeLaunch: [],
    diagnostics,
  }
}

/** 按配置类型补专有字段（Spring Boot / Java / npm / Compound）。 */
function applyTypeFields(
  node: any,
  config: IdeaConfig,
  varContext: VarContext,
  diagnostics: Diagnostic[],
): IdeaConfig {
  switch (config.type) {
    case 'spring-boot':
    case 'java-app': {
      config.mainClass =
        getOpt(node, config.type === 'spring-boot' ? 'SPRING_BOOT_MAIN_CLASS' : 'MAIN_CLASS_NAME') ??
        getOpt(node, 'MAIN_CLASS_NAME')
      config.vmParams = getOpt(node, 'VM_PARAMETERS')
      config.programParams = getOpt(node, 'PROGRAM_PARAMETERS')
      return config
    }
    case 'npm': {
      const packageJsonRaw = valueOf(node?.['package-json']) ?? '$PROJECT_DIR$/package.json'
      config.packageJson = applyVars(packageJsonRaw, varContext, config.name, 'package-json', diagnostics)
      config.npmCommand = valueOf(node?.command)
      config.npmScript = valueOf(node?.scripts?.script)
      const interpreterRaw = valueOf(node?.['node-interpreter'])
      if (interpreterRaw) {
        config.nodeInterpreter = applyVars(interpreterRaw, varContext, config.name, 'node-interpreter', diagnostics)
      }
      return config
    }
    case 'compound': {
      const refs = extractCompoundRefs(node, config.name)
      config.referencedConfigs = refs.names
      diagnostics.push(...refs.diagnostics)
      return config
    }
    default:
      return config
  }
}

function pickOriginWinner(a: IdeaConfig, b: IdeaConfig): IdeaConfig {
  if (a.origin === b.origin) return a
  return a.origin === 'shared' ? a : b
}

function pickConfigNodes(doc: unknown, selector: SourceSelector): any[] {
  // 根节点有两种：.run 文件是 <component ...>，workspace.xml 是 <project><component .../></project>
  const root = (doc as any) ?? {}
  const components = toArray(root.component ?? root.project?.component)

  // 1. workspace.xml：只认 RunManager 组件，其它 component 下的 configuration 一律不碰
  const wanted = selector === 'run-manager' ? 'RunManager' : 'ProjectRunConfigurationManager'
  const fromWanted = components.filter((c: any) => c?.['@_name'] === wanted).flatMap((c: any) => toArray(c?.configuration))
  if (fromWanted.length > 0) return fromWanted

  // 2. 兜底：导出文件组件名可能不同，此时接受所有组件下的 configuration，
  //    但仅限 selector=root（独立 .run 文件里没有其它杂物）
  if (selector === 'root') return components.flatMap((c: any) => toArray(c?.configuration))

  return []
}

/** 变量替换 + 把未知变量转成配置级诊断（保留原文，便于用户看到真实值）。 */
function applyVars(
  raw: string,
  varContext: VarContext,
  configName: string,
  field: string,
  diagnostics: Diagnostic[],
): string {
  const { text, unknown } = substituteVars(raw, varContext)
  for (const variable of unknown) {
    diagnostics.push({
      level: 'warn',
      code: 'unknown-variable',
      ref: configName,
      message: `${field} 中的 $${variable}$ 无法解析，已保留原文："${raw}"`,
    })
  }
  return text
}

/** option[name] 的 value；同名多个时取第一个。 */
function getOpt(node: any, name: string): string | undefined {
  const options = toArray(node?.option)
  const hit = options.find((o: any) => o?.['@_name'] === name)
  const value = hit?.['@_value']
  return typeof value === 'string' ? value : undefined
}

function getEnvs(node: any): Record<string, string> {
  const out: Record<string, string> = {}
  for (const env of toArray(node?.envs?.env)) {
    const key = env?.['@_name']
    if (typeof key === 'string' && key.length > 0) out[key] = env?.['@_value'] ?? ''
  }
  return out
}

/** 取形如 <tag value="x" /> 的节点的 value；兼容单对象与数组两种解析结果。 */
function valueOf(node: any): string | undefined {
  const first = Array.isArray(node) ? node[0] : node
  const value = first?.['@_value']
  return typeof value === 'string' ? value : undefined
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) return []
  return Array.isArray(value) ? value : [value]
}
