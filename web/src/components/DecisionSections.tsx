import { useMemo } from "react";

import { rejectionRules, sourceGradeMap } from "../data/nameSystemData";
import { rerankCandidate } from "../domain/nameSystem";
import type { DiscoveryCandidate } from "../domain/discovery";
import type { CuratedCandidate, PersonalizedCandidate } from "../domain/types";
import {
  exportProfile,
  type BirthDetails,
  type LocalProfile,
  type MetaphysicsAssessment,
} from "../state/storage";
import type { SectionId } from "./AppShell";
import { SectionHeader } from "./AppShell";

type RankedCandidate = CuratedCandidate & {
  culturalScore: number;
  rank: number | null;
};
type ComparisonCandidate =
  | RankedCandidate
  | DiscoveryCandidate
  | PersonalizedCandidate;

function isRankedCandidate(
  candidate: ComparisonCandidate,
): candidate is RankedCandidate {
  return "culturalScore" in candidate;
}

function isPersonalizedCandidate(
  candidate: ComparisonCandidate,
): candidate is PersonalizedCandidate {
  return "fullName" in candidate;
}

const comparisonName = (candidate: ComparisonCandidate): string =>
  isPersonalizedCandidate(candidate) ? candidate.fullName : candidate.name;

const comparisonPinyin = (candidate: ComparisonCandidate): string =>
  isPersonalizedCandidate(candidate)
    ? candidate.quality.pinyin
    : candidate.pinyin ?? "待人工复核";

const comparisonTones = (candidate: ComparisonCandidate): string =>
  isPersonalizedCandidate(candidate)
    ? candidate.quality.tones
    : candidate.tones ?? "待补";

const evidenceRelationLabel = (candidate: PersonalizedCandidate): string =>
  ({
    "exact-phrase": "原文连续成词",
    "clause-related": "同句关联取字",
    "passage-related": "同篇语境取字",
    "cultural-recomposition": "透明文化重组",
  })[candidate.evidence.relation];

export function CompareDrawer({
  names,
  onRemove,
  onOpen,
}: {
  names: readonly string[];
  onRemove: (name: string) => void;
  onOpen: () => void;
}) {
  if (names.length === 0) return null;

  return (
    <aside className="compare-drawer" aria-label="名字对照栏">
      <div>
        <span>四名对照</span>
        <strong>{names.length} / 4</strong>
      </div>
      <ul>
        {names.map((name) => (
          <li key={name}>
            {name}
            <button
              type="button"
              aria-label={`移出${name}`}
              onClick={() => onRemove(name)}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <button className="button button-primary" type="button" onClick={onOpen}>
        展开对照
      </button>
    </aside>
  );
}

const compareRows: Array<{
  label: string;
  value: (candidate: ComparisonCandidate) => string;
}> = [
  { label: "读音", value: comparisonPinyin },
  { label: "声调", value: comparisonTones },
  {
    label: "核心含义",
    value: (candidate) =>
      isPersonalizedCandidate(candidate)
        ? candidate.quality.meaning
        : candidate.familyNote || "待人工概括",
  },
  {
    label: "典据关系",
    value: (candidate) =>
      isPersonalizedCandidate(candidate)
        ? evidenceRelationLabel(candidate)
        : isRankedCandidate(candidate)
          ? `${candidate.grade} 级精选证据`
          : `${candidate.grade} 级全文发现`,
  },
  {
    label: "出处",
    value: (candidate) =>
      isPersonalizedCandidate(candidate)
        ? candidate.evidence.citations
            .map((citation) => `${citation.bookTitle}·${citation.workTitle}`)
            .join("；")
        : candidate.source,
  },
  {
    label: "取字",
    value: (candidate) =>
      isPersonalizedCandidate(candidate)
        ? candidate.evidence.extraction
        : candidate.extraction,
  },
  {
    label: "使用权衡",
    value: (candidate) =>
      isPersonalizedCandidate(candidate)
        ? `${candidate.quality.pronunciationNote} ${candidate.quality.usabilityNote}`
        : candidate.risk || "待人工判断",
  },
  {
    label: "少见度说明",
    value: (candidate) =>
      isPersonalizedCandidate(candidate)
        ? candidate.quality.uncommonnessNote
        : "待实名数据复核",
  },
  {
    label: "家族呼应",
    value: (candidate) =>
      isPersonalizedCandidate(candidate)
        ? candidate.features.familyMeaning >= 0.65
          ? "有较明确的家族意义线索"
          : "不以家族线为主"
        : candidate.familyNote ?? "待人工判断",
  },
  {
    label: "主要风险",
    value: (candidate) =>
      isPersonalizedCandidate(candidate)
        ? candidate.risks.map((risk) => risk.summary).join("；") || "暂无硬性风险"
        : candidate.risk ?? "待人工判断",
  },
];

export function CompareTable({
  candidates,
  discoveryCandidates,
  personalizedCandidates,
  profile,
  onRemove,
  onNavigate,
}: {
  candidates: readonly RankedCandidate[];
  discoveryCandidates: readonly DiscoveryCandidate[];
  personalizedCandidates?: readonly PersonalizedCandidate[];
  profile: LocalProfile;
  onRemove: (name: string) => void;
  onNavigate: (section: SectionId) => void;
}) {
  const selected = profile.compareNames
    .map(
      (name) =>
        personalizedCandidates?.find((candidate) => candidate.fullName === name) ??
        candidates.find((candidate) => candidate.name === name) ??
        discoveryCandidates.find((candidate) => candidate.name === name),
    )
    .filter((candidate): candidate is ComparisonCandidate => Boolean(candidate));

  return (
    <section className="page-section">
      <SectionHeader
        eyebrow="SIDE-BY-SIDE · 家庭讨论"
        title="四名对照"
        description="把直觉拆成可比较的维度。建议四名以内，否则家人的注意力会重新被名字数量淹没。"
        aside={
          <div className="large-count">
            <strong>{selected.length}/4</strong>
            <span>对照席位</span>
          </div>
        }
      />

      {selected.length === 0 ? (
        <div className="empty-state spacious">
          <span className="empty-seal">待</span>
          <b>对照栏还是空的</b>
          <p>从“个性寻名”加入 2–4 个名字，再回来横向比较。</p>
          <button
            className="button button-primary"
            type="button"
            onClick={() => onNavigate("explore")}
          >
            去个性寻名
          </button>
        </div>
      ) : (
        <>
          <div className="compare-nameplates">
            {selected.map((candidate) => (
              <article key={comparisonName(candidate)}>
                <span>{isPersonalizedCandidate(candidate) ? "语义审核候选" : isRankedCandidate(candidate) ? `第 ${candidate.rank} 名` : "全文发现"}</span>
                <h2>{comparisonName(candidate)}</h2>
                <p>{comparisonPinyin(candidate)}</p>
                <button type="button" onClick={() => onRemove(comparisonName(candidate))}>
                  移出
                </button>
              </article>
            ))}
          </div>
          <div className="compare-scroll" tabIndex={0}>
            <table className="compare-table">
              <thead>
                <tr>
                  <th scope="col">观察项</th>
                  {selected.map((candidate) => (
                    <th key={comparisonName(candidate)} scope="col">
                      {comparisonName(candidate)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {compareRows.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    {selected.map((candidate) => (
                      <td key={comparisonName(candidate)}>{row.value(candidate)}</td>
                    ))}
                  </tr>
                ))}
                <tr>
                  <th scope="row">家庭备注</th>
                  {selected.map((candidate) => (
                    <td key={comparisonName(candidate)}>
                      {profile.notes[comparisonName(candidate)] || "尚未记录"}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function Field({
  label,
  value,
  placeholder,
  type = "text",
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  type?: "text" | "date" | "time";
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

export function BirthProfile({
  candidates,
  profile,
  setBirthStatus,
  setMetaphysicsWeight,
  updateBirth,
  updateAssessment,
}: {
  candidates: readonly RankedCandidate[];
  profile: LocalProfile;
  setBirthStatus: (status: LocalProfile["birthStatus"]) => void;
  setMetaphysicsWeight: (weight: number) => void;
  updateBirth: (patch: Partial<BirthDetails>) => void;
  updateAssessment: (
    name: string,
    assessment: MetaphysicsAssessment,
  ) => void;
}) {
  const namesForAssessment = useMemo(() => {
    const preferred = [
      ...profile.compareNames,
      ...profile.favoriteNames,
      ...candidates
        .filter((candidate) => candidate.gate === "通过")
        .slice(0, 6)
        .map((candidate) => candidate.name),
    ];
    return [...new Set(preferred)]
      .map((name) => candidates.find((candidate) => candidate.name === name))
      .filter((candidate): candidate is RankedCandidate => Boolean(candidate))
      .slice(0, 10);
  }, [candidates, profile.compareNames, profile.favoriteNames]);

  const reranked = namesForAssessment
    .map((candidate) => {
      const assessment = profile.assessments[candidate.name];
      return {
        candidate,
        result: rerankCandidate(candidate, {
          birthStatus: profile.birthStatus,
          metaphysicsWeight: profile.metaphysicsWeight,
          metaphysicsScore: assessment?.score,
        }),
      };
    })
    .sort((left, right) => right.result.finalScore - left.result.finalScore);

  const born = profile.birthStatus === "已出生";

  return (
    <section className="page-section">
      <SectionHeader
        eyebrow="POST-BIRTH CALIBRATION · 校准层"
        title="出生后复排"
        description="古代命理依赖实际出生年月日时。出生前只做日期与时辰情景占位，不虚构八字；出生后也只把民俗判断作为有限权重的一票。"
        aside={
          <div className={`birth-status ${born ? "is-born" : ""}`}>
            <span>{profile.birthStatus}</span>
            <strong>{born ? "可录入实际信息" : "命理权重自动为 0"}</strong>
          </div>
        }
      />

      <div className="privacy-banner">
        <span aria-hidden="true">锁</span>
        <p>
          <b>本地隐私模式</b>
          以下出生信息不会上传到服务器，只写入当前浏览器的 localStorage。
        </p>
      </div>

      <div className="birth-layout">
        <form className="birth-form" onSubmit={(event) => event.preventDefault()}>
          <fieldset>
            <legend>一 · 当前阶段</legend>
            <div className="segmented-control">
              {(["未出生", "已出生"] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  className={profile.birthStatus === status ? "is-active" : ""}
                  aria-pressed={profile.birthStatus === status}
                  onClick={() => setBirthStatus(status)}
                >
                  {status}
                </button>
              ))}
            </div>
          </fieldset>

          {!born ? (
            <fieldset>
              <legend>二 · 预产窗口</legend>
              <div className="form-grid">
                <Field
                  label="起始日期"
                  type="date"
                  value={profile.birth.dueStart}
                  onChange={(dueStart) => updateBirth({ dueStart })}
                />
                <Field
                  label="结束日期"
                  type="date"
                  value={profile.birth.dueEnd}
                  onChange={(dueEnd) => updateBirth({ dueEnd })}
                />
              </div>
              <p className="field-help">
                2026 年 8 月 20–30 日共 11 天 × 12 时辰，形成 132
                个占位情景。它们不用于提前判定喜用神。
              </p>
            </fieldset>
          ) : (
            <>
              <fieldset>
                <legend>二 · 实际出生资料</legend>
                <div className="form-grid">
                  <Field
                    label="出生日期"
                    type="date"
                    value={profile.birth.date}
                    onChange={(date) => updateBirth({ date })}
                  />
                  <Field
                    label="北京时间"
                    type="time"
                    value={profile.birth.time}
                    onChange={(time) => updateBirth({ time })}
                  />
                  <Field
                    label="出生城市"
                    value={profile.birth.city}
                    placeholder="例如：北京"
                    onChange={(city) => updateBirth({ city })}
                  />
                  <Field
                    label="经度（可选）"
                    value={profile.birth.longitude}
                    placeholder="例如：116.4074"
                    onChange={(longitude) => updateBirth({ longitude })}
                  />
                  <label className="field">
                    <span>时间口径</span>
                    <select
                      value={profile.birth.solarTimePolicy}
                      onChange={(event) =>
                        updateBirth({
                          solarTimePolicy: event.target
                            .value as BirthDetails["solarTimePolicy"],
                        })
                      }
                    >
                      <option>出生后决定</option>
                      <option>北京时间</option>
                      <option>真太阳时</option>
                      <option>两套并列</option>
                    </select>
                  </label>
                  <Field
                    label="四柱（由可信排盘填写）"
                    value={profile.birth.fourPillars}
                    placeholder="本工具不自动臆算"
                    onChange={(fourPillars) => updateBirth({ fourPillars })}
                  />
                </div>
              </fieldset>

              <fieldset>
                <legend>三 · 民俗判断边界</legend>
                <label className="field field-wide">
                  <span>用神方向或顾问结论</span>
                  <textarea
                    value={profile.birth.useDirection}
                    placeholder="记录判断依据，不只写一个五行字"
                    onChange={(event) =>
                      updateBirth({ useDirection: event.target.value })
                    }
                  />
                </label>
                <label className="field range-field weight-field">
                  <span>
                    民俗复排权重：{Math.round(profile.metaphysicsWeight * 100)}%
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="0.25"
                    step="0.05"
                    value={profile.metaphysicsWeight}
                    onChange={(event) =>
                      setMetaphysicsWeight(Number(event.target.value))
                    }
                  />
                  <small>
                    其余 {Math.round((1 - profile.metaphysicsWeight) * 100)}%
                    仍由女性感、典故、家族线、稀有度、音律和易用性决定。
                  </small>
                </label>
              </fieldset>
            </>
          )}
        </form>

        <aside className="birth-protocol">
          <p className="eyebrow">BOUNDARY NOTE</p>
          <h2>什么会算，什么不会算</h2>
          <ul>
            <li>
              <b>会保留：</b>实际时间、地点、采用的时间口径与顾问理由。
            </li>
            <li>
              <b>会限制：</b>命理分数只能占最终排序的 0–25%。
            </li>
            <li>
              <b>不会做：</b>用预产期冒充八字，或让五行覆盖负面典故硬筛。
            </li>
            <li>
              <b>不会宣称：</b>姓名评分能预测健康、性格、学业或命运。
            </li>
          </ul>
          <q>民俗可以被记录，但不应伪装成确定性科学。</q>
        </aside>
      </div>

      <div className="rerank-section">
        <div className="subsection-heading">
          <div>
            <p className="eyebrow">LIMITED-WEIGHT RERANK</p>
            <h2>{born ? "候选复排表" : "出生前排序保持不变"}</h2>
          </div>
          <p>
            {born
              ? "为候选录入 0–100 的民俗适配分，并必须附上理由。"
              : "当前所有候选的有效命理权重为 0；出生后切换状态再填写。"}
          </p>
        </div>
        <div className="rerank-table-wrap">
          <table className="rerank-table">
            <thead>
              <tr>
                <th scope="col">名字</th>
                <th scope="col">文化分</th>
                <th scope="col">民俗分与理由</th>
                <th scope="col">有效权重</th>
                <th scope="col">最终分</th>
              </tr>
            </thead>
            <tbody>
              {reranked.map(({ candidate, result }) => {
                const assessment = profile.assessments[candidate.name] ?? {
                  score: 50,
                  rationale: "",
                };
                return (
                  <tr key={candidate.name}>
                    <th scope="row">
                      <b>{candidate.name}</b>
                      <span>{result.status}</span>
                    </th>
                    <td>{result.culturalScore.toFixed(1)}</td>
                    <td>
                      <div className="assessment-input">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          disabled={!born}
                          value={assessment.score}
                          aria-label={`${candidate.name}民俗适配分`}
                          onChange={(event) =>
                            updateAssessment(candidate.name, {
                              score: Number(event.target.value),
                              rationale: assessment.rationale,
                            })
                          }
                        />
                        <input
                          type="text"
                          disabled={!born}
                          value={assessment.rationale}
                          placeholder="填写判断依据"
                          aria-label={`${candidate.name}民俗评分理由`}
                          onChange={(event) =>
                            updateAssessment(candidate.name, {
                              score: assessment.score,
                              rationale: event.target.value,
                            })
                          }
                        />
                      </div>
                    </td>
                    <td>
                      {Math.round(result.effectiveMetaphysicsWeight * 100)}%
                    </td>
                    <td>
                      <strong>{result.finalScore.toFixed(1)}</strong>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function downloadProfile(profile: LocalProfile) {
  const blob = new Blob([exportProfile(profile)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "王姓女孩取名档案.json";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function Methodology({
  profile,
  clearProfile,
}: {
  profile: LocalProfile;
  clearProfile: () => void;
}) {
  const handleClear = () => {
    if (
      window.confirm(
        "确定清除当前浏览器中的收藏、对照、备注和出生资料吗？此操作无法撤销。",
      )
    ) {
      clearProfile();
    }
  };

  return (
    <section className="page-section">
      <SectionHeader
        eyebrow="METHOD & PRIVACY · 附录"
        title="方法与隐私"
        description="这套系统把可查证的文化判断与不可证实的民俗判断分开：前者透明评分，后者出生后限权记录。"
      />

      <div className="method-intro">
        <p className="vertical-caption" aria-hidden="true">
          取名有法
        </p>
        <div>
          <h2>先淘汰不能接受的，再比较各有所长的</h2>
          <p>
            总分不是“真理机器”。它的作用，是让一家人知道为什么喜欢、为什么犹豫，以及哪个判断来自原文、哪个只是个人偏好。
          </p>
        </div>
      </div>

      <div className="method-grid">
        <article>
          <span>01</span>
          <h3>证据分级</h3>
          <dl className="grade-list">
            {sourceGradeMap.map((item) => (
              <div key={item.grade}>
                <dt className={`grade-badge grade-${item.grade}`}>
                  {item.grade}
                </dt>
                <dd>
                  <b>{item.definition}</b>
                  <span>出处维度参考 {item.sourceScore} / 5</span>
                </dd>
              </div>
            ))}
          </dl>
        </article>

        <article>
          <span>02</span>
          <h3>文化评分</h3>
          <div className="weight-equation">
            <p>
              <b>25%</b> 女性感
            </p>
            <p>
              <b>20%</b> 典故证据
            </p>
            <p>
              <b>15%</b> 家族呼应
            </p>
            <p>
              <b>15%</b> 稀有度
            </p>
            <p>
              <b>15%</b> 音律
            </p>
            <p>
              <b>10%</b> 易用性
            </p>
          </div>
        </article>

        <article className="method-wide">
          <span>03</span>
          <h3>七条硬筛与降级规则</h3>
          <div className="rule-table-wrap">
            <table className="rule-table">
              <thead>
                <tr>
                  <th scope="col">编号</th>
                  <th scope="col">门类</th>
                  <th scope="col">触发条件</th>
                  <th scope="col">处理</th>
                </tr>
              </thead>
              <tbody>
                {rejectionRules.map((rule) => (
                  <tr key={rule.code}>
                    <td>{rule.code}</td>
                    <th scope="row">{rule.category}</th>
                    <td>{rule.trigger}</td>
                    <td>{rule.handling}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </div>

      <div className="privacy-vault">
        <div>
          <p className="eyebrow">LOCAL DATA VAULT</p>
          <h2>你的取名档案由你保管</h2>
          <p>
            网站是纯静态页面，没有账号、数据库或分析接口。收藏、排除、对照、家庭备注与出生信息只保存在当前浏览器。
          </p>
        </div>
        <div className="vault-summary">
          <span>当前本地档案</span>
          <p>
            收藏 <b>{profile.favoriteNames.length}</b> · 对照{" "}
            <b>{profile.compareNames.length}</b> · 备注{" "}
            <b>{Object.keys(profile.notes).length}</b>
          </p>
        </div>
        <div className="vault-actions">
          <button
            className="button button-primary"
            type="button"
            onClick={() => downloadProfile(profile)}
          >
            导出本地档案
          </button>
          <button className="button button-danger" type="button" onClick={handleClear}>
            清除本地数据
          </button>
        </div>
      </div>

      <footer className="method-footer">
        <p>
          版本 0.1 · 为王姓女孩、2026 年 8 月预产窗口建立
        </p>
        <p>“命名是一种祝愿，不是一份命运判决。”</p>
      </footer>
    </section>
  );
}
