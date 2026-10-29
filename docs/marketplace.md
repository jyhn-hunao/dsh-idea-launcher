# 发布到 DSH 插件市场

市场目录的数据源是 GitHub 仓库 [`awesome-dsh-plugin/awesome-dsh-plugin`](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)，
站点 `dshmarket.com` 与 `awesome-dsh-plugin.com` 每天从它生成。

## 收录规则（来自官方 contributing.md）

- 每个插件**一个 YAML 文件**：`data/plugins/<owner>__<repo>.yml`，一个 PR 只加这一个文件；
- **`url` 必须是 GitHub 仓库地址**，且与仓库完全一致（`https://github.com/owner/repo`）；
- 只有 `description.en` 必填，`zh` 可选（缺了维护者会补）；
- `category` 取固定枚举之一（本插件建议 `dev`，开发与运行时）；
- `icon` 可选：必须是 **GitHub 托管的位图**（raw.githubusercontent.com），不写则回退作者头像；
- 不要手改 README（它们由 `data/plugins/*.yml` 生成）。

> 结论：**Gitee 仓库不能直接提交**——目录按 GitHub 仓库抓取元数据。所以需要先在 GitHub 建一个镜像仓。

## 当前阻塞

本机 **没有可用的 GitHub 凭据**：
- `ssh -T git@github.com` → `Permission denied (publickey)`
- 未安装 / 未登录 `gh` CLI

建镜像仓与开 PR 都需要 GitHub 账号。

## 待提交的 YAML（把 `<owner>` 换成你的 GitHub 用户名）

文件：`data/plugins/<owner>__dsh-idea-launcher.yml`

```yaml
url: https://github.com/<owner>/dsh-idea-launcher
name: <owner>/dsh-idea-launcher
category: dev
description:
  en: 'Reads IDEA run configurations and launches Java, Spring Boot and Vue projects inside DeepSeek Harness, with colored logs and a fast java -cp path.'
  zh: '在 DeepSeek Harness 里读取 IDEA 运行配置，启动 Java / Spring Boot / Vue 项目并查看彩色日志，支持快速启动（java -cp 直启）。'
```

注意：描述里出现 `: `（冒号+空格）要加引号，否则 YAML 解析失败。

## 操作步骤（任选一种）

### A. 你自己做（不需要把凭据给我）

```bash
# 1. GitHub 建一个空仓库 <owner>/dsh-idea-launcher（public，不要初始化 README）
# 2. 从 Gitee 镜像推送（会同时推 master 与 v0.1.0 tag）
cd dsh-idea-launcher
git remote add github git@github.com:<owner>/dsh-idea-launcher.git
git push github master:main --tags

# 3. 在 GitHub fork https://github.com/awesome-dsh-plugin/awesome-dsh-plugin
git clone git@github.com:<owner>/awesome-dsh-plugin.git
cd awesome-dsh-plugin
#    新增 data/plugins/<owner>__dsh-idea-launcher.yml（内容见上）
git checkout -b add-dsh-idea-launcher
git add data/plugins/<owner>__dsh-idea-launcher.yml
git commit -m "Add <owner>/dsh-idea-launcher"
git push origin add-dsh-idea-launcher
# 4. 在 GitHub 开 PR（标题：Add <owner>/dsh-idea-launcher）
```

### B. 给我 GitHub 个人访问令牌（PAT）

需要的权限：`repo`（建仓/推送）+ `public_repo` 足够；我会：
1. 用 API 建 `<owner>/dsh-idea-launcher`；
2. 把 Gitee 仓库（含 `v0.1.0` tag）镜像推过去；
3. fork `awesome-dsh-plugin`，加 `data/plugins/<owner>__dsh-idea-launcher.yml`，开 PR。

> 令牌用完请立即在 GitHub 删除；我不会把它写进任何文件或日志。

### C. 先不发市场

Gitee 仓库 + tag 已经可安装（见 README「安装」），市场收录等有 GitHub 账号再做。

## 可选：市场卡片图标

需要一张 **180×180 的位图**（PNG/JPG），且托管在 GitHub 上（例如 `<owner>/dsh-idea-launcher/main/assets/icon-180.png`），
在 YAML 里写 `icon: https://raw.githubusercontent.com/<owner>/dsh-idea-launcher/main/assets/icon-180.png`。
不写则回退到作者头像。仓库里目前没有图标资源。
