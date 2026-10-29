// 乱码修复：UTF-8 被按 GBK 解释的文本要还原；正常中文与英文不能被误伤。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import iconv from 'iconv-lite'
import { repairMojibake } from '../src/runtime/encoding-fix.ts'

/** 模拟 Windows PTY：UTF-8 字节被当作 GBK 解码后的样子。 */
function asMojibake(text: string): string {
  return iconv.decode(Buffer.from(text, 'utf8'), 'gbk')
}

test('encoding-fix: 还原「UTF-8 被当 GBK 解」的中文', () => {
  const original = '错误: 找不到或无法加载主类 com.xh.mlw.MlmServerMainApplication'
  const broken = asMojibake(original)
  assert.notEqual(broken, original)
  assert.equal(repairMojibake(broken), original)
})

test('encoding-fix: 正常中文（GBK 文本）与纯英文原样返回，不误伤', () => {
  assert.equal(repairMojibake('这是一段正常的中文日志'), '这是一段正常的中文日志')
  assert.equal(repairMojibake('[INFO] Started Application in 3.2s'), '[INFO] Started Application in 3.2s')
  assert.equal(repairMojibake('中文 mixed with English'), '中文 mixed with English')
})

test('encoding-fix: 已含替换字符的文本不再二次加工；空串安全', () => {
  assert.equal(repairMojibake('坏字节 \uFFFD 中文'), '坏字节 \uFFFD 中文')
  assert.equal(repairMojibake(''), '')
})
