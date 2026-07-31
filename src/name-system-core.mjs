function rounded(value, digits = 1) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function familyProxyFor(first, second) {
  let score = 0;
  for (const item of [first, second]) {
    if (item.familyTag === "玉") score += 2.5;
    if (item.familyTag === "影") score += 2;
    if (item.char === "玉" || item.char === "影") score += 1;
    if (item.char === "韶") score += 1.5;
  }
  return Math.min(5, rounded(score));
}

export function generateRawPool(characters, surname = "王") {
  const pool = [];
  let sequence = 1;
  for (const first of characters) {
    for (const second of characters) {
      if (first.char === second.char) continue;
      pool.push({
        id: `RAW-${String(sequence).padStart(5, "0")}`,
        name: `${surname}${first.char}${second.char}`,
        first: first.char,
        second: second.char,
        firstCategory: first.category,
        secondCategory: second.category,
        feminineProxy: rounded((first.feminine + second.feminine) / 2),
        familyProxy: familyProxyFor(first, second),
        rarityProxy: rounded((first.rarity + second.rarity) / 2),
        usabilityProxy: rounded((first.usability + second.usability) / 2),
        status: "待核典",
        evidence: "原始生成层：必须进入古籍核验与人工精审后才可推荐。",
      });
      sequence += 1;
    }
  }
  return pool;
}

export function generateAllusionCandidates(
  fragments,
  characterSet,
  surname = "王",
) {
  const candidates = [];
  for (const fragment of fragments) {
    const usable = [...fragment.quote].filter((char) => characterSet.has(char));
    const localSeen = new Set();
    for (let i = 0; i < usable.length; i += 1) {
      const maxJ = Math.min(usable.length, i + 13);
      for (let j = i + 1; j < maxJ; j += 1) {
        const first = usable[i];
        const second = usable[j];
        if (first === second) continue;
        const name = `${surname}${first}${second}`;
        const key = `${fragment.id}:${name}`;
        if (localSeen.has(key)) continue;
        localSeen.add(key);
        const contiguous = fragment.quote.includes(`${first}${second}`);
        candidates.push({
          id: `${fragment.id}-${String(candidates.length + 1).padStart(4, "0")}`,
          fragmentId: fragment.id,
          name,
          first,
          second,
          corpus: fragment.corpus,
          source: fragment.source,
          quote: fragment.quote,
          extraction: contiguous
            ? `原文连续：${first}${second}`
            : `同一原句隔字/首尾：${first}…${second}`,
          grade: contiguous ? "A" : "B",
          scene: fragment.scene,
          contextTone: fragment.contextTone,
          url: fragment.url,
          reviewStatus: "机器生成，待人工精审",
        });
      }
    }
  }
  return candidates;
}

export function validateSystemData({ characters, fragments, curated }) {
  const errors = [];
  const characterKeys = characters.map((item) => item.char);
  if (new Set(characterKeys).size !== characterKeys.length) {
    errors.push("用字字典存在重复字符");
  }
  if (characters.length < 145) {
    errors.push("用字字典不足145字，无法稳定生成2万条原始姓名");
  }
  for (const fragment of fragments) {
    for (const field of ["id", "source", "quote", "url"]) {
      if (!fragment[field]) errors.push(`语料 ${fragment.id || "未知"} 缺少 ${field}`);
    }
  }
  const curatedNames = new Set();
  for (const item of curated) {
    if (curatedNames.has(item.name)) errors.push(`精选候选重复：${item.name}`);
    curatedNames.add(item.name);
    for (const field of ["name", "source", "quote", "extraction", "grade", "url"]) {
      if (!item[field]) errors.push(`精选候选 ${item.name || "未知"} 缺少 ${field}`);
    }
    for (const score of Object.values(item.scores || {})) {
      if (!Number.isFinite(score) || score < 0 || score > 5) {
        errors.push(`精选候选 ${item.name} 存在非法评分`);
      }
    }
  }
  return {
    errors,
    summary: {
      characters: characters.length,
      fragments: fragments.length,
      curated: curated.length,
    },
  };
}

export function buildBirthScenarios(startDate, endDate) {
  const scenarios = [];
  const hourBranches = [
    ["子", "23:00–00:59"],
    ["丑", "01:00–02:59"],
    ["寅", "03:00–04:59"],
    ["卯", "05:00–06:59"],
    ["辰", "07:00–08:59"],
    ["巳", "09:00–10:59"],
    ["午", "11:00–12:59"],
    ["未", "13:00–14:59"],
    ["申", "15:00–16:59"],
    ["酉", "17:00–18:59"],
    ["戌", "19:00–20:59"],
    ["亥", "21:00–22:59"],
  ];
  const cursor = new Date(`${startDate}T00:00:00+08:00`);
  const last = new Date(`${endDate}T00:00:00+08:00`);
  let sequence = 1;
  while (cursor <= last) {
    const dateText = new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(cursor);
    for (const [branch, range] of hourBranches) {
      scenarios.push({
        id: `SCN-${String(sequence).padStart(3, "0")}`,
        date: dateText,
        hourBranch: branch,
        timeRange: range,
        yearMonthNote: "按2026年主窗口：丙午年、立秋后申月；出生后须按实际节气时刻复核。",
        status: "仅情景占位，不计算喜用神",
      });
      sequence += 1;
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return scenarios;
}

