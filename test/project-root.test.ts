// 项目根解析：跟着当前会话走，还是用手填路径。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveProjectRoot } from '../src/config/project-root.ts'

const sessions = {
  get(id: string) {
    if (id === 'session-with-cwd') return { header: { cwd: 'D:/codeData/myself/ydcy' } }
    if (id === 'session-without-cwd') return { header: {} }
    return undefined
  },
}

test('project-root: 手填路径优先于会话', () => {
  assert.deepEqual(resolveProjectRoot('D:/other', 'session-with-cwd', sessions), {
    projectRoot: 'D:/other',
    source: 'path',
  })
})

test('project-root: 跟随会话时取 SessionHeader.cwd', () => {
  assert.deepEqual(resolveProjectRoot(null, 'session-with-cwd', sessions), {
    projectRoot: 'D:/codeData/myself/ydcy',
    source: 'session',
  })
})

test('project-root: 会话没有 cwd 时明确报错，不拿别的路径顶替', () => {
  const result = resolveProjectRoot(null, 'session-without-cwd', sessions)
  assert.ok('error' in result)
  assert.match(result.error, /cwd/)
})

test('project-root: 未找到会话同样报错，不静默返回空路径', () => {
  const result = resolveProjectRoot(null, 'missing', sessions)
  assert.ok('error' in result)
})

test('project-root: 两个来源都没有时报错（含提示）', () => {
  const result = resolveProjectRoot(undefined, undefined, sessions)
  assert.ok('error' in result)
  assert.match(result.error, /path|sessionId/)
})

test('project-root: sessions 服务缺失时按"无 cwd"报错，不崩溃', () => {
  const result = resolveProjectRoot(null, 'session-with-cwd', undefined)
  assert.ok('error' in result)
})
