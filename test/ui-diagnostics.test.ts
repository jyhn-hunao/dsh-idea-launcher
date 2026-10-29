// 诊断展示策略：页面上只留计数徽标，明细进弹窗；其它配置的告警不进页面。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dedupeDiagnostics, diagnosticsSummary, isRelevantDiagnostic } from '../src/ui/diagnostics.ts'
import type { Diagnostic } from '../src/types.ts'

const d = (patch: Partial<Diagnostic>): Diagnostic => ({ level: 'warn', code: 'module-unresolved', message: 'm', ...patch })

test('diagnostics: 只保留当前配置、无 ref、文件级三类', () => {
  assert.equal(isRelevantDiagnostic(d({ ref: 'Grape-Service' }), 'Grape-Service'), true)
  assert.equal(isRelevantDiagnostic(d({ ref: '其它配置' }), 'Grape-Service'), false)
  assert.equal(isRelevantDiagnostic(d({ ref: undefined }), 'Grape-Service'), true)
  assert.equal(isRelevantDiagnostic(d({ ref: 'D:/p/.idea/workspace.xml', code: 'parse-error' }), 'x'), true)
  assert.equal(isRelevantDiagnostic(d({ ref: '.dsh/idea-launcher.json', code: 'overlay-invalid' }), 'x'), true)
})

test('diagnostics: 去重按 level+ref+message，保留第一次出现', () => {
  const items = [d({ message: 'same' }), d({ message: 'same' }), d({ message: 'other', level: 'error' })]
  assert.equal(dedupeDiagnostics(items).length, 2)
})

test('diagnostics: 计数文案区分错误与警告', () => {
  assert.equal(diagnosticsSummary([d({ level: 'error' })]).label, '1 错误')
  assert.equal(diagnosticsSummary([d({}), d({})]).label, '2 警告')
  assert.equal(diagnosticsSummary([d({ level: 'error' }), d({})]).label, '1 错误 · 1 警告')
  assert.equal(diagnosticsSummary([]).label, '')
})
