// 配置列表过滤：名称与类型标签都参与匹配（大小写不敏感）；空查询保持原顺序。
import { typeLabel } from './config-type.ts'

export interface FilterableConfig {
  name: string
  type: string
}

export function filterConfigs<T extends FilterableConfig>(items: readonly T[], query: string): readonly T[] {
  const q = query.trim().toLowerCase()
  if (q.length === 0) return items
  return items.filter(
    (item) => item.name.toLowerCase().includes(q) || typeLabel(item.type).toLowerCase().includes(q),
  )
}
