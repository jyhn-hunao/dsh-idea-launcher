// 解析层端到端：用两份真实工程做回归。
//   test/fixtures        —— grape 的 .idea（local 来源 + npm 的 $USER_HOME$ + 缺失模块）
//   /d/codeData/myself/ydcy —— .run 里的嵌套 Compound + 多模块 Spring Boot（本机存在才跑）
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { loadIdeaConfigs } from '../src/parser/extract.ts'
import { resolveCompound } from '../src/parser/compound.ts'
import { mapToLaunchPlan } from '../src/mapper/index.ts'

const fixtures = join(process.cwd(), 'test', 'fixtures')
const ydcy = 'D:/codeData/myself/ydcy'

test('extract(fixtures): Spring Boot / npm 字段与诊断都正确', async () => {
  const { configs } = await loadIdeaConfigs(fixtures, { userHome: 'C:/Users/demo' })

  // 1. Spring Boot：主类、VM 参数、Before Launch 的 Make 必须被识别成构建任务
  const service = configs.find((c) => c.name === 'Grape-Service-生产Service')
  assert.ok(service, '应解析出 Grape-Service-生产Service')
  assert.equal(service.type, 'spring-boot')
  assert.equal(service.origin, 'local')
  assert.equal(service.mainClass, 'com.xh.cloud.grape.ServiceApplication')
  assert.equal(service.vmParams, '-Xms2048m -Xmx2048m')
  assert.deepEqual(service.beforeLaunch, [{ kind: 'build', option: 'Make' }])
  assert.equal(service.workDir, fixtures)

  // 2. 模块 grape-server 既不在 modules.xml 也没有同名目录 → 必须报错，且不静默顶替
  assert.equal(service.moduleName, 'grape-server')
  assert.equal(service.moduleRoot, undefined)
  assert.ok(service.diagnostics.some((d) => d.code === 'module-unresolved' && d.level === 'error'))

  // 3. npm：脚本取 <script value="serve">，$USER_HOME$ 必须被替换
  const ui = configs.find((c) => c.name === 'Grape-UI-生产Service')
  assert.ok(ui, '应解析出 Grape-UI-生产Service')
  assert.equal(ui.type, 'npm')
  assert.equal(ui.npmCommand, 'run')
  assert.equal(ui.npmScript, 'serve')
  assert.match(ui.packageJson ?? '', /grape-ui[\\/]package\.json$/)
  assert.ok((ui.nodeInterpreter ?? '').startsWith('C:/Users/demo'), `nodeInterpreter=${ui.nodeInterpreter}`)
  assert.ok(!(ui.nodeInterpreter ?? '').includes('$USER_HOME$'))

  // 4. 扫描范围：workspace.xml 里其它 component 的 <configuration> 文本不能被当成运行配置
  assert.equal(configs.some((c) => c.name.includes('Subversion')), false)

  // 5. 未识别类型（JUnit）保留为 unsupported，而不是悄悄丢掉
  assert.ok(configs.some((c) => c.type === 'unsupported'))
})

test('extract(samples): Before Launch 三类任务串起来能落到映射层', async () => {
  // 这份样本按实证形状手写：Make + RunConfigurationTask + LaunchBrowser.Before.Run
  const root = join(process.cwd(), 'test', 'samples', 'before-launch')
  const { configs, diagnostics } = await loadIdeaConfigs(root)

  const web = configs.find((c) => c.name === 'Demo Web')
  assert.ok(web, '应解析出 Demo Web')
  assert.equal(web.type, 'npm')
  assert.deepEqual(diagnostics.filter((d) => d.level === 'error'), [])

  // 1. 三个任务按声明顺序解析，且没有 unsupported
  assert.deepEqual(
    web.beforeLaunch.map((t) => t.kind),
    ['build', 'run-config', 'browser'],
  )
  const runConfig = web.beforeLaunch.find((t) => t.kind === 'run-config')
  assert.equal(runConfig?.kind === 'run-config' ? runConfig.configName : undefined, 'Demo API')
  const browser = web.beforeLaunch.find((t) => t.kind === 'browser')
  assert.equal(browser?.kind === 'browser' ? browser.url : undefined, 'http://localhost:5173')

  // 2. 映射层：npm 的浏览器地址来自 LaunchBrowser 任务，而不是硬编码端口
  const plan = mapToLaunchPlan(web, root)
  assert.equal(plan?.browserUrl, 'http://localhost:5173')
  assert.deepEqual(plan?.argv, ['npm', 'run', 'dev'])
  assert.equal(plan?.confidence, 'high')
})

test('extract(ydcy): 嵌套 Compound 展开与多模块 Spring Boot', { skip: existsSync(join(ydcy, '.run')) ? false : 'ydcy 工程不在本机' }, async () => {
  const { configs } = await loadIdeaConfigs(ydcy)

  // 1. .run 里的 Compound 引用顺序
  const all = configs.find((c) => c.name === 'YDCY All')
  assert.ok(all, '应解析出 YDCY All')
  assert.equal(all.type, 'compound')
  assert.deepEqual(all.referencedConfigs, ['YDCY Backend', 'YDCY UI'])

  // 2. 嵌套展开：Backend 自身是 Compound，必须继续展开成 3 个 Spring Boot 叶子
  const plan = resolveCompound(configs, 'YDCY All')
  assert.deepEqual(plan.leaves.map((c) => c.name), [
    'YiDianAuthApplication',
    'YiDianGatewayApplication',
    'YiDianSystemApplication',
    'YDCY UI',
  ])
  assert.deepEqual(plan.diagnostics, [])

  // 3. npm 叶子字段
  const ui = plan.leaves.find((c) => c.name === 'YDCY UI')
  assert.equal(ui?.npmScript, 'dev')

  // 4. 模块解析：以根 pom 的 <modules> 为准（比"同名目录"可靠），两个模块都能解析到
  const auth = configs.find((c) => c.name === 'YiDianAuthApplication')
  assert.match(auth?.moduleRoot ?? '', /ydcy-auth$/)
  assert.ok(!auth?.diagnostics.some((d) => d.code === 'module-unresolved' && d.level === 'error'))

  // ydcy-modules-ai 的 artifactId 指向嵌套模块 ydcy-modules/ydcy-ai
  const ai = configs.find((c) => c.name === 'YiDianAiApplication')
  assert.match(ai?.moduleRoot ?? '', /ydcy-modules[\\/]ydcy-ai$/)
  assert.ok(!ai?.diagnostics.some((d) => d.code === 'module-unresolved' && d.level === 'error'))
})
