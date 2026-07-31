import { useMemo, useState } from "react";

import type {
  AllusionCandidate,
  CuratedCandidate,
  RawNameCandidate,
} from "../domain/types";
import { SectionHeader } from "./AppShell";

type RankedCandidate = CuratedCandidate & {
  culturalScore: number;
  rank: number | null;
};

const PAGE_SIZE = 48;

function Pagination({
  page,
  total,
  pageSize,
  onPage,
}: {
  page: number;
  total: number;
  pageSize: number;
  onPage: (page: number) => void;
}) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="pagination" aria-label="分页">
      <button
        type="button"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        上一页
      </button>
      <span>
        第 {page} / {pageCount} 页
      </span>
      <button
        type="button"
        disabled={page >= pageCount}
        onClick={() => onPage(page + 1)}
      >
        下一页
      </button>
    </div>
  );
}

export function NameExplorer({
  candidates,
}: {
  candidates: readonly RawNameCandidate[];
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部");
  const [minimumFeminine, setMinimumFeminine] = useState(4);
  const [familyOnly, setFamilyOnly] = useState(false);
  const [page, setPage] = useState(1);

  const categories = useMemo(
    () => [
      "全部",
      ...new Set(
        candidates.flatMap((candidate) => [
          candidate.firstCategory,
          candidate.secondCategory,
        ]),
      ),
    ],
    [candidates],
  );

  const filtered = useMemo(() => {
    const normalized = query.trim();
    return candidates.filter(
      (candidate) =>
        (!normalized ||
          candidate.name.includes(normalized) ||
          candidate.first.includes(normalized) ||
          candidate.second.includes(normalized)) &&
        (category === "全部" ||
          candidate.firstCategory === category ||
          candidate.secondCategory === category) &&
        candidate.feminineProxy >= minimumFeminine &&
        (!familyOnly || candidate.familyProxy > 0),
    );
  }, [candidates, category, familyOnly, minimumFeminine, query]);

  const safePage = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
  const visible = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  return (
    <section className="page-section">
      <SectionHeader
        eyebrow="DISCOVERY INDEX · 发现层"
        title="原始寻名"
        description="这里用于发现陌生而可用的字组，不等同于推荐榜。每一个组合仍需进入古籍核验、音义排雷与人工精审。"
        aside={
          <div className="large-count">
            <strong>{filtered.length.toLocaleString("zh-CN")}</strong>
            <span>符合当前筛选</span>
          </div>
        }
      />

      <div className="archive-warning">
        <b>待核典</b>
        <p>
          本页名字由字库机械组合产生。看到喜欢的字形或气质后，请到“古籍典故库”寻找可靠出处，不能直接声称有典故。
        </p>
      </div>

      <div className="filter-ledger">
        <label className="field field-wide">
          <span>检索名字或单字</span>
          <input
            type="search"
            value={query}
            placeholder="例如：玉、皎、影"
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <label className="field">
          <span>意象门类</span>
          <select
            value={category}
            onChange={(event) => {
              setCategory(event.target.value);
              setPage(1);
            }}
          >
            {categories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="field range-field">
          <span>女性感不低于 {minimumFeminine.toFixed(1)}</span>
          <input
            type="range"
            min="3"
            max="5"
            step="0.1"
            value={minimumFeminine}
            onChange={(event) => {
              setMinimumFeminine(Number(event.target.value));
              setPage(1);
            }}
          />
        </label>
        <label className="check-field">
          <input
            type="checkbox"
            checked={familyOnly}
            onChange={(event) => {
              setFamilyOnly(event.target.checked);
              setPage(1);
            }}
          />
          <span>只看可呼应“玉 / 影 / 绍”的组合</span>
        </label>
      </div>

      <div className="name-index">
        {visible.map((candidate) => (
          <article key={candidate.id} className="index-ticket">
            <span>{candidate.id}</span>
            <h2>{candidate.name}</h2>
            <p>
              {candidate.firstCategory} · {candidate.secondCategory}
            </p>
            <dl>
              <div>
                <dt>女性感</dt>
                <dd>{candidate.feminineProxy.toFixed(1)}</dd>
              </div>
              <div>
                <dt>稀有度</dt>
                <dd>{candidate.rarityProxy.toFixed(1)}</dd>
              </div>
              <div>
                <dt>家族线</dt>
                <dd>{candidate.familyProxy.toFixed(1)}</dd>
              </div>
            </dl>
            <small>{candidate.status}</small>
          </article>
        ))}
      </div>
      {visible.length === 0 ? (
        <div className="empty-state">
          <b>没有符合条件的组合</b>
          <p>放宽女性感阈值，或取消家族线筛选再试。</p>
        </div>
      ) : null}
      <Pagination
        page={safePage}
        total={filtered.length}
        pageSize={PAGE_SIZE}
        onPage={setPage}
      />
    </section>
  );
}

export function AllusionLibrary({
  candidates,
}: {
  candidates: readonly AllusionCandidate[];
}) {
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState("全部");
  const [corpus, setCorpus] = useState("全部");
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const corpora = useMemo(
    () => ["全部", ...new Set(candidates.map((candidate) => candidate.corpus))],
    [candidates],
  );
  const filtered = useMemo(() => {
    const normalized = query.trim();
    return candidates.filter(
      (candidate) =>
        (!normalized ||
          candidate.name.includes(normalized) ||
          candidate.quote.includes(normalized) ||
          candidate.source.includes(normalized)) &&
        (grade === "全部" || candidate.grade === grade) &&
        (corpus === "全部" || candidate.corpus === corpus),
    );
  }, [candidates, corpus, grade, query]);
  const safePage = Math.min(page, Math.max(1, Math.ceil(filtered.length / pageSize)));
  const visible = filtered.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );

  return (
    <section className="page-section">
      <SectionHeader
        eyebrow="TEXTUAL EVIDENCE · 证据层"
        title="古籍典故库"
        description="所有候选都保留原文、篇目、取字方式与上下文。A级为原文连续，B级为同句隔字、首尾或尾首。"
        aside={
          <div className="large-count">
            <strong>{candidates.length}</strong>
            <span>条机器初筛路径</span>
          </div>
        }
      />

      <div className="filter-ledger compact">
        <label className="field field-wide">
          <span>检索名字、原文或篇目</span>
          <input
            type="search"
            value={query}
            placeholder="例如：明月、洛神赋、瑶"
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
          />
        </label>
        <label className="field">
          <span>证据等级</span>
          <select
            value={grade}
            onChange={(event) => {
              setGrade(event.target.value);
              setPage(1);
            }}
          >
            <option>全部</option>
            <option>A</option>
            <option>B</option>
          </select>
        </label>
        <label className="field">
          <span>古籍门类</span>
          <select
            value={corpus}
            onChange={(event) => {
              setCorpus(event.target.value);
              setPage(1);
            }}
          >
            {corpora.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="allusion-ledger">
        {visible.map((candidate) => (
          <details key={candidate.id} className="allusion-row">
            <summary>
              <span className={`grade-badge grade-${candidate.grade}`}>
                {candidate.grade}
              </span>
              <strong>{candidate.name}</strong>
              <span>{candidate.source}</span>
              <em>{candidate.extraction}</em>
              <span aria-hidden="true">＋</span>
            </summary>
            <div className="allusion-detail">
              <blockquote>“{candidate.quote}”</blockquote>
              <dl>
                <div>
                  <dt>人物 / 场景</dt>
                  <dd>{candidate.scene}</dd>
                </div>
                <div>
                  <dt>上下文基调</dt>
                  <dd>{candidate.contextTone}</dd>
                </div>
                <div>
                  <dt>审校状态</dt>
                  <dd>{candidate.reviewStatus}</dd>
                </div>
              </dl>
              <a href={candidate.url} target="_blank" rel="noreferrer">
                打开原典核验 ↗
              </a>
            </div>
          </details>
        ))}
      </div>
      {visible.length === 0 ? (
        <div className="empty-state">
          <b>没有找到对应典故</b>
          <p>试试只输入一个字，或把证据等级改为“全部”。</p>
        </div>
      ) : null}
      <Pagination
        page={safePage}
        total={filtered.length}
        pageSize={pageSize}
        onPage={setPage}
      />
    </section>
  );
}

function ScoreBar({ value, label }: { value: number; label: string }) {
  return (
    <div className="score-bar">
      <span>{label}</span>
      <i>
        <b style={{ width: `${value * 20}%` }} />
      </i>
      <em>{value.toFixed(1)}</em>
    </div>
  );
}

function NameCard({
  candidate,
  favorite,
  rejected,
  compared,
  compareFull,
  note,
  onFavorite,
  onReject,
  onCompare,
  onNote,
}: {
  candidate: RankedCandidate;
  favorite: boolean;
  rejected: boolean;
  compared: boolean;
  compareFull: boolean;
  note: string;
  onFavorite: () => void;
  onReject: () => void;
  onCompare: () => void;
  onNote: (note: string) => void;
}) {
  return (
    <article
      className={`name-card ${candidate.gate === "不通过" ? "is-rejected" : ""}`}
    >
      <header>
        <div className="rank-stamp">
          {candidate.rank ? (
            <>
              <span>NO.</span>
              <strong>{String(candidate.rank).padStart(2, "0")}</strong>
            </>
          ) : (
            <strong>筛除</strong>
          )}
        </div>
        <div className="name-title">
          <h2>{candidate.name}</h2>
          <p>
            {candidate.pinyin} · {candidate.tones}
          </p>
        </div>
        <span className={`grade-badge grade-${candidate.grade}`}>
          {candidate.grade}级
        </span>
      </header>

      <div className="card-source">
        <q>{candidate.quote}</q>
        <p>
          <b>{candidate.source}</b>
          <span>{candidate.extraction}</span>
        </p>
      </div>

      <div className="card-body">
        <div className="score-total">
          <strong>{candidate.culturalScore.toFixed(1)}</strong>
          <span>文化总分 / 100</span>
        </div>
        <div className="score-bars">
          <ScoreBar value={candidate.scores.feminine} label="女性感" />
          <ScoreBar value={candidate.scores.source} label="出处" />
          <ScoreBar value={candidate.scores.family} label="家族线" />
          <ScoreBar value={candidate.scores.rarity} label="稀有度" />
          <ScoreBar value={candidate.scores.phonology} label="音律" />
          <ScoreBar value={candidate.scores.usability} label="易用性" />
        </div>
      </div>

      <dl className="review-notes">
        <div>
          <dt>家族呼应</dt>
          <dd>{candidate.familyNote}</dd>
        </div>
        <div>
          <dt>风险提示</dt>
          <dd>{candidate.risk}</dd>
        </div>
      </dl>

      <details className="personal-note">
        <summary>写下家人的直觉与意见</summary>
        <textarea
          value={note}
          placeholder="例如：妈妈喜欢字形，爸爸担心误读……"
          onChange={(event) => onNote(event.target.value)}
        />
      </details>

      <footer>
        <a href={candidate.url} target="_blank" rel="noreferrer">
          核验原文 ↗
        </a>
        <div>
          <button
            type="button"
            className={favorite ? "is-active" : ""}
            aria-pressed={favorite}
            onClick={onFavorite}
          >
            {favorite ? "已收藏" : "收藏"}
          </button>
          <button
            type="button"
            className={rejected ? "is-danger" : ""}
            aria-pressed={rejected}
            onClick={onReject}
          >
            {rejected ? "已排除" : "排除"}
          </button>
          <button
            type="button"
            className={compared ? "is-active" : ""}
            aria-pressed={compared}
            disabled={!compared && compareFull}
            title={!compared && compareFull ? "对照栏最多放四个名字" : undefined}
            onClick={onCompare}
          >
            {compared ? "移出对照" : compareFull ? "对照已满" : "加入对照"}
          </button>
        </div>
      </footer>
    </article>
  );
}

export interface CuratedProfileActions {
  favoriteNames: readonly string[];
  rejectedNames: readonly string[];
  compareNames: readonly string[];
  notes: Readonly<Record<string, string>>;
  toggleFavorite: (name: string) => void;
  toggleRejected: (name: string) => void;
  toggleCompare: (name: string) => void;
  updateNote: (name: string, note: string) => void;
}

export function CuratedRanking({
  candidates,
  profile,
}: {
  candidates: readonly RankedCandidate[];
  profile: CuratedProfileActions;
}) {
  const [view, setView] = useState<"通过" | "收藏" | "筛除">("通过");
  const [query, setQuery] = useState("");
  const visible = useMemo(
    () =>
      candidates.filter(
        (candidate) =>
          (!query.trim() ||
            candidate.name.includes(query.trim()) ||
            candidate.source.includes(query.trim()) ||
            candidate.quote.includes(query.trim())) &&
          (view === "通过"
            ? candidate.gate === "通过" &&
              !profile.rejectedNames.includes(candidate.name)
            : view === "收藏"
              ? profile.favoriteNames.includes(candidate.name)
              : candidate.gate === "不通过" ||
                profile.rejectedNames.includes(candidate.name)),
      ),
    [candidates, profile.favoriteNames, profile.rejectedNames, query, view],
  );

  return (
    <section className="page-section">
      <SectionHeader
        eyebrow="CURATED REGISTER · 决策层"
        title="人工精选榜"
        description="这一层才是可认真讨论的候选。硬筛先排除负面语境、明显谐音、强势同名与典故不实，再用六维文化分排序。"
        aside={
          <div className="large-count">
            <strong>{profile.favoriteNames.length}</strong>
            <span>已收藏</span>
          </div>
        }
      />

      <div className="ranking-toolbar">
        <div className="segmented-control" aria-label="精选榜视图">
          {(["通过", "收藏", "筛除"] as const).map((item) => (
            <button
              key={item}
              type="button"
              className={view === item ? "is-active" : ""}
              aria-pressed={view === item}
              onClick={() => setView(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <label className="inline-search">
          <span className="sr-only">搜索精选名字</span>
          <input
            type="search"
            value={query}
            placeholder="搜索名字、篇目或原句"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>

      <div className="name-card-grid">
        {visible.map((candidate) => (
          <NameCard
            key={candidate.name}
            candidate={candidate}
            favorite={profile.favoriteNames.includes(candidate.name)}
            rejected={profile.rejectedNames.includes(candidate.name)}
            compared={profile.compareNames.includes(candidate.name)}
            compareFull={profile.compareNames.length >= 4}
            note={profile.notes[candidate.name] ?? ""}
            onFavorite={() => profile.toggleFavorite(candidate.name)}
            onReject={() => profile.toggleRejected(candidate.name)}
            onCompare={() => profile.toggleCompare(candidate.name)}
            onNote={(note) => profile.updateNote(candidate.name, note)}
          />
        ))}
      </div>
      {visible.length === 0 ? (
        <div className="empty-state">
          <b>{view === "收藏" ? "还没有收藏名字" : "没有匹配结果"}</b>
          <p>
            {view === "收藏"
              ? "回到“通过”页，从读起来有感觉的名字开始，不必一次作决定。"
              : "清空检索词再看看。"}
          </p>
        </div>
      ) : null}
    </section>
  );
}

