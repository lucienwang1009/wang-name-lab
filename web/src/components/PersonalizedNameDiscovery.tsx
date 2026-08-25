import { useMemo, useState } from "react";

import { buildPersonalizedBatch } from "../domain/diversityRanker";
import { NAME_FEATURE_KEYS } from "../domain/nameFeatures";
import { personalUtility, recordPairwiseChoice } from "../domain/preferenceModel";
import type {
  EvidenceRelation,
  NameStyle,
  PersonalizedCandidate,
} from "../domain/types";
import type {
  PairwiseChoice,
  PreferenceState,
} from "../state/storage";
import { SectionHeader } from "./AppShell";
import type { CuratedProfileActions } from "./Catalogues";

type Viewpoint = "personal" | "evidence" | "uncommon" | "usable" | "family";

const viewpoints: Array<{ id: Viewpoint; label: string }> = [
  { id: "personal", label: "最适合我们" },
  { id: "evidence", label: "典据更直接" },
  { id: "uncommon", label: "少见不猎奇" },
  { id: "usable", label: "读写更稳妥" },
  { id: "family", label: "家族呼应" },
];

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

function qualityBaseline(candidate: PersonalizedCandidate): number {
  return (
    candidate.features.pronounceable +
    candidate.features.writable +
    candidate.features.recognizable
  ) / 3;
}

function featureDistance(
  left: PersonalizedCandidate,
  right: PersonalizedCandidate,
): number {
  const squared = NAME_FEATURE_KEYS.reduce((sum, key) => {
    const difference = left.features[key] - right.features[key];
    return sum + difference * difference;
  }, 0);
  return Math.sqrt(squared / NAME_FEATURE_KEYS.length);
}

export function selectCalibrationAnchors(
  candidates: readonly PersonalizedCandidate[],
  maximum = 16,
): PersonalizedCandidate[] {
  const available = candidates
    .filter((candidate) => candidate.eligibility === "recommendable")
    .sort(
      (left, right) =>
        qualityBaseline(right) - qualityBaseline(left) ||
        left.id.localeCompare(right.id),
    );
  const first = available.shift();
  if (!first) return [];
  const selected = [first];

  while (available.length > 0 && selected.length < maximum) {
    available.sort((left, right) => {
      const leftDistance = Math.min(
        ...selected.map((candidate) => featureDistance(left, candidate)),
      );
      const rightDistance = Math.min(
        ...selected.map((candidate) => featureDistance(right, candidate)),
      );
      return (
        rightDistance - leftDistance ||
        qualityBaseline(right) - qualityBaseline(left) ||
        left.id.localeCompare(right.id)
      );
    });
    selected.push(available.shift() as PersonalizedCandidate);
  }
  return selected;
}

function preferenceForViewpoint(
  preference: PreferenceState,
  viewpoint: Viewpoint,
): PreferenceState {
  if (viewpoint === "personal") return preference;
  const weights = { ...preference.weights };
  if (viewpoint === "evidence") {
    weights.classical = 1.6;
    weights.exactPhrasePreference = 2.6;
    weights.recompositionPreference = -0.6;
  } else if (viewpoint === "uncommon") {
    weights.uncommon = 2.8;
    weights.recognizable = 1;
    weights.writable = 0.6;
  } else if (viewpoint === "usable") {
    weights.pronounceable = 2.6;
    weights.writable = 2;
    weights.recognizable = 2.2;
  } else {
    weights.familyMeaning = 3;
  }
  return { ...preference, weights };
}

function calibrationChoice(
  preference: PreferenceState,
  left: PersonalizedCandidate,
  right: PersonalizedCandidate,
  choice: PairwiseChoice,
): PreferenceState {
  if (choice !== "skip") {
    return recordPairwiseChoice(preference, left, right, choice);
  }
  return {
    ...preference,
    feedback: [
      ...preference.feedback,
      { leftName: left.fullName, rightName: right.fullName, choice },
    ],
    calibrationProgress: Math.min(8, preference.calibrationProgress + 1),
  };
}

function CalibrationCandidate({ candidate }: { candidate: PersonalizedCandidate }) {
  const citation = candidate.evidence.citations[0];
  return (
    <article className="calibration-candidate">
      <span>{styleLabels[candidate.quality.primaryStyle]}</span>
      <h2>{candidate.fullName}</h2>
      <p>{candidate.quality.pinyin} · {candidate.quality.tones}</p>
      <strong>{candidate.quality.meaning}</strong>
      <blockquote>“{citation?.quote}”</blockquote>
      <small>{citation ? `${citation.bookTitle} · ${citation.workTitle}` : "典据待展开"}</small>
    </article>
  );
}

function RecommendationCard({
  candidate,
  reason,
  selectionKind,
  profile,
  onLookup,
}: {
  candidate: PersonalizedCandidate;
  reason: readonly string[];
  selectionKind: "fit" | "diverse" | "explore";
  profile: CuratedProfileActions;
  onLookup: (name: string) => void;
}) {
  const citation = candidate.evidence.citations[0];
  const favorite = profile.favoriteNames.includes(candidate.fullName);
  const rejected = profile.rejectedNames.includes(candidate.fullName);
  const compared = profile.compareNames.includes(candidate.fullName);
  const compareFull = profile.compareNames.length >= 4;
  const selectionLabel =
    selectionKind === "fit"
      ? "贴近当前偏好"
      : selectionKind === "diverse"
        ? "拓宽本轮风格"
        : "帮助继续学习";
  return (
    <article className={`personalized-card ${rejected ? "is-rejected" : ""}`}>
      <header>
        <div>
          <span className="recommendation-kind">{selectionLabel}</span>
          <h2>{candidate.fullName}</h2>
          <p>{candidate.quality.pinyin} · {candidate.quality.tones}</p>
        </div>
        <span className="evidence-relation">{relationLabels[candidate.evidence.relation]}</span>
      </header>

      <div className="candidate-meaning">
        <strong>{candidate.quality.meaning}</strong>
        <p>{candidate.quality.semanticExplanation}</p>
      </div>
      {citation ? (
        <div className="candidate-evidence">
          <blockquote>“{citation.quote}”</blockquote>
          <p><strong>{citation.bookTitle}</strong> · {citation.workTitle} · {citation.chapterTitle}</p>
          <small>{candidate.evidence.extraction}</small>
        </div>
      ) : null}

      <dl className="recommendation-reasons">
        <div>
          <dt>为什么出现</dt>
          <dd>{reason.length > 0 ? reason.join("；") : "通过语义核验，并作为本轮多样性候选加入。"}</dd>
        </div>
        <div>
          <dt>使用权衡</dt>
          <dd>{candidate.quality.usabilityNote} {candidate.quality.uncommonnessNote}</dd>
        </div>
        {candidate.risks.length > 0 ? (
          <div>
            <dt>需要复核</dt>
            <dd>{candidate.risks.map((risk) => risk.summary).join("；")}</dd>
          </div>
        ) : null}
      </dl>

      <details className="personal-note">
        <summary>写下家人的直觉与意见</summary>
        <textarea
          value={profile.notes[candidate.fullName] ?? ""}
          placeholder="例如：喜欢出处，但担心某个字难读……"
          onChange={(event) => profile.updateNote(candidate.fullName, event.target.value)}
        />
      </details>

      <footer>
        <div className="discovery-links">
          {citation ? <a href={citation.verificationUrl} target="_blank" rel="noreferrer">核验原文 ↗</a> : null}
          <button type="button" onClick={() => onLookup(candidate.fullName)}>查完整典籍</button>
        </div>
        <div className="discovery-actions">
          <button
            type="button"
            className={favorite ? "is-active" : ""}
            aria-pressed={favorite}
            onClick={() => profile.toggleFavorite(candidate.fullName)}
          >{favorite ? "已收藏" : "收藏"}</button>
          <button
            type="button"
            className={rejected ? "is-danger" : ""}
            aria-pressed={rejected}
            onClick={() => profile.toggleRejected(candidate.fullName)}
          >{rejected ? "已排除" : "排除"}</button>
          <button
            type="button"
            className={compared ? "is-active" : ""}
            aria-pressed={compared}
            disabled={!compared && compareFull}
            onClick={() => profile.toggleCompare(candidate.fullName)}
          >{compared ? "移出对照" : compareFull ? "对照已满" : "加入对照"}</button>
        </div>
      </footer>
    </article>
  );
}

export function PersonalizedNameDiscovery({
  candidates,
  loading,
  error,
  preference,
  profile,
  onPreferenceChange,
  onExposure,
  onLookup,
  onRetry,
}: {
  candidates: readonly PersonalizedCandidate[];
  loading: boolean;
  error?: string;
  preference: PreferenceState;
  profile: CuratedProfileActions;
  onPreferenceChange: (preference: PreferenceState) => void;
  onExposure: (names: readonly string[]) => void;
  onLookup: (name: string) => void;
  onRetry: () => void;
}) {
  const [viewpoint, setViewpoint] = useState<Viewpoint>("personal");
  const [previousBatch, setPreviousBatch] = useState<string[]>([]);
  const anchors = useMemo(() => selectCalibrationAnchors(candidates), [candidates]);
  const pairIndex = Math.min(7, preference.calibrationProgress);
  const left = anchors[pairIndex * 2];
  const right = anchors[pairIndex * 2 + 1];
  const rankedPreference = useMemo(
    () => preferenceForViewpoint(preference, viewpoint),
    [preference, viewpoint],
  );
  const availableCount = candidates.filter(
    (candidate) =>
      !profile.rejectedNames.includes(candidate.fullName) &&
      !profile.rejectedNames.includes(candidate.givenName),
  ).length;
  const excluded = previousBatch.length > 0 && availableCount - previousBatch.length >= 12
    ? previousBatch
    : [];
  const batch = useMemo(
    () =>
      buildPersonalizedBatch(candidates, rankedPreference, {
        size: 12,
        excludedNames: [...profile.rejectedNames, ...excluded],
      }),
    [candidates, excluded.join("|"), profile.rejectedNames, rankedPreference],
  );

  const answerPair = (choice: PairwiseChoice) => {
    if (!left || !right) return;
    const next = calibrationChoice(preference, left, right, choice);
    onPreferenceChange(next);
    if (next.calibrationProgress === 8) {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const refresh = () => {
    const names = batch.map(({ candidate }) => candidate.fullName);
    onExposure(names);
    setPreviousBatch(names);
  };

  if (loading) {
    return <section className="page-section loading-panel">正在加载经语义审核的候选池……</section>;
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

  if (preference.calibrationProgress < 8 && left && right) {
    return (
      <section className="page-section calibration-page">
        <SectionHeader
          eyebrow="PERSONAL CALIBRATION · 只比较，不打总分"
          title="先用 8 组选择认识你们"
          description="每次只凭整体直觉选一个。系统会学习古典感、少见度、读写便利、取字方式与家族意义之间的取舍；跳过不会被当作偏好。"
          aside={<div className="large-count"><strong>{preference.calibrationProgress + 1} / 8</strong><span>当前比较</span></div>}
        />
        <div className="calibration-progress" aria-label="偏好校准进度">
          <span style={{ width: `${((preference.calibrationProgress + 1) / 8) * 100}%` }} />
        </div>
        <div className="calibration-pair">
          <CalibrationCandidate candidate={left} />
          <span aria-hidden="true">或</span>
          <CalibrationCandidate candidate={right} />
        </div>
        <div className="calibration-actions">
          <button className="button button-primary" type="button" onClick={() => answerPair("left")}>更喜欢 {left.fullName}</button>
          <button className="button button-primary" type="button" onClick={() => answerPair("right")}>更喜欢 {right.fullName}</button>
          <button className="button button-quiet" type="button" onClick={() => answerPair("both-dislike")}>两个都不喜欢</button>
          <button className="button button-quiet" type="button" onClick={() => answerPair("skip")}>跳过这组</button>
        </div>
      </section>
    );
  }

  return (
    <section className="page-section personalized-page">
      <SectionHeader
        eyebrow="PERSONALIZED DISCOVERY · 适配与多样性并行"
        title="个性寻名"
        description="默认一批 12 个：7 个贴近当前偏好、3 个主动拓宽风格、2 个帮助继续学习。这里不设万能总分；出处、名字质量、个人适配与传统命理分别说明。"
        aside={<div className="large-count"><strong>{candidates.length}</strong><span>已通过语义审核</span></div>}
      />
      <div className="discovery-console personalized-console">
        <div className="segmented-control discovery-modes" aria-label="推荐观察角度">
          {viewpoints.map((item) => (
            <button
              key={item.id}
              type="button"
              className={viewpoint === item.id ? "is-active" : ""}
              aria-pressed={viewpoint === item.id}
              onClick={() => {
                setViewpoint(item.id);
                setPreviousBatch([]);
              }}
            >{item.label}</button>
          ))}
        </div>
        <button className="button button-primary" type="button" onClick={refresh}>换一批 12 个</button>
      </div>
      <p className="ranking-caveat">排序只表示“与当前选择的相对适配”，不表示名字有客观高低；每张卡都会说明入选原因与使用权衡。</p>
      <div className="personalized-grid">
        {batch.map(({ candidate, reasons, selectionKind }) => (
          <RecommendationCard
            key={candidate.id}
            candidate={candidate}
            reason={reasons}
            selectionKind={selectionKind}
            profile={profile}
            onLookup={onLookup}
          />
        ))}
      </div>
    </section>
  );
}
