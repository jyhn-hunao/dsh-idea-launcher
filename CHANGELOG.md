# Changelog

本项目遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [0.1.2] - 2026-10-29

### 修复

- **日志中文乱码**：Windows 的 PTY 固定按 CP936(GBK) 解释子进程字节，而 Spring Boot（默认控制台字符集 UTF-8）、npm/Vite 等会主动写 UTF-8，日志里就成了「UTF-8 被当 GBK 解」的乱码。
  - 新增 `src/runtime/encoding-fix.ts`：入库前把文本按 GBK 编回字节再严格按 UTF-8 解码——真乱码能还原，正常中文（GBK 编码后再按 UTF-8 解码必然失败）与纯英文原样保留，含 `U+FFFD` 的文本不再二次加工；
  - 实测 `chcp 65001` 在 ConPTY 下会清屏丢字，因此不走改代码页路线，也不强推 JVM UTF-8（那会让 JVM 自己的中文报错变乱码）；
  - 产物注入 `createRequire`（`iconv-lite` 内部 `require('buffer')` 需要），新增依赖 `iconv-lite`。

## [0.1.1] - 2026-10-29

### 修复

- **按项目 SDK 启动**：此前快速启动直接用 PATH 上的 `java`，遇到项目使用更高版本 JDK 时启动失败（`UnsupportedClassVersionError: class file version 65.0 ... up to 61.0`，mlw 项目真实踩到）。
  - 新增 `src/parser/project-jdk.ts`：读 `.idea/misc.xml` 的 `project-jdk-name` / `languageLevel`，再到 IDEA 的 `jdk.table.xml` 解析 `homePath`；
  - 快速启动改用该 JDK 的 `java`，并为进程设置 `JAVA_HOME` 与 `PATH`（Maven 回退路径同样受用）；
  - 解析不到时给 `project-jdk-unresolved` 诊断并回退 PATH（不静默）；
  - 详情浮层显示 `JDK ms-21（D:/java/jdk21）`。

## [0.1.0] - 2026-10-29

首个可用版本（V1）。在 DeepSeek Harness 里读取 IDEA 运行配置、启动项目、看彩色日志。

### 新增

- **解析层**：读取 `.idea/runConfigurations/*.xml`、`.run/*.run.xml`、`.idea/workspace.xml`（只取 `RunManager` 子树）；
  - Before Launch 任务：`Make`（构建）、`RunConfigurationTask`（先启动另一个配置）、`LaunchBrowser.Before.Run`（打开浏览器）；
  - Compound 配置：真实 `<toRun>` 形状，支持嵌套 Compound 展开、去重、环检测；
  - 变量：`$PROJECT_DIR$` / `$MODULE_DIR$` / `$USER_HOME$`，未知变量保留原文并给诊断；
  - 模块解析：`.idea/modules.xml`（iml content root）→ 根 `pom.xml` 的 `<modules>` 声明 → 项目内同名目录（唯一命中）；
  - 每条配置携带结构化诊断（未识别任务、模块未解析、变量未知、重名配置等）。
- **进程层**：基于 `ctx.subprocess.spawnTerminal`（真 PTY）启动进程；多实例（实例 id = `配置名#序号`）；两段式停止（可定位前台组时 SIGINT → 宽限 → terminate；Windows 上自动降级为强制停止并标注）；插件卸载时终止全部实例。
- **日志**：进程合并输出 → 环形缓冲（2MB）→ 增量拉取；ANSI 16/256/真彩还原成颜色；只渲染尾部 20 万字符；吸底/暂停跟随/清空/复制。
- **映射层**：Spring Boot（Gradle / Maven，模块根或 `-pl :<artifactId>`）、npm（锁文件判包管理器）、Java Application（classpath 近似并明确标注）；`.dsh/idea-launcher.json` 覆盖层（命令/工作目录/env/启动模式）。
- **快速启动**：缓存依赖 classpath（`mvn dependency:build-classpath`）+ 仅源码或资源变更时 `mvn compile` + 直接 `java -cp` 启动，跳过每次的 Maven 生命周期；失败自动回退 `mvn spring-boot:run` 并写日志。
- **界面**：
  - 顶栏运行控件 `[● 配置名 ▾] [▶/■] [⚡强制停止] [■—全部停止] [●诊断] [▤日志] [⋯详情]`；
  - 配置下拉带类型图标（Spring Boot 叶子 / npm 包裹箱 / Java 咖啡杯 / Compound 叠层 / 未支持虚线框）与搜索；
  - 日志窗口支持拖拽调高度（120–720px）、内置/独立浮动窗口切换、多实例切换；
  - 项目根默认跟随当前会话（`SessionHeader.cwd`），可切手动指定并记住。

### 已知限制

- Windows 上无法优雅停止（PTY provider 不提供前台进程组/pid），停止即强制终止。
- 日志窗口使用 `shell.bottom`（三栏下方整宽），会缩短左右栏可用高度。
- 快速启动的过期判定基于文件 mtime；多模块工程的兄弟模块需先 `mvn -DskipTests install`。
- Gradle 工程未接入快速启动（仍走 `gradlew bootRun`）。
- 界面文案暂未接入 Client locale。
