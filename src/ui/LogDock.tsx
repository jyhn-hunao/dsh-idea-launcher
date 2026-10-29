// 日志窗口：支持两种形态 + 手动调整尺寸
//   inline（默认）：`shell.bottom` 里的底部窗口，顶部拖拽条可上下调整高度；
//   float：独立浮动窗口（portal 到 body），拖标题栏移动、拖底边调高度，可一键还原内置。
// 高度/形态/位置都持久化在 localStorage；折叠时只留标题行。
import React from 'react'
import { createPortal } from 'react-dom'
import {
  activeInstance,
  clearActiveLog,
  liveInstances,
  selectInstance,
  selectedConfig,
  setDockCollapsed,
  setDockHeight,
  setDockMode,
  setDockOpen,
  setDockPos,
  stickToBottom,
  useLauncher,
} from './state.ts'
import { LogView } from './LogView.tsx'
import { toPlainText } from './ansi.ts'
import { clampFloatPos, formatUptime } from './format.ts'

const HEADER_HEIGHT = 28
const FLOAT_WIDTH = 760

const iconButton: React.CSSProperties = {
  flex: '0 0 auto',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 24,
  height: 22,
  borderRadius: 5,
  border: '1px solid transparent',
  background: 'transparent',
  color: 'inherit',
  cursor: 'pointer',
  padding: 0,
}

export function LogDock(): React.ReactElement | null {
  const state = useLauncher()

  // 1. 窗口没打开就不占任何高度
  if (!state.dockOpen) return null

  const instance = activeInstance()
  const config = selectedConfig()
  const name = instance?.configName ?? config?.name ?? '日志'
  const collapsed = state.dockCollapsed
  const floating = state.dockMode === 'float'

  // 2. 浮动窗口默认停在右下角；拖动过之后用持久化坐标
  const floatPos = state.dockPos ?? {
    x: Math.max(16, window.innerWidth - FLOAT_WIDTH - 24),
    y: Math.max(16, window.innerHeight - state.dockHeight - 96),
  }

  const body = (
    <>
      <LogHeader name={name} floating={floating} />
      {collapsed ? null : (
        <div
          style={{
            height: state.dockHeight,
            padding: '0 10px 10px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <LogView text={state.log} stickSignal={state.logStick} />
        </div>
      )}
    </>
  )

  if (floating) {
    return createPortal(
      <div
        style={{
          position: 'fixed',
          left: floatPos.x,
          top: floatPos.y,
          width: FLOAT_WIDTH,
          maxWidth: 'calc(100vw - 32px)',
          zIndex: 2147482000,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 10,
          border: '1px solid rgba(127, 127, 127, 0.35)',
          background: 'canvas',
          color: 'inherit',
          boxShadow: '0 16px 40px rgba(0, 0, 0, 0.28)',
          overflow: 'hidden',
          fontSize: 12,
        }}
      >
        <FloatingDragArea pos={floatPos}>{body}</FloatingDragArea>
        {collapsed ? null : <FloatResizeEdge />}
      </div>,
      document.body,
    )
  }

  // 3. 内置：shell.bottom 内，顶部拖拽条 + 面板
  return (
    <div
      style={{
        width: '100%',
        minWidth: 0,
        boxSizing: 'border-box',
        borderTop: '1px solid rgba(127, 127, 127, 0.3)',
        overflow: 'hidden',
        background: 'rgba(127, 127, 127, 0.07)',
        fontSize: 12,
        color: 'inherit',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <InlineResizeHandle collapsed={collapsed} />
      {body}
    </div>
  )
}

/** 内置模式的顶边拖拽条：向上拖变高、向下拖变矮。 */
function InlineResizeHandle(props: { collapsed: boolean }): React.ReactElement {
  const state = useLauncher()
  const onPointerDown = (event: React.PointerEvent): void => {
    if (props.collapsed) return
    event.preventDefault()
    const startY = event.clientY
    const startHeight = state.dockHeight
    const move = (ev: PointerEvent): void => setDockHeight(startHeight - (ev.clientY - startY))
    const up = (): void => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      document.body.style.cursor = ''
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    document.body.style.cursor = 'ns-resize'
  }

  return (
    <div
      role="separator"
      aria-label="拖拽调整日志区高度"
      title={props.collapsed ? undefined : '上下拖拽调整高度'}
      onPointerDown={onPointerDown}
      style={{ height: 6, flex: '0 0 auto', cursor: props.collapsed ? 'default' : 'ns-resize', background: 'transparent' }}
    />
  )
}

/** 浮动模式的标题栏拖拽：按住顶栏移动整个窗口。 */
function FloatingDragArea(props: { pos: { x: number; y: number }; children: React.ReactNode }): React.ReactElement {
  const [dragging, setDragging] = React.useState(false)

  const onPointerDown = (event: React.PointerEvent): void => {
    // 点在按钮/选择器上时不触发拖动
    if ((event.target as HTMLElement).closest('button,select,input')) return
    event.preventDefault()
    const startX = event.clientX
    const startY = event.clientY
    const originX = props.pos.x
    const originY = props.pos.y
    setDragging(true)
    const move = (ev: PointerEvent): void => {
      setDockPos(
        clampFloatPos(
          { x: originX + ev.clientX - startX, y: originY + ev.clientY - startY },
          { width: window.innerWidth, height: window.innerHeight },
        ),
      )
    }
    const up = (): void => {
      setDragging(false)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      document.body.style.cursor = ''
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    document.body.style.cursor = 'move'
  }

  return <div onPointerDown={onPointerDown} style={{ cursor: dragging ? 'move' : 'default' }}>{props.children}</div>
}

/** 浮动模式的底边拖拽条：调整高度。 */
function FloatResizeEdge(): React.ReactElement {
  const state = useLauncher()
  const onPointerDown = (event: React.PointerEvent): void => {
    event.preventDefault()
    const startY = event.clientY
    const startHeight = state.dockHeight
    const move = (ev: PointerEvent): void => setDockHeight(startHeight + (ev.clientY - startY))
    const up = (): void => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      document.body.style.cursor = ''
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    document.body.style.cursor = 'ns-resize'
  }

  return <div role="separator" aria-label="拖拽调整日志区高度" onPointerDown={onPointerDown} style={{ height: 6, flex: '0 0 auto', cursor: 'ns-resize' }} />
}

/** 标题行：状态 + 实例切换 + 操作（折叠时也保留）。 */
function LogHeader(props: { name: string; floating: boolean }): React.ReactElement {
  const state = useLauncher()
  const instance = activeInstance()

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: HEADER_HEIGHT,
        padding: '0 8px 0 10px',
        boxSizing: 'border-box',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
      }}
    >
      <StateDot />
      <strong style={{ fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {props.name}
      </strong>
      <span style={{ opacity: 0.7, whiteSpace: 'nowrap', flex: '0 0 auto' }}>
        {instance ? stateText(instance.state, instance.stopPhase, instance.exitCode) : '未运行'}
      </span>
      {instance && instance.state === 'running' ? (
        <span style={{ opacity: 0.5, whiteSpace: 'nowrap', flex: '0 0 auto' }}>· {formatUptime(Date.now() - instance.startedAt)}</span>
      ) : null}

      <InstanceSwitcher />

      <span style={{ flex: 1, minWidth: 8 }} />

      <button type="button" style={iconButton} title="吸底（滚到最新并恢复跟随）" onClick={stickToBottom} disabled={!instance}>
        <svg width={14} height={14} viewBox="0 0 16 16" aria-hidden focusable="false">
          <path d="M8 2.5v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M4.5 7.5L8 11l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M3 13h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>

      <button type="button" style={iconButton} title="清空日志" onClick={() => void clearActiveLog()} disabled={!instance}>
        <svg width={14} height={14} viewBox="0 0 16 16" aria-hidden focusable="false">
          <path d="M3.5 4.5h9M6 4.5V3h4v1.5M5 4.5l.6 8h4.8l.6-8" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <button type="button" style={iconButton} title="复制全部日志" onClick={() => void copyLog(state.log)} disabled={!instance}>
        <svg width={14} height={14} viewBox="0 0 16 16" aria-hidden focusable="false">
          <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <path d="M10.5 5.5V4a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      </button>

      {/* 内置 ↔ 独立窗口 */}
      <button
        type="button"
        style={iconButton}
        title={props.floating ? '还原为内置窗口' : '切换为独立窗口'}
        aria-label={props.floating ? '还原为内置窗口' : '切换为独立窗口'}
        onClick={() => setDockMode(props.floating ? 'inline' : 'float')}
      >
        {props.floating ? (
          <svg width={14} height={14} viewBox="0 0 16 16" aria-hidden focusable="false">
            <rect x="2.5" y="8.5" width="5" height="5" rx="1" fill="none" stroke="currentColor" strokeWidth="1.3" />
            <path d="M8 8V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H9" fill="none" stroke="currentColor" strokeWidth="1.3" />
          </svg>
        ) : (
          <svg width={14} height={14} viewBox="0 0 16 16" aria-hidden focusable="false">
            <rect x="2.5" y="2.5" width="7" height="7" rx="1" fill="none" stroke="currentColor" strokeWidth="1.3" />
            <path d="M9.5 9.5h3a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v3" fill="none" stroke="currentColor" strokeWidth="1.3" />
          </svg>
        )}
      </button>

      <button
        type="button"
        style={iconButton}
        title={state.dockCollapsed ? '展开日志窗口' : '折叠日志窗口'}
        onClick={() => setDockCollapsed(!state.dockCollapsed)}
      >
        <svg width={14} height={14} viewBox="0 0 16 16" aria-hidden focusable="false" style={{ transform: state.dockCollapsed ? 'rotate(180deg)' : undefined }}>
          <path d="M4 10l4-4 4 4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      <button type="button" style={iconButton} title="关闭日志窗口（不会停止进程）" onClick={() => setDockOpen(false)}>
        <svg width={14} height={14} viewBox="0 0 16 16" aria-hidden focusable="false">
          <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  )
}

/** 多实例时切换要查看的日志（≥2 个活跃实例才出现）。 */
function InstanceSwitcher(): React.ReactElement | null {
  const state = useLauncher()
  const live = liveInstances()
  if (live.length < 2) return null

  const current = activeInstance()?.id ?? state.activeId ?? ''
  return (
    <select
      value={current}
      onChange={(event) => selectInstance(event.target.value)}
      title="切换要查看的日志实例"
      style={{
        flex: '0 0 auto',
        height: 20,
        maxWidth: 220,
        padding: '0 4px',
        borderRadius: 5,
        border: '1px solid rgba(127,127,127,0.35)',
        background: 'transparent',
        color: 'inherit',
        fontSize: 11,
      }}
    >
      {live.map((item) => (
        <option key={item.id} value={item.id}>
          {item.configName} · {item.id.split('#')[1] ?? item.id}
        </option>
      ))}
    </select>
  )
}

function StateDot(): React.ReactElement {
  const instance = activeInstance()
  const color =
    !instance
      ? '#9ca3af'
      : instance.state === 'failed'
        ? '#dc2626'
        : instance.state === 'running'
          ? '#16a34a'
          : instance.state === 'stopped'
            ? '#9ca3af'
            : '#f59e0b'
  return <span aria-hidden style={{ width: 7, height: 7, borderRadius: 4, background: color, flex: '0 0 auto' }} />
}

function stateText(state: string, stopPhase: string, exitCode?: number): string {
  if (state === 'failed') return `失败 exitCode=${exitCode ?? '?'}`
  if (state === 'stopped') return stopPhase === 'hard-killed' ? '已停止（强制）' : stopPhase === 'soft-killed' ? '已停止（优雅）' : '已停止'
  if (state === 'starting') return '启动中…'
  if (state === 'stopping') return '停止中…'
  return '运行中'
}

async function copyLog(raw: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(toPlainText(raw))
  } catch {
    // 剪贴板不可用（权限/非安全上下文）时静默失败，不影响其它操作
  }
}
