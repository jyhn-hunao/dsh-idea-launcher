// 快速启动（java 直启）的纯函数与文件系统判断。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, utimes } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, sep } from 'node:path'
import {
  buildJavaArgv,
  classpathStale,
  inspectFastJava,
  needsCompile,
  normalizeClasspath,
} from '../src/runtime/fast-java.ts'

test('fast-java: buildJavaArgv 拼出 java + vm + -cp + 主类 + 程序参数', () => {
  const argv = buildJavaArgv(
    { projectRoot: 'D:/p', moduleRoot: 'D:/p/mod', mainClass: 'demo.Main', vmParams: '-Xms64m -Xmx128m', programParams: '--profile=dev' },
    '/deps/a.jar:/deps/b.jar',
  )
  assert.equal(argv[0], 'java')
  assert.deepEqual(argv.slice(1, 3), ['-Xms64m', '-Xmx128m'])
  const cpIndex = argv.indexOf('-cp')
  assert.ok(cpIndex > 0)
  assert.match(argv[cpIndex + 1], /[\\/]target[\\/]classes/)
  assert.match(argv[cpIndex + 1], /a\.jar/)
  assert.equal(argv[cpIndex + 2], 'demo.Main')
  assert.equal(argv[cpIndex + 3], '--profile=dev')
})

test('fast-java: classpath 归一化支持多行，按平台分隔符拼接', () => {
  const joiner = sep === '\\' ? ';' : ':'
  assert.equal(normalizeClasspath('a.jar\r\nb.jar\n'), `a.jar${joiner}b.jar`)
})

test('fast-java: 编译/依赖缓存过期判定', () => {
  assert.equal(needsCompile(100, 0), true)
  assert.equal(needsCompile(100, 200), false)
  assert.equal(needsCompile(300, 200), true)
  assert.equal(classpathStale(100, 0), true)
  assert.equal(classpathStale(100, 200), false)
  assert.equal(classpathStale(300, 200), true)
})

test('fast-java: 首次 inspect 需要重建 classpath 与编译；写入时间戳后不再需要', async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), 'launcher-fast-'))
  const moduleRoot = join(projectRoot, 'mod')
  await mkdir(join(moduleRoot, 'src', 'main', 'java', 'demo'), { recursive: true })
  await writeFile(join(moduleRoot, 'pom.xml'), '<project/>')
  await writeFile(join(moduleRoot, 'src', 'main', 'java', 'demo', 'Main.java'), 'class Main {}')

  const spec = { projectRoot, moduleRoot, mainClass: 'demo.Main' }
  const first = await inspectFastJava(spec)
  assert.equal(first.needsClasspath, true)
  assert.equal(first.needsCompile, true)
  assert.ok(first.notes.some((note) => note.includes('首次')))

  // 模拟：classpath 已生成、编译已完成
  await mkdir(join(projectRoot, '.dsh', 'idea-launcher'), { recursive: true })
  await writeFile(first.classpathPath, 'a.jar')
  const { stampFastJava } = await import('../src/runtime/fast-java.ts')
  const future = Date.now() + 1000
  await stampFastJava(spec, { classpathAt: future, compiledAt: future })

  const second = await inspectFastJava(spec)
  assert.equal(second.needsClasspath, false)
  assert.equal(second.needsCompile, false)

  // 源码比编译时间戳更新 → 需要重编
  const newer = Date.now() + 5000
  await utimes(join(moduleRoot, 'src', 'main', 'java', 'demo', 'Main.java'), newer / 1000, newer / 1000)
  const third = await inspectFastJava(spec)
  assert.equal(third.needsCompile, true)
})
