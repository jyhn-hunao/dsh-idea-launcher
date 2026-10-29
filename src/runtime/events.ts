import type { RunInstance } from '../types.js'

export const EVT = {
  state: 'idea-launcher:state',
  logAppend: 'idea-launcher:log-append',
  logQuery: 'idea-launcher:log-query',
  instancesQuery: 'idea-launcher:instances-query',
} as const

export interface StatePayload { instance: RunInstance }
export interface LogAppendPayload { instanceId: string; sourceId: string; chunk: string }
export interface LogQueryPayload { instanceId: string; sourceId: string }
export interface LogQueryResult { baseline: string }
