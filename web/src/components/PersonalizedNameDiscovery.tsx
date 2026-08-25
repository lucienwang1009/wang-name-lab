import { useMemo } from "react";

import {
  selectAdaptiveRecommendation,
  type BatchSelectionKind,
  type PersonalizedBatchItem,
} from "../domain/diversityRanker";
import type {
  EvidenceRelation,
  NameStyle,
  PersonalizedCandidate,
} from "../domain/types";
import type {
  CandidateReaction,
  PreferenceState,
} from "../state/storage";
import { SectionHeader } from "./AppShell";
import type { CuratedProfileActions } from "./Catalogues";

const relationLabels: Record<EvidenceRelation, string> = {
  "exact-phrase": "原文连续成词",
  "clause-related": "同句关联取字",
  "passage-related": "同篇语境取字",
  "cultural-recomposition": "透明文化重组",
};

const styleLabels: Record<NameStyle, string> = {
  classical: "古典",
  graceful: "端雅",
  gentle: "温柔",
  bright: "明净",
  austere: "清峻",
  modern: "现代",
};

const modeLabels: Record<BatchSelectionKind, { title: string; detail: string }> = {
  fit: {
    title: "贴近当前偏好",
    detail: "利用已经学到的取舍，继续向你靠近。",
  },
  diverse: {
    title: "主动拓宽",
    detail: "在适配基础上避开最近名字的重复风格。",
  },
  explore: {
    title: "探索新方向",
    detail: "试探尚不确定的审美边界，避免过早定型。",
  },
};

const reactionOptions: Array<{
  reaction: CandidateReaction;
  label: string;
  detail: string;
  className: string;
}> = [
  { reaction: "dislike", label: "不喜欢", detail: "降低相似候选", className: "is-dislike" },
  { reaction: "skip", label: "跳过", detail: "不改变偏好", className: "is-skip" },
  { reaction: "like", label: "还不错", detail: "小幅提高相似候选", className: "is-like" },
  { reaction: "love", label: "很喜欢 · 收藏", detail: "强信号并加入收藏", className: "is-love" },
];

function MmrExplanation({ item }: { item: PersonalizedBatchItem }) {
  const { mmr, selectionKind } = item;
  const percent = (value: number) => `${Math.round(value * 100)}%`;
  const score = (value: number) => value.toFixed(2);
  if (selectionKind === "explore") {
    return (
      <p>
        不确定性 {percent(mmr.uncertainty)} × 50% + 最近差异 {percent(mmr.diversity)} × 30%
        + 个人适配 {percent(mmr.relevance)} × 20%
        {mmr.exposurePenalty > 0 ? `，扣除曝光 ${score(mmr.exposurePenalty)}` : ""}；
        本轮选择值 {score(mmr.selectionScore)}。
      </p>
    );
  }
  return (
    <p>
      个人适配 {percent(mmr.relevance)} × 75% + 最近差异 {percent(mmr.diversity)} × 25%
      = {score(mmr.weightedScore)}
      {mmr.diversityBonus > 0 ? `；拓宽奖励 ${score(mmr.diversityBonus)}` : ""}
      {mmr.exposurePenalty > 0 ? `；曝光惩罚 ${score(mmr.exposurePenalty)}` : ""}
      {mmr.closestSelectedName ? `；最近最相似的是${mmr.closestSelectedName}` : "；这是本次学习的起点"}。
    </p>
  );
}

function AdaptiveNameCard({
  item,
  profile,
  onLookup,
}: {
  item: PersonalizedBatchItem;
  profile: CuratedProfileActions;
  onLookup: (name: string) => void;
}) {
  const { candidate, reasons, selectionKind } = item;
  const citation = candidate.evidence.citations[0];
  const humanReviewed = candidate.evidence.reviewStatus === "reviewed";
  const compared = profile.compareNames.includes(candidate.fullName);
  const compareFull = profile.compareNames.length >= 4;
  const mode = modeLabels[selectionKind];

  return (
    <article className="adaptive-name-card">
      <div className="adaptive-nameplate">
        <div className="adaptive-card-kicker">
          <span className="recommendation-kind">{mode.title}</span>
          <span className={`review-tier ${humanReviewed ? "is-reviewed" : "is-rule-screened"}`}>
            {humanReviewed ? "人工精审" : "规则粗筛 · 待人工精审"}
          </span>
        </div>
        <span className="adaptive-style-mark">
          {styleLabels[candidate.quality.primaryStyle]} · {candidate.quality.imageryCategory}
        </span>
        <h2>{candidate.fullName}</h2>
        <p className="adaptive-pronunciation">
          {humanReviewed
            ? `${candidate.quality.pinyin} · ${candidate.quality.tones}`
            : "读音、声调与谐音待人工复核"}
        </p>
        <div className="adaptive-meaning">
          <strong>{candidate.quality.meaning}</strong>
          <p>{candidate.quality.semanticExplanation}</p>
        </div>
        <div className="adaptive-mode-note">
          <span>本次为何这样推荐</span>
          <strong>{mode.detail}</strong>
          <p>{reasons.length > 0 ? reasons.join("；") : "当前仍在建立家庭偏好。"}</p>
        </div>
      </div>

      <div className="adaptive-evidence-panel">
        <div className="adaptive-evidence-heading">
          <span>{relationLabels[candidate.evidence.relation]}</span>
          <small>{candidate.evidence.extraction}</small>
        </div>
        {citation ? (
          <>
            <blockquote>“{citation.quote}”</blockquote>
            <p className="adaptive-source">
              <strong>{citation.bookTitle}</strong>
              <span>{citation.workTitle} · {citation.chapterTitle}</span>
            </p>
          </>
        ) : null}
        <div className="adaptive-model-note">
          <span>MMR 推荐模型</span>
          <MmrExplanation item={item} />
        </div>
        <div className="adaptive-usage-note">
          <span>使用权衡</span>
          <p>{candidate.quality.usabilityNote} {candidate.quality.uncommonnessNote}</p>
        </div>
        {candidate.risks.length > 0 ? (
          <div className="adaptive-risk-note">
            <span>需要复核</span>
            <p>{candidate.risks.map((risk) => risk.summary).join("；")}</p>
          </div>
        ) : null}
        <details className="personal-note adaptive-personal-note">
          <summary>记录家人的直觉</summary>
          <textarea
            value={profile.notes[candidate.fullName] ?? ""}
            placeholder="例如：喜欢出处，但担心某个字难读……"
            onChange={(event) => profile.updateNote(candidate.fullName, event.target.value)}
          />
        </details>
        <footer className="adaptive-card-links">
          <div className="discovery-links">
            {citation ? <a href={citation.verificationUrl} target="_blank" rel="noreferrer">核验原文 ↗</a> : null}
            <button type="button" onClick={() => onLookup(candidate.fullName)}>查完整典籍</button>
          </div>
          <button
            type="button"
            className={compared ? "is-active" : ""}
            aria-pressed={compared}
            disabled={!compared && compareFull}
            onClick={() => profile.toggleCompare(candidate.fullName)}
          >{compared ? "移出对照" : compareFull ? "对照已满" : "加入对照"}</button>
        </footer>
      </div>
    </article>
  );
}

export function PersonalizedNameDiscovery({
  candidates,
  loading,
  error,
  preference,
  profile,
  onReaction,
  onUndoReaction,
  onLookup,
  onRetry,
}: {
  candidates: readonly PersonalizedCandidate[];
  loading: boolean;
  error?: string;
  preference: PreferenceState;
  profile: CuratedProfileActions;
  onReaction: (candidate: PersonalizedCandidate, reaction: CandidateReaction) => void;
  onUndoReaction: (candidate: PersonalizedCandidate) => void;
  onLookup: (name: string) => void;
  onRetry: () => void;
}) {
  const humanReviewedCount = candidates.filter(
    (candidate) => candidate.evidence.reviewStatus === "reviewed",
  ).length;
  const ruleScreenedCount = candidates.filter(
    (candidate) => candidate.evidence.reviewStatus === "rule-screened",
  ).length;
  const excludedNames = [...profile.favoriteNames, ...profile.rejectedNames];
  const current = useMemo(
    () => selectAdaptiveRecommendation(candidates, preference, { excludedNames }),
    [candidates, excludedNames.join("|"), preference],
  );
  const candidatesByName = useMemo(
    () => new Map(candidates.flatMap((candidate) => [
      [candidate.fullName, candidate] as const,
      [candidate.givenName, candidate] as const,
    ])),
    [candidates],
  );
  const lastReactionName = preference.reactionOrder.at(-1);
  const lastCandidate = lastReactionName ? candidatesByName.get(lastReactionName) : undefined;
  const learnedCount = preference.reactionOrder.length;
  const unavailableNames = new Set([...Object.keys(preference.reactions), ...excludedNames]);
  const remainingCount = candidates.filter(
    (candidate) =>
      (candidate.eligibility === "recommendable" || candidate.eligibility === "provisional") &&
      !unavailableNames.has(candidate.fullName) &&
      !unavailableNames.has(candidate.givenName),
  ).length;

  if (loading) {
    return <section className="page-section loading-panel">正在加载持续推荐候选池……</section>;
  }
  if (error) {
    return (
      <section className="page-section error-panel" role="alert">
        <h1>个性寻名暂时无法加载</h1>
        <p>{error}</p>
        <button className="button button-primary" type="button" onClick={onRetry}>重新加载推荐</button>
      </section>
    );
  }
  if (candidates.length === 0) {
    return (
      <section className="page-section error-panel">
        <h1>个性寻名</h1>
        <p>推荐池目前为空；全文典籍检索仍可单独使用。</p>
      </section>
    );
  }

  return (
    <section className="page-section adaptive-feed-page">
      <SectionHeader
        eyebrow="ADAPTIVE NAME FEED · 每次选择都重新学习"
        title="个性寻名"
        description={`一次认真看一个名字。每次选择都会立即更新家庭偏好，再从 ${humanReviewedCount} 个人工精审与 ${ruleScreenedCount} 个规则粗筛候选中计算下一名；约 20% 的推荐用于探索新方向。`}
        aside={
          <div className="adaptive-header-count">
            <strong>{learnedCount}</strong>
            <span>次反馈信号</span>
          </div>
        }
      />

      <div className="adaptive-learning-strip" aria-label="持续推荐状态">
        <div><span>学习进度</span><strong>已学习 {learnedCount} 次</strong></div>
        <div><span>尚未看过</span><strong>{remainingCount} 个</strong></div>
        <div><span>当前策略</span><strong>{current ? modeLabels[current.selectionKind].title : "本轮完成"}</strong></div>
        <button
          type="button"
          className="adaptive-undo"
          disabled={!lastCandidate}
          onClick={() => lastCandidate && onUndoReaction(lastCandidate)}
        >撤销上一步</button>
      </div>

      {current ? (
        <>
          <AdaptiveNameCard item={current} profile={profile} onLookup={onLookup} />
          <div className="reaction-rail" aria-label={`对${current.candidate.fullName}的直觉反馈`}>
            <p>不用分析太久，按第一直觉选择；下一名会立即重算。</p>
            <div>
              {reactionOptions.map((option) => (
                <button
                  key={option.reaction}
                  type="button"
                  className={option.className}
                  aria-label={option.label}
                  onClick={() => onReaction(current.candidate, option.reaction)}
                >
                  <strong>{option.label}</strong>
                  <span>{option.detail}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="adaptive-complete">
          <span className="empty-seal">成</span>
          <h2>这一轮候选已经看完</h2>
          <p>已学习 {learnedCount} 次。可以进入收藏和四名对照继续收敛，也可以撤销上一步重新选择。</p>
        </div>
      )}
    </section>
  );
}
