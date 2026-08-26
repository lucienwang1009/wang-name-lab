# 古籍原文指针式候选生成设计

日期：2026-08-26  
状态：已确认  
适用范围：`web/factory/` 本地候选工厂

## 问题

现有生成器虽然接收了古籍原文、规范化正文和允许字符清单，但仍同时负责填写名字、来源字、出现序号、取字关系和解释。真实校准中，模型会先想起“令仪、含章、静姝”等熟悉名字，再为它们错配输入段落或夸大关系。JSON Schema 只能限制字段形状，无法保证字段与原文事实一致。本地硬规则能阻止错误发布，却造成大量无效调用和零产出。

## 选择的方案

继续把古籍原文直接交给 LLM，但把模型输出降权为“两个来源位置 + 待审查语义”。模型不得返回名字、来源字符、出现序号、取字关系或证据说明：

```ts
interface PointerSelection {
  first: { passageId: string; index: number };
  second: { passageId: string; index: number };
  meaning: string;
  rationale: string;
  imageryCategory: string;
  familyConnection: string;
}
```

`index` 指对应 `FactoryPassage.normalizedText` 的 Unicode 汉字位置。程序验证段落属于当前批次、位置为范围内整数，然后从两个位置读取规范简体字并组成 `givenName`。模型即使想表达输入外的熟悉名字，也只能得到实际位置上的字，无法伪造证据。

## 本地编译

本地编译器根据位置生成完整 `CandidateProposal`：

- `character`：直接读取 `normalizedText[index]`；
- `occurrence`：统计该位置之前相同字符的出现次数；
- `proposalId`：由批次 ID、段落 ID 和位置确定，忽略模型自定义 ID；
- `exact-phrase`：同段且第二个位置紧邻第一个位置；
- `clause-related`：同段、非连续，但位于同一规范化句子范围；
- `passage-related`：同段跨句，或不同段但属于同一作品；
- `cultural-recomposition`：两个位置属于不同作品；
- `extraction`：程序根据真实书目、篇章和位置生成，不采用模型复述。

两个位置相同、越界、段落不在批次或读取不到汉字时，选择无效。无效选择不会进入后续审核，但会以批次、位置和原因写入检查点与审核报告，便于衡量模型的指针准确率。

## 数据流

```text
古籍原文 + normalizedText
  → LLM 选择两个 passageId/index
  → 本地指针校验与 CandidateProposal 编译
  → 现有本地硬规则
  → 匿名语义审核
  → 姓名感审核
  → 对抗审核
  → 多样性排序与静态发布
```

下游 `CandidateProposal`、网页 Recommendation V3、偏好学习和 MMR 保持不变。提示词版本升级为 `name-factory-v3`，旧 v2 检查点不能误恢复，旧缓存也不会命中。

## 错误与恢复

- 指针级错误按候选淘汰，不中止整个批次；
- 整个校准窗口没有任何可编译且通过硬规则的候选时才停止扩量；
- 检查点保存已编译提案和指针问题，恢复后不重复生成已完成批次；
- 预算、缓存、JSON 修复与失败清单沿用现有实现；
- 不修改或发布当前 25 个人工精审候选。

## 验收标准

- LLM 生成响应结构中不存在 `givenName`、`character`、`occurrence`、`relation` 或 `extraction`；
- 所有编译后候选的名字、字符、出现序号和关系均由本地程序从语料确定；
- 单元测试覆盖连续、同句、同篇、跨篇、重复字符、越界和未知段落；
- 模拟端到端流水线能从指针响应发布候选，并审计无效指针；
- 全部测试、类型检查、dry-run 与生产构建通过；
- 验证阶段不调用真实 API，后续是否再次花费由用户单独确认。

