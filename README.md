# dock-git

[English](README.en.md)

dock 系列的 Git 历史可视化插件：在侧边栏挂载启动面板（活动项 `git`），渲染当前工作区 git 仓库的提交历史图（提交图 / 分支 / 标签 / 远端），并支持分支、标签、配置、远端、暂存、提交与推送操作。

## 功能

- **提交历史图**：泳道式提交图，展示分支/标签/远端引用徽标、未提交改动节点；N+1 探测「更多提交」。
- **提交详情**：点击提交展开详情——提交信息、作者、变更文件树（新增/修改/删除/重命名）、旧/新文件内容三栏对比、diff（512 KiB 截断，UTF-16 安全）。
- **多仓库发现**：扫描会话工作区（cwd 及其两层子目录）内的独立 git 仓库，可切换目标仓库。
- **分支/标签管理**：创建、重命名、删除分支，创建/删除标签，检出（`git switch`，无路径语义歧义）。
- **暂存与提交**：VSCode 风格 status/stage/unstage/commit（`--no-verify`，不执行仓库钩子）。
- **远端操作**：list / add / remove / set-url、fetch、pull、fetch-into、push（分支/标签，支持 `--force-with-lease`）。
- **配置读写**：读取任意仓库配置；写入仅限 `user.name` / `user.email`。
- **多语言**：内置中英文界面，跟随 DSH 全局语言设置。

## 安装

需要 `dock` 基础插件：

```sh
dsh plugin add github:AKS1st/dock
dsh plugin add github:AKS1st/dock-git
```

## 安全

- `/wb-git` 路由只接受受信任来源（回环地址 / trustedHosts + 同源检查）的 POST。
- git 一律以参数数组直接 spawn（无 shell 字符串），环境变量消毒（清掉 GIT_DIR / GIT_WORK_TREE，固定 C locale）。
- 所有用户可控的 argv 位置都有白名单校验：ref 名、远端名、config key、暂存路径、提交消息等；拒绝前导 `-`（选项注入）、`..` / `@{`（范围/refspec 走私）、路径规格 magic（`:`）、控制字符与 NUL。
- `repoRoot` 限定在会话工作区内（realpath 前缀比较），不能在任意目录执行 git。
- 大输出命令（log / diff / show / status）带流式字节上限，超出即终止子进程，避免拖垮宿主。
- 检出用 `git switch`，绝不回退到路径语义（不会误恢复工作区文件）。

## License

MIT
