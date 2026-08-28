# 本地古籍候选工厂

当前候选生产路线使用 Codex 的 `gpt-5.6-luna` 子代理阅读本地 70 部古籍全文库，再由主审筛选并写入 `web/corpus/generated/luna-approved-candidates.json`。不调用 DeepSeek，不读取 DeepSeek API Key；GitHub Pages 和 GitHub Actions 也不会调用任何模型。

仓库中的 DeepSeek 工厂代码和 `approved-candidates.json` 仅用于保留历史候选的来源审计，不再作为新增候选入口；相应命令已经从 `package.json` 移除。

当前流程先从本地全文构造有上下文的 source window，让 Luna 阅读高质量窗口并提出同句、同段非连续重组；不得只从已有名字或已有典故原文里改字。Luna 必须逐项说明取字关系、完整姓名听感、最大风险和淘汰理由。主审不会按数量发布，只保留真正像女孩姓名、少见而不猎奇的结果。

发布层不信任模型生成的引文。每个字的 passageId、出现序号、书名、篇名、原文和固定来源链接都由本地构建程序复核；模型归属、提示版本和运行批次必须一致。不同模型或批次的同名候选会使构建失败。全部 70 部书仍保留在全文搜索与典籍核实中。

## 命令

先构建全文库：

```bash
pnpm --dir web corpus:build
```

Luna 原始报告保存在被 Git 忽略的 `web/factory/reports/<run-id>/`。主审只能从报告中选择少量真实姓名感合格的结果，并补齐原文、取字位置、风险和模型归属；构建期会再次逐条核对固定语料。历史 DeepSeek 产物与每一批 Luna 产物分别保存，避免混写来源；`web/corpus/generated/` 中的每个 JSON 都必须是完整、可独立审计的发布批次，构建时再统一合并进入推荐池。

未发布候选也不能丢弃。版本化历史保存在 `web/factory/history/`，每条记录包含代理原始输出、来源批次和主审状态：`published` 已发布，`deferred` 值得以后按新偏好重审，`rejected` 是可用于改进提示词和过滤规则的负例。`rejected` 不是物理删除；若规则、语料或家庭偏好变化，可以从原始证据重新评估。
