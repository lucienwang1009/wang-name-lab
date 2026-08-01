import type { SectionId } from "./AppShell";
import { SectionHeader } from "./AppShell";

interface FunnelOverviewProps {
  counts: {
    discovery: number;
    gradeA: number;
    gradeB: number;
    fragments: number;
    corpora: number;
    passing: number;
    favorites: number;
    compare: number;
    scenarios: number;
  };
  onNavigate: (section: SectionId) => void;
}

const steps = [
  {
    id: "explore" as const,
    number: "01",
    title: "典籍寻名",
    tag: "发现与精审",
    description: "直接从古籍原句取字，混合全文发现与人工精选，反复换一批。",
  },
  {
    id: "allusions" as const,
    number: "02",
    title: "完整核查",
    tag: "证据层",
    description: "给出任意名字，反查 70 部全文并区分 A–F 六级关系。",
  },
  {
    id: "compare" as const,
    number: "03",
    title: "家庭对照",
    tag: "决策层",
    description: "把收藏压缩到四名，逐项比较出处、女性感、家族呼应与风险。",
  },
  {
    id: "birth" as const,
    number: "04",
    title: "出生后复排",
    tag: "校准层",
    description: "出生前不算喜用神；出生后民俗评分权重最高仅 25%。",
  },
];

export function FunnelOverview({ counts, onNavigate }: FunnelOverviewProps) {
  return (
    <section className="page-section overview-page">
      <SectionHeader
        eyebrow="WANG FAMILY · NAME ARCHIVE 2026"
        title="为一个名字，留下完整来路"
        description="从古籍原文开始发现名字，再反复换一批、收藏、核验和比较。当前偏好：女孩、王姓、古典但不熟滥，可用隔字、首尾或尾首取法。"
        aside={
          <div className="status-stamp">
            <span>当前阶段</span>
            <strong>出生前 · 文化筛选</strong>
          </div>
        }
      />

      <div className="overview-hero">
        <div className="hero-statement">
          <p className="vertical-caption" aria-hidden="true">
            典有所据
          </p>
          <div>
            <span className="hero-index">家藏 · 甲编</span>
            <blockquote>
              “好名字不只要好听，
              <br />
              还应经得起追问。”
            </blockquote>
            <p>
              重点保留“玉”的家族线索，也用月色、光影与声韵含蓄回应奶奶“字玉”、姥姥“绍影”。
            </p>
            <div className="hero-actions">
              <button
                className="button button-primary"
                type="button"
                onClick={() => onNavigate("explore")}
              >
                开始典籍寻名
              </button>
              <button
                className="button button-quiet"
                type="button"
                onClick={() => onNavigate("method")}
              >
                阅读筛选规则
              </button>
            </div>
          </div>
        </div>

        <div className="candidate-preview" aria-label="风格锚点">
          <span className="folio-label">审美锚点</span>
          <div className="preview-name">
            <b>王</b>
            <span>令仪</span>
          </div>
          <p>WÁNG LÌNG-YÍ · 2—4—2</p>
          <q>柔嘉维则，令仪令色。</q>
          <small>《诗经·大雅·烝民》</small>
          <div className="preview-rule">
            <span>可再陌生一点</span>
            <span>仍需明确女性感</span>
          </div>
        </div>
      </div>

      <div className="metric-strip" aria-label="候选规模">
        <div>
          <strong>{counts.discovery.toLocaleString("zh-CN")}</strong>
          <span>典籍寻名候选</span>
        </div>
        <div>
          <strong>{counts.gradeA}</strong>
          <span>A 级 · 原文连续</span>
        </div>
        <div>
          <strong>{counts.gradeB}</strong>
          <span>B 级 · 同句或相邻</span>
        </div>
        <div>
          <strong>{counts.fragments}</strong>
          <span>{counts.corpora} 类精选片段</span>
        </div>
        <div>
          <strong>{counts.passing}</strong>
          <span>通过硬筛</span>
        </div>
        <div>
          <strong>{counts.scenarios}</strong>
          <span>出生情景</span>
        </div>
      </div>

      <div className="funnel-layout">
        <div className="funnel-heading">
          <p className="eyebrow">SELECTION FUNNEL</p>
          <h2>四层筛选，逐层提高证据</h2>
          <p>大量候选不是终点。每向下一层，名字更少，解释责任更高。</p>
        </div>
        <ol className="funnel-steps">
          {steps.map((step, index) => {
            const amount =
              index === 0
                ? counts.discovery
                : index === 1
                  ? 70
                  : index === 2
                    ? counts.compare
                    : counts.scenarios;
            return (
              <li key={step.id}>
                <button type="button" onClick={() => onNavigate(step.id)}>
                  <span className="step-number">{step.number}</span>
                  <span className="step-copy">
                    <small>{step.tag}</small>
                    <b>{step.title}</b>
                    <em>
                      {step.description}
                    </em>
                  </span>
                  <strong>{amount.toLocaleString("zh-CN")}</strong>
                  <span aria-hidden="true">→</span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="desk-grid">
        <article className="desk-note">
          <span>家族线索</span>
          <h3>不必机械拼成“玉影”</h3>
          <p>
            可直接保留玉字，也可用瑶、琬、璐等玉系字；“影”则可化为月光、映照、疏影等同场景意象。
          </p>
        </article>
        <article className="desk-note">
          <span>取字原则</span>
          <h3>允许首尾、尾首与隔字</h3>
          <p>
            只要两字来自同一可靠语境，并准确标注取法，就不必拘泥于原文连续成词。
          </p>
        </article>
        <article className="desk-note desk-progress">
          <span>你的进度</span>
          <h3>
            {counts.favorites > 0
              ? `已收藏 ${counts.favorites} 个候选`
              : "尚未收藏候选"}
          </h3>
          <p>
            已放入对照栏 {counts.compare} / 4 个名字。建议先选 6–10 个收藏，再压缩到四名。
          </p>
        </article>
      </div>
    </section>
  );
}
