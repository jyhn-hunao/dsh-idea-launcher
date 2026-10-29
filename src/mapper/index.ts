// 映射调度：IdeaConfig → LaunchPlan，并在此处应用覆盖层。
// Compound 不在这里映射（它需要并行编排多个子实例，见 M6）。
import type { IdeaConfig, LaunchPlan } from '../types.ts'
import type { Overlay, OverlayEntry } from '../config/overlay.ts'
import { mapJavaApp } from './java-app.ts'
import { mapNpm } from './npm.ts'
import { mapSpringBoot } from './spring-boot.ts'
import { planDiagnostic } from './facts.ts'

export function mapToLaunchPlan(cfg: IdeaConfig, projectRoot: string, overlay?: Overlay): LaunchPlan | null {
  const base = mapByType(cfg, projectRoot)
  if (!base) return null
  const entry = overlay?.[cfg.name]
  return entry ? applyOverlay(base, cfg.name, entry) : base
}

function mapByType(cfg: IdeaConfig, projectRoot: string): LaunchPlan | null {
  switch (cfg.type) {
    case 'spring-boot':
      return mapSpringBoot(cfg, projectRoot)
    case 'java-app':
      return mapJavaApp(cfg, projectRoot)
    case 'npm':
      return mapNpm(cfg, projectRoot)
    default:
      return null
  }
}

/**
 * 覆盖层语义：用户写什么就是什么——命令覆盖后不再保留推导出的 argv，
 * 同时把可信度拉回 high 之外（因为已经不是"推导"而是"用户指定"）。
 */
function applyOverlay(plan: LaunchPlan, configName: string, entry: OverlayEntry): LaunchPlan {
  const next: LaunchPlan = { ...plan }

  if (entry.env) next.env = { ...next.env, ...entry.env }

  // 覆盖层可强制回 Maven 路径（快速启动出问题时的手动开关）
  if (entry.launchMode === 'maven') {
    next.fastJava = undefined
    next.launchMode = 'maven'
  }
  if (entry.launchMode === 'fast' && next.fastJava) next.launchMode = 'java'
  if (entry.cwdOverride) next.cwd = entry.cwdOverride

  if (entry.commandOverride) {
    next.command = entry.commandOverride
    next.argv = undefined
    next.display = entry.commandOverride
    // 覆盖后命令由用户负责，不再标"含假设"，但保留一条说明便于排查
    next.confidence = 'high'
    next.diagnostics = [
      ...next.diagnostics,
      planDiagnostic('warn', 'command-assumption', configName, `命令来自覆盖层：${entry.commandOverride}`),
    ]
  }

  return next
}
