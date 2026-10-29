// 变量替换：已知变量必须替换，未知变量必须「保留原文 + 登记」，不能静默留空或拿别的值顶替。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { substituteVars } from '../src/parser/vars.ts'

const ctx = { projectRoot: 'D:/proj', moduleRoot: 'D:/proj/mod-a', userHome: 'C:/Users/u' }

test('vars: 替换 PROJECT_DIR / MODULE_DIR / USER_HOME', () => {
  const r = substituteVars('$PROJECT_DIR$/.idea/$MODULE_DIR$/x', ctx)
  assert.equal(r.text, 'D:/proj/.idea/D:/proj/mod-a/x')
  assert.deepEqual(r.unknown, [])
})

test('vars: 没有模块根时 MODULE_DIR 视为未知，且不拿项目根顶替', () => {
  const r = substituteVars('$MODULE_DIR$/src', { projectRoot: 'D:/proj' })
  assert.equal(r.text, '$MODULE_DIR$/src')
  assert.deepEqual(r.unknown, ['MODULE_DIR'])
})

test('vars: 未知变量保留原文并按出现顺序去重登记', () => {
  const r = substituteVars('$FOO$/$BAR$/$FOO$', ctx)
  assert.equal(r.text, '$FOO$/$BAR$/$FOO$')
  assert.deepEqual(r.unknown, ['FOO', 'BAR'])
})

test('边界：空输入不产出 undefined 字符串', () => {
  assert.deepEqual(substituteVars(undefined, ctx), { text: '', unknown: [] })
  assert.deepEqual(substituteVars('', ctx), { text: '', unknown: [] })
})
