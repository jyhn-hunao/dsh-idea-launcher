// 展示用格式化（纯函数，便于单测）。
export function formatUptime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  if (total < 60) return `${total}s`
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  if (minutes < 60) return `${minutes}m${seconds.toString().padStart(2, '0')}s`
  const hours = Math.floor(minutes / 60)
  return `${hours}h${(minutes % 60).toString().padStart(2, '0')}m`
}

/** 日志区高度钳制：太小看不见，太大占满整屏。 */
export function clampDockHeight(height: number): number {
  if (!Number.isFinite(height)) return 240
  return Math.round(Math.min(720, Math.max(120, height)))
}

/** 浮动窗口位置钳制：保证标题区域始终留在视口内（不能被拖出屏幕）。 */
export function clampFloatPos(
  pos: { x: number; y: number },
  viewport: { width: number; height: number },
  minVisible = { width: 120, height: 60 },
): { x: number; y: number } {
  const maxX = Math.max(8, viewport.width - minVisible.width)
  const maxY = Math.max(8, viewport.height - minVisible.height)
  return {
    x: Math.min(Math.max(8, Math.round(pos.x)), maxX),
    y: Math.min(Math.max(8, Math.round(pos.y)), maxY),
  }
}
