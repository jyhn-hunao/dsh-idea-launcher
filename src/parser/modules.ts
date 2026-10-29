// 模块名 → 模块根解析。
// 数据来源（按可信度）：
//   1. .idea/modules.xml 列出的 iml 文件，读 iml 里的 content url（权威，IDEA 自己写的）；
//   2. 项目内以模块名命名的目录（深度 ≤3、唯一命中才采用）——仅用于 modules.xml 缺失/过期的情况，
//      采用时一定产出 warn 诊断，不静默。
// 解析不出来就返回原因，由上层写 error 诊断；不用项目根顶替冒充模块根。
import { readdir, readFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import type { Diagnostic } from '../types.ts'
import { substituteVars } from './vars.ts'

export interface ModuleMap {
  /** 模块名 → 模块根绝对路径 */
  roots: Map<string, string>
  diagnostics: Diagnostic[]
}

export type ModuleResolveReason = 'modules-xml' | 'maven-modules' | 'dir-match' | 'not-found' | 'ambiguous'

export interface ModuleResolution {
  root?: string
  reason: ModuleResolveReason
  /** ambiguous 时给出候选，便于定位 */
  candidates?: string[]
}

/** 读 .idea/modules.xml + 各 iml，建立 模块名 → 模块根 的映射。 */
export async function loadModuleMap(projectRoot: string, userHome?: string): Promise<ModuleMap> {
  const diagnostics: Diagnostic[] = []
  const roots = new Map<string, string>()

  // 1. 读 modules.xml；不存在是合法情况（不是所有工程都提交它），不报错
  const modulesXmlPath = join(projectRoot, '.idea', 'modules.xml')
  let xml: string
  try {
    xml = await readFile(modulesXmlPath, 'utf8')
  } catch {
    return { roots, diagnostics }
  }

  // 2. 从 XML 里取每个 <module filepath="..."/>，文件名即模块名（IntelliJ 约定）
  const filepaths = [...xml.matchAll(/<module[^>]*\bfilepath="([^"]+)"[^>]*\/?>/g)].map((m) => m[1])

  for (const raw of filepaths) {
    const substituted = substituteVars(raw, { projectRoot, userHome })
    const imlPath = substituted.text
    const name = basename(imlPath).replace(/\.iml$/i, '')

    // 3. 读 iml 的 content url，得到模块根（$MODULE_DIR$ 指 iml 所在目录）
    let iml: string
    try {
      iml = await readFile(imlPath, 'utf8')
    } catch {
      diagnostics.push({
        level: 'warn',
        code: 'module-unresolved',
        ref: name,
        message: `modules.xml 声明的 iml 读不到：${imlPath}`,
      })
      continue
    }

    const contentUrl = [...iml.matchAll(/<content[^>]*\burl="([^"]+)"/g)].map((m) => m[1])[0]
    if (!contentUrl) {
      diagnostics.push({
        level: 'warn',
        code: 'module-unresolved',
        ref: name,
        message: `iml 没有 content url，模块根未知：${imlPath}`,
      })
      continue
    }

    const moduleDir = dirname(imlPath)
    const moduleRoot = substituteVars(contentUrl.replace(/^file:\/\//, ''), {
      projectRoot,
      moduleRoot: moduleDir,
      userHome,
    }).text

    roots.set(name, moduleRoot)
  }

  return { roots, diagnostics }
}

/** 解析单个模块名；modules.xml 没有时退化为「项目内同名目录」并给 warn。 */
export async function resolveModuleRoot(
  moduleName: string,
  projectRoot: string,
  known: Map<string, string>,
  maven?: Map<string, string>,
): Promise<ModuleResolution> {
  // 1. .idea/modules.xml + iml 的 content root（IDE 自己写的，最靠前）
  const exact = known.get(moduleName)
  if (exact) return { root: exact, reason: 'modules-xml' }

  // 2. 根 pom 的 <modules> 声明（Maven 的事实；artifactId / 目录名 / 相对路径都能命中）
  const mavenHit = maven?.get(moduleName)
  if (mavenHit) return { root: mavenHit, reason: 'maven-modules' }

  // 2. 退化来源：项目内同名目录（深度 ≤3），必须唯一命中
  const candidates = await findDirsNamed(moduleName, projectRoot, 3)
  if (candidates.length === 1) return { root: candidates[0], reason: 'dir-match' }
  if (candidates.length > 1) return { reason: 'ambiguous', candidates }
  return { reason: 'not-found' }
}

/** 广度优先找同名的目录（不进入 node_modules / .git / target 等无关目录）。 */
async function findDirsNamed(name: string, root: string, maxDepth: number): Promise<string[]> {
  const skip = new Set(['node_modules', '.git', '.idea', 'target', 'build', 'dist', '.gradle', '.mvn'])
  const hits: string[] = []
  let frontier: Array<{ dir: string; depth: number }> = [{ dir: root, depth: 0 }]

  while (frontier.length > 0) {
    const next: Array<{ dir: string; depth: number }> = []
    for (const { dir, depth } of frontier) {
      let entries
      try {
        entries = await readdir(dir, { withFileTypes: true })
      } catch {
        continue
      }
      for (const entry of entries) {
        if (!entry.isDirectory() || skip.has(entry.name)) continue
        const child = join(dir, entry.name)
        if (entry.name === name) {
          hits.push(child)
          // 命中后仍继续扫，但不再深入该目录（避免把它的子目录当候选）
          continue
        }
        if (depth + 1 < maxDepth) next.push({ dir: child, depth: depth + 1 })
      }
    }
    frontier = next
  }

  return hits
}
