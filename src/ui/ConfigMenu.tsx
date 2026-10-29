// 配置下拉列表（点 pill 的 ▾ 直接出）：搜索 + 类型图标 + 当前选中高亮。
// 参照 IDEA 的运行配置选择器：只做"选一个"，不掺杂项目根/命令/诊断等细节。
import React from 'react'
import { ConfigIcon, typeLabel } from './icons.tsx'
import { filterConfigs } from './filter.ts'
import type { ConfigView } from './state.ts'

export interface ConfigMenuProps {
  configs: ConfigView[]
  selected: string | null
  /** 正在运行的配置名（多配置并行时用于标记） */
  running?: readonly string[]
  onSelect: (name: string) => void
}

const itemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  padding: '6px 10px',
  borderRadius: 5,
  border: 'none',
  background: 'transparent',
  color: 'inherit',
  fontSize: 12,
  cursor: 'pointer',
  textAlign: 'left',
}

export function ConfigMenu(props: ConfigMenuProps): React.ReactElement {
  const { configs, selected, onSelect, running = [] } = props
  const [query, setQuery] = React.useState('')
  const [cursor, setCursor] = React.useState(0)

  // 1. 过滤（名称/类型都能搜）
  const filtered = React.useMemo(() => filterConfigs(configs, query), [configs, query])

  // 2. 键盘：↑/↓ 移动，Enter 选中（列表可能 29 条，键盘更快）
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setCursor((index) => Math.min(index + 1, Math.max(filtered.length - 1, 0)))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setCursor((index) => Math.max(index - 1, 0))
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      const hit = filtered[cursor]
      if (hit) onSelect(hit.name)
    }
  }

  return (
    <div onKeyDown={onKeyDown} style={{ display: 'flex', flexDirection: 'column', maxHeight: 'inherit', minHeight: 0 }}>
      <div style={{ padding: 6, borderBottom: '1px solid rgba(127,127,127,0.2)' }}>
        <input
          autoFocus
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setCursor(0)
          }}
          placeholder="搜索运行配置"
          spellCheck={false}
          style={{
            width: '100%',
            height: 26,
            padding: '0 8px',
            boxSizing: 'border-box',
            borderRadius: 6,
            border: '1px solid rgba(127,127,127,0.35)',
            background: 'transparent',
            color: 'inherit',
            fontSize: 12,
          }}
        />
      </div>

      <div style={{ overflow: 'auto', padding: 4 }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '10px 10px', opacity: 0.65 }}>没有匹配的运行配置</div>
        ) : (
          filtered.map((item, index) => {
            const active = item.name === selected
            return (
              <button
                key={item.name}
                type="button"
                onMouseEnter={() => setCursor(index)}
                onClick={() => onSelect(item.name)}
                style={{
                  ...itemStyle,
                  background: index === cursor ? 'rgba(127,127,127,0.16)' : 'transparent',
                  fontWeight: active ? 600 : 400,
                }}
                title={item.plan?.display ?? `${typeLabel(item.type)}（暂不支持启动）`}
              >
                <ConfigIcon type={item.type} />
                {running.includes(item.name) ? (
                  <span aria-hidden title="运行中" style={{ width: 6, height: 6, borderRadius: 3, background: '#16a34a', flex: '0 0 auto' }} />
                ) : null}
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                {item.plan === null ? (
                  <span style={{ opacity: 0.55 }}>暂不支持</span>
                ) : item.plan.confidence === 'low' ? (
                  <span style={{ opacity: 0.6, color: '#d97706' }}>含假设</span>
                ) : null}
                <span style={{ opacity: 0.5 }}>{typeLabel(item.type)}</span>
                {active ? <span style={{ opacity: 0.7 }}>✓</span> : null}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
