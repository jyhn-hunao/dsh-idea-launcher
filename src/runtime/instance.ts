// 运行实例注册表：持有 RunInstance 快照 + 对应的 ProcessDriver。
// 状态机（对齐方案 4.2 / 9.3）：
//   starting ──启动成功──> running ──soft stop──> stopping ──退出──> stopped | failed
//   任何阶段启动失败 → failed（带 reason）
// 退出解读：exitCode===0 → stopped；被信号杀 → stopped + killedBySignal；非 0 → failed。
import type { ConfigType, RunInstance, RunState, StopPhase } from '../types.ts'
import type { ProcessDriver, ProcessExit } from './process.ts'

interface InstanceRecord {
  snapshot: RunInstance
  driver?: ProcessDriver
  /** 失败原因（启动失败或异常退出），用于 UI 与日志 */
  reason?: string
}

export class InstanceRegistry {
  private readonly records = new Map<string, InstanceRecord>()
  private seq = 0

  /** 创建一个 starting 状态的实例（此时还没有 pid）。 */
  create(configName: string, configType: ConfigType): RunInstance {
    this.seq += 1
    const id = `${configName}#${this.seq}`
    const snapshot: RunInstance = {
      id,
      configName,
      configType,
      state: 'starting',
      stopPhase: 'none',
      startedAt: Date.now(),
      logSources: [{ kind: 'process', stream: 'stdout', id: `${id}:console` }],
    }
    this.records.set(id, { snapshot })
    return snapshot
  }

  /** 进程起来后挂上 driver，并进入 running。 */
  attach(id: string, driver: ProcessDriver): void {
    const record = this.records.get(id)
    if (!record) return
    record.driver = driver
    record.snapshot.pid = driver.pid
    record.snapshot.state = 'running'
  }

  /** 启动失败：标记 failed 并记录原因。 */
  fail(id: string, reason: string): void {
    const record = this.records.get(id)
    if (!record) return
    record.reason = reason
    record.snapshot.state = 'failed'
  }

  setState(id: string, state: RunState, stopPhase?: StopPhase): void {
    const record = this.records.get(id)
    if (!record) return
    record.snapshot.state = state
    if (stopPhase) record.snapshot.stopPhase = stopPhase
  }

  /** 进程退出：用户主动停止的一律算 stopped；否则按退出码/信号判定。 */
  applyExit(id: string, exit: ProcessExit): void {
    const record = this.records.get(id)
    if (!record) return
    record.snapshot.exitCode = exit.exitCode ?? undefined
    record.snapshot.signal = exit.signal ?? undefined
    record.snapshot.killedBySignal = Boolean(exit.signal)

    // 停止流程已经介入（stopPhase 非 none）时，非 0 退出码是"被停止"的结果，不是故障
    if (record.snapshot.stopPhase !== 'none') {
      record.snapshot.state = 'stopped'
      return
    }

    // 被信号杀掉（不是我们发的停止流程）= 外部终止，同样算 stopped
    if (exit.signal) {
      record.snapshot.state = 'stopped'
      return
    }

    record.snapshot.state = exit.exitCode === 0 ? 'stopped' : 'failed'
    if (record.snapshot.state === 'failed') {
      record.reason = `exit code ${exit.exitCode}`
    }
  }

  get(id: string): RunInstance | undefined {
    return this.records.get(id)?.snapshot
  }

  driver(id: string): ProcessDriver | undefined {
    return this.records.get(id)?.driver
  }

  reason(id: string): string | undefined {
    return this.records.get(id)?.reason
  }

  list(): RunInstance[] {
    return [...this.records.values()].map((r) => ({ ...r.snapshot }))
  }

  /** 仍在跑的实例（用于卸载清理与状态聚合）。 */
  running(): Array<{ id: string; driver: ProcessDriver }> {
    const out: Array<{ id: string; driver: ProcessDriver }> = []
    for (const [id, record] of this.records) {
      if (record.driver && (record.snapshot.state === 'running' || record.snapshot.state === 'stopping')) {
        out.push({ id, driver: record.driver })
      }
    }
    return out
  }
}
