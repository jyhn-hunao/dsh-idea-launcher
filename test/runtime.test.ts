// 进程层纯函数与环形缓冲：不依赖 PTY，可在 CI/无宿主环境下回归。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildTerminalArgv } from '../src/runtime/process.ts'
import { InstanceRegistry } from '../src/runtime/instance.ts'
import { LogRing } from '../src/runtime/log-ring.ts'

test('process: Windows 用 cmd /d /s /c 包裹命令（与 IDEA 交给 shell 执行一致）', () => {
  assert.deepEqual(buildTerminalArgv('windows', 'cmd.exe', 'mvn spring-boot:run'), [
    'cmd.exe',
    '/d',
    '/s',
    '/c',
    'mvn spring-boot:run',
  ])
  assert.deepEqual(buildTerminalArgv('windows', undefined, 'npm run dev')[0], 'cmd.exe')
})

test('process: POSIX 用默认 shell -c；命令作为单个 argv 元素，不做额外分词', () => {
  assert.deepEqual(buildTerminalArgv('posix', '/bin/zsh', 'npm run dev -- --host'), [
    '/bin/zsh',
    '-c',
    'npm run dev -- --host',
  ])
})

test('log-ring: 超过上限时按块淘汰头部（不切碎单块），snapshot 始终不超过上限', () => {
  const ring = new LogRing(10)
  ring.append('abcdef')
  ring.append('ghij')
  assert.equal(ring.snapshot(), 'abcdefghij')
  ring.append('klm')
  // 淘汰以"追加块"为粒度：'abcdef' 整块被丢弃，'ghijklm' 保留
  assert.equal(ring.snapshot(), 'ghijklm')
  assert.ok(Buffer.byteLength(ring.snapshot()) <= 10)
  ring.clear()
  assert.equal(ring.snapshot(), '')
})

test('instance: 退出码 0 → stopped；非 0 → failed；被信号杀 → stopped + killedBySignal', () => {
  const registry = new InstanceRegistry()

  const a = registry.create('svc', 'spring-boot')
  registry.setState(a.id, 'running')
  registry.applyExit(a.id, { exitCode: 0, signal: null })
  assert.equal(registry.get(a.id)?.state, 'stopped')

  const b = registry.create('svc', 'spring-boot')
  registry.applyExit(b.id, { exitCode: 2, signal: null })
  assert.equal(registry.get(b.id)?.state, 'failed')
  assert.equal(registry.reason(b.id), 'exit code 2')

  const c = registry.create('svc', 'spring-boot')
  registry.applyExit(c.id, { exitCode: null, signal: 'SIGINT' })
  assert.equal(registry.get(c.id)?.state, 'stopped')
  assert.equal(registry.get(c.id)?.killedBySignal, true)
})

test('instance: 同名配置多次创建得到不同实例 id（多实例隔离的基础）', () => {
  const registry = new InstanceRegistry()
  const a = registry.create('Grape-UI', 'npm')
  const b = registry.create('Grape-UI', 'npm')
  assert.notEqual(a.id, b.id)
  assert.equal(registry.list().length, 2)
})
