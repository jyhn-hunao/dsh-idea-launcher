// Compound：真实引用节点是 <toRun name type>，且存在 Compound 嵌套 Compound 的情况。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { XMLParser } from 'fast-xml-parser'
import { extractCompoundRefs, resolveCompound } from '../src/parser/compound.ts'
import type { ConfigType, IdeaConfig } from '../src/types.ts'

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => name === 'toRun',
})

function cfg(name: string, type: ConfigType, refs?: string[]): IdeaConfig {
  return {
    name,
    type,
    origin: 'shared',
    workDir: '/p',
    env: {},
    beforeLaunch: [],
    diagnostics: [],
    referencedConfigs: refs,
  }
}

test('compound: 从真实 <toRun> 形状取引用（ydcy/.run/YDCY All.run.xml 同形）', () => {
  const node = parser.parse(
    '<configuration name="YDCY All" type="CompoundRunConfigurationType" factoryName="Compound">' +
      '<toRun name="YDCY Backend" type="CompoundRunConfigurationType" />' +
      '<toRun name="YDCY UI" type="js.build_tools.npm" />' +
      '<method v="2" />' +
      '</configuration>',
  ).configuration

  const r = extractCompoundRefs(node, 'YDCY All')
  assert.deepEqual(r.names, ['YDCY Backend', 'YDCY UI'])
  assert.deepEqual(r.diagnostics, [])
})

test('compound: 嵌套展开成叶子，顺序按引用、同名只出现一次', () => {
  const configs = [
    cfg('All', 'compound', ['Backend', 'UI']),
    cfg('Backend', 'compound', ['Auth', 'Gateway', 'System']),
    cfg('Auth', 'spring-boot'),
    cfg('Gateway', 'spring-boot'),
    cfg('System', 'spring-boot'),
    cfg('UI', 'npm'),
  ]

  const plan = resolveCompound(configs, 'All')
  assert.deepEqual(plan.leaves.map((c) => c.name), ['Auth', 'Gateway', 'System', 'UI'])
  assert.deepEqual(plan.diagnostics, [])
})

test('compound: 引用成环只报诊断，不无限递归', () => {
  const configs = [cfg('A', 'compound', ['B']), cfg('B', 'compound', ['A'])]
  const plan = resolveCompound(configs, 'A')
  assert.deepEqual(plan.leaves, [])
  assert.ok(plan.diagnostics.some((d) => d.code === 'compound-cycle'))
})

test('异常：引用不存在的配置时报错且不产出叶子', () => {
  const configs = [cfg('A', 'compound', ['Ghost'])]
  const plan = resolveCompound(configs, 'A')
  assert.deepEqual(plan.leaves, [])
  assert.equal(plan.diagnostics[0].code, 'compound-missing-ref')
  assert.match(plan.diagnostics[0].message, /Ghost/)
})
