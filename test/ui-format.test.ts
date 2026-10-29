// 纯文本与时长格式化：日志复制、底部窗口计时都依赖它们。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toPlainText } from '../src/ui/ansi.ts'
import { clampDockHeight, clampFloatPos, formatUptime } from '../src/ui/format.ts'

test('toPlainText: 去掉颜色转义，只留可读文本', () => {
  const raw = '\u001b[32m[INFO]\u001b[0m started \u001b[1;31mboom\u001b[0m'
  assert.equal(toPlainText(raw), '[INFO] started boom')
})

test('toPlainText: 光标/清屏/OSC 也被剥掉', () => {
  const raw = '\u001b[2Ja\u001b[?25lb\u001b]0;title\u0007c'
  assert.equal(toPlainText(raw), 'abc')
})

test('formatUptime: 秒 / 分秒 / 时分', () => {
  assert.equal(formatUptime(0), '0s')
  assert.equal(formatUptime(999), '0s')
  assert.equal(formatUptime(59_000), '59s')
  assert.equal(formatUptime(61_000), '1m01s')
  assert.equal(formatUptime(3_600_000), '1h00m')
  assert.equal(formatUptime(3_723_000), '1h02m')
})

test('formatUptime: 负数按 0 处理（时钟漂移时不出现 -1s）', () => {
  assert.equal(formatUptime(-5000), '0s')
})

test('clampDockHeight: 120~720 之间，非法值回默认 240', () => {
  assert.equal(clampDockHeight(50), 120)
  assert.equal(clampDockHeight(2000), 720)
  assert.equal(clampDockHeight(360), 360)
  assert.equal(clampDockHeight(Number.NaN), 240)
})

test('clampFloatPos: 保证至少留出可抓取区域，且不出左/上边界', () => {
  const viewport = { width: 1200, height: 800 }
  assert.deepEqual(clampFloatPos({ x: -100, y: -50 }, viewport), { x: 8, y: 8 })
  assert.deepEqual(clampFloatPos({ x: 5000, y: 5000 }, viewport), { x: 1080, y: 740 })
  assert.deepEqual(clampFloatPos({ x: 300, y: 200 }, viewport), { x: 300, y: 200 })
})
