// 项目 JDK 解析：IDEA 启动配置本身不带 JDK，JDK 由"项目 SDK"决定。
// 不读这条信息就会用 PATH 上的 java，出现「class file version 65.0 > 61.0」这类
// UnsupportedClassVersionError（mlw 项目真实踩过：项目用 ms-21，PATH 是 JDK 17）。
//
// 数据来源（都是 IDE 自己写的文件，不猜）：
//   1. <项目>/.idea/misc.xml → ProjectRootManager 的 project-jdk-name / languageLevel
//   2. IDEA 的 jdk.table.xml    → SDK 名称到 homePath 的映射（JetBrains 配置目录）
import { readFile, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type { Diagnostic } from '../types.ts'

export interface ProjectJdk {
  /** misc.xml 里声明的 SDK 名（如 ms-21、17、1.8） */
  name?: string
  /** 语言级别（如 JDK_21） */
  languageLevel?: string
  /** 解析出的 JDK 根目录（含 bin/java） */
  home?: string
  diagnostics: Diagnostic[]
}

export function javaExecutable(home: string): string {
  return join(home, 'bin', process.platform === 'win32' ? 'java.exe' : 'java')
}

/** 读 .idea/misc.xml 里的项目 SDK 声明。 */
export async function readProjectJdkName(projectRoot: string): Promise<{ name?: string; languageLevel?: string }> {
  try {
    const text = await readFile(join(projectRoot, '.idea', 'misc.xml'), 'utf8')
    const component = /<component[^>]*name="ProjectRootManager"[^>]*>/.exec(text)?.[0] ?? ''
    const name = /project-jdk-name="([^"]+)"/.exec(component)?.[1]
    const languageLevel = /languageLevel="([^"]+)"/.exec(component)?.[1]
    return { name, languageLevel }
  } catch {
    return {}
  }
}

/** IDEA 的 jdk.table.xml 位置（按平台列候选目录）。 */
function jdkTableCandidates(): string[] {
  const roots: string[] = []
  if (process.platform === 'win32') {
    const appData = process.env.APPDATA
    if (appData) roots.push(join(appData, 'JetBrains'))
  } else if (process.platform === 'darwin') {
    roots.push(join(homedir(), 'Library', 'Application Support', 'JetBrains'))
  } else {
    roots.push(join(homedir(), '.config', 'JetBrains'))
    roots.push(join(homedir(), '.IntelliJIdea'))
  }
  return roots
}

interface SdkEntry {
  name: string
  home: string
}

/** 解析 jdk.table.xml：<jdk> 块里取 name 与 homePath。 */
export function parseJdkTable(xml: string): SdkEntry[] {
  const entries: SdkEntry[] = []
  for (const match of xml.matchAll(/<jdk\b[^>]*>([\s\S]*?)<\/jdk>/g)) {
    const block = match[1]
    const name = /<name value="([^"]+)"/.exec(block)?.[1]
    const home = /<homePath value="([^"]+)"/.exec(block)?.[1]
    if (name && home) entries.push({ name, home: home.replace(/\\/g, '/') })
  }
  return entries
}

/** 扫描所有 JetBrains 配置目录，汇总 SDK 表（后出现的同名条目覆盖前者，贴近"最新 IDE"）。 */
export async function loadSdkTable(): Promise<Map<string, string>> {
  const table = new Map<string, string>()
  for (const root of jdkTableCandidates()) {
    let dirs: string[]
    try {
      dirs = await readdir(root)
    } catch {
      continue
    }
    dirs.sort()
    for (const dir of dirs) {
      const file = join(root, dir, 'options', 'jdk.table.xml')
      try {
        await stat(file)
        const xml = await readFile(file, 'utf8')
        for (const entry of parseJdkTable(xml)) table.set(entry.name, entry.home)
      } catch {
        // 某个 IDE 目录没有 jdk.table.xml 就跳过，不影响其它版本
      }
    }
  }
  return table
}

/** 把项目 SDK 名解析成 JDK 根目录；解析不出来时返回诊断，由调用方决定是否退回 PATH。 */
export async function loadProjectJdk(projectRoot: string): Promise<ProjectJdk> {
  const { name, languageLevel } = await readProjectJdkName(projectRoot)
  const diagnostics: Diagnostic[] = []
  if (!name) return { languageLevel, diagnostics }

  const table = await loadSdkTable()
  const home = table.get(name)
  if (!home) {
    diagnostics.push({
      level: 'warn',
      code: 'project-jdk-unresolved',
      ref: 'misc.xml',
      message: `项目 SDK "${name}" 在 IDEA 的 jdk.table.xml 里找不到 homePath，将退回 PATH 上的 java`,
    })
    return { name, languageLevel, diagnostics }
  }
  return { name, languageLevel, home, diagnostics }
}
