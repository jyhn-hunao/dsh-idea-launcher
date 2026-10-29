// 项目根解析：显式 path 优先；否则用 sessionId 查该会话的 cwd（SessionHeader.cwd，绝对路径）。
// 抽成纯函数便于单测——"跟随当前项目"是这套 UI 的核心语义，不能只靠手工点。
export interface SessionsLike {
  get(id: string): { header?: { cwd?: string } } | undefined
  /** 诊断用：能列出会话就把它带出来，方便看清"为什么解析不到 cwd" */
  list?(): Array<{ id: string; header?: { cwd?: string } }>
}

export interface ResolvedRoot {
  projectRoot: string
  source: 'path' | 'session'
}

export function resolveProjectRoot(
  pathValue: string | null | undefined,
  sessionIdValue: string | null | undefined,
  sessions: SessionsLike | undefined,
): ResolvedRoot | { error: string } {
  // 1. 手填路径优先（用户可随时覆盖跟随行为）
  if (pathValue && pathValue.trim().length > 0) {
    return { projectRoot: pathValue.trim(), source: 'path' }
  }

  // 2. 跟随会话：cwd 来自 SessionHeader，是宿主校验过的绝对路径
  if (sessionIdValue && sessionIdValue.length > 0) {
    const session = sessions?.get(sessionIdValue)
    const cwd = session?.header?.cwd
    if (cwd) return { projectRoot: cwd, source: 'session' }
    return { error: `会话 ${sessionIdValue} 没有可用的 cwd（SessionHeader.cwd 未设置）` }
  }

  return { error: '需要 path（手动指定项目根）或 sessionId（跟随会话 cwd）' }
}
