# dsh-idea-launcher

> 在 **DeepSeek Harness** 里直接读取 IDEA 的运行配置，启动 Java / Spring Boot / Vue 项目并查看彩色日志 —— 不用再切回 IntelliJ。

作者：**静音胡闹** ｜ 版本：**v0.1.0** ｜ 许可：[MIT](LICENSE)

---

## 为什么

用 Harness 开发已有 IDEA 项目时，启动项目和看日志仍然要开 IDEA，两套工具来回切。
这个插件把 IDEA 的「读配置 → 启动 → 看日志」三条链路搬进 Harness，**不需要重新配置**：直接读项目里已有的
`.idea/runConfigurations/*.xml`、`.run/*.run.xml`、`.idea/workspace.xml`，下拉列表里的名字和 IDEA 里一致。

## 特性

- **读 IDEA 配置**：Spring Boot / Java Application / npm(Vue) / Compound；Before Launch 的 Make、Run 其他配置、打开浏览器
- **跟随当前项目**：默认用会话的 `cwd`，切换会话即自动换项目；也可手动指定目录
- **多实例并行**：不同配置可同时运行，各自独立进程与日志；配置下拉里有绿点标记运行中
- **彩色日志**：还原 ANSI 16/256/真彩；吸底跟随、清空、复制、可调高度、可切独立浮动窗口
- **快速启动**（默认开）：缓存依赖 classpath + 按需编译 + `java -cp` 直启，跳过每次的 Maven 生命周期；失败自动回退 `mvn spring-boot:run`
- **诚实的诊断**：解析不出来、命令含假设、模块未解析……都会变成可查看的诊断，而不是静默兜底或假装成功

## 安装

> 主仓在 **GitHub**（[`jyhn-hunao/dsh-idea-launcher`](https://github.com/jyhn-hunao/dsh-idea-launcher)），Gitee 镜像：[`ydcy_studio/dsh-idea-launcher`](https://gitee.com/ydcy_studio/dsh-idea-launcher)。npm 包名 `dsh-idea-launcher` 已确认为空闲，待发布。`lib/` 构建产物已随仓库提交，**克隆后无需构建**。

### 方式一：让 DSH 自己装（推荐）

把下面这段提示词发给任意一个 DSH 会话即可：

```text
帮我安装 dsh-idea-launcher 插件（在 Harness 里读 IDEA 运行配置、启动项目并看彩色日志）：
1. 把 https://github.com/jyhn-hunao/dsh-idea-launcher.git 克隆到一个固定目录，例如 ~/dsh-plugins/dsh-idea-launcher
2. 用 plugin_manager({ action: "install_bundle", target: "<克隆后的绝对路径>" }) 安装
3. 要求返回 application=applied；失败就把错误原文贴给我，不要自己改插件代码
4. 完成后提醒我刷新页面（Host 半更新需要重载插件，仅 Client 半改动刷新即可）
```

### 方式二：手动安装

```bash
git clone https://github.com/jyhn-hunao/dsh-idea-launcher.git
```

```text
plugin_manager({ action: "install_bundle", target: "<本仓库绝对路径>" })
```

### 方式三：npm（待发布）

包发布到 npm 后可直接：

```sh
dsh plugin --profile web add dsh-idea-launcher@latest
```

装完**硬刷新浏览器**（Ctrl/Cmd+Shift+R）。Host 半改动需要重载插件；只改 Client 半刷新页面即可。

> 依赖：Node ≥ 20；被启动的项目自己需要 java / mvn / npm 等工具链，插件不代装。

## 快速开始

1. 打开一个会话（会话的 `cwd` 就是被启动的项目根），或手动指定项目根；
2. 点顶栏控件里的「配置名 ▾」，从下拉里选一个 IDEA 运行配置（带类型图标，可搜索）；
3. 点 `▶` 启动，底部/浮动日志窗口会立刻出现并实时输出；
4. 运行中：`■` 停止当前、`⚡` 强制停止当前、`[■—]` 停止全部；`▤` 开合日志窗口；`⋯` 看项目根与将执行的命令。

## 界面

```
顶栏： [● Grape-Service ▾] [▶/■] [⚡] [■—] [●2] [▤] [⋯]
         选配置           启停  强停  全停  诊断 日志 详情

日志窗口： ● 配置名  运行中 · 12s  [实例 ▾]      ⤓ 🗑 ⧉ ⛶ ⌃ ✕
           [INFO] Starting Grape-Service ...
           [WARN] ...
```

- 日志窗口可**拖拽上边缘调高度**（120–720px，记忆）、可**切成独立浮动窗口**（拖标题栏移动、拖底边调高）
- 配置下拉里：`含假设`（命令含推断成分）、`暂不支持`（Compound/未识别类型，M6 支持编排）
- 诊断徽标只在有内容时出现；点开是只读列表

## 配置

### 项目根

默认**跟随当前会话**：Host 用 `ctx.sessions.get(sessionId).header.cwd` 解析。切换会话即换项目。
需要看别的目录时点「改手动」填路径（会记住），随时可切回「跟随会话」。

### 覆盖层 `.dsh/idea-launcher.json`（项目内，可选）

按 IDEA 配置名覆盖。**绝不回写 IDEA 的 XML**。

```json
{
  "Grape-Service-本地Nacos": {
    "commandOverride": "mvn -q spring-boot:run -Dspring-boot.run.jvmArguments=\"-Xms2048m -Xmx2048m\"",
    "cwdOverride": "D:/codeData/workData/workCode/grape/grape-service/grape-server",
    "env": { "SPRING_PROFILES_ACTIVE": "dev" },
    "launchMode": "maven"
  }
}
```

| 字段 | 作用 |
|---|---|
| `commandOverride` | 整条命令覆盖（走平台 shell 执行），覆盖后不再使用推导命令 |
| `cwdOverride` | 覆盖工作目录 |
| `env` | 追加/覆盖环境变量 |
| `launchMode` | `fast`（默认，能快则快）/ `maven`（强制走 `mvn spring-boot:run`） |

### 快速启动的缓存

- 依赖 classpath：`<项目根>/.dsh/idea-launcher/classpath-<hash>.txt`
- classpath / 编译时间戳：`<项目根>/.dsh/idea-launcher/state.json`
- 删除 `state.json` 可强制重建；`pom.xml` 变更会自动重建 classpath，`src/main/java` 或 `src/main/resources` 更新会自动编译一次

## 工作原理

```
Host（Harness 进程）
  /configs?path=|sessionId=   解析 .idea/* + 模块解析 + 映射为「启动计划」
  /run                       起实例：快速启动则先准备（classpath/编译）再 spawn，否则直接 mvn/npm
  /stop /stop-all /clear     停止 / 全部停止 / 清空日志
  /logs?id=&since=           增量日志
  /instances /events         实例快照 / 生命周期事件（spawn/stop-request/exit/plugin-unload）

Client（Web UI 插件）
  conversation.session.header.utilities  → 顶栏运行控件
  shell.bottom                           → 日志窗口（可折叠、可浮动）
```

- 进程接缝：`ctx.subprocess.spawnTerminal`（真 PTY）。**不用 `ctx.shell`** —— 它没有 pid、`kill()` 不能发信号，两段式停止无法实现
- 客户端与 Host 走同源 HTTP（`/idea-launcher/api/*`），不依赖任何第三方传输层
- 更完整的背景与设计取舍见 [docs/design.md](docs/design.md)

## 限制与已知问题

| 限制 | 说明 / 绕过 |
|---|---|
| Windows 无法优雅停止 | PTY provider 不提供前台进程组与 pid，`SIGINT` 无法投递；停止即 `terminate`，日志与状态会标注「强制」 |
| 日志窗口占底部整宽 | 用的是 `shell.bottom`（三栏下方），会缩短左右栏高度；没有「仅会话列底部」的宿主槽位 |
| 快速启动依赖 mtime 判断 | 极端情况（时钟异常/产物被外部替换）可能误判，删 `.dsh/idea-launcher/state.json` 强制重建 |
| 多模块依赖需先安装 | 兄弟模块没进本地仓库时，先 `mvn -DskipTests install`；日志里也会给这条提示 |
| Gradle 工程无快路径 | 仍走 `gradlew bootRun`；可类比扩展 |
| Compound 暂不能一键启动 | 解析完整（含嵌套展开），执行编排在 M6 |
| 文案未接 Client locale | 目前是中文硬编码 |

## 开发

```bash
pnpm install
pnpm build       # 产出 lib/index.js（Host, ESM）+ lib/client.js（Client, loader 包装）
pnpm typecheck   # tsc --noEmit
pnpm test        # node --test 跑解析/映射/进程/UI 纯函数回归
```

- `lib/` 是**必须提交**的构建产物：插件按目录安装，装的时候不会替你构建
- Client 半的产物是 `window.__ModuleLoader__.load({ id: 包名, factory })` 形态，`react` / `react-dom` 由浏览器模块表提供
- 改 Host 半后需要重载插件（禁用再启用 bundle），改 Client 半刷新页面即可

### 目录结构

```
src/
  index.ts              Host 入口：路由、实例注册、快速启动准备
  client.ts             Client 入口：两个槽位注册
  types.ts              共享类型（IdeaConfig / LaunchPlan / Diagnostic ...）
  parser/               扫描 .idea、解析配置、模块解析（.idea + Maven）、Compound、Before Launch、变量
  mapper/               配置 → 启动计划（Spring Boot / npm / Java），覆盖层应用
  runtime/              PTY 进程驱动、实例注册表、日志环、快速启动（classpath 缓存/按需编译）
  config/               覆盖层、项目根解析
  ui/                   顶栏控件、配置下拉、日志窗口、详情、ANSI 解析
test/                   回归用例 + fixtures（真实 IDEA 样本）
scripts/build.mjs       esbuild 构建（Host ESM / Client loader 包装）
```

## FAQ

**Q：为什么不用 `mvn spring-boot:run` 每次都跑？**
慢。实测同一配置热启动：Maven 路径要 ~60s 才起进程，快速启动 1.1s 拉起 `java`。需要旧行为就把覆盖层设 `"launchMode": "maven"`。

**Q：点了启动没反应？**
看日志窗口第一行：有「启动 …」说明进程已拉起；Maven 首次构建可能几十秒静默（已用 `-Dmaven.test.skip=true` 缩短）。

**Q：为什么停止是「强制」？**
见限制表。Windows 上暂时只能这样，已在 UI 与状态里如实标注。

## 许可

[MIT](LICENSE) © 2026 静音胡闹
