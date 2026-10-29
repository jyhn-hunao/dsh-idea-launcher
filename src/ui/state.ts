// 客户端状态：项目根 / 配置列表 / 实例快照 / 日志增量，全部由 Host API 驱动。
// 项目根默认「跟随当前会话」：顶栏拿到 sessionId，Host 用 ctx.sessions.get(id).header.cwd 解析，
// 切换会话即自动换项目（与 dsh-graph 看板按项目加载同一思路）；也可切成手动指定。
import React from 'react'
import type { Diagnostic } from '../types.ts'
import { clampDockHeight } from './format.ts'

const API = '/idea-launcher/api'
const MANUAL_ROOT_KEY = 'dsh-idea-launcher:manualRoot'
const FOLLOW_KEY = 'dsh-idea-launcher:followSession'
const DOCK_OPEN_KEY = 'dsh-idea-launcher:dockOpen'
const DOCK_COLLAPSED_KEY = 'dsh-idea-launcher:dockCollapsed'
const DOCK_HEIGHT_KEY = 'dsh-idea-launcher:dockHeight'
const DOCK_MODE_KEY = 'dsh-idea-launcher:dockMode'
const DOCK_POS_KEY = 'dsh-idea-launcher:dockPos'
const POLL_MS = 1000

export interface PlanView {
  display: string
  confidence: 'high' | 'low'
  cwd: string
  argv?: string[]
  command?: string
  diagnostics: Diagnostic[]
  /** 项目 SDK 名（如 ms-21）与 JDK 根目录：来自 .idea/misc.xml + jdk.table.xml */
  jdkName?: string
  javaHome?: string
  launchMode?: 'maven' | 'java'
}

export interface ConfigView {
  name: string
  type: string
  origin: string
  moduleName?: string
  moduleRoot?: string
  plan: PlanView | null
}

export interface InstanceView {
  id: string
  configName: string
  configType: string
  state: 'starting' | 'running' | 'stopping' | 'stopped' | 'failed'
  stopPhase: 'none' | 'soft-killed' | 'hard-killed'
  startedAt: number
  exitCode?: number
  pid?: number
}

export interface LauncherState {
  /** 配置浮层是否打开（顶栏 pill 的 ▾）：只有打开时才拉实例状态与日志 */
  active: boolean
  /** 底部日志窗口是否显示 */
  dockOpen: boolean
  /** 底部日志窗口是否折叠成一行标题 */
  dockCollapsed: boolean
  /** 日志区高度（px，可拖拽） */
  dockHeight: number
  /** inline=底部内置；float=独立浮动窗口 */
  dockMode: 'inline' | 'float'
  /** 浮动窗口左上角坐标；null=右下角默认位置 */
  dockPos: { x: number; y: number } | null
  /** 递增即触发日志区回到底部（吸底按钮用） */
  logStick: number
  /** 当前会话 id（顶栏注入），followSession 时用它解析项目根 */
  sessionId: string | null
  followSession: boolean
  /** Host 解析出的实际项目根 */
  projectRoot: string
  rootSource: 'session' | 'path' | null
  /** 手动模式下用户记住的路径 */
  manualRoot: string
  configs: ConfigView[]
  selected: string | null
  loadingConfigs: boolean
  error: string | null
  diagnostics: Diagnostic[]
  instances: InstanceView[]
  activeId: string | null
  log: string
  logOffset: number
}

let state: LauncherState = {
  active: false,
  dockOpen: readFlag(DOCK_OPEN_KEY, false),
  dockCollapsed: readFlag(DOCK_COLLAPSED_KEY, false),
  dockHeight: readNumber(DOCK_HEIGHT_KEY, 240),
  dockMode: readMode(DOCK_MODE_KEY),
  dockPos: readPos(DOCK_POS_KEY),
  logStick: 0,
  sessionId: null,
  followSession: readFlag(FOLLOW_KEY, true),
  projectRoot: '',
  rootSource: null,
  manualRoot: readString(MANUAL_ROOT_KEY),
  configs: [],
  selected: null,
  loadingConfigs: false,
  error: null,
  diagnostics: [],
  instances: [],
  activeId: null,
  log: '',
  logOffset: 0,
}

const listeners = new Set<() => void>()

export function getState(): LauncherState {
  return state
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  ensureTimer()
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) stopTimer()
  }
}

function set(patch: Partial<LauncherState>): void {
  state = { ...state, ...patch }
  for (const listener of listeners) listener()
}

function readString(key: string): string {
  try {
    return globalThis.localStorage?.getItem(key) ?? ''
  } catch {
    return ''
  }
}

function readFlag(key: string, fallback: boolean): boolean {
  try {
    const raw = globalThis.localStorage?.getItem(key)
    return raw === null || raw === undefined ? fallback : raw === '1'
  } catch {
    return fallback
  }
}

function readNumber(key: string, fallback: number): number {
  const raw = readString(key)
  const value = Number(raw)
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function readMode(key: string): 'inline' | 'float' {
  return readString(key) === 'float' ? 'float' : 'inline'
}

function readPos(key: string): { x: number; y: number } | null {
  const raw = readString(key)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as { x?: unknown; y?: unknown }
    if (typeof parsed.x === 'number' && typeof parsed.y === 'number') return { x: parsed.x, y: parsed.y }
  } catch {
    // 解析失败按默认位置处理
  }
  return null
}

function writeStorage(key: string, value: string): void {
  try {
    globalThis.localStorage?.setItem(key, value)
  } catch {
    // localStorage 不可用只影响"记住上次"，不影响功能
  }
}

// ── 轮询：只在面板打开时拉实例与日志增量 ───────────────────────────────────
let timer: ReturnType<typeof setInterval> | undefined
let polling = false

function ensureTimer(): void {
  if (timer) return
  timer = setInterval(() => {
    void tick()
  }, POLL_MS)
}

function stopTimer(): void {
  if (!timer) return
  clearInterval(timer)
  timer = undefined
}

async function tick(): Promise<void> {
  // 浮层与底部日志窗口都没打开时不轮询（顶栏常驻订阅，否则会每秒空转打 Host）
  if (!state.active && !state.dockOpen) return
  if (polling) return
  polling = true
  try {
    await refreshInstances()
    await pullLogs()
  } finally {
    polling = false
  }
}

// ── 项目根解析 ──────────────────────────────────────────────────────────
/** 顶栏每次挂载/切换会话时调用；会话变了且处于跟随模式就重新读配置。 */
export function setSession(sessionId: string | null | undefined): void {
  const next = sessionId ?? null
  if (state.sessionId === next) return
  set({ sessionId: next })
  if (state.followSession) void refreshConfigs()
}

/** 面板开合时由顶栏按钮调用：打开即开始轮询，关闭即停。 */
export function setPanelActive(active: boolean): void {
  set({ active })
  if (active && state.configs.length === 0) void refreshConfigs()
}

// ── 底部日志窗口 ────────────────────────────────────────────────────────
export function setDockOpen(open: boolean): void {
  writeStorage(DOCK_OPEN_KEY, open ? '1' : '0')
  set({ dockOpen: open, ...(open ? { dockCollapsed: false } : {}) })
  if (open && !state.dockCollapsed) writeStorage(DOCK_COLLAPSED_KEY, '0')
}

export function setDockCollapsed(collapsed: boolean): void {
  writeStorage(DOCK_COLLAPSED_KEY, collapsed ? '1' : '0')
  set({ dockCollapsed: collapsed })
}

/** 拖拽调整日志区高度；限制在 [120, 720]，避免拖成一条缝或占满整屏。 */
export function setDockHeight(height: number): void {
  const next = clampDockHeight(height)
  if (next === state.dockHeight) return
  writeStorage(DOCK_HEIGHT_KEY, String(next))
  set({ dockHeight: next })
}

/** 内置 ↔ 独立浮动窗口。 */
export function setDockMode(mode: 'inline' | 'float'): void {
  writeStorage(DOCK_MODE_KEY, mode)
  set({ dockMode: mode })
}

/** 浮动窗口位置（拖标题栏移动时写入）。 */
export function setDockPos(pos: { x: number; y: number }): void {
  writeStorage(DOCK_POS_KEY, JSON.stringify(pos))
  set({ dockPos: pos })
}

/** 吸底：让日志视图滚到底并恢复跟随。 */
export function stickToBottom(): void {
  set({ logStick: state.logStick + 1 })
}


/** 清空当前实例的日志缓冲（Host 侧 ring + 本地偏移一起重置）。 */
export async function clearActiveLog(): Promise<void> {
  const instance = activeInstance()
  if (!instance) return
  try {
    const response = await fetch(`${API}/clear`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id: instance.id }),
    })
    if (!response.ok) return
    set({ log: '', logOffset: 0, logStick: state.logStick + 1 })
  } catch {
    // 清空失败不阻塞操作，下一次轮询会重新拉回已有内容
  }
}

/** 切回跟随模式：丢掉手动路径，按当前会话重新解析。 */
export function followCurrentSession(): void {
  writeStorage(FOLLOW_KEY, '1')
  set({ followSession: true })
  void refreshConfigs()
}

/** 手动模式：用用户填的路径，并记住它。 */
export function useManualRoot(root: string): void {
  const manualRoot = root.trim()
  writeStorage(FOLLOW_KEY, '0')
  writeStorage(MANUAL_ROOT_KEY, manualRoot)
  set({ followSession: false, manualRoot })
  void refreshConfigs()
}

export async function refreshConfigs(): Promise<void> {
  const query =
    state.followSession && state.sessionId
      ? `sessionId=${encodeURIComponent(state.sessionId)}`
      : state.manualRoot
        ? `path=${encodeURIComponent(state.manualRoot)}`
        : null

  if (!query) {
    set({
      loadingConfigs: false,
      error: state.followSession ? '还没有会话上下文，无法跟随项目；可改为手动指定项目根' : '先填项目根目录',
    })
    return
  }

  set({ loadingConfigs: true, error: null })
  try {
    const response = await fetch(`${API}/configs?${query}`)
    const body = await response.json()
    if (!response.ok || !body.ok) throw new Error(body?.error?.message ?? `HTTP ${response.status}`)

    const configs = body.configs as ConfigView[]
    const firstRunnable = configs.find((c) => c.plan !== null)?.name ?? configs[0]?.name ?? null
    const keep = state.selected && configs.some((c) => c.name === state.selected) ? state.selected : firstRunnable

    set({
      configs,
      diagnostics: body.diagnostics ?? [],
      selected: keep,
      loadingConfigs: false,
      projectRoot: body.projectRoot,
      rootSource: body.rootSource ?? null,
      // 切换项目时旧实例的日志不再对应当前配置，清掉避免误导
      activeId: null,
      log: '',
      logOffset: 0,
    })
  } catch (error) {
    set({ loadingConfigs: false, error: error instanceof Error ? error.message : String(error) })
  }
}

// ── 配置与实例 ──────────────────────────────────────────────────────────
export function select(name: string): void {
  set({ selected: name, activeId: null, log: '', logOffset: 0 })
}

export function selectedConfig(): ConfigView | undefined {
  return state.configs.find((c) => c.name === state.selected)
}

export function activeInstance(): InstanceView | undefined {
  if (state.activeId) {
    const hit = state.instances.find((i) => i.id === state.activeId)
    if (hit) return hit
  }
  return state.instances.find((i) => i.configName === state.selected && isLive(i.state))
}

/** 所有活跃实例（多配置并行时用于日志切换与状态展示）。 */
export function liveInstances(): InstanceView[] {
  return state.instances.filter((i) => isLive(i.state))
}

/** 某个配置最近的一个活跃实例——多实例语义下，运行键作用于"这个配置"，而不是"全局当前实例"。 */
export function instanceFor(configName: string | null | undefined): InstanceView | undefined {
  if (!configName) return undefined
  const matches = state.instances.filter((i) => i.configName === configName && isLive(i.state))
  return matches[matches.length - 1]
}

/** 切换正在查看的日志实例（不改运行状态）。 */
export function selectInstance(id: string): void {
  if (state.activeId === id) return
  set({ activeId: id, log: '', logOffset: 0 })
}

function isLive(s: InstanceView['state']): boolean {
  return s === 'starting' || s === 'running' || s === 'stopping'
}

export async function start(): Promise<void> {
  const config = selectedConfig()
  if (!config) {
    set({ error: '还没选择运行配置' })
    return
  }
  if (config.plan === null) {
    set({ error: `"${config.name}" 是 ${config.type} 配置，M6 才支持一键编排` })
    return
  }

  const target = state.followSession && state.sessionId ? { sessionId: state.sessionId } : { projectRoot: state.manualRoot }
  set({ error: null })
  try {
    const response = await fetch(`${API}/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...target, configName: config.name }),
    })
    const body = await response.json()
    if (!response.ok || !body.ok) throw new Error(body?.error?.message ?? `HTTP ${response.status}`)
    // 启动成功就把日志窗口叫出来（IDEA 里按 Run 也会弹出 Run 工具窗）
    writeStorage(DOCK_OPEN_KEY, '1')
    writeStorage(DOCK_COLLAPSED_KEY, '0')
    set({ activeId: body.instance.id, log: '', logOffset: 0, dockOpen: true, dockCollapsed: false })
    await refreshInstances()
    // 启动后立刻拉一次日志：否则首行最多要等一个轮询周期（1s）才出现，观感上会显得"启动慢"
    await pullLogs()
  } catch (error) {
    set({ error: error instanceof Error ? error.message : String(error) })
  }
}

export async function stopActive(mode: 'soft' | 'hard' = 'soft'): Promise<void> {
  const instance = activeInstance()
  if (!instance) return
  await stopInstance(instance.id, mode)
}

/** 全部停止：对所有活跃实例执行停止（Host 侧逐个 terminate）。 */
export async function stopAll(): Promise<void> {
  try {
    const response = await fetch(`${API}/stop-all`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
    const body = await response.json()
    if (!response.ok || !body.ok) throw new Error(body?.error?.message ?? `HTTP ${response.status}`)
    await refreshInstances()
  } catch (error) {
    set({ error: error instanceof Error ? error.message : String(error) })
  }
}

/** 按实例 id 停止：多实例/多配置并行时必须能指定是谁。 */
export async function stopInstance(id: string, mode: 'soft' | 'hard' = 'soft'): Promise<void> {
  try {
    const response = await fetch(`${API}/stop`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id, mode }),
    })
    const body = await response.json()
    if (!response.ok || !body.ok) throw new Error(body?.error?.message ?? `HTTP ${response.status}`)
    await refreshInstances()
  } catch (error) {
    set({ error: error instanceof Error ? error.message : String(error) })
  }
}

export async function refreshInstances(): Promise<void> {
  try {
    const response = await fetch(`${API}/instances`)
    const body = await response.json()
    if (body.ok) set({ instances: body.instances as InstanceView[] })
  } catch {
    // 轮询失败不打扰用户：下一次再试
  }
}

async function pullLogs(): Promise<void> {
  const instance = activeInstance()
  if (!instance) return

  const offset = state.activeId === instance.id ? state.logOffset : 0
  try {
    const response = await fetch(`${API}/logs?id=${encodeURIComponent(instance.id)}&since=${offset}`)
    const body = await response.json()
    if (!body.ok) return
    set({
      activeId: instance.id,
      log: offset === 0 ? body.text : state.log + body.text,
      logOffset: body.offset,
    })
  } catch {
    // 同上
  }
}

export function useLauncher(): LauncherState {
  return React.useSyncExternalStore(subscribe, getState)
}
