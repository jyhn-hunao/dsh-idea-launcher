// 配置选择器：带类型图标 + 可搜索的下拉。
// 为什么不用原生 <select>：29 条配置只有文字很难区分，IDEA 也是靠类型图标 + 可过滤列表。
import React from 'react'
import { ConfigIcon, typeLabel } from './icons.tsx'
import { filterConfigs } from './filter.ts'
import type { ConfigView } from './state.ts'

export interface ConfigPickerProps {
  configs: ConfigView[]
  selected: string | null
  onSelect: (name: string) => void
}

const triggerStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  height: 26,
  minWidth: 300,
  maxWidth: 460,
  padding: '0 8px',
  borderRadius: 6,
  border: '1px solid rgba(127, 127, 127, 0.35)',
  background: 'transparent',
  color: 'inherit',
  fontSize: 12,
  cursor: 'pointer',
  textAlign: 'left',
}

export function ConfigPicker(props: ConfigPickerProps): React.ReactElement {
  const { configs, selected, onSelect } = props
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [cursor, setCursor] = React.useState(0)
  const boxRef = React.useRef<HTMLDivElement | null>(null)

  const current = configs.find((item) => item.name === selected)

  // 1. 搜索过滤：名称与类型标签都参与匹配，空查询保留全部（保持 Host 给的顺序）
  const filtered = React.useMemo(() => filterConfigs(configs, query), [configs, query])

  // 2. 点外部关闭
  React.useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const choose = React.useCallback(
    (name: string) => {
      onSelect(name)
      setOpen(false)
      setQuery('')
      setCursor(0)
    },
    [onSelect],
  )

  // 3. 键盘：↓/↑ 移动，Enter 选中，Esc 关闭（列表很长时不用鼠标）
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!open) {
      if (event.key === 'Enter' || event.key === 'ArrowDown') {
        event.preventDefault()
        setOpen(true)
      }
      return
    }
    if (event.key === 'Escape') {
      setOpen(false)
      return
    }
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
      if (hit) choose(hit.name)
    }
  }

  return (
    <div ref={boxRef} style={{ position: 'relative', display: 'inline-block' }} onKeyDown={onKeyDown}>
      <button type="button" style={triggerStyle} onClick={() => setOpen((value) => !value)} title="选择运行配置">
        {current ? <ConfigIcon type={current.type} /> : <ConfigIcon type="unsupported" />}
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {current ? current.name : configs.length === 0 ? '（当前项目没有解析出运行配置）' : '选择运行配置'}
        </span>
        {current ? <span style={{ opacity: 0.55 }}>{typeLabel(current.type)}</span> : null}
        <span style={{ opacity: 0.6 }}>{open ? '▴' : '▾'}</span>
      </button>

      {open ? (
        <div
          style={{
            position: 'absolute',
            zIndex: 40,
            top: 30,
            left: 0,
            width: 460,
            maxHeight: 320,
            overflow: 'auto',
            borderRadius: 8,
            border: '1px solid rgba(127, 127, 127, 0.35)',
            background: 'canvas',
            color: 'inherit',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.18)',
          }}
        >
          <div style={{ position: 'sticky', top: 0, padding: 6, background: 'canvas', borderBottom: '1px solid rgba(127,127,127,0.2)' }}>
            <input
              autoFocus
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setCursor(0)
              }}
              placeholder="搜索配置（名称或类型）"
              spellCheck={false}
              style={{
                width: '100%',
                height: 24,
                padding: '0 8px',
                boxSizing: 'border-box',
                borderRadius: 5,
                border: '1px solid rgba(127,127,127,0.35)',
                background: 'transparent',
                color: 'inherit',
                fontSize: 12,
              }}
            />
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: '10px 12px', opacity: 0.65 }}>没有匹配的配置</div>
          ) : (
            <ul role="listbox" style={{ margin: 0, padding: 4, listStyle: 'none' }}>
              {filtered.map((item, index) => (
                <li key={item.name}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={item.name === selected}
                    onMouseEnter={() => setCursor(index)}
                    onClick={() => choose(item.name)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      width: '100%',
                      padding: '5px 8px',
                      borderRadius: 5,
                      border: 'none',
                      background: index === cursor ? 'rgba(127,127,127,0.16)' : 'transparent',
                      color: 'inherit',
                      fontSize: 12,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <ConfigIcon type={item.type} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                    {item.plan === null ? (
                      <span style={{ opacity: 0.55 }}>暂不支持启动</span>
                    ) : item.plan.confidence === 'low' ? (
                      <span style={{ opacity: 0.55, color: '#d97706' }}>含假设</span>
                    ) : null}
                    <span style={{ opacity: 0.5 }}>{typeLabel(item.type)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
