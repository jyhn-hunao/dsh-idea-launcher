// Spring Boot → 启动计划。
// 真实约束（ydcy / grape 两份工程实测）：
//   1. 配置里带 <module name="...">，多模块 Maven 必须在模块目录执行，或在根目录用 -pl；
//   2. 模块根可能解析不出来（modules.xml 过期）→ 这时按 -pl <模块名> 给一条低可信度命令，
//      并在 diagnostics 里说明，UI 会标"命令含假设"；
//   3. VM/PROGRAM 参数走 Maven 的 spring-boot.run.*，Gradle 走 --args / org.gradle.jvmargs。
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { IdeaConfig, LaunchPlan } from '../types.ts'
import { formatCommand, hasGradle, makePlan, planDiagnostic } from './facts.ts'

export function mapSpringBoot(cfg: IdeaConfig, projectRoot: string): LaunchPlan {
  const diagnostics = [...cfg.diagnostics]
  const workdir = cfg.workDir || projectRoot
  const vm = cfg.vmParams?.trim()
  const program = cfg.programParams?.trim()
  const browser = cfg.beforeLaunch.find((t) => t.kind === 'browser')
  const browserUrl = browser?.kind === 'browser' ? browser.url : undefined

  // 1. Gradle：wrapper 存在即按 Gradle 处理（模块根优先，其次工作目录）
  const gradleRoot = cfg.moduleRoot ?? workdir
  if (hasGradle(gradleRoot) || hasGradle(projectRoot)) {
    const root = hasGradle(gradleRoot) ? gradleRoot : projectRoot
    const wrapper = join(root, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew')
    const argv = [existsSync(wrapper) ? wrapper : 'gradle', 'bootRun']
    if (vm) argv.push(`-Dorg.gradle.jvmargs=${vm}`)
    if (program) argv.push(`--args=${program}`)
    return makePlan({ argv, cwd: root, beforeLaunch: cfg.beforeLaunch, browserUrl, confidence: 'high', diagnostics })
  }

  // 2. Maven + 模块根已解析：优先走"快速启动"（缓存 classpath + 直接 java -cp），
  //    没有主类时退回 mvn spring-boot:run。fallback 命令仍然保留在 argv 里，Host 失败会回退。
  if (cfg.moduleRoot) {
    const argv = ['mvn', '-Dmaven.test.skip=true', 'spring-boot:run']
    if (vm) argv.push(`-Dspring-boot.run.jvmArguments=${vm}`)
    if (program) argv.push(`-Dspring-boot.run.arguments=${program}`)

    const fastJava =
      cfg.mainClass && cfg.moduleRoot
        ? { moduleRoot: cfg.moduleRoot, mainClass: cfg.mainClass, vmParams: vm, programParams: program }
        : undefined

    // 展示用命令：快速启动时给出等价的 java 命令（classpath 由 Host 在启动时解析）
    const display = fastJava
      ? `java ${vm ?? ''} -cp <target/classes + 依赖classpath> ${cfg.mainClass} ${program ?? ''}`.replace(/\s+/g, ' ').trim()
      : undefined

    return makePlan({
      argv,
      cwd: cfg.moduleRoot,
      beforeLaunch: cfg.beforeLaunch,
      browserUrl,
      confidence: 'high',
      diagnostics,
      fastJava,
      launchMode: fastJava ? 'java' : 'maven',
      display,
    })
  }

  // 3. Maven + 模块名在但根没解析出：退回项目根用 -pl，属"含假设"，必须标出来
  if (cfg.moduleName) {
    // -pl 的裸目录名 Maven 不认（mlw 实测：Could not find the selected project in the reactor），
    // 用  选择器；模块名通常就是 artifactId，仍未解析到时才走到这里
    const argv = ['mvn', '-Dmaven.test.skip=true', '-pl', `:${cfg.moduleName}`, 'spring-boot:run']
    if (vm) argv.push(`-Dspring-boot.run.jvmArguments=${vm}`)
    if (program) argv.push(`-Dspring-boot.run.arguments=${program}`)
    diagnostics.push(
      planDiagnostic(
        'warn',
        'command-assumption',
        cfg.name,
        `模块根未解析，命令按 "-pl ${cfg.moduleName}" 推出：${formatCommand(argv)}；若构建失败，请在 .dsh/idea-launcher.json 里用 commandOverride 修正`,
      ),
    )
    return makePlan({ argv, cwd: workdir, beforeLaunch: cfg.beforeLaunch, browserUrl, confidence: 'low', diagnostics })
  }

  // 4. 无模块声明：单模块工程，项目根直接跑
  const argv = ['mvn', '-Dmaven.test.skip=true', 'spring-boot:run']
  if (vm) argv.push(`-Dspring-boot.run.jvmArguments=${vm}`)
  if (program) argv.push(`-Dspring-boot.run.arguments=${program}`)
  return makePlan({ argv, cwd: workdir, beforeLaunch: cfg.beforeLaunch, browserUrl, confidence: 'high', diagnostics })
}
