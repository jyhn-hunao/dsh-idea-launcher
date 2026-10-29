// Maven 模块解析：以根 `pom.xml` 的 `<modules>` 声明为准，递归收集每个模块的
// 目录、相对路径与 artifactId。这是 Maven 自己的事实，比"项目内同名目录"可靠得多
// （同名目录可能出现在 log/、backup/ 等无关位置，会导致解析歧义——mlw 项目真实踩过）。
import { readFile, stat } from 'node:fs/promises'
import { basename, join, relative } from 'node:path'
import type { Diagnostic } from '../types.ts'

export interface MavenModuleMap {
  /** 键：artifactId / 目录末段 / 根相对路径（正斜杠） → 模块根绝对路径 */
  byKey: Map<string, string>
  diagnostics: Diagnostic[]
}

const MAX_DEPTH = 6

export async function loadMavenModules(projectRoot: string): Promise<MavenModuleMap> {
  const byKey = new Map<string, string>()
  const diagnostics: Diagnostic[] = []
  const rootPom = await readPom(join(projectRoot, 'pom.xml'))
  if (!rootPom) return { byKey, diagnostics }

  // 1. 从根 pom 的 modules 开始广度优先，逐层读子模块的 pom
  const queue: Array<{ dir: string; depth: number }> = []
  for (const relPath of rootPom.modules) queue.push({ dir: join(projectRoot, relPath), depth: 1 })

  const visited = new Set<string>()
  while (queue.length > 0 && visited.size < 500) {
    const { dir, depth } = queue.shift()!
    if (depth > MAX_DEPTH || visited.has(dir)) continue
    visited.add(dir)

    const pom = await readPom(join(dir, 'pom.xml'))
    if (!pom) {
      diagnostics.push({
        level: 'warn',
        code: 'module-unresolved',
        ref: relative(projectRoot, dir),
        message: `pom.xml 的 module 指向的目录没有 pom：${dir}`,
      })
      continue
    }

    // 2. 三种键都登记：artifactId、目录末段、根相对路径（都用正斜杠，跨平台一致）
    const relPath = relative(projectRoot, dir).replace(/\\/g, '/')
    const keys = new Set<string>()
    if (pom.artifactId) keys.add(pom.artifactId)
    keys.add(basename(dir))
    keys.add(relPath)
    for (const key of keys) {
      if (!byKey.has(key)) byKey.set(key, dir)
    }

    // 3. 子模块继续排队（嵌套模块，如 backend/x/x-server-main）
    for (const child of pom.modules) queue.push({ dir: join(dir, child), depth: depth + 1 })
  }

  return { byKey, diagnostics }
}

interface PomFacts {
  artifactId?: string
  modules: string[]
}

/** 只取需要的两样：模块声明与 artifactId（跳过 <parent> 里的 artifactId）。 */
async function readPom(path: string): Promise<PomFacts | null> {
  try {
    await stat(path)
  } catch {
    return null
  }
  let text: string
  try {
    text = await readFile(path, 'utf8')
  } catch {
    return null
  }

  const withoutParent = text.replace(/<parent>[\s\S]*?<\/parent>/g, '')
  const artifactId = /<artifactId>\s*([^<]+?)\s*<\/artifactId>/.exec(withoutParent)?.[1]
  const modulesBlock = /<modules>([\s\S]*?)<\/modules>/.exec(text)?.[1] ?? ''
  const modules = [...modulesBlock.matchAll(/<module>\s*([^<]+?)\s*<\/module>/g)].map((match) => match[1])

  return { artifactId, modules }
}
