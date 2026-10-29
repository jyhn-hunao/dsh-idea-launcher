// 覆盖层：`.dsh/idea-launcher.json`，以 IDEA 配置名为键。
// 只用于「用户在 DSH 里修正命令」——绝不回写 IDEA 的 XML。
// 结构：
//   { "配置名": { "commandOverride": "mvn -pl x spring-boot:run", "cwdOverride": "...", "env": { "K": "V" } } }
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { Diagnostic } from '../types.ts'

export interface OverlayEntry {
  /** 整条命令覆盖（走平台 shell 执行，用户自己负责引号） */
  commandOverride?: string
  cwdOverride?: string
  env?: Record<string, string>
  /** fast=优先直接 java 启动（默认）；maven=强制走 mvn spring-boot:run */
  launchMode?: 'fast' | 'maven'
}

export type Overlay = Record<string, OverlayEntry>

export interface OverlayReadResult {
  overlay: Overlay
  diagnostics: Diagnostic[]
}

export function overlayPath(projectRoot: string): string {
  return join(projectRoot, '.dsh', 'idea-launcher.json')
}

/** 读覆盖层：文件不存在 = 没有覆盖（合法）；内容非法 = 明确诊断，不当成空覆盖静默吞掉。 */
export async function readOverlay(projectRoot: string): Promise<OverlayReadResult> {
  const path = overlayPath(projectRoot)
  let text: string
  try {
    text = await readFile(path, 'utf8')
  } catch {
    return { overlay: {}, diagnostics: [] }
  }

  try {
    const parsed: unknown = JSON.parse(text)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return {
        overlay: {},
        diagnostics: [
          { level: 'error', code: 'overlay-invalid', ref: path, message: '覆盖层必须是「配置名 → 覆盖项」的对象' },
        ],
      }
    }
    const overlay: Overlay = {}
    const diagnostics: Diagnostic[] = []
    for (const [name, value] of Object.entries(parsed as Record<string, unknown>)) {
      const entry = toEntry(value, name, path, diagnostics)
      if (entry) overlay[name] = entry
    }
    return { overlay, diagnostics }
  } catch (error) {
    return {
      overlay: {},
      diagnostics: [
        {
          level: 'error',
          code: 'overlay-invalid',
          ref: path,
          message: `覆盖层 JSON 解析失败：${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    }
  }
}

function toEntry(value: unknown, name: string, path: string, diagnostics: Diagnostic[]): OverlayEntry | undefined {
  if (typeof value !== 'object' || value === null) {
    diagnostics.push({ level: 'error', code: 'overlay-invalid', ref: name, message: `${path} 里 "${name}" 不是对象` })
    return undefined
  }
  const raw = value as Record<string, unknown>
  const entry: OverlayEntry = {}
  if (typeof raw.commandOverride === 'string' && raw.commandOverride.trim().length > 0) {
    entry.commandOverride = raw.commandOverride.trim()
  }
  if (typeof raw.cwdOverride === 'string' && raw.cwdOverride.trim().length > 0) {
    entry.cwdOverride = raw.cwdOverride.trim()
  }
  if (raw.launchMode === 'maven' || raw.launchMode === 'fast') entry.launchMode = raw.launchMode
  if (raw.env && typeof raw.env === 'object') {
    const env: Record<string, string> = {}
    for (const [key, v] of Object.entries(raw.env as Record<string, unknown>)) {
      if (typeof v === 'string') env[key] = v
    }
    if (Object.keys(env).length > 0) entry.env = env
  }
  return Object.keys(entry).length > 0 ? entry : undefined
}

export async function writeOverlay(projectRoot: string, overlay: Overlay): Promise<void> {
  const path = overlayPath(projectRoot)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(overlay, null, 2)}\n`, 'utf8')
}
