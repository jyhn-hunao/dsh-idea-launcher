// 三来源扫描。
// 关键点：workspace.xml 里同时存在别的东西（shelf、svn 配置等），
// 只能取 <component name="RunManager"> 里的 <configuration>，
// 否则会把 <configuration>路径文本</configuration> 之类的无关节点当运行配置。
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ConfigOrigin } from '../types.ts'

/**
 * selector 决定解析时从哪里取 <configuration>：
 *   root        = 文件本身就是 ProjectRunConfigurationManager（.run/*.run.xml、.idea/runConfigurations/*.xml）
 *   run-manager = 只能取 <component name="RunManager"> 子树（.idea/workspace.xml）
 */
export type SourceSelector = 'root' | 'run-manager'

export interface ConfigSource {
  path: string
  origin: ConfigOrigin
  selector: SourceSelector
  content: string
}

export async function scanSources(projectRoot: string): Promise<ConfigSource[]> {
  const sources: ConfigSource[] = []

  // 1. .idea/runConfigurations/*.xml —— 旧版共享格式，目录不存在是正常情况
  sources.push(...(await readXmlDir(join(projectRoot, '.idea', 'runConfigurations'), '.xml', 'shared', 'root')))

  // 2. .run/*.run.xml —— 新版共享格式
  sources.push(...(await readXmlDir(join(projectRoot, '.run'), '.run.xml', 'shared', 'root')))

  // 3. .idea/workspace.xml —— 默认存储位置（必须扫描），只取 RunManager 子树
  const workspace = join(projectRoot, '.idea', 'workspace.xml')
  try {
    sources.push({ path: workspace, origin: 'local', selector: 'run-manager', content: await readFile(workspace, 'utf8') })
  } catch {
    // 没有 workspace.xml 是合法状态（配置可能全部共享在 .run/ 里）
  }

  return sources
}

async function readXmlDir(
  dir: string,
  suffix: string,
  origin: ConfigOrigin,
  selector: SourceSelector,
): Promise<ConfigSource[]> {
  let files: string[]
  try {
    files = await readdir(dir)
  } catch {
    return []
  }

  const out: ConfigSource[] = []
  for (const file of files) {
    if (!file.endsWith(suffix)) continue
    const path = join(dir, file)
    try {
      out.push({ path, origin, selector, content: await readFile(path, 'utf8') })
    } catch {
      // 单个文件读失败不影响其它配置；上层会因为缺少该配置而体现出来
      continue
    }
  }
  return out
}
