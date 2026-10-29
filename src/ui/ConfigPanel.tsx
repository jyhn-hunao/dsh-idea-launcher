// 运行配置详情浮层：**只放信息**（项目根 / 命令 / cwd / 状态），不放任何文字按钮。
// 启停、强制停止、诊断、日志开关都已挪到顶栏控件的图标段里（见 LauncherPill）。
import React from 'react'
import { activeInstance, followCurrentSession, refreshConfigs, selectedConfig, setSession, useLauncher, useManualRoot } from './state.ts'

export interface ConfigPanelProps {
  sessionId?: string
  onClose?: () => void
}

const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 8 }
const mono: React.CSSProperties = { fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace' }

const iconButton: React.CSSProperties = {
  flex: '0 0 auto',
  width: 26,
  height: 26,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 0,
  borderRadius: 6,
  border: '1px solid rgba(127, 127, 127, 0.35)',
  background: 'transparent',
  color: 'inherit',
  cursor: 'pointer',
}

const linkButton: React.CSSProperties = {
  height: 22,
  padding: '0 4px',
  border: 'none',
  background: 'transparent',
  color: 'inherit',
  fontSize: 12,
  cursor: 'pointer',
  textDecoration: 'underline',
  textUnderlineOffset: 3,
  opacity: 0.85,
}

export function ConfigPanel(props: ConfigPanelProps): React.ReactElement {
  const state = useLauncher()
  const { sessionId, onClose } = props

  React.useEffect(() => {
    setSession(sessionId)
  }, [sessionId])

  const config = selectedConfig()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 14px 14px', fontSize: 12, color: 'inherit' }}>
      {/* 标题行：项目根 + 改手动 + 刷新 + 关闭 */}
      <div style={row}>
        <strong style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>运行配置</strong>
        <span style={{ flex: 1, minWidth: 0, display: 'inline-flex', alignItems: 'baseline', gap: 4, opacity: 0.75 }}>
          <span style={{ whiteSpace: 'nowrap', opacity: 0.8 }}>{state.followSession ? '跟随会话' : '手动'}</span>
          <code
            title={state.followSession ? state.projectRoot : state.manualRoot}
            style={{ ...mono, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {state.followSession ? state.projectRoot || '（等待会话 cwd）' : state.manualRoot || '（未指定）'}
          </code>
          <button
            type="button"
            style={linkButton}
            onClick={() => (state.followSession ? useManualRoot(state.projectRoot) : followCurrentSession())}
          >
            {state.followSession ? '改手动' : '改跟随'}
          </button>
        </span>
        <button type="button" style={iconButton} title="重新读取配置" onClick={() => void refreshConfigs()} disabled={state.loadingConfigs}>
          <svg width={14} height={14} viewBox="0 0 16 16" aria-hidden focusable="false">
            <path d="M12.5 8a4.5 4.5 0 1 1-1.4-3.2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M12 2.5v3h-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {onClose ? (
          <button type="button" style={iconButton} title="关闭" onClick={onClose}>
            <svg width={14} height={14} viewBox="0 0 16 16" aria-hidden focusable="false">
              <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        ) : null}
      </div>

      {/* 手动模式才出现的路径输入 */}
      {state.followSession ? null : <ManualRootInput />}

      {/* 状态：纯文本 */}
      <StatusLine />

      {/* 命令块：命令 + cwd */}
      {config?.plan ? (
        <div
          style={{
            padding: '8px 10px',
            borderRadius: 8,
            border: '1px solid rgba(127, 127, 127, 0.18)',
            background: 'rgba(127, 127, 127, 0.08)',
            ...mono,
            fontSize: 11.5,
            lineHeight: '18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          <span style={{ wordBreak: 'break-all' }}>{config.plan.display}</span>
          <span style={{ opacity: 0.6, wordBreak: 'break-all' }}>cwd {config.plan.cwd}</span>
          {config.plan.jdkName ? (
            <span style={{ opacity: 0.6, wordBreak: 'break-all' }}>
              JDK {config.plan.jdkName}
              {config.plan.javaHome ? `（${config.plan.javaHome}）` : ''}
            </span>
          ) : null}
        </div>
      ) : config ? (
        <div style={{ opacity: 0.7 }}>{config.type} 配置暂不支持在 V1 启动（Compound 编排在 M6）。</div>
      ) : (
        <div style={{ opacity: 0.7 }}>当前项目没有可启动的运行配置。</div>
      )}
    </div>
  )
}

function ManualRootInput(): React.ReactElement {
  const state = useLauncher()
  const [draft, setDraft] = React.useState(state.manualRoot)

  React.useEffect(() => {
    setDraft(state.manualRoot)
  }, [state.manualRoot])

  return (
    <div style={row}>
      <input
        style={{ flex: 1, height: 26, padding: '0 8px', borderRadius: 6, border: '1px solid rgba(127, 127, 127, 0.35)', background: 'transparent', color: 'inherit', fontSize: 12 }}
        value={draft}
        placeholder="项目根目录，例如 D:/codeData/myself/ydcy"
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') useManualRoot(draft)
        }}
        spellCheck={false}
      />
      <button
        type="button"
        onClick={() => useManualRoot(draft)}
        style={{ height: 26, padding: '0 10px', borderRadius: 6, border: '1px solid rgba(127,127,127,0.35)', background: 'transparent', color: 'inherit', fontSize: 12, cursor: 'pointer' }}
      >
        使用
      </button>
    </div>
  )
}

/** 状态行：只描述现状，不提供操作（操作都在顶栏图标段）。 */
function StatusLine(): React.ReactElement {
  const state = useLauncher()
  const instance = activeInstance()
  if (!instance) return <span style={{ opacity: 0.65 }}>{state.error ?? '未运行'}</span>

  const phase =
    instance.stopPhase === 'hard-killed' ? '（强制停止）' : instance.stopPhase === 'soft-killed' ? '（优雅停止）' : ''
  const text =
    instance.state === 'failed'
      ? `失败 exitCode=${instance.exitCode ?? '?'}`
      : instance.state === 'stopped'
        ? `已停止${phase}`
        : instance.state === 'starting'
          ? '启动中…'
          : instance.state === 'stopping'
            ? '停止中…'
            : '运行中'

  const color = instance.state === 'failed' ? '#dc2626' : instance.state === 'running' ? '#16a34a' : 'inherit'
  return <span style={{ color, fontWeight: 500 }}>{text}</span>
}
