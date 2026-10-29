// ANSI SGR 解析：把日志里的终端颜色还原成可渲染的 span。
// 之前为了去控制序列把 ANSI 全剥掉了，颜色也随之丢失——这里只剥"非颜色"的序列，保留颜色/加粗/下划线。
// 支持的 SGR：0/1/2/3/4/22/24/30-37/39/40-47/49/90-97/100-107，以及 38;5;n 与 38;2;r;g;b（同理 48）。
import type { CSSProperties } from 'react'

export interface LogSpan {
  text: string
  fg?: string
  bg?: string
  bold?: boolean
  dim?: boolean
  underline?: boolean
}

interface AnsiState {
  fg?: string
  bg?: string
  bold?: boolean
  dim?: boolean
  underline?: boolean
}

// 16 色（One Dark 风格：深浅背景都可读）
const BASIC = ['#3f3f46', '#e06c75', '#98c379', '#d19a66', '#61afef', '#c678dd', '#56b6c2', '#dcdfe4']
const BRIGHT = ['#7f848e', '#ef7d87', '#b5e08e', '#e6b676', '#83c1f5', '#d79ae8', '#72ccd8', '#ffffff']

/** 任意 CSI / OSC / 单字符转义（含 `?` 这类私有模式参数） */
const GENERIC_ESCAPE = /^\u001b(?:\[[0-9;?]*[ -/]*[@-~]|\][^\u0007]*\u0007|[@-_])/

/** 裸 \r 变换行（保留 \r\n），否则进度条会把整行覆盖成一堆重复文本 */
function normalizeNewlines(text: string): string {
  return text.replace(/\r(?!\n)/g, '\n')
}

/** 只保留可渲染文本：剥掉非 SGR 的转义（SGR 原样保留，供渲染层解析颜色）。 */
export function stripNonColorEscapes(input: string): string {
  let out = ''
  let index = 0
  while (index < input.length) {
    const escapeAt = input.indexOf('\u001b', index)
    if (escapeAt < 0) {
      out += normalizeNewlines(input.slice(index))
      break
    }
    out += normalizeNewlines(input.slice(index, escapeAt))

    const rest = input.slice(escapeAt)
    const sgr = /^\u001b\[([0-9;]*)m/.exec(rest)
    if (sgr) {
      out += sgr[0]
      index = escapeAt + sgr[0].length
      continue
    }

    const generic = GENERIC_ESCAPE.exec(rest)
    index = escapeAt + (generic ? generic[0].length : 1)
  }
  return out
}

export function parseAnsi(input: string, maxSpans = 4000): LogSpan[] {
  // 1. 无 ESC 的常规情况走快路径，避免无谓的正则开销
  if (!input.includes('\u001b')) return [{ text: normalizeNewlines(input) }]

  const spans: LogSpan[] = []
  let state: AnsiState = {}
  let index = 0

  const push = (raw: string): void => {
    const text = normalizeNewlines(raw)
    if (!text) return
    const last = spans[spans.length - 1]
    // 2. 相邻同样式文本合并，减少 span 数量（大日志渲染更快）
    if (last && sameStyle(last, state)) {
      last.text += text
      return
    }
    spans.push({ text, ...state })
  }

  while (index < input.length) {
    const escapeAt = input.indexOf('\u001b', index)
    if (escapeAt < 0) {
      push(input.slice(index))
      break
    }
    if (escapeAt > index) push(input.slice(index, escapeAt))

    const rest = input.slice(escapeAt)
    const sgr = /^\u001b\[([0-9;]*)m/.exec(rest)
    if (sgr) {
      // 3. 只处理 SGR；其它转义（光标/清屏/OSC）直接丢弃
      state = applySgr(state, sgr[1])
      index = escapeAt + sgr[0].length
      continue
    }

    const generic = GENERIC_ESCAPE.exec(rest)
    index = escapeAt + (generic ? generic[0].length : 1)
  }

  // 4. 超长时保留尾部（用户关心最新输出），并标注被截断
  if (spans.length > maxSpans) {
    const kept = spans.slice(spans.length - maxSpans)
    kept.unshift({ text: `…（已省略前 ${spans.length - maxSpans} 段彩色内容）\n`, dim: true })
    return kept
  }
  return spans
}

function sameStyle(span: LogSpan, state: AnsiState): boolean {
  return (
    span.fg === state.fg &&
    span.bg === state.bg &&
    Boolean(span.bold) === Boolean(state.bold) &&
    Boolean(span.dim) === Boolean(state.dim) &&
    Boolean(span.underline) === Boolean(state.underline)
  )
}

function applySgr(current: AnsiState, params: string): AnsiState {
  const codes = params.length === 0 ? [0] : params.split(';').map((value) => Number(value) || 0)
  let state: AnsiState = { ...current }

  for (let i = 0; i < codes.length; i += 1) {
    const code = codes[i]
    if (code === 0) {
      state = {}
    } else if (code === 1) {
      state.bold = true
    } else if (code === 2) {
      state.dim = true
    } else if (code === 22) {
      state.bold = false
      state.dim = false
    } else if (code === 4) {
      state.underline = true
    } else if (code === 24) {
      state.underline = false
    } else if (code >= 30 && code <= 37) {
      state.fg = BASIC[code - 30]
    } else if (code === 39) {
      state.fg = undefined
    } else if (code >= 90 && code <= 97) {
      state.fg = BRIGHT[code - 90]
    } else if (code >= 40 && code <= 47) {
      state.bg = BASIC[code - 40]
    } else if (code === 49) {
      state.bg = undefined
    } else if (code >= 100 && code <= 107) {
      state.bg = BRIGHT[code - 100]
    } else if (code === 38 || code === 48) {
      // 扩展色：38;5;n（256 色）或 38;2;r;g;b（真彩）
      const mode = codes[i + 1]
      if (mode === 5) {
        const color = color256(codes[i + 2] ?? 0)
        if (code === 38) state.fg = color
        else state.bg = color
        i += 2
      } else if (mode === 2) {
        const color = `rgb(${codes[i + 2] ?? 0}, ${codes[i + 3] ?? 0}, ${codes[i + 4] ?? 0})`
        if (code === 38) state.fg = color
        else state.bg = color
        i += 4
      } else {
        i += 1
      }
    }
  }

  return state
}

/** 256 色 → CSS 颜色：0-15 用基础表，16-231 走 6×6×6 色立方，232-255 是灰阶。 */
function color256(index: number): string {
  const n = Math.max(0, Math.min(255, index))
  if (n < 8) return BASIC[n]
  if (n < 16) return BRIGHT[n - 8]
  if (n < 232) {
    const value = n - 16
    const steps = [0, 95, 135, 175, 215, 255]
    const r = steps[Math.floor(value / 36)]
    const g = steps[Math.floor((value % 36) / 6)]
    const b = steps[value % 6]
    return `rgb(${r}, ${g}, ${b})`
  }
  const gray = 8 + (n - 232) * 10
  return `rgb(${gray}, ${gray}, ${gray})`
}

export function spanStyle(span: LogSpan): CSSProperties {
  const style: CSSProperties = {}
  if (span.fg) style.color = span.fg
  if (span.bg) style.backgroundColor = span.bg
  if (span.bold) style.fontWeight = 600
  if (span.dim) style.opacity = 0.65
  if (span.underline) style.textDecoration = 'underline'
  return style
}

/** 去掉所有转义后的纯文本（复制到剪贴板用）。 */
export function toPlainText(input: string): string {
  return parseAnsi(input)
    .map((span) => span.text)
    .join('')
}
