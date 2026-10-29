// 项目 JDK 解析：misc.xml 的 SDK 名 + IDEA jdk.table.xml 的 homePath。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { javaExecutable, parseJdkTable, readProjectJdkName } from '../src/parser/project-jdk.ts'
import { buildJavaArgv } from '../src/runtime/fast-java.ts'

const JDK_TABLE = `<?xml version="1.0" encoding="UTF-8"?>
<application>
  <component name="ProjectJdkTable">
    <jdk version="2">
      <name value="17" />
      <type value="JavaSDK" />
      <version value="Oracle OpenJDK 17.0.10" />
      <homePath value="D:/Java/Jdk17" />
    </jdk>
    <jdk version="2">
      <name value="ms-21" />
      <type value="JavaSDK" />
      <version value="Microsoft OpenJDK 21.0.12" />
      <homePath value="D:\\java\\jdk21" />
    </jdk>
  </component>
</application>`

test('project-jdk: 从 jdk.table.xml 解析出 SDK 名到 homePath（反斜杠归一化）', () => {
  const entries = parseJdkTable(JDK_TABLE)
  assert.equal(entries.length, 2)
  assert.equal(entries[0].name, '17')
  assert.equal(entries[0].home, 'D:/Java/Jdk17')
  assert.equal(entries[1].name, 'ms-21')
  assert.equal(entries[1].home, 'D:/java/jdk21')
})

test('project-jdk: 读 .idea/misc.xml 的 project-jdk-name 与 languageLevel', async () => {
  const root = await mkdtemp(join(tmpdir(), 'launcher-jdk-'))
  await mkdir(join(root, '.idea'), { recursive: true })
  await writeFile(
    join(root, '.idea', 'misc.xml'),
    '<project version="4"><component name="ProjectRootManager" version="2" languageLevel="JDK_21" default="true" project-jdk-name="ms-21" project-jdk-type="JavaSDK" /></project>',
  )
  const result = await readProjectJdkName(root)
  assert.equal(result.name, 'ms-21')
  assert.equal(result.languageLevel, 'JDK_21')
})

test('project-jdk: 没有 misc.xml 时不报错、不编造 SDK 名', async () => {
  const root = await mkdtemp(join(tmpdir(), 'launcher-jdk-empty-'))
  const result = await readProjectJdkName(root)
  assert.equal(result.name, undefined)
})

test('project-jdk: buildJavaArgv 用项目 JDK 的 java，而不是 PATH 上的', () => {
  const argv = buildJavaArgv(
    { projectRoot: 'D:/p', moduleRoot: 'D:/p/mod', mainClass: 'demo.Main', javaHome: 'D:/java/jdk21' },
    'deps.jar',
  )
  assert.match(argv[0], /jdk21[\\/]bin[\\/]java(\.exe)?$/)
  assert.equal(javaExecutable('D:/java/jdk21'), join('D:/java/jdk21', 'bin', process.platform === 'win32' ? 'java.exe' : 'java'))

  const fallback = buildJavaArgv({ projectRoot: 'D:/p', moduleRoot: 'D:/p/mod', mainClass: 'demo.Main' }, 'deps.jar')
  assert.equal(fallback[0], 'java')
})
