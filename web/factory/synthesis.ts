import { normalizeFeatures } from "../src/domain/nameFeatures.ts";
import type { NameRisk, PersonalizedEvidenceCitation } from "../src/domain/types.ts";
import type {
  CandidateFeatureInput,
  FactoryCandidate,
  SynthesisInput,
} from "./types.ts";
import { FACTORY_MODEL } from "./types.ts";

function modelRisk(code: string, summary: string): NameRisk {
  return {
    code,
    kind: "usability",
    severity: "note",
    summary,
  };
}

export function candidateFeatures({
  style,
  relation,
  nameScores,
  familyConnection,
}: CandidateFeatureInput) {
  return normalizeFeatures({
    classical: style === "modern" ? 0.58 : 0.92,
    graceful: style === "graceful" ? 0.96 : nameScores.femininity * 0.68,
    gentle: style === "gentle" ? 0.95 : nameScores.femininity * 0.55,
    bright: style === "bright" ? 0.95 : 0.35 + nameScores.nameFeel * 0.3,
    austere: style === "austere" ? 0.95 : 0.3 + nameScores.distinctiveness * 0.35,
    modern: style === "modern" ? 0.9 : 0.18,
    pronounceable: nameScores.phonology,
    writable: nameScores.usability,
    recognizable: nameScores.usability,
    uncommon: nameScores.distinctiveness,
    familyMeaning: familyConnection.trim() ? 0.85 : 0.08,
    exactPhrasePreference: relation === "exact-phrase" ? 1 : relation === "clause-related" ? 0.68 : 0.28,
    recompositionPreference: relation === "cultural-recomposition" ? 1 : relation === "passage-related" ? 0.72 : 0.15,
  });
}

function citation(
  source: SynthesisInput["proposal"]["sources"][number],
  input: SynthesisInput,
): PersonalizedEvidenceCitation {
  const passage = input.passagesById.get(source.passageId);
  if (!passage) throw new Error(`发布时找不到来源段落 ${source.passageId}。`);
  return {
    id: `${passage.id}:${source.character}:${source.occurrence}`,
    passageId: passage.id,
    matchedChar: source.character,
    occurrence: source.occurrence,
    bookId: passage.bookId,
    bookTitle: passage.bookTitle,
    workTitle: passage.workTitle,
    chapterTitle: passage.chapterTitle,
    quote: passage.text,
    sourceUrl: passage.sourceUrl,
    verificationUrl: passage.verificationUrl,
  };
}

export function synthesizeCandidate(input: SynthesisInput): FactoryCandidate {
  const { proposal, semantic, name, adversarial } = input;
  if (semantic.decision !== "approve" || name.decision !== "approve" || adversarial.decision !== "approve") {
    throw new Error(`候选 ${proposal.givenName} 尚未通过全部审核，不能发布。`);
  }
  const citations = proposal.sources.map((source) => citation(source, input));
  const uniqueCitations = [...new Map(citations.map((item) => [item.id, item])).values()];
  const risks = [
    ...input.pronunciationRisks,
    ...semantic.risks.map((summary, index) => modelRisk(`semantic-note-${index + 1}`, summary)),
    ...name.risks.map((summary, index) => modelRisk(`name-note-${index + 1}`, summary)),
  ];
  return {
    id: `personalized:${proposal.givenName}`,
    surname: "王",
    givenName: proposal.givenName,
    fullName: `王${proposal.givenName}`,
    evidence: {
      relation: proposal.relation,
      reviewStatus: "ai-reviewed",
      extraction: proposal.extraction,
      citations: uniqueCitations,
    },
    features: candidateFeatures({
      style: name.primaryStyle,
      relation: proposal.relation,
      nameScores: name.scores,
      familyConnection: proposal.familyConnection,
    }),
    quality: {
      pinyin: input.pinyin,
      tones: input.tones,
      meaning: proposal.meaning,
      semanticExplanation: semantic.explanation,
      pronunciationNote: name.pronunciationNote,
      usabilityNote: name.usabilityNote,
      uncommonnessNote: name.uncommonnessNote,
      primaryStyle: name.primaryStyle,
      imageryCategory: proposal.imageryCategory,
    },
    eligibility: "recommendable",
    risks,
    factoryAudit: {
      model: FACTORY_MODEL,
      promptVersion: input.promptVersion,
      corpusVersion: input.corpusVersion,
      runId: input.runId,
      proposalId: proposal.proposalId,
      semantic: {
        semanticScore: semantic.semanticScore,
        evidenceScore: semantic.evidenceScore,
        explanation: semantic.explanation,
      },
      name: { ...name.scores },
      adversarialCritique: adversarial.critique,
    },
  };
}

export function factoryCandidateScore(candidate: FactoryCandidate): number {
  const audit = candidate.factoryAudit;
  return (
    audit.semantic.semanticScore * 0.2 +
    audit.semantic.evidenceScore * 0.18 +
    audit.name.nameFeel * 0.24 +
    audit.name.phonology * 0.16 +
    audit.name.femininity * 0.1 +
    audit.name.usability * 0.07 +
    audit.name.distinctiveness * 0.05
  );
}

function mergeCitations(
  first: readonly PersonalizedEvidenceCitation[],
  second: readonly PersonalizedEvidenceCitation[],
): PersonalizedEvidenceCitation[] {
  return [...new Map([...first, ...second].map((item) => [item.id, item])).values()]
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function mergeCandidateEvidence(candidates: readonly FactoryCandidate[]): FactoryCandidate[] {
  const byName = new Map<string, FactoryCandidate>();
  for (const candidate of [...candidates].sort((left, right) =>
    factoryCandidateScore(right) - factoryCandidateScore(left) || left.givenName.localeCompare(right.givenName)
  )) {
    const existing = byName.get(candidate.givenName);
    if (!existing) {
      byName.set(candidate.givenName, candidate);
      continue;
    }
    existing.evidence.citations = mergeCitations(existing.evidence.citations, candidate.evidence.citations);
  }
  return [...byName.values()];
}

export function selectDiverseCandidates(
  candidates: readonly FactoryCandidate[],
  target: number,
): FactoryCandidate[] {
  const ranked = mergeCandidateEvidence(candidates).sort(
    (left, right) => factoryCandidateScore(right) - factoryCandidateScore(left) || left.givenName.localeCompare(right.givenName),
  );
  const characterLimit = Math.max(2, Math.ceil(target * 0.1));
  const bookLimit = Math.max(3, Math.ceil(target * 0.15));
  const imageryLimit = Math.max(3, Math.ceil(target * 0.2));
  const characterCounts = new Map<string, number>();
  const bookCounts = new Map<string, number>();
  const imageryCounts = new Map<string, number>();
  const selected: FactoryCandidate[] = [];

  const canSelect = (candidate: FactoryCandidate) => {
    const charactersOkay = [...candidate.givenName].every(
      (character) => (characterCounts.get(character) ?? 0) < characterLimit,
    );
    const primaryBook = candidate.evidence.citations[0]?.bookId ?? "unknown";
    return charactersOkay &&
      (bookCounts.get(primaryBook) ?? 0) < bookLimit &&
      (imageryCounts.get(candidate.quality.imageryCategory) ?? 0) < imageryLimit;
  };

  for (const candidate of ranked) {
    if (selected.length >= target) break;
    if (!canSelect(candidate)) continue;
    selected.push(candidate);
    for (const character of candidate.givenName) {
      characterCounts.set(character, (characterCounts.get(character) ?? 0) + 1);
    }
    const primaryBook = candidate.evidence.citations[0]?.bookId ?? "unknown";
    bookCounts.set(primaryBook, (bookCounts.get(primaryBook) ?? 0) + 1);
    imageryCounts.set(
      candidate.quality.imageryCategory,
      (imageryCounts.get(candidate.quality.imageryCategory) ?? 0) + 1,
    );
  }
  return selected;
}
