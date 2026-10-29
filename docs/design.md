# 方案：DSH “IDEA 兼容式项目启动与日志面板”插件（dsh-idea-launcher）

## 〇、插件命名

| 项 | 取值 | 说明 |
|---|---|---|
| **插件包名** | `dsh-idea-launcher` | 遵循社区 `dsh-` 前缀惯例 |
| **内部 ID** | `idea-launcher` | 用于 slot 注册、事件通道、日志前缀 |
| **自有配置** | `.dsh/idea-launcher.json` | 无 IDEA 配置时的回退；用户修正命令的持久化位置 |
| **事件前缀** | `idea-launcher:` | 日志增量、进程状态、baseline query 统一前缀 |
| **安装** | `dsh plugin --profile web add github:<owner>/dsh-idea-launcher` | 与现有社区插件一致 |

## 一、目标与范围

**痛点**：用 Harness 开发已有 IDEA 项目时，仍需单独打开 IDEA 启动项目和看日志，两套工具来回切换。

**目标**：把 IDEA 的**启动、运行控制、日志观察**三条主链路完整迁移到 Harness，使已有 IDEA 项目可以在 Harness 内完成日常“跑起来”的全部操作，无需回到 IDEA。

**关键约束**：**不要求用户重新配置**。插件直接读取项目里已有的 IDEA 运行配置（`.idea/runConfigurations`、`.run/*.run.xml`、`.idea/workspace.xml`），下拉列表中的条目名称与 IDEA 一致。

### 1.1 覆盖矩阵（诚实标注）

| IDEA 能力 | 本方案覆盖程度 | 优先级 |
|---|---|---|
| 读取 Spring Boot / Java / npm 配置的核心参数 | **完整覆盖** | P0 |
| 顶栏启动/停止 + 配置下拉选择 | **完整覆盖** | P0 |
| 底部实时日志（含 baseline 防丢） | **完整覆盖** | P0 |
| **Rerun（重新运行）** | **完整覆盖** | P0 |
| **两段式停止：soft kill → hard kill** | **完整覆盖** | P0 |
| **多运行实例 / 多标签页日志** | **完整覆盖** | P0 |
| **Before Launch：Build 校验** | **完整覆盖** | P0 |
| **Before Launch：Launch Web Browser** | **完整覆盖**（Vue 开发高频） | P0 |
| **Compound（前后端一键启动）** | **完整覆盖** | P1 |
| **日志多源标签页（Ant 模式）** | **完整覆盖**（Spring Boot 日志文件场景） | P1 |
| **临时/永久配置语义 + 模板** | **部分覆盖**（读取 + 标记，写入以自有配置为主） | P1 |
| 日志高级过滤/折叠/缓冲区可调 | **不做**（标注为增强项，不影响主链路） | P2 |

## 二、整体架构

`dsh-idea-launcher` 采用 host + client 双面形态。

```text
dsh-idea-launcher/
├── package.json                  # 包名、依赖白名单、构建脚本
├── tsconfig.json                 # TS 配置，outDir → lib/
├── cordis.yml                    # 插件 manifest（⚠️ 字段对照 dsh-plugin-dev）
├── lib/                          # 构建产物（由 tsc 生成，不手写）
│   ├── index.js                  # Host 入口（由 src/index.ts 构建）
│   └── client.js                 # Client 入口（由 src/client.ts 构建）
├── src/
│   ├── index.ts                  # Host 入口源码（⚠️ apply 签名对照 SDK）
│   ├── client.ts                 # Client 入口源码（⚠️ slot 注册）
│   ├── types.ts                  # 共享类型定义（纯逻辑）
│   ├── parser/
│   │   ├── scan.ts               # 三来源扫描与合并（纯逻辑）
│   │   ├── extract.ts            # 按 type 提取字段（纯逻辑）
│   │   ├── before-launch.ts      # Before Launch 任务解析（纯逻辑）
│   │   ├── compound.ts           # Compound 引用解析（纯逻辑）
│   │   └── vars.ts               # $PROJECT_DIR$ 等变量替换（纯逻辑）
│   ├── mapper/
│   │   ├── index.ts              # 映射调度（纯逻辑）
│   │   ├── spring-boot.ts        # Spring Boot → 命令（纯逻辑）
│   │   ├── java-app.ts           # Java Application → 命令（纯逻辑）
│   │   └── npm.ts                # npm/Vue → 命令（纯逻辑）
│   ├── runtime/
│   │   ├── instance.ts           # RunInstance 模型 + 多实例管理（纯逻辑 + ⚠️ 接 shell）
│   │   ├── process.ts            # ShellProcess 托管 + 两段式停止（⚠️ 核心风险点）
│   │   ├── log-ring.ts           # 有界环形缓冲（纯逻辑）
│   │   ├── log-source.ts         # process/file 多源日志（纯逻辑 + ⚠️ 文件监视）
│   │   └── events.ts             # 事件常量与 payload 类型（纯逻辑）
│   ├── config/
│   │   ├── overlay.ts            # .dsh/idea-launcher.json 覆盖层（纯逻辑）
│   │   └── schema.ts             # schemastery schema（⚠️ 对照 SDK）
│   └── compound-orchestrator.ts  # Compound 并行编排（纯逻辑 + ⚠️）
├── ui/
│   ├── LaunchControl.tsx         # 顶栏：下拉 + 启停 + Rerun + 两段停止（⚠️ slot）
│   ├── RunPanel.tsx              # 底部：配置标签页 + 日志（⚠️ slot）
│   ├── InstanceSelector.tsx      # 同名多实例切换（纯 UI）
│   ├── LogView.tsx               # 日志视图 + 吸底/暂停/清空/全屏（纯 UI）
│   └── TabBar.tsx                # 配置标签页栏 + Pin/Close（纯 UI）
└── test/
    └── fixtures/                 # 真实 IDEA 配置样本（第 1 步准备）
```

### 2.1 核心数据模型：运行实例（RunInstance）

这是本方案区别于早期 MVP 的关键抽象。IDEA 的 Run 工具窗口以**运行配置**为单位管理标签页，每个配置可以同时有多个运行中的实例。插件必须建立对应的模型：

```text
RunInstance {
  id: string                 // 实例唯一标识
  configName: string         // 来自 IDEA 配置的 name
  configType: string         // SpringBoot / npm / Compound / ...
  state: 'starting' | 'running' | 'stopping' | 'stopped' | 'failed'
  process: ShellProcess      // 句柄
  stopPhase: 'none' | 'soft-killed' | 'hard-killed'
  logSources: LogSource[]    // 至少包含 process-stdout/stderr
  startedAt: number
}
```

顶栏下拉选择的是 `configName`；底部面板以 `configName` 为标签页标题，同名配置的多个实例合并到同一标签页下的**实例切换器**中。

## 三、IDEA 配置解析层

### 3.1 三来源扫描与合并（不变）

```text
.idea/runConfigurations/*.xml   ← 优先（共享配置）
.run/*.run.xml                  ← 优先（新版共享格式）
.idea/workspace.xml             ← 兜底（默认存储位置，必须扫描）
```

**`workspace.xml` 兜底是硬要求**：IDEA 的 “Store as project file” 默认关闭，运行配置默认存储在 `.idea/workspace.xml` 中[reference:0]。只扫描 `runConfigurations` 会导致空列表。

### 3.2 配置类型与关键字段

**Spring Boot**（`type="SpringBootApplicationConfigurationType"`）：`SPRING_BOOT_MAIN_CLASS` / `MAIN_CLASS_NAME`、`VM_PARAMETERS`、`PROGRAM_PARAMETERS`、`WORKING_DIRECTORY`、`envs`。

**npm / Vue**（`type="js.build_tools.npm"`）：`package-json`、`command`、`scripts/script`、`node-interpreter`、`envs`。

**Compound**（`type="CompoundRunConfigurationType"` / `factoryName="Compound"`）：Compound 配置本身不包含启动命令，它包含的是**对其他配置的引用列表**。解析时需要提取其引用的配置名，并在运行时**并行启动所有被引用的配置**。Compound 的每个子配置会在 Run 工具窗口中各自拥有独立标签页[reference:1]。

**Java Application**（`type="Application"`）：`MAIN_CLASS_NAME`、`VM_PARAMETERS`、`PROGRAM_PARAMETERS`、`WORKING_DIRECTORY`、`envs`。

### 3.3 Before Launch 解析（新增核心）

IDEA 的 Before Launch 不是单一动作，而是一个**有序任务列表**。对每个 `<configuration>`，解析其 `<method>` / `<option>` 中与 Before Launch 相关的节点，至少识别：

| Before Launch 任务 | 识别依据 | 插件执行语义 |
|---|---|---|
| **Build / Build Project** | 构建类 before-run task | 在启动主进程前执行构建命令（`mvn compile` / `npm run build` 等）；构建失败则**不启动**主进程 |
| **Launch Web Browser** | `browser` 属性 + `start_url` / `url` 字段 | 主进程进入 running 后，自动在 Harness 内或外部打开指定 URL |
| **Run Another Configuration** | `RunConfigurationTask` 节点，含 `run_configuration_name` 和 `run_configuration_type` | 按顺序先启动被引用的配置，等待其进入 running 后再启动当前配置 |
| **Run External Tool** | external tool 引用 | 首版标记为“暂不支持自动执行”，展示但跳过 |

Before Launch 的执行必须是**顺序的、失败即中断的**：Build 失败 → 不启动主进程；Run Another Configuration 失败 → 不启动当前配置。这与 IDEA 的行为一致。

### 3.4 解析技术选型与参考实现（不变）

Host 端使用 `fast-xml-parser`。参考项目：`intellijtovscode`（runConfigurations）、`tsvsj/jetbrains-vscode`（workspace.xml）、`run-xml-to-launch-json`（.run 扫描）。**这些项目不提供 `type` → 命令 / Before Launch 的映射表**，映射规则需在第 2 步用真实样本推导。

### 3.5 变量替换与默认值补齐（不变）

`$PROJECT_DIR$` / `$MODULE_DIR$` 替换；Spring Boot 默认项目根，npm 默认 `package.json` 目录。

## 四、运行控制语义（补齐的核心）

### 4.1 Rerun（重新运行）

IDEA 的 Rerun 是独立的一等操作：**停止当前应用并立即再次运行**[reference:2]。插件必须提供独立的 Rerun 动作，而不是让用户手动“先停再启”。

实现路径：

1. 对目标 `RunInstance` 执行完整的停止流程（见 4.2），**等待进程真正退出**（`await done`）。
2. 用同一份已解析的配置和 Before Launch 序列，重新创建 `RunInstance` 并启动。
3. 日志面板**不重置标签页**，而是在同一标签页内追加一条分隔线（如 `--- rerun at <timestamp> ---`），保留历史日志。这与 IDEA Rerun 后控制台保留旧输出的行为一致。

顶栏按钮布局：主按钮为**启动/停止切换**；Rerun 作为主按钮旁的一个独立图标按钮（仅在 `state === 'running'` 时可用）。

### 4.2 两段式停止：soft kill → hard kill

IDEA 的停止按钮行为是明确的**两段式**：首次点击发送 **SIGINT（soft kill）** ，允许应用捕获信号执行优雅关闭；如果进程仍未退出，再次点击发送 **SIGKILL（hard kill）** 强制终止。在 Windows 上，soft kill 对应模拟 Ctrl+C 事件[reference:3][reference:4]。

**DSH 侧的关键限制**：`ShellProcess.kill()` 的契约是“**Kill the process group**”，它**不直接暴露发送任意信号（如 SIGINT）的参数**。因此插件不能假设 `kill()` 等于 soft kill。

**缓解方案（必须在第 3 步验证）** ：

- **优先路径**：检查当前 `ctx.shell` 的 provider 是否提供“发送信号”或“优雅终止”的扩展接口。如果底层（`bash-local`）支持，直接使用。
- **回退路径**：通过 `ctx.shell.start` 启动一个**短命令**来发送 SIGINT（Unix：`kill -INT <pid>`；Windows：使用 `windows-kill -SIGINT` 等工具）。这要求 `ShellProcess` 暴露子进程的 PID。如果 PID 不可得，回退路径不可用。
- **最差回退**：如果以上都不可行，首版将停止实现为**单段式 hard kill**，并在 UI 中明确标注“当前环境不支持优雅停止”。这会影响 Spring Boot 的 `@PreDestroy` 和连接池释放，但至少保证功能可用。

停止按钮的 UI 语义：

- 首次点击 → 进入 `stopping` + `stopPhase: 'soft-killed'`，按钮变为“强制停止”。
- 若进程在可配置的宽限期内（默认 5 秒）退出 → `stopped`。
- 再次点击或宽限期超时 → 调用 `kill()` → `hard-killed` → `stopped`。

### 4.3 多运行实例与标签页

**实例隔离**：每个 `RunInstance` 独立持有自己的 `ShellProcess` 和日志缓冲。同一 `configName` 可以同时存在多个实例（例如同一个 Vue 配置启动了两个端口），实例之间通过 `id` 区分。

**底部面板的标签页模型**：

- 标签页以 `configName` 为标题。
- 如果一个 `configName` 下有多个活跃实例，标签页内显示一个**实例选择器**（下拉或分段按钮），用户切换查看不同实例的日志。
- 标签页支持**固定（pin）**，防止在达到最大标签数时被自动关闭。这与 IDEA 的 Pin Tab 行为对齐[reference:5]。
- 关闭标签页时，如果对应实例仍在运行，**先执行停止流程**，再关闭标签页。

**DSH 侧实现参考**：`dsh-terminal-panel` 和 `dsh-devpanel` 已验证了底部多标签页面板的可行性（标签栏、+ 新建、per-tab close）[reference:6]。插件可以借鉴其标签页管理逻辑，但标签页的内容和生命周期由 `RunInstance` 驱动，而非由用户手动新建终端。

### 4.4 Compound（复合配置）

当用户选择的是一个 `CompoundRunConfigurationType` 配置时：

1. 解析其引用的配置名列表。
2. **并行启动**所有被引用的配置（IDEA 的 Compound 语义是“同时启动”，不是串行）[reference:7]。
3. 为每个子配置创建独立的 `RunInstance`，并在底部面板中**为每个子配置打开独立标签页**。
4. Compound 本身的“运行状态”是其所有子实例状态的聚合：任一子实例 `failed` → Compound 标记 `failed`；全部 `running` → Compound `running`。
5. 停止 Compound → 对所有子实例执行两段式停止。

这直接解决“一个 Spring Boot 后端 + 一个 Vue 前端一键启动”的场景。

## 五、Before Launch 执行层（新增）

Before Launch 的执行必须嵌入启动生命周期，而不是在命令映射时静态拼接。

### 5.1 启动生命周期

```text
选择配置 → [Before Launch 序列] → 主进程启动 → running
              │
              ├── Build：执行构建命令，失败则中止
              ├── Run Another Configuration：先启动依赖配置，失败则中止
              └── Launch Web Browser：记录 URL，主进程 running 后打开
```

### 5.2 Build 的映射

| 配置类型 | Build 命令（默认） |
|---|---|
| Spring Boot（Maven） | `mvn -q compile`（或 `mvn -q test-compile`，取决于是否有测试代码） |
| Spring Boot（Gradle） | `./gradlew compileJava` |
| npm / Vue | `npm run build`（仅在配置显式包含 Build 任务时执行；dev server 场景通常不要求） |
| Java Application | `mvn compile` / `./gradlew compileJava` |

Build 任务只在 IDEA 配置**显式包含**时执行。如果配置的 Before Launch 列表中没有 Build，插件**不主动添加**，保持与 IDEA 行为一致。

### 5.3 Launch Web Browser

Spring Boot 配置中的 `browser` / `start_url` 字段，以及 npm 配置中常见的 before-launch browser 任务，解析后记录为 `pendingBrowserUrl`。主进程进入 `running` 后：

- **DSH 内打开**：如果 Harness 有内置的浏览器面板或 URL 打开能力，优先使用。
- **回退**：在 UI 中提供一个可点击的 URL 链接，并可选调用系统默认浏览器（需宿主环境允许）。

### 5.4 执行失败的处理

Before Launch 中任一任务失败 → 主进程**不启动**，`RunInstance.state = 'failed'`，底部面板展示失败任务的输出（Build 的 stderr）和失败原因。用户可以在修正后点击 Rerun。

## 六、日志系统（补齐多源与高级控制）

### 6.1 多日志源

IDEA 允许在运行配置中指定**多个日志文件**，每个日志文件在 Run 工具窗口中拥有独立标签页，路径支持 **Ant 模式**；对于滚动日志，取最新匹配文件；还可以选择“只显示新内容”（Skip Content）[reference:8]。

插件需要将日志源抽象为两类：

```text
LogSource =
  | { kind: 'process', stream: 'stdout' | 'stderr' }   // 子进程输出
  | { kind: 'file', tabName: string, pathOrAntPattern: string, skipContent: boolean }
```

**进程输出**：始终存在，作为“Console”标签页的内容。

**文件日志源**：从 IDEA 配置的 Logs 设置中解析。Host 端使用文件监视（或定期轮询）读取匹配的文件内容，推送到对应标签页。Ant 模式的实现可以使用 `minimatch` 等 glob 库近似匹配（Ant 模式与标准 glob 有细微差异，首版按 glob 近似，标注已知限制）。

**标签页层级**：底部面板的每个 `RunInstance` 标签页内部，再分为子标签页：Console + 各文件日志源。这与 IDEA 的“配置标签页 → 日志文件标签页”两级结构对齐。

### 6.2 日志 baseline 与增量（不变）

Host 端维护**每个 LogSource 的有界环形缓冲**。Client 面板挂载或重连时，先通过 `idea-launcher:log-query`（unary）拉取当前缓冲，再订阅 `idea-launcher:log-append` 增量事件。普通事件不重放，baseline 是必须项。

### 6.3 日志面板基础交互

实时追加、自动吸底、手动上滚暂停跟随、清空当前 LogSource、全屏。**不做**正则高亮、按级别过滤、折叠相似行、缓冲区大小可调——这些是增强项，不影响“能跑、能看日志”的主链路。

## 七、配置生命周期（补齐临时/永久语义）

IDEA 区分**临时配置**（运行无永久配置的类时自动创建，最多 5 个）和**永久配置**（由模板创建或由临时配置保存而来）；永久配置可以存储在 `workspace.xml`（本地）或 `runConfigurations`（共享）中[reference:9][reference:10]。

插件不需要在首版实现完整的“在 Harness 内创建临时配置”的闭环，但必须：

1. **读取时保留语义**：解析出的配置条目标注 `origin: 'shared' | 'local'`，UI 中可见（例如本地配置带一个标记）。
2. **用户修正命令的回写**：当用户在 Harness 中手动修正映射后的启动命令时，**写入 `.dsh/idea-launcher.json` 的覆盖层**，而不是直接改写 IDEA 的 XML。覆盖层以 `configName` 为键，包含 `commandOverride`、`beforeLaunchOverride` 等字段。下次解析时，覆盖层优先于 IDEA 原始配置。这样既不会破坏 IDEA 文件，又保证了 Harness 内的修改持久化。
3. **“保存为共享”的显式动作（P1）** ：提供一个“将当前配置导出为 `.idea/runConfigurations` 共享 XML”的动作，让用户的修改可以反向写回 IDEA 可识别的共享位置。首版可以暂不实现，但数据模型（覆盖层）应为该动作预留结构。

## 八、UI 设计

### 8.1 顶栏：`conversation.session.header.actions`

这是一个 list 型槽位，插件以唯一 ID `idea-launcher` 纯 additive 注册[reference:11]。

组件包含：

- **配置下拉选择器**：数据源 = IDEA 解析结果 + `.dsh/idea-launcher.json` 覆盖层合并。
- **启动/停止主按钮**：根据当前选中配置的聚合状态切换。
- **Rerun 按钮**：仅在 running 时可用。
- **停止按钮的两段式状态**：首次点击后变为“强制停止”图标。

```tsx
export const inject = ['slots']
export function apply(ctx: Context): void {
  ctx.slots.inject('conversation.session.header.actions', () =>
    ctx.slots.register(
      { name: 'conversation.session.header.actions', id: 'idea-launcher', order: 100 },
      LaunchControl,
    )
  )
}
```

### 8.2 底部：`shell.bottom`

框架级槽位，由占用方控制高度与显隐。注册 ID `idea-launcher-run-panel`。

面板结构：

```text
[配置标签页 A] [配置标签页 B] [Compound 标签页 C] ...
┌──────────────────────────────────────────────┐
│ 实例选择器（同名多实例时显示） | Pin | Close  │
│ ┌ Console ┐ ┌ app.log (Ant) ┐ ┌ error.log ┐  │
│ │ 实时输出 │ │ 文件日志       │ │ 文件日志  │  │
│ └─────────┘ └───────────────┘ └──────────┘  │
│ [吸底] [暂停跟随] [清空当前] [全屏]           │
└──────────────────────────────────────────────┘
```

多标签页的交互逻辑参考 `dsh-terminal-panel` 的标签栏实现[reference:12]；底部面板的高度拖拽和折叠参考 `shell.bottom` 已有插件的做法。

## 九、Host 端进程与事件通道

### 9.1 进程启动

使用 `ctx.shell.start({ command, workdir, env })`，返回 `ShellProcess` 句柄，background execution，**no timeout applies**。不手动 `spawn`。

`ctx.effect()` 注册 disposer：插件卸载/HMR 时，对所有活跃 `RunInstance` 执行停止流程（优先 soft，宽限期后 hard），并等待退出。

### 9.2 事件通道

复用 DSH 原生下行通道（`/api/events.mux` / `/api/events.host`），不自建 WebSocket。事件命名：

| 事件 | 方向 | 用途 |
|---|---|---|
| `idea-launcher:state` | Host→Client | RunInstance 状态变更（starting/running/stopping/stopped/failed，stopPhase） |
| `idea-launcher:log-append` | Host→Client | 某个 LogSource 的增量日志 |
| `idea-launcher:log-query` | Client→Host | 挂载/重连时拉取 baseline |
| `idea-launcher:instances-query` | Client→Host | 拉取当前所有 RunInstance 的聚合视图 |

### 9.3 退出状态解读

`dsh-shell` 的退出契约区分 `exitCode`、`signal`、`timedOut` 等独立字段；killed by signal 会有明确的 signal 标记[reference:13]。插件据此区分：

- 正常退出（`exitCode === 0`）→ `stopped`。
- 被信号杀死（`signal` 有值）→ `stopped`，标注 `killedBySignal`。
- 非零退出码 → `failed`，展示 exitCode。

## 十、执行顺序（交给 Harness）

**第 0 步：加载 `dsh-plugin-dev` 技能**，确保生命周期与依赖纪律。

**第 1 步：解析层（三来源 + 类型 + Before Launch 节点提取）** 。准备一个真实项目，包含 `.idea/runConfigurations`、`.run`、`.workspace.xml`，并至少有一个 Spring Boot 配置、一个 npm 配置、一个 Compound 配置、一个带 Build + Browser 的配置。验证能提取名称、类型、核心参数、Before Launch 任务列表、Compound 引用列表。**这一步是所有后续工作的基础。**

**第 2 步：映射层独立验证**。将第 1 步解析出的配置映射为：主启动命令 + Before Launch 命令序列 + browser URL。**手动在终端执行**映射结果，确认 Spring Boot 能启动、npm 能启动、Build 能通过。不要假设开源项目有现成映射表。

**第 3 步：进程控制最小闭环（含两段式停止验证）** 。用 `ctx.shell.start` 启动长进程，验证句柄立即返回、无超时。**重点验证能否发送 SIGINT**：如果 `ShellProcess` 暴露 PID 或 signal 接口，实现 soft kill；如果完全不可行，明确记录并回退到单段式 hard kill，在 UI 中标注。同时验证 `ctx.effect` 清理。

**第 4 步：日志流 + 多源**。实现 `process` 和 `file` 两类 LogSource 的增量读取 → 环形缓冲 → `log-append` 推送 → baseline query。先用临时 Client 组件验证，不接入完整 UI。

**第 5 步：RunInstance 模型与多实例管理**。实现实例隔离、状态聚合、同名多实例切换。验证两个 npm 配置同时运行、日志互不串扰。

**第 6 步：顶栏槽位**。注册 `LaunchControl`，接入下拉、启动/停止、Rerun、两段式停止按钮状态。

**第 7 步：底部 Run 面板**。注册 `shell.bottom`，实现配置标签页、实例选择器、Console/文件日志子标签页、Pin/Close、baseline 加载。

**第 8 步：Before Launch 执行层**。将第 2 步验证过的 Build / Run Another Configuration / Browser 序列接入启动生命周期，验证失败中断。

**第 9 步：Compound**。解析 Compound 引用，并行启动子配置，聚合状态，停止时统一停止。

**第 10 步：覆盖层与回退**。接入 `.dsh/idea-launcher.json` 覆盖层（用户命令修正持久化）；无 IDEA 配置时回退到自有 Schema。

## 十一、可行性评估

### 11.1 已验证的可行性依据

| 能力 | 支撑证据 | 可行性 |
|---|---|---|
| 三来源 IDEA 配置解析 | 均为标准 XML；三个开源项目分别验证 runConfigurations、workspace.xml、.run 的可解析性 | 高 |
| Compound 引用解析与并行启动 | Compound XML 结构已知；IDEA 语义明确为并行启动、独立标签页[reference:14] | 高 |
| Before Launch 节点识别 | `RunConfigurationTask` 等节点在 IDEA XML 中有明确结构；Build 失败中断语义明确 | 中高 |
| 日志文件源 + Ant 模式 | IDEA Logs 文档明确了 Tab Name、Ant pattern、Skip Content 的语义[reference:16] | 中高（Ant 需 glob 近似） |
| 多标签页底部面板 | `dsh-terminal-panel` / `dsh-devpanel` 已验证底部多标签页可行[reference:17] | 高 |
| Rerun | 本质是“停止→重新启动”，`ctx.shell.start` 可重复调用 | 高 |
| **两段式停止（soft kill）** | IDEA 语义明确（SIGINT → SIGKILL）[reference:18]；但 **DSH `ShellProcess.kill()` 只承诺杀进程组，未暴露 signal 参数**[reference:19] | **中低（关键风险）** |
| 多实例隔离 | 每个实例独立 `ShellProcess`，DSH 无冲突 | 高 |
| 进程状态与退出解读 | `dsh-shell` 区分 `exitCode` / `signal` / `timedOut`[reference:20] | 高 |

### 11.2 关键风险与缓解

**风险 1（最高）：soft kill 在 DSH 上可能不可行。** `ShellProcess.kill()` 杀进程组，不保证 SIGINT 语义。**缓解**：第 3 步优先验证；如果 PID 可得，通过短命令发送 SIGINT；如果完全不可行，首版降级为单段式 hard kill 并在 UI 标注。这是环境能力限制，不是方案缺陷，但必须在交付时诚实告知用户。

**风险 2：Before Launch 的 Build 映射不是“配置里写了什么就执行什么”。** IDEA 的 Build 任务在 XML 中不一定以显式命令形式出现，可能需要根据配置类型和项目构建方式推断。**缓解**：首版只对**显式识别出的** Build 任务执行；无法识别的任务标记为“已跳过”，不阻塞启动。

**风险 3：Ant 模式与标准 glob 的差异。** 文件日志源的 Ant 路径匹配可能无法用 `minimatch` 完全等价。**缓解**：首版按 glob 近似，在 UI 中标注“模式匹配为近似实现”；如果用户发现遗漏，可以在覆盖层中指定精确路径。

**风险 4：Compound 的状态聚合和停止时序。** 并行启动多个子实例，任一失败时是否停止已启动的其他子实例，IDEA 的行为需要明确。**缓解**：首版采用**保守策略**——任一子实例启动失败 → 停止所有已启动的子实例，Compound 标记 failed；这与“一键启动前后端，一个失败就不应留下半启动状态”的直觉一致。

**风险 5：日志多源的文件监视开销。** 每个文件 LogSource 都需要监视或轮询。**缓解**：首版使用**低频轮询**（如 1 秒），而不是 inotify/fsevents，避免跨平台复杂度和资源占用；文件大小上限与环形缓冲上限可配置。

### 11.3 总体判断

**方案可行，且已经从“能启动 + 看基础日志”的 MVP 扩展为覆盖 IDEA 运行主链路的完整设计。** 核心不确定性集中在**两段式停止的 soft kill 是否能在当前 DSH shell seam 上实现**——这是唯一可能需要在首版降级的能力。Rerun、多实例标签页、Compound、Before Launch（Build + Browser）、日志多源，在解析层和执行层都有明确的实现路径和可参考的先例。

建议 Harness 严格按第十节的顺序推进：**解析层和映射层必须先独立跑通**，再进入进程和 UI；**第 3 步的两段式停止验证结果应作为是否调整范围的决策点**。其余能力按 P0 → P1 的顺序交付，日志高级过滤等 P2 能力明确放在范围外，不阻塞主链路。