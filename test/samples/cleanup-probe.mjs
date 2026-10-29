// 卸载清理探针：每 200ms 往文件里写一行，用来验证"插件禁用/重载时实例被真正终止"。
// 用法：node test/samples/cleanup-probe.mjs <输出文件>
import { appendFileSync } from 'node:fs'

const out = process.argv[2]
if (!out) {
  console.error('[cleanup-probe] 缺少输出文件参数')
  process.exit(2)
}

console.log('[cleanup-probe] started pid=' + process.pid)
appendFileSync(out, `start pid=${process.pid} at=${Date.now()}\n`)
setInterval(() => appendFileSync(out, `tick ${Date.now()}\n`), 200)
