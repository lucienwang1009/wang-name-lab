import type { ReactNode } from "react";

export type SectionId =
  | "overview"
  | "explore"
  | "allusions"
  | "curated"
  | "compare"
  | "birth"
  | "method";

interface AppShellProps {
  children: ReactNode;
  currentSection: SectionId;
  favoriteCount: number;
  compareCount: number;
  onNavigate: (section: SectionId) => void;
}

const navigation: Array<{
  id: SectionId;
  index: string;
  label: string;
  shortLabel: string;
}> = [
  { id: "overview", index: "序", label: "工作台总览", shortLabel: "总览" },
  { id: "explore", index: "一", label: "字词组合池", shortLabel: "组合" },
  { id: "allusions", index: "二", label: "古籍典故库", shortLabel: "典故" },
  { id: "curated", index: "三", label: "人工精选榜", shortLabel: "精选" },
  { id: "compare", index: "四", label: "四名对照", shortLabel: "对照" },
  { id: "birth", index: "五", label: "出生后复排", shortLabel: "复排" },
  { id: "method", index: "附", label: "方法与隐私", shortLabel: "方法" },
];

export function SectionHeader({
  eyebrow,
  title,
  description,
  aside,
}: {
  eyebrow: string;
  title: string;
  description: string;
  aside?: ReactNode;
}) {
  return (
    <header className="section-header">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="section-description">{description}</p>
      </div>
      {aside ? <div className="section-aside">{aside}</div> : null}
    </header>
  );
}

export function AppShell({
  children,
  currentSection,
  favoriteCount,
  compareCount,
  onNavigate,
}: AppShellProps) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        跳至正文
      </a>
      <aside className="archive-rail" aria-label="主要导航">
        <button
          className="brand-mark"
          type="button"
          onClick={() => onNavigate("overview")}
          aria-label="返回工作台总览"
        >
          <span className="brand-seal" aria-hidden="true">
            王
          </span>
          <span>
            <b>女孩取名实验室</b>
            <small>古籍证据 · 家族记忆 · 出生后复排</small>
          </span>
        </button>

        <nav className="archive-nav">
          {navigation.map((item) => (
            <button
              key={item.id}
              className={currentSection === item.id ? "is-current" : ""}
              type="button"
              onClick={() => onNavigate(item.id)}
              aria-current={currentSection === item.id ? "page" : undefined}
            >
              <span>{item.index}</span>
              {item.label}
              {item.id === "curated" && favoriteCount > 0 ? (
                <em>{favoriteCount}</em>
              ) : null}
              {item.id === "compare" && compareCount > 0 ? (
                <em>{compareCount}/4</em>
              ) : null}
            </button>
          ))}
        </nav>

        <div className="rail-note">
          <span className="status-dot" aria-hidden="true" />
          <p>
            所有偏好与出生资料
            <strong>仅保存在此浏览器</strong>
          </p>
        </div>
      </aside>

      <div className="mobile-masthead">
        <button type="button" onClick={() => onNavigate("overview")}>
          <span className="brand-seal" aria-hidden="true">
            王
          </span>
          <b>取名实验室</b>
        </button>
        <span>{compareCount}/4 待对照</span>
      </div>

      <nav className="mobile-tabs" aria-label="移动端主要导航">
        {navigation.map((item) => (
          <button
            key={item.id}
            type="button"
            className={currentSection === item.id ? "is-current" : ""}
            onClick={() => onNavigate(item.id)}
            aria-current={currentSection === item.id ? "page" : undefined}
          >
            <span>{item.index}</span>
            {item.shortLabel}
          </button>
        ))}
      </nav>

      <main id="main-content" className="archive-main" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}
