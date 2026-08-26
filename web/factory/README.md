# 本地古籍候选工厂

该工具只在本机运行，使用 `deepseek-v4-flash` 从现有 70 部古籍全文库生成并多轮审核王姓女孩名字。GitHub Pages 和 GitHub Actions 不会调用 DeepSeek，也不需要 API Key。

## 安全准备

1. 撤销任何曾经出现在聊天、终端或日志里的旧 Key。
2. 在 DeepSeek 控制台新建 Key。
3. 在 `web/.env.local` 写入 `DEEPSEEK_API_KEY=新Key`，或只在当前终端导出同名环境变量。
4. `.env.local`、缓存、检查点和本地报告均已排除在 Git 与网页部署之外。

程序不会打印 Key，也不会把 Key放进缓存键、请求报告、异常或发布 JSON。

## 命令

先构建全文库：

```bash
pnpm --dir web corpus:build
```

零费用查看调用计划：

```bash
pnpm --dir web factory:dry-run
```

最多 1 元的真实连通性测试：只取一个原句批次，随后至多各调用一次语义、姓名感和对抗审核；若校准候选未通过本地硬规则，会安全停止而不扩量。

```bash
pnpm --dir web factory:smoke
```

按默认 20 元硬上限正式构建：

```bash
pnpm --dir web factory:build
```

常用覆盖参数：

```bash
pnpm --dir web factory:build -- --max-cny 20 --target 400 --run-id first-2026-08
```

中断后使用原 run-id 恢复：

```bash
pnpm --dir web factory:build -- --run-id first-2026-08 --resume
```

正式结果写入 `web/corpus/generated/approved-candidates.json`，本地完整报告写入 `web/factory/reports/<run-id>/`。失败运行也会保留脱敏的 `manifest.json`，记录已发生请求和估算费用。只有通过本地硬规则、匿名语义审核、姓名感审核和对抗复审的候选会进入发布文件。

## 费用说明

默认总预算为 20 元：校准 2 元、生成 10 元、语义与姓名审核合计 5 元、对抗复审 2 元、重试 1 元。每次请求前都会按最大输出预留预算，请求完成后根据 API token usage 结算；预计下一次请求可能突破总预算或阶段预算时立即停止。价格和美元兑人民币换算可通过 `.env.example` 中的变量更新，运行清单会记录当次口径。
