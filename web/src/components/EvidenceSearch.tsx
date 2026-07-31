import { useEffect, useMemo, useState } from "react";

import {
  normalizeGivenName,
  searchClassicalEvidence,
} from "../domain/nameSystem";
import type {
  ClassicalEvidenceMatch,
  ClassicalFragment,
  EvidenceMatchGrade,
} from "../domain/types";
import type {
  CorpusEvidenceMatch,
  CorpusSearchClient,
  CorpusSearchResult,
} from "../corpus/searchCorpus";

const gradeCopy: Record<
  EvidenceMatchGrade,
  { title: string; explanation: string }
> = {
  A: { title: "A级 · 转录连续", explanation: "两字按名字顺序直接相连；仍须结合句义判断是否成词" },
  B: { title: "B级 · 同句取字", explanation: "同句隔字、首尾或反序出现" },
  C: { title: "C级 · 同篇分见", explanation: "同一篇目的不同原句分别出现" },
  D: { title: "D级 · 同书异篇", explanation: "同一部古籍的不同篇目分别取字" },
  E: { title: "E级 · 跨典双源", explanation: "两个字分别来自不同古籍" },
  F: { title: "F级 · 单字出处", explanation: "只证明单字有古典用例，不构成完整名字典故" },
};

const examples = ["王景玉", "王令仪", "王皎舒"];
const grades = ["A", "B", "C", "D", "E", "F"] as const;
const relationGrades = ["A", "B", "C", "D", "E"] as const;
const initialReadyBookCount = 70;

type FullTextViewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "settled"; result: CorpusSearchResult };

function groupMatches<T extends { grade: EvidenceMatchGrade }>(
  matches: readonly T[],
): Record<EvidenceMatchGrade, T[]> {
  return Object.fromEntries(
    grades.map((grade) => [
      grade,
      matches.filter((match) => match.grade === grade),
    ]),
  ) as Record<EvidenceMatchGrade, T[]>;
}

function EvidenceCard({ match }: { match: ClassicalEvidenceMatch }) {
  const isComposite = match.citations.length > 1;

  return (
    <article className={`evidence-card evidence-${match.grade}`}>
      <header>
        <span className={`grade-badge grade-${match.grade}`}>{match.grade}</span>
        <div>
          <strong>{match.source}</strong>
          <small>{match.corpus} · 精选片段</small>
        </div>
      </header>
      {isComposite ? (
        <div className="evidence-citation-stack">
          {match.citations.map((citation) => (
            <div key={`${citation.fragmentId}:${citation.matchedChar}`}>
              <header>
                <span>取“{citation.matchedChar}”</span>
                <strong>{citation.source}</strong>
              </header>
              <blockquote>“{citation.quote}”</blockquote>
              <a href={citation.url} target="_blank" rel="noreferrer">
                核验此条 ↗
              </a>
            </div>
          ))}
        </div>
      ) : (
        <blockquote>“{match.quote}”</blockquote>
      )}
      <p className="evidence-extraction">{match.extraction}</p>
      <dl>
        <div>
          <dt>场景</dt>
          <dd>{match.scene}</dd>
        </div>
        <div>
          <dt>基调</dt>
          <dd>{match.contextTone}</dd>
        </div>
      </dl>
      {!isComposite ? (
        <a href={match.url} target="_blank" rel="noreferrer">
          打开原典核验 ↗
        </a>
      ) : null}
    </article>
  );
}

function ProvenanceLinks({
  sourceUrl,
  verificationUrl,
}: {
  sourceUrl: string;
  verificationUrl: string;
}) {
  return (
    <div className="corpus-provenance">
      <a href={sourceUrl} target="_blank" rel="noreferrer">
        固定机器来源 ↗
      </a>
      <a href={verificationUrl} target="_blank" rel="noreferrer">
        公版页面复核 ↗
      </a>
    </div>
  );
}

function FullTextEvidenceCard({ match }: { match: CorpusEvidenceMatch }) {
  const firstCitation = match.citations[0];
  if (!firstCitation) return null;
  const isComposite = match.citations.length > 1;

  return (
    <article className={`evidence-card fulltext-card evidence-${match.grade}`}>
      <header>
        <span className={`grade-badge grade-${match.grade}`}>{match.grade}</span>
        <div>
          <strong>
            {isComposite ? "全文组合证据" : `${firstCitation.bookTitle} · ${firstCitation.workTitle}`}
          </strong>
          <small>
            {isComposite
              ? `${match.citations.length} 处原句`
              : `${firstCitation.chapterTitle} · 全文库`}
          </small>
        </div>
      </header>

      {isComposite ? (
        <div className="evidence-citation-stack fulltext-citation-stack">
          {match.citations.map((citation) => (
            <div key={`${citation.passageId}:${citation.matchedChar}`}>
              <header>
                <span>取“{citation.matchedChar}”</span>
                <strong>{citation.bookTitle} · {citation.workTitle}</strong>
              </header>
              <small>{citation.chapterTitle}</small>
              <blockquote>“{citation.text}”</blockquote>
              <ProvenanceLinks
                sourceUrl={citation.sourceUrl}
                verificationUrl={citation.verificationUrl}
              />
            </div>
          ))}
        </div>
      ) : (
        <>
          <blockquote>“{firstCitation.text}”</blockquote>
          <ProvenanceLinks
            sourceUrl={firstCitation.sourceUrl}
            verificationUrl={firstCitation.verificationUrl}
          />
        </>
      )}
      <p className="evidence-extraction">{match.extraction}</p>
    </article>
  );
}

function FullTextLayer({ state }: { state: FullTextViewState }) {
  const result = state.status === "settled" ? state.result : undefined;
  const grouped = groupMatches(result?.matches ?? []);
  const readyBooks = result?.coverage?.readyBooks ?? initialReadyBookCount;

  return (
    <section className="evidence-layer fulltext-layer" aria-labelledby="fulltext-layer-title">
      <header className="evidence-layer-header">
        <div>
          <p className="eyebrow">FULL TEXT · 全文检索层</p>
          <h3 id="fulltext-layer-title">七十部核心古籍正文</h3>
          <p>先查固定版本的机器转录；每条同时给出数据来源与人工复核页。</p>
        </div>
        <span className="layer-count">{readyBooks} 部已就绪</span>
      </header>
      <p className="fulltext-edition-note">
        版本说明：这里使用 Chinese Poetry、ECT-KRP 与 Kanripo 的开源数字转录；部分语料保留古注，部分仅取正文，且机器分段不等于现代权威校勘本。重要取名依据请打开来源复核。
      </p>

      {state.status === "loading" ? (
        <div className="fulltext-state fulltext-loading" role="status">
          <span aria-hidden="true">检</span>
          <div>
            <b>正在查找全文索引</b>
            <p>按名字用字加载相关索引桶与必要正文，不下载整座全文库。</p>
          </div>
        </div>
      ) : null}

      {result?.status === "error" ? (
        <div className="fulltext-state fulltext-error" role="alert">
          <span aria-hidden="true">!</span>
          <div>
            <b>全文库加载失败</b>
            <p>{result.message} 精选片段仍可在下方查看。</p>
          </div>
        </div>
      ) : null}

      {result?.status === "no-hit" ? (
        <div className="fulltext-state fulltext-none">
          <span aria-hidden="true">○</span>
          <div>
            <b>当前 {readyBooks} 部核心库未找到对应关系</b>
            <p>这只是当前收录范围内的结论，不代表全部传世文献中都不存在。</p>
          </div>
        </div>
      ) : null}

      {result?.status === "hit" ? (
        <div className="fulltext-hit">
          <div className="fulltext-grade-ledger" aria-label="全文证据等级统计">
            {grades.map((grade) => (
              <span key={grade}>
                <b>{grouped[grade].length}</b>
                {grade}级
              </span>
            ))}
          </div>
          {result.givenName.length === 2 &&
          grouped.A.length + grouped.B.length + grouped.C.length === 0 &&
          grouped.D.length + grouped.E.length > 0 ? (
            <div className="evidence-caveat">
              <b>全文中暂未找到同句或同篇共同出处</b>
              <p>D、E 级是系统按结构组合出的关系，不能声称原文中本来就有这个名字。</p>
            </div>
          ) : null}
          {grades.map((grade) =>
            grouped[grade].length > 0 ? (
              <section key={grade} className="evidence-group">
                <header>
                  <h3>{gradeCopy[grade].title}</h3>
                  <p>{gradeCopy[grade].explanation}</p>
                </header>
                <div className="evidence-grid">
                  {grouped[grade].map((match) => (
                    <FullTextEvidenceCard key={match.id} match={match} />
                  ))}
                </div>
              </section>
            ) : null,
          )}
        </div>
      ) : null}
    </section>
  );
}

export function EvidenceSearch({
  fragments,
  corpusSearchClient,
}: {
  fragments: readonly ClassicalFragment[];
  corpusSearchClient: CorpusSearchClient;
}) {
  const [query, setQuery] = useState("");
  const [showAllSingle, setShowAllSingle] = useState(false);
  const [fullTextState, setFullTextState] = useState<FullTextViewState>({
    status: "idle",
  });
  const givenName = normalizeGivenName(query);
  const matches = useMemo(
    () => searchClassicalEvidence(query, fragments),
    [fragments, query],
  );
  const grouped = useMemo(() => groupMatches(matches), [matches]);
  const sameTextCount = grouped.A.length + grouped.B.length + grouped.C.length;
  const compositeCount = grouped.D.length + grouped.E.length;
  const visibleGrades = relationGrades.filter(
    (grade) => grouped[grade].length > 0,
  );
  const visibleSingle = showAllSingle ? grouped.F : grouped.F.slice(0, 8);

  useEffect(() => {
    if (!givenName) {
      setFullTextState({ status: "idle" });
      return;
    }
    let active = true;
    setFullTextState({ status: "loading" });
    void corpusSearchClient
      .search(query)
      .then((result) => {
        if (active) setFullTextState({ status: "settled", result });
      })
      .catch((error: unknown) => {
        if (!active) return;
        setFullTextState({
          status: "settled",
          result: {
            status: "error",
            givenName,
            normalizedGivenName: givenName,
            matches: [],
            message: error instanceof Error ? error.message : "全文库加载失败。",
          },
        });
      });
    return () => {
      active = false;
    };
  }, [corpusSearchClient, givenName, query]);

  return (
    <section className="evidence-search-panel" aria-labelledby="evidence-search-title">
      <div className="evidence-search-intro">
        <div>
          <p className="eyebrow">NAME TO TEXT · 名字查典</p>
          <h2 id="evidence-search-title">给一个名字，反查相关原句</h2>
          <p>
            输入完整姓名或名字。系统明确区分同句、同篇、同书、跨典组合和单字用例。
          </p>
        </div>
        <div className="evidence-search-box">
          <span aria-hidden="true">查</span>
          <label>
            <span className="sr-only">输入姓名查找古籍原句</span>
            <input
              type="search"
              value={query}
              placeholder="例如：王景玉、令仪"
              aria-label="输入姓名查找古籍原句"
              onChange={(event) => {
                setQuery(event.target.value);
                setShowAllSingle(false);
              }}
            />
          </label>
        </div>
        <div className="evidence-examples" aria-label="示例名字">
          <span>试一试</span>
          {examples.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => {
                setQuery(example);
                setShowAllSingle(false);
              }}
            >
              {example}
            </button>
          ))}
        </div>
      </div>

      <div className="corpus-layer-status" aria-label="古籍检索覆盖范围">
        <div>
          <span>01 · FULL TEXT</span>
          <strong>全文库 {initialReadyBookCount} 部</strong>
          <small>开源正文 · 按需加载</small>
        </div>
        <i aria-hidden="true">/</i>
        <div>
          <span>02 · CURATED</span>
          <strong>精选片段 {fragments.length} 条</strong>
          <small>人工整理 · 补充语境</small>
        </div>
        <p>检索顺序：先全文，后精选。两层结果不混称。</p>
      </div>

      {!givenName ? (
        <div className="evidence-empty-guide">
          <ol>
            <li><b>A</b><span>连续原文</span></li>
            <li><b>B</b><span>同句取字</span></li>
            <li><b>C</b><span>同篇分见</span></li>
            <li><b>D</b><span>同书异篇</span></li>
            <li><b>E</b><span>跨典双源</span></li>
            <li><b>F</b><span>单字出处</span></li>
          </ol>
        </div>
      ) : (
        <div className="evidence-results" aria-live="polite">
          <FullTextLayer state={fullTextState} />

          <section className="evidence-layer curated-evidence-layer" aria-labelledby="curated-layer-title">
            <header className="evidence-layer-header">
              <div>
                <p className="eyebrow">CURATED FRAGMENTS · 精选补充层</p>
                <h3 id="curated-layer-title">精选片段补充</h3>
                <p>这 {fragments.length} 条片段保留人工场景与基调标签，用来补充全文结果的阅读线索。</p>
              </div>
              <span className="layer-count">{fragments.length} 条已整理</span>
            </header>

            <header className="evidence-result-summary">
              <div>
                <span>已解析名字</span>
                <strong>王{givenName}</strong>
              </div>
              <ul>
                {grades.map((grade) => (
                  <li key={grade}>
                    <b>{grouped[grade].length}</b>
                    {grade === "F" ? "单字出处" : `${grade}级`}
                  </li>
                ))}
              </ul>
            </header>

            {matches.length === 0 ? (
              <div className="empty-state evidence-none">
                <b>精选片段中没有找到对应原句</b>
                <p>这只代表 {fragments.length} 条人工收录片段尚未覆盖，请以上方全文结果为先。</p>
              </div>
            ) : null}

            {givenName.length === 1 && grouped.F.length > 0 ? (
              <div className="evidence-caveat">
                <b>目前只输入了一个名用字</b>
                <p>下面是这个字的古典用例；输入两个字后，系统才会计算 A–E 级关系。</p>
              </div>
            ) : null}

            {givenName.length === 2 && sameTextCount === 0 && compositeCount > 0 ? (
              <div className="evidence-caveat">
                <b>精选片段暂未找到同句或同篇共同出处</b>
                <p>D、E 级只是同书或跨典组合，不能宣称原文中本来就有这个完整名字。</p>
              </div>
            ) : null}

            {givenName.length === 2 &&
            sameTextCount === 0 &&
            compositeCount === 0 &&
            grouped.F.length > 0 ? (
              <div className="evidence-caveat">
                <b>精选片段暂未找到两字关联出处</b>
                <p>下面只显示 F 级单字用例，不能拼接后宣称为“原典中的完整名字”。</p>
              </div>
            ) : null}

            {visibleGrades.map((grade) => (
              <section key={grade} className="evidence-group">
                <header>
                  <h3>{gradeCopy[grade].title}</h3>
                  <p>{gradeCopy[grade].explanation}</p>
                </header>
                <div className="evidence-grid">
                  {grouped[grade].map((match) => (
                    <EvidenceCard key={match.id} match={match} />
                  ))}
                </div>
              </section>
            ))}

            {grouped.F.length > 0 ? (
              <section className="evidence-group evidence-single-group">
                <header>
                  <h3>{gradeCopy.F.title}</h3>
                  <p>{gradeCopy.F.explanation}</p>
                </header>
                <div className="evidence-grid">
                  {visibleSingle.map((match) => (
                    <EvidenceCard key={match.id} match={match} />
                  ))}
                </div>
                {grouped.F.length > 8 ? (
                  <button
                    className="button button-quiet evidence-more"
                    type="button"
                    onClick={() => setShowAllSingle((current) => !current)}
                  >
                    {showAllSingle
                      ? "收起单字旁证"
                      : `展开其余 ${grouped.F.length - 8} 条`}
                  </button>
                ) : null}
              </section>
            ) : null}
          </section>
        </div>
      )}
    </section>
  );
}
