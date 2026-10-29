// M2 探针进程：用来验证 PTY + SIGINT 两段式停止。
// mode=graceful（默认）：收到 SIGINT 打印标记后正常退出，模拟 Spring Boot 的优雅关闭
// mode=stubborn：忽略 SIGINT，用来验证"宽限期到期 → 强制 terminate"这条降级路径
const mode = process.argv[2] ?? 'graceful'

console.log(`[probe] started pid=${process.pid} mode=${mode}`)

process.on('SIGINT', () => {
  if (mode === 'stubborn') {
    console.log('[probe] SIGINT received but ignored')
    return
  }
  console.log('[probe] SIGINT received, shutting down gracefully')
  process.exit(0)
})

setInterval(() => {}, 1000)
