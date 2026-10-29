// Java Application → 启动计划。
// 已知局限：IDEA 用的是模块的编译输出 + 依赖 classpath，这里拿不到完整 classpath，
// 所以 V1 用 target/classes 近似，并明确标低可信度 + 诊断，不假装和 IDEA 等价。
import { join } from 'node:path'
import type { IdeaConfig, LaunchPlan } from '../types.ts'
import { makePlan, planDiagnostic } from './facts.ts'

export function mapJavaApp(cfg: IdeaConfig, projectRoot: string): LaunchPlan {
  const diagnostics = [...cfg.diagnostics]
  const cwd = cfg.moduleRoot ?? cfg.workDir ?? projectRoot

  if (!cfg.mainClass) {
    diagnostics.push(planDiagnostic('error', 'command-assumption', cfg.name, '配置里没有 MAIN_CLASS_NAME，无法生成启动命令'))
  }

  const argv = ['java']
  if (cfg.vmParams?.trim()) argv.push(...cfg.vmParams.trim().split(/\s+/))
  argv.push('-cp', join(cwd, 'target', 'classes'))
  if (cfg.mainClass) argv.push(cfg.mainClass)
  if (cfg.programParams?.trim()) argv.push(...cfg.programParams.trim().split(/\s+/))

  diagnostics.push(
    planDiagnostic(
      'warn',
      'command-assumption',
      cfg.name,
      'classpath 用 target/classes 近似，未含依赖 jar；如需完整 classpath 请用覆盖层改命令',
    ),
  )

  return makePlan({
    argv,
    cwd,
    beforeLaunch: cfg.beforeLaunch,
    confidence: cfg.mainClass ? 'low' : 'low',
    diagnostics,
  })
}
