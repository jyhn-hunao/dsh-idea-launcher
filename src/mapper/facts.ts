// 启动计划共用的工程事实探测与小工具。
// 全部按"文件存在即事实"判断，不做路径猜测：找不到就说找不到，由上层降级并标注 confidence。
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { Diagnostic, LaunchPlan } from '../types.ts'

export type PackageManager = 'npm' | 'pnpm' | 'yarn'

/** 包管理器：以锁文件为准（pnpm-lock.yaml → pnpm，yarn.lock → yarn，其余 npm）。 */
export function detectPackageManager(cwd: string): PackageManager {
  if (existsSync(join(cwd, 'pnpm-lock.yaml'))) return 'pnpm'
  if (existsSync(join(cwd, 'yarn.lock'))) return 'yarn'
  return 'npm'
}

export function hasGradle(root: string): boolean {
  return (
    existsSync(join(root, 'build.gradle')) ||
    existsSync(join(root, 'build.gradle.kts')) ||
    existsSync(join(root, 'settings.gradle')) ||
    existsSync(join(root, 'settings.gradle.kts'))
  )
}

/** 展示用命令串：含空格/特殊字符的参数用双引号包住，仅用于 UI 与日志。 */
export function formatCommand(argv: readonly string[]): string {
  return argv
    .map((part) => (/[\s"']/.test(part) ? `"${part.replace(/"/g, '\\"')}"` : part))
    .join(' ')
}

export function makePlan(input: {
  argv?: string[]
  command?: string
  cwd: string
  env?: Record<string, string>
  beforeLaunch?: LaunchPlan['beforeLaunch']
  browserUrl?: string
  confidence: LaunchPlan['confidence']
  diagnostics?: Diagnostic[]
  fastJava?: LaunchPlan['fastJava']
  launchMode?: LaunchPlan['launchMode']
  /** 覆盖展示命令（快速启动时给等价 java 命令用） */
  display?: string
}): LaunchPlan {
  const display = input.display ?? (input.argv && input.argv.length > 0 ? formatCommand(input.argv) : (input.command ?? ''))
  return {
    argv: input.argv,
    command: input.command,
    cwd: input.cwd,
    env: input.env ?? {},
    display,
    confidence: input.confidence,
    beforeLaunch: input.beforeLaunch ?? [],
    browserUrl: input.browserUrl,
    diagnostics: input.diagnostics ?? [],
    fastJava: input.fastJava,
    launchMode: input.launchMode,
  }
}

/** 覆盖层/local 诊断都要带配置名，避免 UI 里对不上号。 */
export function planDiagnostic(level: 'error' | 'warn', code: Diagnostic['code'], ref: string, message: string): Diagnostic {
  return { level, code, ref, message }
}
