// 有界环形缓冲：按字节上限淘汰头部，保证日志不会无限吃内存。
// 注意：不用 TS 参数属性（Node 的类型剥离不支持语法改写的 TS 特性）。
export class LogRing {
  private chunks: string[] = []
  private size = 0
  private readonly maxBytes: number

  constructor(maxBytes = 2 * 1024 * 1024) {
    this.maxBytes = maxBytes
  }

  append(text: string): void {
    if (!text) return
    this.chunks.push(text)
    this.size += Buffer.byteLength(text)
    while (this.size > this.maxBytes && this.chunks.length > 0) {
      const removed = this.chunks.shift()
      if (removed === undefined) break
      this.size -= Buffer.byteLength(removed)
    }
  }

  snapshot(): string {
    return this.chunks.join('')
  }

  clear(): void {
    this.chunks = []
    this.size = 0
  }
}
