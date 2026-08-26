import type {
  CuratedCandidate,
  EvidenceRelation,
  NameFeatureVector,
  NameRisk,
  NameStyle,
  PersonalizedCandidate,
  PersonalizedEvidenceCitation,
} from "../domain/types";
import { normalizeFeatures, recommendationEligibility } from "../domain/nameFeatures.ts";
import type { CorpusDiscoveryCandidate } from "./types";

export interface ReviewedSeedMetadata {
  meaning: string;
  semanticExplanation: string;
  primaryStyle: NameStyle;
  imageryCategory: string;
  features?: Partial<NameFeatureVector>;
}

export interface BuildRecommendationPoolOptions {
  curatedCandidates: readonly CuratedCandidate[];
  discoveryCandidates: readonly CorpusDiscoveryCandidate[];
  generatedCandidates?: readonly PersonalizedCandidate[];
  reviewedSeeds: Readonly<Record<string, ReviewedSeedMetadata>>;
}

export interface RecommendationPoolBuild {
  recommendable: PersonalizedCandidate[];
  provisional: PersonalizedCandidate[];
  searchOnly: PersonalizedCandidate[];
  blocked: PersonalizedCandidate[];
}

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

const negativeContextPattern = /墓|葬|死|喪|丧|兵|刑|殺|杀|哀|殤|殇|諷|讽|貶|贬|譏|讥|愁|恨|淚|泪|病|苦|怨|孤|寡|鬼|尸|血|災|灾|禍|祸|敗|败|辱|賤|贱|惡|恶|凶/u;
const pronunciationRiskPattern = /讀|读|音|聲|声|多音|上聲|上声|去聲|去声|陽平|阳平/u;
const writingRiskPattern = /識讀|识读|字形|繁|成本|難寫|难写/u;
const commonnessRiskPattern = /熟悉|常見|常见|使用較多|使用较多|重名|熟語|熟语|過於熟|过于熟/u;
const functionCharacterPattern = /[不无無未莫其之兮者也矣于於以而与與为為乃则則曰何所且将將公君我你今昔日中上下来去入出有又正曾]/u;

const ruleThresholds = {
  feminine: 4,
  rarity: 3.5,
  usability: 3.6,
} as const;

function relationForGrade(grade: CuratedCandidate["grade"]): EvidenceRelation {
  if (grade === "A") return "exact-phrase";
  if (grade === "B") return "clause-related";
  if (grade === "C") return "passage-related";
  return "cultural-recomposition";
}

function inferRiskKind(risk: string): NameRisk["kind"] {
  if (/墓|葬|原典|語境|语境|諷|讽|貶|贬/u.test(risk)) return "source-context";
  if (/音|讀|读|聲|声/u.test(risk)) return "pronunciation";
  if (/人物|角色|同名|碰撞/u.test(risk)) return "name-collision";
  if (/錄入|录入|識讀|识读|字形/u.test(risk)) return "usability";
  return "source-context";
}

function curatedRisk(candidate: CuratedCandidate): NameRisk[] {
  if (!candidate.risk.trim()) return [];
  return [
    {
      code: candidate.gate === "通过" ? "review-note" : "curated-hard-gate",
      kind: inferRiskKind(candidate.risk),
      severity: candidate.gate === "通过" ? "note" : "hard",
      summary: candidate.risk,
    },
  ];
}

function automaticRisk(candidate: CorpusDiscoveryCandidate): NameRisk[] {
  if (!negativeContextPattern.test(candidate.quote)) return [];
  return [
    {
      code: "automatic-negative-context",
      kind: "source-context",
      severity: "hard",
      summary: "自动扫描发现原句含有需要排除的负面语境词，不能主动推荐。",
    },
  ];
}

function passesRuleScreen(candidate: CorpusDiscoveryCandidate): boolean {
  const characters = [...candidate.givenName];
  return (
    candidate.grade === "A" &&
    characters.length === 2 &&
    characters[0] !== characters[1] &&
    !functionCharacterPattern.test(candidate.givenName) &&
    !negativeContextPattern.test(candidate.quote) &&
    candidate.feminine >= ruleThresholds.feminine &&
    candidate.rarity >= ruleThresholds.rarity &&
    candidate.usability >= ruleThresholds.usability
  );
}

function automaticFeatures(candidate: CorpusDiscoveryCandidate): NameFeatureVector {
  const feminine = candidate.feminine / 5;
  const rarity = candidate.rarity / 5;
  const usability = candidate.usability / 5;
  return normalizeFeatures({
    classical: 0.9,
    graceful: feminine,
    gentle: 0.35 + feminine * 0.45,
    bright: 0.25 + usability * 0.45,
    austere: 0.25 + rarity * 0.5,
    modern: 0.15,
    pronounceable: 0.5,
    writable: usability,
    recognizable: usability,
    uncommon: rarity,
    familyMeaning: candidate.familyScore / 2,
    exactPhrasePreference: candidate.grade === "A" ? 1 : 0.35,
    recompositionPreference: 0,
  });
}

function automaticStyle(candidate: CorpusDiscoveryCandidate): NameStyle {
  if (candidate.rarity >= 4.1) return "austere";
  if (candidate.feminine >= 4.2) return "graceful";
  if (candidate.usability >= 4.1) return "bright";
  return "classical";
}

function styleFeatures(style: NameStyle): Partial<NameFeatureVector> {
  return {
    classical: style === "modern" ? 0.55 : 0.9,
    graceful: style === "graceful" ? 0.95 : 0.45,
    gentle: style === "gentle" ? 0.95 : 0.4,
    bright: style === "bright" ? 0.95 : 0.35,
    austere: style === "austere" ? 0.95 : 0.35,
    modern: style === "modern" ? 0.9 : 0.25,
  };
}

function seedFeatures(
  candidate: CuratedCandidate,
  metadata: ReviewedSeedMetadata,
): NameFeatureVector {
  const exact = candidate.grade === "A";
  const recomposed = candidate.grade === "C" || candidate.grade === "D";
  return normalizeFeatures({
    ...styleFeatures(metadata.primaryStyle),
    pronounceable: pronunciationRiskPattern.test(candidate.risk) ? 0.55 : 0.9,
    writable: writingRiskPattern.test(candidate.risk) ? 0.55 : 0.9,
    recognizable: writingRiskPattern.test(candidate.risk) ? 0.55 : 0.9,
    uncommon: commonnessRiskPattern.test(candidate.risk) ? 0.3 : 0.7,
    familyMeaning: /無直接|无直接/u.test(candidate.familyNote) ? 0.1 : 0.65,
    exactPhrasePreference: exact ? 1 : 0.25,
    recompositionPreference: recomposed ? 1 : 0.2,
    ...metadata.features,
  });
}

function curatedCitation(
  candidate: CuratedCandidate,
  givenName: string,
): PersonalizedEvidenceCitation {
  return {
    id: `curated:${givenName}:${candidate.source}`,
    bookId: `curated:${candidate.source}`,
    bookTitle: candidate.source,
    workTitle: candidate.source,
    chapterTitle: "人工核验原句",
    quote: candidate.quote,
    sourceUrl: candidate.url,
    verificationUrl: candidate.url,
  };
}

function discoveryCitation(
  candidate: CorpusDiscoveryCandidate,
): PersonalizedEvidenceCitation {
  return {
    id: candidate.passageId,
    bookId: candidate.bookId,
    bookTitle: candidate.bookTitle,
    workTitle: candidate.workTitle,
    chapterTitle: candidate.chapterTitle,
    quote: candidate.quote,
    sourceUrl: candidate.sourceUrl,
    verificationUrl: candidate.verificationUrl,
  };
}

function fromCurated(
  candidate: CuratedCandidate,
  metadata: ReviewedSeedMetadata | undefined,
): PersonalizedCandidate {
  const givenName = candidate.name.startsWith("王") ? candidate.name.slice(1) : candidate.name;
  const evidence = {
    relation: relationForGrade(candidate.grade),
    reviewStatus: "reviewed" as const,
    extraction: candidate.extraction,
    citations: [curatedCitation(candidate, givenName)],
  };
  const quality = {
    pinyin: candidate.pinyin,
    tones: candidate.tones,
    meaning: metadata?.meaning ?? "",
    semanticExplanation: metadata?.semanticExplanation ?? "",
    pronunciationNote: pronunciationRiskPattern.test(candidate.risk)
      ? candidate.risk
      : "完整姓名读音已由人工候选记录复核。",
    usabilityNote: writingRiskPattern.test(candidate.risk)
      ? candidate.risk
      : "名字用字的日常识读与输入成本较低。",
    uncommonnessNote: `${candidate.risk}；少见程度为代理判断，仍需属地重名查询复核。`,
    primaryStyle: metadata?.primaryStyle ?? ("classical" as const),
    imageryCategory: metadata?.imageryCategory ?? "待补名字级语义",
  };
  const result: PersonalizedCandidate = {
    id: `personalized:${givenName}`,
    surname: "王",
    givenName,
    fullName: `王${givenName}`,
    evidence,
    features: metadata ? seedFeatures(candidate, metadata) : normalizeFeatures({}),
    quality,
    eligibility: "search-only",
    risks: curatedRisk(candidate),
  };
  return { ...result, eligibility: recommendationEligibility(result) };
}

function fromDiscovery(candidate: CorpusDiscoveryCandidate): PersonalizedCandidate {
  const ruleScreened = passesRuleScreen(candidate);
  const result: PersonalizedCandidate = {
    id: `personalized:${candidate.givenName}`,
    surname: "王",
    givenName: candidate.givenName,
    fullName: `王${candidate.givenName}`,
    evidence: {
      relation: candidate.grade === "A" ? "exact-phrase" : "clause-related",
      reviewStatus: ruleScreened ? "rule-screened" : "automatic",
      extraction: candidate.extraction,
      citations: [discoveryCitation(candidate)],
    },
    features: automaticFeatures(candidate),
    quality: {
      pinyin: "",
      tones: "",
      meaning: `原文中连续出现“${candidate.givenName}”二字。`,
      semanticExplanation: ruleScreened
        ? "当前只确认连续出处、用字代理指标与负面语境扫描；二字作为姓名时是否形成完整、合宜的语义，仍待人工精审。"
        : "机器发现项，尚未达到个性页面的规则粗筛门槛。",
      pronunciationNote: "完整姓名读音、方言谐音与多音风险尚未人工复核。",
      usabilityNote: `字表易用性代理值 ${candidate.usability.toFixed(1)} / 5；仍需核对实际输入与登记。`,
      uncommonnessNote: `字表少见度代理值 ${candidate.rarity.toFixed(1)} / 5；未接入属地重名数据。`,
      primaryStyle: automaticStyle(candidate),
      imageryCategory:
        candidate.firstCategory === candidate.secondCategory
          ? candidate.firstCategory
          : `${candidate.firstCategory} × ${candidate.secondCategory}`,
    },
    eligibility: "search-only",
    risks: [
      ...automaticRisk(candidate),
      ...(ruleScreened
        ? [{
            code: "rule-screen-pending-human-review",
            kind: "source-context" as const,
            severity: "review" as const,
            summary: "规则粗筛不是人工语义审核；组合语义、声韵、谐音和姓名碰撞均待精审。",
          }]
        : []),
    ],
  };
  return { ...result, eligibility: recommendationEligibility(result) };
}

function mergeCitations(
  left: readonly PersonalizedEvidenceCitation[],
  right: readonly PersonalizedEvidenceCitation[],
): PersonalizedEvidenceCitation[] {
  const byId = new Map<string, PersonalizedEvidenceCitation>();
  for (const citation of [...left, ...right]) byId.set(citation.id, citation);
  return [...byId.values()].sort((a, b) => compareText(a.id, b.id));
}

export function buildRecommendationPool({
  curatedCandidates,
  discoveryCandidates,
  generatedCandidates = [],
  reviewedSeeds,
}: BuildRecommendationPoolOptions): RecommendationPoolBuild {
  const byName = new Map<string, PersonalizedCandidate>();

  for (const candidate of [...discoveryCandidates].sort((a, b) =>
    compareText(a.id, b.id),
  )) {
    const converted = fromDiscovery(candidate);
    const existing = byName.get(converted.givenName);
    if (!existing) {
      byName.set(converted.givenName, converted);
      continue;
    }
    byName.set(converted.givenName, {
      ...existing,
      evidence: {
        ...existing.evidence,
        citations: mergeCitations(existing.evidence.citations, converted.evidence.citations),
      },
    });
  }

  for (const candidate of [...generatedCandidates].sort((a, b) =>
    compareText(a.givenName, b.givenName),
  )) {
    const converted: PersonalizedCandidate = {
      ...candidate,
      evidence: {
        ...candidate.evidence,
        citations: [...candidate.evidence.citations],
      },
      risks: [...candidate.risks],
    };
    converted.eligibility = recommendationEligibility(converted);
    const existing = byName.get(converted.givenName);
    if (existing) {
      converted.evidence.citations = mergeCitations(
        converted.evidence.citations,
        existing.evidence.citations,
      );
    }
    byName.set(converted.givenName, converted);
  }

  for (const candidate of [...curatedCandidates].sort((a, b) =>
    compareText(a.name, b.name),
  )) {
    const givenName = candidate.name.startsWith("王") ? candidate.name.slice(1) : candidate.name;
    const converted = fromCurated(candidate, reviewedSeeds[givenName]);
    const existing = byName.get(givenName);
    if (existing) {
      converted.evidence.citations = mergeCitations(
        converted.evidence.citations,
        existing.evidence.citations,
      );
    }
    byName.set(givenName, converted);
  }

  const all = [...byName.values()].sort((a, b) => compareText(a.givenName, b.givenName));
  return {
    recommendable: all.filter((candidate) => candidate.eligibility === "recommendable"),
    provisional: all.filter((candidate) => candidate.eligibility === "provisional"),
    searchOnly: all.filter((candidate) => candidate.eligibility === "search-only"),
    blocked: all.filter((candidate) => candidate.eligibility === "blocked"),
  };
}
