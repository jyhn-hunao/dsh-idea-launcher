// 日志视图：保留 ANSI 颜色（终端日志靠颜色区分 INFO/WARN/ERROR），并做吸底。
// 大日志只渲染尾部：整段 2MB 文本逐字符解析 + 数千 DOM 节点会明显卡顿。
import React from 'react'
import { parseAnsi, spanStyle } from './ansi.ts'

/** 只渲染最后这么多字符（约 20 万字符），超出部分截断并提示 */
const TAIL_CHARS = 200_000

export function LogView(props: { text: string; height?: number | string; stickSignal?: number }): React.ReactElement {
  const { text, height = '100%', stickSignal = 0 } = props
  const ref = React.useRef<HTMLPreElement | null>(null)
  const following = React.useRef(true)

  // 1. 取尾部 + 解析 ANSI；两者都是纯计算，按 text 缓存
  const { spans, truncated } = React.useMemo(() => {
    const clipped = text.length > TAIL_CHARS
    const tail = clipped ? text.slice(text.length - TAIL_CHARS) : text
    return { spans: parseAnsi(tail), truncated: clipped }
  }, [text])

  // 2. 内容更新后：只有在「跟随」状态才滚到底
  React.useEffect(() => {
    const node = ref.current
    if (!node || !following.current) return
    node.scrollTop = node.scrollHeight
  }, [spans])

  // 3. 外部点「吸底」：恢复跟随并跳到底部
  React.useEffect(() => {
    const node = ref.current
    if (!node) return
    following.current = true
    node.scrollTop = node.scrollHeight
  }, [stickSignal])

  // 3. 用户上滚超过 8px 即暂停跟随，回到底部再恢复
  const onScroll = React.useCallback(() => {
    const node = ref.current
    if (!node) return
    following.current = node.scrollHeight - node.scrollTop - node.clientHeight < 8
  }, [])

  return (
    <pre
      ref={ref}
      onScroll={onScroll}
      style={{
        margin: 0,
        // 背景与边框由外层容器（日志窗口）统一提供，这里透明并撑满，避免"背景跟随文字长度"
        flex: 1,
        width: '100%',
        height,
        minHeight: 0,
        boxSizing: 'border-box',
        overflow: 'auto',
        padding: '8px 10px',
        background: 'transparent',
        fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
        fontSize: 12,
        lineHeight: '17px',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
      }}
    >
      {truncated ? (
        <span style={{ opacity: 0.55 }}>{`…（仅显示最后 ${TAIL_CHARS.toLocaleString()} 个字符）\n`}</span>
      ) : null}
      {spans.length === 0 ? (
        <span style={{ opacity: 0.55 }}>（暂无输出）</span>
      ) : (
        spans.map((span, index) => (
          <span key={index} style={spanStyle(span)}>
            {span.text}
          </span>
        ))
      )}
    </pre>
  )
}
