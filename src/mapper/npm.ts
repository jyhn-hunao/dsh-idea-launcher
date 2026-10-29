// npm / Vue → 启动计划。
// 真实约束（grape / ydcy 实测）：
//   1. 配置里 <package-json value="$PROJECT_DIR$/xxx/package.json"> 决定工作目录，不是项目根；
//   2. <command value="run"> + <scripts><script value="dev|serve"> 决定 npm 子命令；
//   3. 包管理器按锁文件判定（pnpm-lock.yaml / yarn.lock），没有锁文件按 npm；
//   4. <node-interpreter> 在 V1 不参与执行（用系统 node），但必须告警而不是静默忽略。
import { dirname, join } from 'node:path'
import type { IdeaConfig, LaunchPlan } from '../types.ts'
import { detectPackageManager, makePlan, planDiagnostic } from './facts.ts'

export function mapNpm(cfg: IdeaConfig, projectRoot: string): LaunchPlan {
  const diagnostics = [...cfg.diagnostics]

  // 1. 工作目录 = package.json 所在目录（配置没给时退回配置的工作目录）
  const packageJson = cfg.packageJson || join(projectRoot, 'package.json')
  const cwd = dirname(packageJson)

  // 2. 脚本：IDEA 里是必填项；缺了就是配置异常，用默认值但标低可信度
  const script = cfg.npmScript
  if (!script) {
    diagnostics.push(planDiagnostic('warn', 'command-assumption', cfg.name, '配置里没有 <script>，按 "dev" 假设，请在覆盖层确认'))
  }
  const scriptName = script ?? 'dev'

  // 3. 包管理器：锁文件即事实
  const manager = detectPackageManager(cwd)
  const argv = [manager, 'run', scriptName]

  // 4. node-interpreter：绝对路径时说明"V1 不使用"，避免用户以为生效了
  if (cfg.nodeInterpreter && /[\\/]/.test(cfg.nodeInterpreter)) {
    diagnostics.push(
      planDiagnostic(
        'warn',
        'command-assumption',
        cfg.name,
        `node-interpreter=${cfg.nodeInterpreter} 在 V1 不参与执行（使用系统 node），如需生效请用覆盖层改命令`,
      ),
    )
  }

  const browser = cfg.beforeLaunch.find((t) => t.kind === 'browser')
  const browserUrl = browser?.kind === 'browser' ? browser.url : undefined

  return makePlan({
    argv,
    cwd,
    beforeLaunch: cfg.beforeLaunch,
    browserUrl,
    confidence: script ? 'high' : 'low',
    diagnostics,
  })
}
