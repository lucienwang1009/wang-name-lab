import { useMemo, useState } from "react";

import {
  normalizeGivenName,
  searchClassicalEvidence,
} from "../domain/nameSystem";
import type {
  ClassicalEvidenceMatch,
  ClassicalFragment,
  EvidenceMatchGrade,
} from "../domain/types";

const gradeCopy: Record<
  EvidenceMatchGrade,
  { title: string; explanation: string }
> = {
  A: { title: "A级 · 原文连续", explanation: "两字按名字顺序连续出现" },
  B: { title: "B级 · 同句取字", explanation: "同句隔字、首尾或反序出现" },
  C: { title: "C级 · 同篇分见", explanation: "同一篇目的不同片段分别出现" },
  D: { title: "D级 · 同书异篇", explanation: "同一部古籍的不同篇目分别取字" },
  E: { title: "E级 · 跨典双源", explanation: "两个字分别来自不同古籍" },
  F: { title: "F级 · 单字出处", explanation: "只证明单字有古典用例，不构成完整名字典故" },
};

const examples = ["王景玉", "王令仪", "王皎舒"];

function EvidenceCard({ match }: { match: ClassicalEvidenceMatch }) {
  const isComposite = match.citations.length > 1;

  return (
    <article className={`evidence-card evidence-${match.grade}`}>
      <header>
        <span className={`grade-badge grade-${match.grade}`}>{match.grade}</span>
        <div>
          <strong>{match.source}</strong>
          <small>{match.corpus}</small>
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

export function EvidenceSearch({
  fragments,
}: {
  fragments: readonly ClassicalFragment[];
}) {
  const [query, setQuery] = useState("");
  const [showAllSingle, setShowAllSingle] = useState(false);
  const givenName = normalizeGivenName(query);
  const matches = useMemo(
    () => searchClassicalEvidence(query, fragments),
    [fragments, query],
  );
  const grouped = useMemo(
    () =>
      Object.fromEntries(
        (["A", "B", "C", "D", "E", "F"] as const).map((grade) => [
          grade,
          matches.filter((match) => match.grade === grade),
        ]),
      ) as Record<EvidenceMatchGrade, ClassicalEvidenceMatch[]>,
    [matches],
  );
  const sameTextCount = grouped.A.length + grouped.B.length + grouped.C.length;
  const compositeCount = grouped.D.length + grouped.E.length;
  const visibleGrades = (["A", "B", "C", "D", "E"] as const).filter(
    (grade) => grouped[grade].length > 0,
  );
  const visibleSingle = showAllSingle
    ? grouped.F
    : grouped.F.slice(0, 8);

  return (
    <section className="evidence-search-panel" aria-labelledby="evidence-search-title">
      <div className="evidence-search-intro">
        <div>
          <p className="eyebrow">NAME TO TEXT · 名字查典</p>
          <h2 id="evidence-search-title">给一个名字，反查相关原句</h2>
          <p>
            输入完整姓名或名字。系统只检索已收录原典，并明确区分同句、同篇、同书、跨典组合和单字用例。
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
          <header className="evidence-result-summary">
            <div>
              <span>已解析名字</span>
              <strong>王{givenName}</strong>
            </div>
            <ul>
              {(["A", "B", "C", "D", "E", "F"] as const).map((grade) => (
                <li key={grade}>
                  <b>{grouped[grade].length}</b>
                  {grade === "F" ? "单字出处" : `${grade}级`}
                </li>
              ))}
            </ul>
          </header>

          {matches.length === 0 ? (
            <div className="empty-state evidence-none">
              <b>当前收录语料中没有找到对应原句</b>
              <p>这不代表古籍中一定不存在，只代表 126 条已收录片段尚未覆盖。</p>
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
              <b>暂未找到同句或同篇共同出处</b>
              <p>D、E 级只是同书或跨典组合，不能宣称原文中本来就有这个完整名字。</p>
            </div>
          ) : null}

          {givenName.length === 2 && sameTextCount === 0 && compositeCount === 0 && grouped.F.length > 0 ? (
            <div className="evidence-caveat">
              <b>暂未找到两字关联出处</b>
              <p>下面只显示 F 级单字用例，不能把它们拼接后宣称为“原典中的完整名字”。</p>
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
        </div>
      )}
    </section>
  );
}
