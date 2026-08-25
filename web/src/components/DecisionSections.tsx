import { useMemo } from "react";

import { rejectionRules } from "../data/nameSystemData";
import { applyTraditionalReference } from "../domain/nameSystem";
import { personalFit, recommendationReasons } from "../domain/preferenceModel";
import type { PersonalizedCandidate } from "../domain/types";
import {
  exportProfile,
  type BirthDetails,
  type LocalProfile,
  type MetaphysicsAssessment,
} from "../state/storage";
import type { SectionId } from "./AppShell";
import { SectionHeader } from "./AppShell";

interface LegacyComparisonCandidate {
  fullName: string;
  legacy: true;
}
type ComparisonCandidate = PersonalizedCandidate | LegacyComparisonCandidate;

function isPersonalizedCandidate(
  candidate: ComparisonCandidate,
): candidate is PersonalizedCandidate {
  return !("legacy" in candidate);
}

const comparisonName = (candidate: ComparisonCandidate): string =>
  candidate.fullName;

const comparisonPinyin = (candidate: ComparisonCandidate): string =>
  isPersonalizedCandidate(candidate)
    ? candidate.quality.pinyin
    : "待在新推荐池中重新核验";

const comparisonTones = (candidate: ComparisonCandidate): string =>
  isPersonalizedCandidate(candidate)
    ? candidate.quality.tones
    : "待补";

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
        : "旧版保留名称，请从完整典籍重新核验。",
  },
  {
    label: "典据关系",
    value: (candidate) =>
      isPersonalizedCandidate(candidate)
        ? evidenceRelationLabel(candidate)
        : "待 V2 语义核验",
  },
  {
    label: "出处",
    value: (candidate) =>
      isPersonalizedCandidate(candidate)
        ? candidate.evidence.citations
            .map((citation) => `${citation.bookTitle}·${citation.workTitle}`)
            .join("；")
        : "请使用古籍核查",
  },
  {
    label: "取字",
    value: (candidate) =>
      isPersonalizedCandidate(candidate)
        ? candidate.evidence.extraction
        : "待重新标注",
  },
  {
    label: "使用权衡",
    value: (candidate) =>
      isPersonalizedCandidate(candidate)
        ? `${candidate.quality.pronunciationNote} ${candidate.quality.usabilityNote}`
        : "待人工判断",
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
        : "待人工判断",
  },
  {
    label: "主要风险",
    value: (candidate) =>
      isPersonalizedCandidate(candidate)
        ? candidate.risks.map((risk) => risk.summary).join("；") || "暂无硬性风险"
        : "待人工判断",
  },
];

export function CompareTable({
  candidates,
  profile,
  onRemove,
  onNavigate,
}: {
  candidates: readonly PersonalizedCandidate[];
  profile: LocalProfile;
  onRemove: (name: string) => void;
  onNavigate: (section: SectionId) => void;
}) {
  const selected: ComparisonCandidate[] = profile.compareNames.map(
    (name) =>
      candidates.find(
        (candidate) =>
          candidate.fullName === name || candidate.givenName === name,
      ) ?? { fullName: name, legacy: true },
  );

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
                <span>{
                  isPersonalizedCandidate(candidate)
                    ? candidate.evidence.reviewStatus === "reviewed"
                      ? "人工精审候选"
                      : "规则粗筛 · 待精审"
                    : "旧版保留名称"
                }</span>
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
  candidates: readonly PersonalizedCandidate[];
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
        .slice(0, 6)
        .map((candidate) => candidate.fullName),
    ];
    return [...new Set(preferred)]
      .map((name) =>
        candidates.find(
          (candidate) =>
            candidate.fullName === name || candidate.givenName === name,
        ),
      )
      .filter((candidate): candidate is PersonalizedCandidate => Boolean(candidate))
      .slice(0, 10);
  }, [candidates, profile.compareNames, profile.favoriteNames]);

  const traditionalReferences = namesForAssessment
    .map((candidate) => {
      const assessment = profile.assessments[candidate.fullName];
      const fit = personalFit(profile.preference, candidate);
      return {
        candidate,
        fit,
        reasons: recommendationReasons(profile.preference, candidate, 2),
        result: applyTraditionalReference(fit, candidate.eligibility, {
          birthStatus: profile.birthStatus,
          metaphysicsWeight: profile.metaphysicsWeight,
          metaphysicsScore: assessment?.score,
        }),
      };
    })
    .sort(
      (left, right) =>
        (right.result.adjustedPersonalFit ?? -1) -
          (left.result.adjustedPersonalFit ?? -1) ||
        left.candidate.id.localeCompare(right.candidate.id),
    );

  const born = profile.birthStatus === "已出生";

  return (
    <section className="page-section">
      <SectionHeader
        eyebrow="POST-BIRTH CALIBRATION · 校准层"
        title="出生后复排"
        description="传统命理依赖实际出生年月日时。出生前只保留预产窗口，有效权重为 0；出生后可记录四柱和顾问理由，但最高只作 10% 的弱参考。"
        aside={
          <div className={`birth-status ${born ? "is-born" : ""}`}>
            <span>{profile.birthStatus}</span>
            <strong>{born ? "可录入实际信息" : "传统权重自动为 0"}</strong>
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
              <label className="field field-wide">
                <span>已有参考预排（不参与排序）</span>
                <textarea
                  value={profile.birth.metaphysicsNote}
                  onChange={(event) =>
                    updateBirth({ metaphysicsNote: event.target.value })
                  }
                />
              </label>
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
                  <label className="field field-wide">
                    <span>传统参考备注</span>
                    <textarea
                      value={profile.birth.metaphysicsNote}
                      onChange={(event) =>
                        updateBirth({ metaphysicsNote: event.target.value })
                      }
                    />
                  </label>
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
                    传统参考权重：{Math.round(profile.metaphysicsWeight * 100)}%
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="0.1"
                    step="0.05"
                    value={profile.metaphysicsWeight}
                    onChange={(event) =>
                      setMetaphysicsWeight(Number(event.target.value))
                    }
                  />
                  <small>
                    仅用于出生后的最终清单弱排序；默认个性推荐仍由家庭偏好与名字特征决定。
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
              <b>会限制：</b>传统参考只能占出生后最终清单弱排序的 0–10%。
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
            <h2>{born ? "传统参考记录表" : "出生前不参与排序"}</h2>
          </div>
          <p>
            {born
              ? "只对已精选的最终清单录入 0–100 参考值，并必须附上判断理由；界面不生成万能总分。"
              : "当前所有候选的有效传统权重为 0；预产期不能冒充实际八字。"}
          </p>
        </div>
        <div className="rerank-table-wrap">
          <table className="rerank-table">
            <thead>
              <tr>
                <th scope="col">名字</th>
                <th scope="col">个人适配依据</th>
                <th scope="col">传统参考与理由</th>
                <th scope="col">有效权重</th>
                <th scope="col">处理状态</th>
              </tr>
            </thead>
            <tbody>
              {traditionalReferences.map(({ candidate, reasons, result }) => {
                const assessment = profile.assessments[candidate.fullName] ?? {
                  score: 50,
                  rationale: "",
                };
                return (
                  <tr key={candidate.fullName}>
                    <th scope="row">
                      <b>{candidate.fullName}</b>
                      <span>{candidate.quality.pinyin}</span>
                    </th>
                    <td>{reasons.join("；") || "个人适配与多样性组批候选"}</td>
                    <td>
                      <div className="assessment-input">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          disabled={!born}
                          value={assessment.score}
                          aria-label={`${candidate.fullName}传统参考值`}
                          onChange={(event) =>
                            updateAssessment(candidate.fullName, {
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
                          aria-label={`${candidate.fullName}传统参考理由`}
                          onChange={(event) =>
                            updateAssessment(candidate.fullName, {
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
                    <td>{result.status}</td>
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
  resetCalibration,
  clearProfile,
}: {
  profile: LocalProfile;
  resetCalibration: () => void;
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
        description="这套系统把典籍证据、名字质量、个人适配和传统参考分开记录。它们可以共同帮助决策，但不会被伪装成一个客观万能总分。"
      />

      <div className="method-intro">
        <p className="vertical-caption" aria-hidden="true">
          取名有法
        </p>
        <div>
          <h2>宽进、分级、窄出，再让家庭偏好参与排序</h2>
          <p>
            70 部古籍先广泛发现字词，再分成“人工精审、规则粗筛、仅检索”三层。前两层可进入个性组批，但规则粗筛始终标明待人工复核，不冒充精选结论。
          </p>
        </div>
      </div>

      <div className="method-grid">
        <article>
          <span>01</span>
          <h3>典籍证据</h3>
          <dl className="grade-list">
            <div><dt>词</dt><dd><b>原文连续成词</b><span>上下文中具有完整词义</span></dd></div>
            <div><dt>句</dt><dd><b>同句关联取字</b><span>并列、对偶、修饰或首尾关系可说明</span></dd></div>
            <div><dt>篇</dt><dd><b>同篇语境取字</b><span>意象与语义方向一致</span></dd></div>
            <div><dt>组</dt><dd><b>透明文化重组</b><span>说明组合来路，不宣称原文成词</span></dd></div>
          </dl>
        </article>

        <article>
          <span>02</span>
          <h3>名字质量</h3>
          <div className="weight-equation">
            <p><b>音</b> 完整姓名的读音、声调与谐音</p>
            <p><b>形</b> 规范字、书写、输入和识读成本</p>
            <p><b>义</b> 两字组成后的完整含义与原典语境</p>
            <p><b>用</b> 少见不猎奇、重名代理说明与使用风险</p>
          </div>
        </article>

        <article>
          <span>03</span>
          <h3>个人适配</h3>
          <p>用 8 组成对选择学习家庭在古典感、端雅、清峻、少见度、易用性和家族意义之间的取舍。</p>
          <p>收藏与明确排除是强信号，对比是弱信号，跳过不改变偏好。解释只说“为什么适合你们”，不说名字客观上有多少分。</p>
        </article>

        <article>
          <span>04</span>
          <h3>多样性组批</h3>
          <p>每批 12 个名字中，7 个贴近当前偏好，3 个主动拓宽风格，2 个用于继续学习。</p>
          <p>7 个适配项和 3 个拓宽项逐个使用 MMR：0.75 × 个人适配 + 0.25 × 与本批已选名字的差异；2 个学习项另加偏好不确定性。</p>
          <p>候选相似度由风格 45%、共享字 20%、同音 15%、同典籍 10%、同取字关系 10% 构成；“本批差异”取 1 减去与已选项的最高相似度。规则粗筛尚未复核读音时不加同音判定；意象重复另作组批上限与拓宽奖励。</p>
          <p>每张卡公开本轮的适配、差异、MMR 基值、拓宽奖励与曝光惩罚。</p>
        </article>

        <article>
          <span>05</span>
          <h3>传统参考边界</h3>
          <p>实际出生时间和地点确认前有效权重为 0；确认后最高 10%，且必须记录时间口径、四柱、判断方向和理由。</p>
          <p>不自动做“缺什么补什么”，不使用五格笔画吉凶，也不允许传统参考恢复已被硬性排雷淘汰的名字。</p>
        </article>

        <article className="method-wide">
          <span>06</span>
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
            className="button button-quiet"
            type="button"
            onClick={resetCalibration}
          >
            重新校准偏好
          </button>
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
          版本 0.2 · 为王姓女孩、2026 年 8 月预产窗口建立
        </p>
        <p>“命名是一种祝愿，不是一份命运判决。”</p>
      </footer>
    </section>
  );
}
