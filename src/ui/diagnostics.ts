// 诊断筛选（纯函数）：页面正文只留一条计数，其余进弹窗。
// 规则：文件级诊断（parse-error / overlay-invalid，ref 是路径）与"当前选中配置"的诊断才展示；
// 其它配置的诊断（比如一堆 JUnit 配置的模块告警）不铺在页面上，仍保留在 /configs 返回里可按需查。
import type { Diagnostic } from '../types.ts'

const FILE_REF = /[\\/]|\.(xml|json)$/i

export function isRelevantDiagnostic(diagnostic: Diagnostic, selectedName: string | null): boolean {
  if (!diagnostic.ref) return true
  if (selectedName && diagnostic.ref === selectedName) return true
  return FILE_REF.test(diagnostic.ref)
}

export function dedupeDiagnostics(items: readonly Diagnostic[]): Diagnostic[] {
  const seen = new Set<string>()
  const out: Diagnostic[] = []
  for (const item of items) {
    const key = `${item.level}|${item.ref ?? ''}|${item.message}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

/** 页面上的计数徽标文案：0 条不显示，有 error 时优先暴露错误数。 */
export function diagnosticsSummary(items: readonly Diagnostic[]): { errors: number; warnings: number; label: string } {
  const errors = items.filter((d) => d.level === 'error').length
  const warnings = items.length - errors
  const parts: string[] = []
  if (errors > 0) parts.push(`${errors} 错误`)
  if (warnings > 0) parts.push(`${warnings} 警告`)
  return { errors, warnings, label: parts.join(' · ') }
}
