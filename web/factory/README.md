# 本地古籍候选工厂

该工具只在本机运行，使用 `deepseek-v4-flash` 从现有 70 部古籍全文库选择适合组成王姓女孩名字的原文位置，并进行多轮审核。GitHub Pages 和 GitHub Actions 不会调用 DeepSeek，也不需要 API Key。

生成与审核采用 `name-factory-v10` 协议。取材层先按分句提取距离 1–4 的自然双字机会，再让 70 部古籍中的合格来源按质量全局竞争；书目、作品和用字 MMR 只防止垄断，不再为弱书目保留生成配额。早期 smoke 使用的人工典故片段加分已移除，家喻户晓的熟典不再自动占据前排。全部书籍仍完整保留在全文搜索与典籍核实中。

模型只看到每段最高质量的少量窗口，并从形如 `[0]柔 [1]嘉` 的 `indexedText` 复制位置。自动候选的两个字必须来自同一个原始 passage，姓名、出现序号、取字关系、稳定 ID 和证据说明仍全部由本地程序计算。同一名字有多条典故时，只保留语义与证据最强的一条进入姓名审核，避免同名在不同批次出现相互矛盾的结论。姓名感与对抗审核使用本地拼音作为读音事实，最终审查还会复核前序已发现的具体风险；最终 approve 表示值得进入面向家长的稀缺短名单，而不是仅仅“没有致命问题”。对抗审核另行返回 `materialIssues`；模型即使误填 approve，只要已确认存在足以退出短名单的实质审美问题，本地程序仍强制淘汰。语义、证据、音韵、姓名感、女性气质、可用性和适度少见度均有不可互相抵消的发布门槛；越界、跨段落、重复位置或确定虚词残片会被淘汰并写入审核报告。

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
pnpm --dir web factory:build -- --max-cny 20 --target 400 --passages-per-book 16 --batch-size 8 --run-id first-2026-08 --resume
```

恢复时必须沿用原运行的预算与规模参数。程序会读取上一次脱敏费用清单，把已发生费用带入同一个硬上限；参数、语料或提示词版本不一致时拒绝恢复。

正式结果写入 `web/corpus/generated/approved-candidates.json`，本地完整报告写入 `web/factory/reports/<run-id>/`。`review-report.json` 会记录 `pointerSelectionCount`、`invalidPointerCount` 和逐条 `pointerIssues`，用于核对模型指针准确率。失败运行也会保留脱敏的 `manifest.json`，记录已发生请求和估算费用。只有通过本地硬规则、匿名语义审核、姓名感审核和对抗复审的候选会进入发布文件。

## 费用说明

默认总预算为 20 元：校准 2 元、生成 10 元、语义与姓名审核合计 5 元、对抗复审 2 元、重试 1 元。每次请求前都会按最大输出预留预算，请求完成后根据 API token usage 结算；预计下一次请求可能突破总预算或阶段预算时立即停止。价格和美元兑人民币换算可通过 `.env.example` 中的变量更新，运行清单会记录当次口径。
