// 把项目 JDK 信息补进启动计划：IDEA 运行配置不带 JDK，JDK 来自项目 SDK。
// 补进去之后：
//   - Host 起进程时设置 JAVA_HOME / PATH（Maven 与 java 都受用）
//   - 快速启动用该 JDK 的 java，而不是 PATH 上碰巧是哪个
import type { LaunchPlan } from '../types.ts'
import { loadProjectJdk, type ProjectJdk } from '../parser/project-jdk.ts'

/** 同一项目根只解析一次：jdk.table.xml 与 misc.xml 在会话内基本不变。 */
const cache = new Map<string, Promise<ProjectJdk>>()

export async function withProjectJdk(plan: LaunchPlan | null, projectRoot: string): Promise<LaunchPlan | null> {
  if (!plan) return plan
  if (!cache.has(projectRoot)) cache.set(projectRoot, loadProjectJdk(projectRoot))
  const jdk = await cache.get(projectRoot)!
  return {
    ...plan,
    javaHome: jdk.home ?? plan.javaHome,
    jdkName: jdk.name ?? plan.jdkName,
    diagnostics: [...plan.diagnostics, ...jdk.diagnostics],
  }
}
