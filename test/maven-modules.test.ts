// Maven 模块解析：以根 pom 的 <modules> 为准，避免"项目里同名目录有两处"导致的歧义。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadMavenModules } from '../src/parser/maven-modules.ts'
import { resolveModuleRoot } from '../src/parser/modules.ts'

test('maven-modules: 递归读取 modules 声明，按 artifactId / 目录名 / 相对路径建索引', async () => {
  const root = await mkdtemp(join(tmpdir(), 'launcher-mvn-'))
  const serverDir = join(root, 'backend', 'proj-main', 'server-main')
  await mkdir(serverDir, { recursive: true })
  await mkdir(join(root, 'log', 'server-main'), { recursive: true }) // 干扰项：同名目录
  await writeFile(
    join(root, 'pom.xml'),
    '<project><modules><module>backend/proj-main/server-main</module></modules></project>',
  )
  await writeFile(
    join(serverDir, 'pom.xml'),
    '<project><parent><artifactId>parent-artifact</artifactId></parent><artifactId>server-main</artifactId></project>',
  )

  const map = await loadMavenModules(root)
  assert.equal(map.byKey.get('server-main'), serverDir)
  assert.equal(map.byKey.get('backend/proj-main/server-main'), serverDir)

  // 有了 Maven 模块表，"同名目录歧义"就不再发生
  const resolved = await resolveModuleRoot('server-main', root, new Map(), map.byKey)
  assert.equal(resolved.reason, 'maven-modules')
  assert.equal(resolved.root, serverDir)
})

test('maven-modules: 没有 pom.xml 时返回空表，不报错', async () => {
  const root = await mkdtemp(join(tmpdir(), 'launcher-mvn-empty-'))
  const map = await loadMavenModules(root)
  assert.equal(map.byKey.size, 0)
  assert.deepEqual(map.diagnostics, [])
})

test('maven-modules: 真实 mlw 工程（若存在）能解析 mlw-server-main', { skip: existsSync('D:/codeData/workData/workCode/mlw/pom.xml') ? false : 'mlw 不在本机' }, async () => {
  const root = 'D:/codeData/workData/workCode/mlw'
  const map = await loadMavenModules(root)
  const resolved = await resolveModuleRoot('mlw-server-main', root, new Map(), map.byKey)
  assert.equal(resolved.reason, 'maven-modules')
  assert.match(resolved.root ?? '', /backend[\\/]mlw-project-main[\\/]mlw-server-main$/)
})
