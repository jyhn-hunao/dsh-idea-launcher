// 快速启动（IDEA 式）：绕开 `mvn spring-boot:run` 的每次 Maven 生命周期。
//   1. classpath 缓存：`<projectRoot>/.dsh/idea-launcher/classpath-<hash>.txt`，仅当 pom 变更时重建；
//   2. 编译：仅当 src 下有比上次编译更新的文件时跑一次 `mvn -q -Dmaven.test.skip=true compile`；
//   3. 启动：`java <vmParams> -cp "target/classes;<deps>" <mainClass> <programParams>`。
// 任何一个前提不满足都返回原因，由调用方决定"回退到 mvn spring-boot:run"（会显式写日志，不静默）。
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { dirname, join, sep } from 'node:path'

export interface FastJavaSpec {
  projectRoot: string
  moduleRoot: string
  mainClass: string
  vmParams?: string
  programParams?: string
  /** 额外源码目录（相对 moduleRoot），默认只看 src/main/java */
  extraSourceDirs?: string[]
  /** 强制重新编译（用户点"重建"时） */
  forceCompile?: boolean
  /** 跳过编译（明确知道产物是最新的） */
  skipCompile?: boolean
}

export interface FastJavaState {
  /** 需要重建 classpath 缓存 */
  needsClasspath: boolean
  /** 需要编译 */
  needsCompile: boolean
  classpathPath: string
  statePath: string
  /** 诊断信息（写进日志，便于解释为什么这次慢） */
  notes: string[]
}

const CACHE_DIR = ['.dsh', 'idea-launcher']
const CLASSES_DIR = ['target', 'classes']

/** java 启动 argv（纯函数，便于单测）。 */
export function buildJavaArgv(spec: FastJavaSpec, classpath: string): string[] {
  const argv = ['java']
  const vm = spec.vmParams?.trim()
  if (vm) argv.push(...vm.split(/\s+/))
  const entries = [join(spec.moduleRoot, ...CLASSES_DIR), classpath].filter((part) => part.length > 0)
  argv.push('-cp', entries.join(sep === '\\' ? ';' : ':'))
  argv.push(spec.mainClass)
  const program = spec.programParams?.trim()
  if (program) argv.push(...program.split(/\s+/))
  return argv
}

/** 缓存文件里的 classpath 归一化：Maven 写成一行或多行都可能。 */
export function normalizeClasspath(raw: string): string {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join(sep === '\\' ? ';' : ':')
}

/** 源码比上次编译新 → 需要重编。 */
export function needsCompile(newestSourceAt: number, compiledAt: number): boolean {
  if (compiledAt <= 0) return true
  return newestSourceAt > compiledAt
}

/** 依赖 classpath 缓存是否过期：任一把 pom 更新过缓存时间就要重建。 */
export function classpathStale(newestPomAt: number, classpathAt: number): boolean {
  if (classpathAt <= 0) return true
  return newestPomAt > classpathAt
}

export function classpathCachePath(projectRoot: string, moduleRoot: string): string {
  const hash = simpleHash(moduleRoot)
  return join(projectRoot, ...CACHE_DIR, `classpath-${hash}.txt`)
}

export function launcherStatePath(projectRoot: string): string {
  return join(projectRoot, ...CACHE_DIR, 'state.json')
}

export function classpathBuildArgv(spec: FastJavaSpec, classpathPath: string): string[] {
  return [
    'mvn',
    '-q',
    '-Dmaven.test.skip=true',
    '-DincludeScope=runtime',
    'dependency:build-classpath',
    `-Dmdep.outputFile=${classpathPath}`,
  ]
}

export function compileArgv(): string[] {
  return ['mvn', '-q', '-Dmaven.test.skip=true', 'compile']
}

interface LauncherState {
  [moduleRoot: string]: { classpathAt: number; compiledAt: number }
}

/** 读/写 .dsh/idea-launcher/state.json（记录 classpath 与编译的时间戳）。 */
async function readState(statePath: string): Promise<LauncherState> {
  try {
    const parsed: unknown = JSON.parse(await readFile(statePath, 'utf8'))
    return typeof parsed === 'object' && parsed !== null ? (parsed as LauncherState) : {}
  } catch {
    return {}
  }
}

async function writeState(statePath: string, state: LauncherState): Promise<void> {
  await mkdir(dirname(statePath), { recursive: true })
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, 'utf8')
}

/** 计算某个目录下（递归、跳过 target/.git/node_modules）最新修改时间。 */
async function newestUnder(root: string, filter: (name: string) => boolean, maxDepth = 8): Promise<number> {
  let newest = 0
  const walk = async (dir: string, depth: number): Promise<void> => {
    if (depth > maxDepth) return
    let entries
    try {
      entries = await readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.name === 'target' || entry.name === '.git' || entry.name === 'node_modules') continue
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        await walk(full, depth + 1)
        continue
      }
      if (!filter(entry.name)) continue
      try {
        const info = await stat(full)
        if (info.mtimeMs > newest) newest = info.mtimeMs
      } catch {
        // 单个文件读不到就跳过，不影响整体判断
      }
    }
  }
  await walk(root, 0)
  return newest
}

/** 判断当前需要哪些准备步骤；不执行任何 mvn，只做文件系统观察。 */
export async function inspectFastJava(spec: FastJavaSpec): Promise<FastJavaState> {
  const classpathPath = classpathCachePath(spec.projectRoot, spec.moduleRoot)
  const statePath = launcherStatePath(spec.projectRoot)
  const state = await readState(statePath)
  const record = state[spec.moduleRoot] ?? { classpathAt: 0, compiledAt: 0 }
  const notes: string[] = []

  // 1. classpath：缓存不存在或 pom 更新过 → 重建
  let classpathAt = record.classpathAt
  let classpathExists = true
  try {
    await stat(classpathPath)
  } catch {
    classpathExists = false
  }
  const newestPomAt = await newestUnder(spec.projectRoot, (name) => name === 'pom.xml', 3)
  const needsClasspathRebuild = !classpathExists || classpathStale(newestPomAt, classpathAt)
  if (needsClasspathRebuild) notes.push(classpathExists ? 'pom 有更新，重建依赖 classpath' : '首次启动，生成依赖 classpath')

  // 2. 编译：源码比上次编译新才编
  // java 源码与 resources 都要看：mvn compile 会顺带 process-resources，
  // 只盯 .java 会导致改了 application.yml 却不重新编译
  const sourceRoots: Array<{ dir: string; filter: (name: string) => boolean }> = [
    { dir: join(spec.moduleRoot, 'src', 'main', 'java'), filter: (name) => name.endsWith('.java') },
    { dir: join(spec.moduleRoot, 'src', 'main', 'resources'), filter: () => true },
    ...(spec.extraSourceDirs ?? []).map((dir) => ({ dir: join(spec.moduleRoot, dir), filter: (name: string) => name.endsWith('.java') })),
  ]
  let newestSourceAt = 0
  for (const root of sourceRoots) {
    const at = await newestUnder(root.dir, root.filter)
    if (at > newestSourceAt) newestSourceAt = at
  }
  const compileNeeded = spec.skipCompile
    ? false
    : spec.forceCompile || needsCompile(newestSourceAt, record.compiledAt)
  if (compileNeeded && !spec.forceCompile) notes.push('源码有更新，先编译一次')
  if (spec.forceCompile) notes.push('按要求强制重新编译')

  return {
    needsClasspath: needsClasspathRebuild,
    needsCompile: compileNeeded,
    classpathPath,
    statePath,
    notes,
  }
}

/** 记录一步准备完成后的时间戳。 */
export async function stampFastJava(
  spec: FastJavaSpec,
  patch: { classpathAt?: number; compiledAt?: number },
): Promise<void> {
  const statePath = launcherStatePath(spec.projectRoot)
  const state = await readState(statePath)
  const current = state[spec.moduleRoot] ?? { classpathAt: 0, compiledAt: 0 }
  state[spec.moduleRoot] = {
    classpathAt: patch.classpathAt ?? current.classpathAt,
    compiledAt: patch.compiledAt ?? current.compiledAt,
  }
  await writeState(statePath, state)
}

/** 读缓存出来的依赖 classpath。 */
export async function readClasspath(path: string): Promise<string> {
  return normalizeClasspath(await readFile(path, 'utf8'))
}

function simpleHash(input: string): string {
  let hash = 0
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0
  }
  return Math.abs(hash).toString(36)
}
