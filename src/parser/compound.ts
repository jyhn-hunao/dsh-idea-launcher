// Compound 配置解析与展开。
// 真实形状（ydcy/.run 实测）：
//   <configuration name="YDCY All" type="CompoundRunConfigurationType" factoryName="Compound">
//     <toRun name="YDCY Backend" type="CompoundRunConfigurationType" />
//     <toRun name="YDCY UI" type="js.build_tools.npm" />
//     <method v="2" />
//   </configuration>
// 注意：Compound 会嵌套 Compound（YDCY All → YDCY Backend → 3 个 Spring Boot），
// 所以展开必须递归 + 去重 + 防环。
import type { CompoundPlan, Diagnostic, IdeaConfig } from '../types.ts'

export interface CompoundRefsResult {
  names: string[]
  diagnostics: Diagnostic[]
}

/** 从单个 Compound 配置节点取 <toRun> 引用（按声明顺序）。 */
export function extractCompoundRefs(node: any, configName = ''): CompoundRefsResult {
  const names: string[] = []
  const diagnostics: Diagnostic[] = []

  const list = Array.isArray(node?.toRun) ? node.toRun : node?.toRun ? [node.toRun] : []

  for (const item of list) {
    const name = item?.['@_name']
    if (typeof name !== 'string' || name.length === 0) {
      diagnostics.push({
        level: 'warn',
        code: 'compound-missing-ref',
        ref: configName,
        message: '<toRun> 节点缺少 name 属性，已跳过该引用',
      })
      continue
    }
    if (!names.includes(name)) names.push(name)
  }

  return { names, diagnostics }
}

/**
 * 展开 Compound：递归取得所有叶子配置。
 * 语义（对齐 IDEA）：Compound 子配置并行启动，各自独立实例；
 * 任一引用缺失/成环都属于配置错误，只报诊断、不猜替代项。
 */
export function resolveCompound(configs: readonly IdeaConfig[], rootName: string): CompoundPlan {
  const byName = new Map<string, IdeaConfig>()
  for (const config of configs) byName.set(config.name, config)

  const leaves: IdeaConfig[] = []
  const diagnostics: Diagnostic[] = []
  const visited = new Set<string>()

  // 1. 深度优先展开，path 用于环检测（只对当前递归栈敏感）
  const walk = (name: string, path: string[]): void => {
    const config = byName.get(name)
    if (!config) {
      diagnostics.push({
        level: 'error',
        code: 'compound-missing-ref',
        ref: name,
        message: `Compound 引用的配置不存在："${name}"`,
      })
      return
    }

    if (path.includes(name)) {
      diagnostics.push({
        level: 'error',
        code: 'compound-cycle',
        ref: name,
        message: `Compound 引用成环：${[...path, name].join(' → ')}`,
      })
      return
    }

    // 2. 非 Compound 即叶子；同名叶子只保留第一次出现（保持引用顺序）
    if (config.type !== 'compound') {
      if (!visited.has(name)) {
        visited.add(name)
        leaves.push(config)
      }
      return
    }

    // 3. Compound 自身不进 leaves，只展开其引用
    for (const ref of config.referencedConfigs ?? []) {
      walk(ref, [...path, name])
    }
  }

  walk(rootName, [])
  return { leaves, diagnostics }
}
