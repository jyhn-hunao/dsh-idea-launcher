// 乱码修复：Windows 的 PTY 固定按 CP936(GBK) 解释子进程字节（实测 chcp 65001 会清屏丢字，
// 且宿主侧是 UTF-8 流式解码），因此凡是**主动写 UTF-8** 的进程（Spring Boot 默认控制台字符集
// 就是 UTF-8、npm/Vite 也是）在日志里都会变成「UTF-8 字节被当 GBK 解」的乱码。
//
// 修复方式：把文本按 GBK 编回字节，再按 UTF-8 严格解码——
//   - 真乱码（UTF-8 被当 GBK）→ 还原成功；
//   - 真实中文（本来就是 GBK 文本）→ 编回 GBK 字节后按 UTF-8 解码必然失败 → 原样返回，不误伤；
//   - 纯 ASCII 直接跳过。
import iconv from 'iconv-lite'

const CJK = /[\u4e00-\u9fff]/

export function repairMojibake(text: string): string {
  // 1. 没有中文就不处理（日志里大量英文行，避免无谓开销）
  if (!CJK.test(text)) return text
  // 2. 上游已经解出替换字符（U+FFFD）说明字节已丢，救不回来，别二次加工
  if (text.includes('\uFFFD')) return text

  // 3. 按 GBK 编回字节；编不动（含 GBK 不支持的字符）就放弃，保持原文
  let bytes: Buffer
  try {
    bytes = iconv.encode(text, 'gbk')
  } catch {
    return text
  }
  if (bytes.length === 0) return text

  // 4. 严格 UTF-8 解码：失败说明这就是正常的中文（不是乱码），原样返回
  let decoded: string
  try {
    decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return text
  }

  // 5. 还原结果必须仍含中文，且与原文不同，才认为修复有效
  if (decoded === text || !CJK.test(decoded)) return text
  return decoded
}
