// ANSI 颜色解析：日志的颜色必须保留，否则 Maven / Spring Boot 的 INFO/WARN/ERROR 没法快速辨别。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseAnsi, spanStyle, stripNonColorEscapes } from '../src/ui/ansi.ts'

test('ansi: 纯文本不产生多个 span，裸 \\r 变换行', () => {
  const spans = parseAnsi('hello\rworld')
  assert.equal(spans.length, 1)
  assert.equal(spans[0].text, 'hello\nworld')
})

test('ansi: 30-37 前景色与 0 重置', () => {
  const spans = parseAnsi('\u001b[31mred\u001b[0m plain')
  assert.deepEqual(
    spans.map((s) => ({ text: s.text, fg: s.fg })),
    [
      { text: 'red', fg: '#e06c75' },
      { text: ' plain', fg: undefined },
    ],
  )
})

test('ansi: 组合参数 1;32（加粗 + 绿）', () => {
  const spans = parseAnsi('\u001b[1;32mOK\u001b[0m')
  assert.equal(spans[0].text, 'OK')
  assert.equal(spans[0].fg, '#98c379')
  assert.equal(spans[0].bold, true)
  assert.equal(spanStyle(spans[0]).fontWeight, 600)
})

test('ansi: 256 色与真彩', () => {
  const c256 = parseAnsi('\u001b[38;5;208mX')
  assert.match(c256[0].fg ?? '', /^rgb\(\d+, \d+, \d+\)$/)
  const rgb = parseAnsi('\u001b[38;2;10;20;30mY')
  assert.equal(rgb[0].fg, 'rgb(10, 20, 30)')
})

test('ansi: 背景色与 49 重置', () => {
  const spans = parseAnsi('\u001b[41mBG\u001b[49mZ')
  assert.equal(spans[0].bg, '#e06c75')
  assert.equal(spans[1].bg, undefined)
})

test('ansi: 非 SGR 的 CSI（清屏/光标）被剥掉，不污染文本', () => {
  const spans = parseAnsi('a\u001b[2Jb\u001b[?25lc')
  assert.equal(spans.map((s) => s.text).join(''), 'abc')
})

test('ansi: 超过 maxSpans 时保留尾部并加省略提示', () => {
  const noisy = Array.from({ length: 10 }, (_, i) => `\u001b[3${i % 8}mline${i}\u001b[0m`).join('')
  const spans = parseAnsi(noisy, 4)
  assert.equal(spans.length, 5)
  assert.match(spans[0].text, /已省略前/)
})

test('ansi: stripNonColorEscapes 保留 SGR、剥离 OSC 标题序列', () => {
  const text = '\u001b]0;title\u0007ok\u001b[32m!\u001b[0m'
  // stripNonColorEscapes 不做 SGR 解析，SGR 仍留在原串里（由 parseAnsi 处理）
  assert.equal(stripNonColorEscapes(text), 'ok\u001b[32m!\u001b[0m')
})
