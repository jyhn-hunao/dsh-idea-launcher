/**
 * ⚠️ Compound 编排需对照 SDK 补全。
 * 语义（方案 4.4 节）：
 *   1. 解析 referencedConfigs 列表
 *   2. 并行启动所有子配置
 *   3. 任一子实例 failed → 停止所有已启动子实例，Compound 标记 failed
 *   4. 全部 running → Compound running
 *   5. 停止 Compound → 对每个子实例执行两段式停止
 */
export async function runCompound(_refs: string[], _projectRoot: string): Promise<void> {
  throw new Error('TODO: implement compound orchestration')
}
