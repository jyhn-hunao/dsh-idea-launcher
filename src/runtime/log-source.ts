import { LogRing } from './log-ring.js'

export class ProcessLogSource {
  readonly kind = 'process' as const
  readonly ring: LogRing
  constructor(public readonly stream: 'stdout' | 'stderr', maxBytes?: number) {
    this.ring = new LogRing(maxBytes)
  }
}

// ⚠️ 文件日志源需实现：
// - Ant 模式 → 实际文件路径（首版可用 fast-glob 近似，或用 minimatch 手动遍历）
// - skipContent=true 时只追新内容
// - 低频轮询（默认 1s）读取新增内容写入 ring
// - 需对照 dsh-shell / Node fs 能力确认是否可用 fs.watch
export class FileLogSource {
  readonly kind = 'file' as const
  readonly ring: LogRing
  constructor(
    public readonly tabName: string,
    public readonly pattern: string,
    public readonly skipContent: boolean,
    maxBytes?: number,
  ) {
    this.ring = new LogRing(maxBytes)
  }

  async startWatching(): Promise<void> {
    // TODO(harness): 实现文件监视，参考方案 6.1 节
  }

  async stopWatching(): Promise<void> {
    // TODO(harness)
  }
}
