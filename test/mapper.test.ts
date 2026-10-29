// 映射层：把真实工程事实变成可执行命令，并检验"含假设"时是否诚实标注。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { mapSpringBoot } from '../src/mapper/spring-boot.ts'
import { mapNpm } from '../src/mapper/npm.ts'
import { mapJavaApp } from '../src/mapper/java-app.ts'
import { mapToLaunchPlan } from '../src/mapper/index.ts'
import type { IdeaConfig } from '../src/types.ts'

const ydcy = 'D:/codeData/myself/ydcy'

function cfg(patch: Partial<IdeaConfig>): IdeaConfig {
  return {
    name: 'demo',
    type: 'spring-boot',
    origin: 'local',
    workDir: '/p',
    env: {},
    beforeLaunch: [],
    diagnostics: [],
    ...patch,
  }
}

test('mapper: 模块根已解析时进入模块目录跑 spring-boot:run（高可信）', () => {
  const plan = mapSpringBoot(
    cfg({ name: 'svc', moduleName: 'ydcy-auth', moduleRoot: join(ydcy, 'ydcy-auth'), vmParams: '-Xmx512m' }),
    ydcy,
  )
  assert.deepEqual(plan.argv, ['mvn', '-Dmaven.test.skip=true', 'spring-boot:run', '-Dspring-boot.run.jvmArguments=-Xmx512m'])
  assert.equal(plan.cwd, join(ydcy, 'ydcy-auth'))
  assert.equal(plan.confidence, 'high')
})

test('mapper: 模块名有但根没解析出 → -pl 假设 + 低可信 + 明确诊断', () => {
  const plan = mapSpringBoot(cfg({ name: 'ai', moduleName: 'ydcy-modules-ai' }), ydcy)
  assert.deepEqual(plan.argv, ['mvn', '-Dmaven.test.skip=true', '-pl', ':ydcy-modules-ai', 'spring-boot:run'])
  assert.equal(plan.confidence, 'low')
  assert.ok(plan.diagnostics.some((d) => d.code === 'command-assumption' && /commandOverride/.test(d.message)))
})

test('mapper: npm 按锁文件选择包管理器，工作目录取 package.json 所在目录', () => {
  const root = join(process.cwd(), 'test', 'samples', 'npm-pnpm')
  const plan = mapNpm(
    cfg({
      type: 'npm',
      name: 'web',
      packageJson: join(root, 'package.json'),
      npmScript: 'dev',
    }),
    process.cwd(),
  )
  assert.deepEqual(plan.argv, ['pnpm', 'run', 'dev'])
  assert.equal(plan.cwd, root)
  assert.equal(plan.confidence, 'high')
})

test('mapper: 缺 <script> 时按 dev 假设并标低可信（不静默）', () => {
  const plan = mapNpm(cfg({ type: 'npm', name: 'web', packageJson: join(process.cwd(), 'package.json') }), process.cwd())
  assert.equal(plan.confidence, 'low')
  assert.ok(plan.diagnostics.some((d) => d.code === 'command-assumption' && /dev/.test(d.message)))
})

test('mapper: java-app 的 classpath 是近似值，必须标低可信并告警', () => {
  const plan = mapJavaApp(cfg({ type: 'java-app', mainClass: 'demo.Main', vmParams: '-Xms64m' }), '/p')
  assert.deepEqual(plan.argv, ['java', '-Xms64m', '-cp', join('/p', 'target', 'classes'), 'demo.Main'])
  assert.equal(plan.confidence, 'low')
  assert.ok(plan.diagnostics.some((d) => d.message.includes('target/classes')))
})

test('mapper: 覆盖层 commandOverride 覆盖推导命令，且 argv 被清空（避免两份真值）', () => {
  const plan = mapToLaunchPlan(cfg({ name: 'svc', moduleName: 'm' }), '/p', {
    svc: { commandOverride: 'mvn -pl m spring-boot:run -DskipTests' },
  })
  assert.equal(plan?.command, 'mvn -pl m spring-boot:run -DskipTests')
  assert.equal(plan?.argv, undefined)
  assert.equal(plan?.display, 'mvn -pl m spring-boot:run -DskipTests')
  assert.ok(plan?.diagnostics.some((d) => /覆盖层/.test(d.message)))
})

test('mapper: compound 不直接映射（留给 M6 编排），返回 null', () => {
  assert.equal(mapToLaunchPlan(cfg({ type: 'compound', name: 'All' }), '/p'), null)
})

test('mapper: 真实 ydcy 配置映射到模块目录（Maven modules 解析后不再退化为 -pl）', { skip: existsSync(ydcy) ? false : 'ydcy 不在本机' }, async () => {
  const { loadIdeaConfigs } = await import('../src/parser/extract.ts')
  const { configs } = await loadIdeaConfigs(ydcy)
  const auth = configs.find((c) => c.name === 'YiDianAuthApplication')
  const plan = mapToLaunchPlan(auth!, ydcy)
  assert.ok(plan, 'auth 应能映射')
  assert.equal(plan.confidence, 'high')
  assert.equal(plan.cwd, join(ydcy, 'ydcy-auth'))
  assert.equal(plan.launchMode, 'java')
  assert.ok(plan.fastJava, '有主类与模块根时应提供快速启动信息')

  // ydcy-modules-ai 通过 Maven modules 解析到嵌套目录，同样走模块目录（而不是 -pl）
  const ai = configs.find((c) => c.name === 'YiDianAiApplication')
  const aiPlan = mapToLaunchPlan(ai!, ydcy)
  assert.equal(aiPlan?.confidence, 'high')
  assert.match(aiPlan?.cwd ?? '', /ydcy-modules[\\/]ydcy-ai$/)
})
