// 配置列表过滤：图标之外还要能搜（grape 有 29 条配置，纯列表翻起来很慢）。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { filterConfigs } from '../src/ui/filter.ts'
import { typeLabel } from '../src/ui/config-type.ts'

const configs = [
  { name: 'Grape-Service', type: 'spring-boot' },
  { name: 'Grape-UI', type: 'npm' },
  { name: 'deviceConfigurationTest', type: 'unsupported' },
  { name: 'YDCY All', type: 'compound' },
]

test('filter: 空查询保持原顺序与全部条目', () => {
  assert.deepEqual(filterConfigs(configs, '  '), configs)
})

test('filter: 按名称匹配，大小写不敏感', () => {
  assert.deepEqual(
    filterConfigs(configs, 'grape').map((c) => c.name),
    ['Grape-Service', 'Grape-UI'],
  )
  assert.deepEqual(
    filterConfigs(configs, 'DEVICE').map((c) => c.name),
    ['deviceConfigurationTest'],
  )
})

test('filter: 也能按类型标签搜（spring boot / npm / compound）', () => {
  assert.deepEqual(
    filterConfigs(configs, 'spring').map((c) => c.name),
    ['Grape-Service'],
  )
  assert.deepEqual(
    filterConfigs(configs, 'npm').map((c) => c.name),
    ['Grape-UI'],
  )
  assert.deepEqual(
    filterConfigs(configs, 'compound').map((c) => c.name),
    ['YDCY All'],
  )
})

test('filter: 无匹配返回空数组（调用方显示"没有匹配的配置"）', () => {
  assert.deepEqual(filterConfigs(configs, 'zzz'), [])
})

test('config-type: 类型标签覆盖五类，未知类型落到"未支持"', () => {
  assert.equal(typeLabel('spring-boot'), 'Spring Boot')
  assert.equal(typeLabel('npm'), 'npm')
  assert.equal(typeLabel('java-app'), 'Java')
  assert.equal(typeLabel('compound'), 'Compound')
  assert.equal(typeLabel('unsupported'), '未支持')
  assert.equal(typeLabel('something-else'), '未支持')
})
