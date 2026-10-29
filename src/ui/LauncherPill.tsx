// 顶栏运行控件（IDEA 运行选择器形态 + 操作图标集中在外部）：
//   [● 配置名 ▾] [▶/■] [⚡强制停止] [●诊断 N] [▤日志] [⋯详情]
// 浮层里只放信息（项目根 / 命令 / cwd），不放任何文字按钮。
// 所有浮层都走 createPortal + position: fixed：顶栏容器会裁剪 absolute 浮层（实测踩过）。
import React from 'react'
import { createPortal } from 'react-dom'
import {
  instanceFor,
  liveInstances,
  select,
  selectedConfig,
  setDockOpen,
  setPanelActive,
  setSession,
  start,
  stopAll,
  stopInstance,
  useLauncher,
} from './state.ts'
import type { Diagnostic } from '../types.ts'
import { ConfigMenu } from './ConfigMenu.tsx'
import { ConfigPanel } from './ConfigPanel.tsx'
import { dedupeDiagnostics, diagnosticsSummary, isRelevantDiagnostic } from './diagnostics.ts'

export interface LauncherPillProps {
  sessionId?: string
}

type Menu = 'configs' | 'details' | 'diagnostics' | null

const GAP = 6
const EDGE = 8

const shellStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'stretch',
  height: 26,
  border: '1px solid rgba(127, 127, 127, 0.35)',
  borderRadius: 8,
  overflow: 'hidden',
  position: 'relative',
}

const segmentStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 6,
  border: 'none',
  background: 'transparent',
  color: 'inherit',
  cursor: 'pointer',
  padding: '0 7px',
  fontSize: 12,
  whiteSpace: 'nowrap',
}

const divider: React.CSSProperties = { borderLeft: '1px solid rgba(127,127,127,0.3)' }

interface Anchor {
  left: number
  top: number
  width: number
  maxHeight: number
}

export function LauncherPill(props: LauncherPillProps): React.ReactElement {
  const state = useLauncher()
  const [menu, setMenu] = React.useState<Menu>(null)
  const [anchor, setAnchor] = React.useState<Anchor | null>(null)
  const boxRef = React.useRef<HTMLDivElement | null>(null)
  const popRef = React.useRef<HTMLDivElement | null>(null)
  const { sessionId } = props

  // 1. 会话切换：跟随模式下自动换项目
  React.useEffect(() => {
    setSession(sessionId)
  }, [sessionId])

  // 2. 浮层开合 = 轮询开合
  React.useEffect(() => {
    setPanelActive(menu !== null)
  }, [menu])

  // 3. 锚定：配置列表左对齐、其余右对齐到控件右缘
  const place = React.useCallback(() => {
    const node = boxRef.current
    if (!node) return
    const rect = node.getBoundingClientRect()
    const want = menu === 'configs' ? 360 : menu === 'diagnostics' ? 520 : 640
    const width = Math.min(want, window.innerWidth - EDGE * 2)
    const left = menu === 'configs'
      ? Math.max(EDGE, Math.min(rect.left, window.innerWidth - width - EDGE))
      : Math.max(EDGE, Math.min(rect.right - width, window.innerWidth - width - EDGE))
    const top = rect.bottom + GAP
    setAnchor({ left, top, width, maxHeight: Math.max(220, window.innerHeight - top - EDGE) })
  }, [menu])

  React.useLayoutEffect(() => {
    if (menu) place()
  }, [menu, place])

  React.useEffect(() => {
    if (!menu) return
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [menu, place])

  // 4. 点外部 / Esc 关闭
  React.useEffect(() => {
    if (!menu) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (boxRef.current?.contains(target)) return
      if (popRef.current?.contains(target)) return
      setMenu(null)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(null)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [menu])

  const config = selectedConfig()
  // 多实例语义：运行键作用于「选中配置自己的实例」，不受正在查看的日志实例影响
  const instance = instanceFor(config?.name)
  const live = instance !== undefined && (instance.state === 'running' || instance.state === 'starting')
  const failed = instance?.state === 'failed'
  const liveCount = liveInstances().length

  // 5. 诊断：只算当前配置 + 文件级（其它配置的告警不进 UI，避免按配置数量刷屏）
  const diagnostics = React.useMemo<Diagnostic[]>(
    () =>
      dedupeDiagnostics(
        [...(state.diagnostics ?? []), ...(config?.plan?.diagnostics ?? [])].filter((item) =>
          isRelevantDiagnostic(item, config?.name ?? null),
        ),
      ),
    [state.diagnostics, config],
  )
  const summary = diagnosticsSummary(diagnostics)

  const tone = failed ? '#dc2626' : live ? '#16a34a' : 'currentColor'
  const dotColor = failed ? '#dc2626' : live ? '#16a34a' : '#9ca3af'

  const onRun = () => {
    if (!config) {
      setMenu('configs')
      return
    }
    if (live && instance) void stopInstance(instance.id, 'soft')
    else void start()
  }

  const popover = menu && anchor
    ? createPortal(
        <div
          ref={popRef}
          role="dialog"
          aria-label={menu === 'configs' ? '选择运行配置' : menu === 'diagnostics' ? '诊断信息' : '运行配置详情'}
          style={{
            position: 'fixed',
            left: anchor.left,
            top: anchor.top,
            width: anchor.width,
            maxHeight: anchor.maxHeight,
            zIndex: 2147483000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'auto',
            borderRadius: 10,
            border: '1px solid rgba(127, 127, 127, 0.35)',
            background: 'canvas',
            color: 'inherit',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.28)',
          }}
        >
          {menu === 'configs' ? (
            <ConfigMenu
              configs={state.configs}
              selected={state.selected}
              running={liveInstances().map((i) => i.configName)}
              onSelect={(name) => {
                select(name)
                setMenu(null)
              }}
            />
          ) : menu === 'diagnostics' ? (
            <DiagnosticsList items={diagnostics} />
          ) : (
            <ConfigPanel sessionId={sessionId} onClose={() => setMenu(null)} />
          )}
        </div>,
        document.body,
      )
    : null

  return (
    <div ref={boxRef} style={shellStyle}>
      {/* 1) 当前配置 + ▾ */}
      <button
        type="button"
        onClick={() => setMenu(menu === 'configs' ? null : 'configs')}
        aria-expanded={menu === 'configs'}
        title={config ? `${config.name}（${config.type}）` : '选择运行配置'}
        style={{ ...segmentStyle, maxWidth: 220 }}
      >
        <span aria-hidden style={{ width: 7, height: 7, borderRadius: 4, background: dotColor, flex: '0 0 auto' }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {config ? config.name : state.configs.length === 0 ? '无运行配置' : '选择配置'}
        </span>
        <svg width={12} height={12} viewBox="0 0 16 16" aria-hidden focusable="false">
          <path d="M3.5 6l4.5 4.5L12.5 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* 2) 运行 / 停止 */}
      <button
        type="button"
        onClick={onRun}
        title={live ? `停止 ${config?.name ?? ''}（Windows 下为强制停止）` : `运行 ${config?.name ?? ''}`}
        aria-label={live ? '停止' : '运行'}
        style={{ ...segmentStyle, ...divider, padding: '0 6px' }}
      >
        {live ? (
          <svg width={14} height={14} viewBox="0 0 16 16" aria-hidden focusable="false">
            <rect x="4" y="4" width="8" height="8" rx="1.2" fill={tone} />
          </svg>
        ) : (
          <svg width={14} height={14} viewBox="0 0 16 16" aria-hidden focusable="false">
            <path d="M5 3.4v9.2c0 .5.6.8 1 .5l7-4.6a.6.6 0 0 0 0-1l-7-4.6c-.4-.3-1 0-1 .5z" fill={tone} />
          </svg>
        )}
      </button>

      {/* 3) 强制停止（仅运行中可用） */}
      <button
        type="button"
        onClick={() => { if (instance) void stopInstance(instance.id, 'hard') }}
        disabled={!live}
        title="强制停止：跳过宽限期直接 terminate"
        aria-label="强制停止"
        style={{ ...segmentStyle, ...divider, padding: '0 6px', opacity: live ? 0.9 : 0.35, cursor: live ? 'pointer' : 'default' }}
      >
        <svg width={14} height={14} viewBox="0 0 16 16" aria-hidden focusable="false">
          <path d="M9 1.8L4.2 9h3L6.6 14.2 11.8 6.6h-3z" fill={live ? '#dc2626' : 'currentColor'} />
        </svg>
      </button>

      {/* 4) 全部停止：任何实例在跑就可用；多个实例时先确认，避免误杀 */}
      <button
        type="button"
        onClick={() => {
          if (liveCount === 0) return
          if (liveCount > 1 && !window.confirm(`确定停止全部 ${liveCount} 个运行实例？`)) return
          void stopAll()
        }}
        disabled={liveCount === 0}
        title={liveCount > 0 ? `全部停止（当前 ${liveCount} 个实例在运行）` : '全部停止（当前没有运行中的实例）'}
        aria-label="全部停止"
        style={{
          ...segmentStyle,
          ...divider,
          padding: '0 6px',
          opacity: liveCount > 0 ? 0.9 : 0.35,
          cursor: liveCount > 0 ? 'pointer' : 'default',
        }}
      >
        <svg width={14} height={14} viewBox="0 0 16 16" aria-hidden focusable="false">
          <rect x="3.5" y="3" width="9" height="6.5" rx="1.2" fill={liveCount > 0 ? '#dc2626' : 'currentColor'} />
          <path d="M3 12.5h10" stroke={liveCount > 0 ? '#dc2626' : 'currentColor'} strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>

      {/* 5) 诊断（有内容才出现） */}
      {diagnostics.length > 0 ? (
        <button
          type="button"
          onClick={() => setMenu(menu === 'diagnostics' ? null : 'diagnostics')}
          aria-expanded={menu === 'diagnostics'}
          title={`诊断 ${diagnostics.length} 条：${summary.label}`}
          style={{ ...segmentStyle, ...divider, padding: '0 6px' }}
        >
          <span
            aria-hidden
            style={{ width: 6, height: 6, borderRadius: 3, background: summary.errors > 0 ? '#dc2626' : '#d97706', flex: '0 0 auto' }}
          />
          <span style={{ fontSize: 11, opacity: 0.85 }}>{diagnostics.length}</span>
        </button>
      ) : null}

      {/* 6) 日志窗口开合 */}
      <button
        type="button"
        onClick={() => setDockOpen(!state.dockOpen)}
        aria-pressed={state.dockOpen}
        title={state.dockOpen ? '收起日志窗口' : '展开日志窗口'}
        aria-label={state.dockOpen ? '收起日志窗口' : '展开日志窗口'}
        style={{ ...segmentStyle, ...divider, padding: '0 6px', opacity: state.dockOpen ? 1 : 0.7 }}
      >
        <svg width={14} height={14} viewBox="0 0 16 16" aria-hidden focusable="false">
          <rect x="2.5" y="3.5" width="11" height="9" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <path d="M4.5 6.5h7M4.5 9h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </button>

      {/* 7) 详情（项目根 / 命令） */}
      <button
        type="button"
        onClick={() => setMenu(menu === 'details' ? null : 'details')}
        aria-expanded={menu === 'details'}
        title="运行配置详情（项目根 / 命令 / cwd）"
        aria-label="运行配置详情"
        style={{ ...segmentStyle, ...divider, padding: '0 6px' }}
      >
        <svg width={14} height={14} viewBox="0 0 16 16" aria-hidden focusable="false">
          <circle cx="3.5" cy="8" r="1.2" fill="currentColor" />
          <circle cx="8" cy="8" r="1.2" fill="currentColor" />
          <circle cx="12.5" cy="8" r="1.2" fill="currentColor" />
        </svg>
      </button>

      {popover}
    </div>
  )
}

/** 诊断列表（信息展示，无按钮）。 */
function DiagnosticsList(props: { items: Diagnostic[] }): React.ReactElement {
  return (
    <div style={{ padding: '8px 12px 12px', fontSize: 12 }}>
      <div style={{ marginBottom: 6, fontWeight: 600 }}>诊断</div>
      <ul style={{ margin: 0, paddingLeft: 18 }}>
        {props.items.map((item, index) => (
          <li
            key={`${item.code}-${index}`}
            style={{ color: item.level === 'error' ? '#dc2626' : 'inherit', lineHeight: '18px', marginBottom: 2 }}
          >
            {item.ref ? <span style={{ opacity: 0.65 }}>[{item.ref}] </span> : null}
            {item.message}
          </li>
        ))}
      </ul>
    </div>
  )
}
