// Before Launch：真实形状只有 Make 有样本；其余必须保留原始属性并报诊断，不能按名字猜语义。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { XMLParser } from 'fast-xml-parser'
import { extractBeforeLaunch } from '../src/parser/before-launch.ts'

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => name === 'option' || name === 'method',
})

function configNode(inner: string): any {
  return parser.parse(`<configuration name="demo" type="SpringBootApplicationConfigurationType">${inner}</configuration>`).configuration
}

test('before-launch: <method><option name="Make"/> 识别为构建任务（真实样本形状）', () => {
  const r = extractBeforeLaunch(configNode('<method v="2"><option name="Make" enabled="true" /></method>'), 'demo')
  assert.deepEqual(r.tasks, [{ kind: 'build', option: 'Make' }])
  assert.deepEqual(r.diagnostics, [])
})

test('before-launch: 空 method 表示没有任务，不产生任务也不告警', () => {
  const r = extractBeforeLaunch(configNode('<method v="2" />'), 'demo')
  assert.deepEqual(r.tasks, [])
  assert.deepEqual(r.diagnostics, [])
})

test('before-launch: 未识别任务保留原始属性并产出诊断（不猜字段）', () => {
  const r = extractBeforeLaunch(
    configNode('<method v="2"><option name="SomeUnknownTask" enabled="true" foo="bar" /></method>'),
    'demo',
  )
  assert.equal(r.tasks.length, 1)
  const task = r.tasks[0]
  assert.equal(task.kind, 'unsupported')
  if (task.kind === 'unsupported') {
    assert.equal(task.option, 'SomeUnknownTask')
    assert.equal(task.attrs['@_foo'], 'bar')
  }
  assert.equal(r.diagnostics.length, 1)
  assert.equal(r.diagnostics[0].code, 'before-launch-unrecognized')
  assert.match(r.diagnostics[0].message, /foo/)
})

test('before-launch: RunConfigurationTask 解析出被引用的配置（属性名来自 IntelliJ 源码）', () => {
  const r = extractBeforeLaunch(
    configNode(
      '<method v="2"><option name="RunConfigurationTask" enabled="true" ' +
        'run_configuration_name="Grape-Service-生产Service" ' +
        'run_configuration_type="SpringBootApplicationConfigurationType" ' +
        'run_configuration_target="any" /></method>',
    ),
    'demo',
  )
  assert.deepEqual(r.tasks, [
    {
      kind: 'run-config',
      option: 'RunConfigurationTask',
      configName: 'Grape-Service-生产Service',
      configType: 'SpringBootApplicationConfigurationType',
      target: 'any',
    },
  ])
  assert.deepEqual(r.diagnostics, [])
})

test('before-launch: LaunchBrowser.Before.Run 解析出 url/browser/withDebugger', () => {
  const r = extractBeforeLaunch(
    configNode(
      '<method v="2"><option name="LaunchBrowser.Before.Run" enabled="true" ' +
        'url="http://localhost:5173" browser="chrome" withDebugger="true" /></method>',
    ),
    'demo',
  )
  assert.deepEqual(r.tasks, [
    {
      kind: 'browser',
      option: 'LaunchBrowser.Before.Run',
      url: 'http://localhost:5173',
      browser: 'chrome',
      withDebugger: true,
    },
  ])
  assert.deepEqual(r.diagnostics, [])
})

test('异常：已知任务缺必填属性时落 malformed 诊断且不产出任务', () => {
  const r = extractBeforeLaunch(
    configNode('<method v="2"><option name="LaunchBrowser.Before.Run" enabled="true" browser="chrome" /></method>'),
    'demo',
  )
  assert.deepEqual(r.tasks, [])
  assert.equal(r.diagnostics.length, 1)
  assert.equal(r.diagnostics[0].code, 'before-launch-malformed')
  assert.match(r.diagnostics[0].message, /url/)
})

test('边界：enabled="false" 的任务被跳过且不告警', () => {
  const r = extractBeforeLaunch(configNode('<method v="2"><option name="Make" enabled="false" /></method>'), 'demo')
  assert.deepEqual(r.tasks, [])
  assert.deepEqual(r.diagnostics, [])
})

test('异常：完全缺少 <method> 时返回空结果而不是抛错', () => {
  const r = extractBeforeLaunch(configNode(''), 'demo')
  assert.deepEqual(r.tasks, [])
  assert.deepEqual(r.diagnostics, [])
})
