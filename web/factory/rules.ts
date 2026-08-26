import { pinyin, polyphonic } from "pinyin-pro";

import { normalizeSearchText } from "../src/corpus/normalizeText.ts";
import type { NameRisk } from "../src/domain/types.ts";
import type { CandidateProposal, FactoryPassage } from "./types.ts";

const functionCharacterPattern = /[之兮者也矣于於以而与與为為乃则則曰何所且将將公君我你]/u;
const negativeContextPattern = /[墓葬死丧喪刑杀殺哀殇殤讽諷贬貶讥譏恨泪淚病疫苦怨鬼尸血灾災祸禍败敗辱贱賤恶惡凶]/u;
const explicitSurnameCollision = /^王[八巴芭霸]/u;

export interface PronunciationAnalysis {
  pinyin: string;
  tones: string;
  risks: NameRisk[];
}

export interface LocalRuleResult {
  passed: boolean;
  risks: NameRisk[];
  pronunciation: PronunciationAnalysis;
}

function risk(
  code: string,
  kind: NameRisk["kind"],
  severity: NameRisk["severity"],
  summary: string,
): NameRisk {
  return { code, kind, severity, summary };
}

export function derivePronunciation(givenName: string): PronunciationAnalysis {
  const fullName = `王${givenName}`;
  const details = pinyin(fullName, {
    type: "all",
    toneType: "symbol",
    mode: "surname",
    surname: "head",
    toneSandhi: false,
  });
  const pinyinText = details.map((item) => item.pinyin).join(" ");
  const tones = details.map((item) => item.num).join("-");
  const readings = polyphonic(givenName, { type: "array", toneType: "num" });
  const pronunciationRisks: NameRisk[] = [];
  [...givenName].forEach((character, index) => {
    const unique = [...new Set(readings[index] ?? [])];
    if (unique.length > 1) {
      pronunciationRisks.push(risk(
        `polyphonic-${character}`,
        "pronunciation",
        "review",
        `“${character}”存在多种常见读音（${unique.join("、")}），需确认姓名固定读法。`,
      ));
    }
  });
  if (explicitSurnameCollision.test(fullName)) {
    pronunciationRisks.push(risk(
      "wang-explicit-negative-homophone",
      "pronunciation",
      "hard",
      `“${fullName}”开头形成稳定负面谐音，不进入推荐池。`,
    ));
  }
  return { pinyin: pinyinText, tones, risks: pronunciationRisks };
}

function characterOccurrences(text: string, character: string): number[] {
  const normalizedCharacter = normalizeSearchText(character);
  const positions: number[] = [];
  [...normalizeSearchText(text)].forEach((item, index) => {
    if (item === normalizedCharacter) positions.push(index);
  });
  return positions;
}

export function verifyProposalSources(
  proposal: CandidateProposal,
  passagesById: ReadonlyMap<string, FactoryPassage>,
): NameRisk[] {
  const risks: NameRisk[] = [];
  const resolved = proposal.sources.map((source) => {
    const passage = passagesById.get(source.passageId);
    if (!passage) {
      risks.push(risk(
        `missing-source-${source.passageId}`,
        "source-context",
        "hard",
        `找不到来源段落 ${source.passageId}。`,
      ));
      return undefined;
    }
    const positions = characterOccurrences(passage.text, source.character);
    if (source.occurrence >= positions.length) {
      risks.push(risk(
        `missing-character-${source.passageId}-${source.character}`,
        "source-context",
        "hard",
        `来源段落中找不到“${source.character}”的第 ${source.occurrence + 1} 次出现。`,
      ));
    }
    if (negativeContextPattern.test(normalizeSearchText(passage.text))) {
      risks.push(risk(
        `negative-context-${source.passageId}`,
        "source-context",
        "hard",
        `来源段落 ${source.passageId} 含明显负面语境。`,
      ));
    }
    return passage;
  });
  const [firstPassage, secondPassage] = resolved;
  if (firstPassage && secondPassage) {
    if (proposal.relation === "exact-phrase") {
      const normalizedName = normalizeSearchText(proposal.givenName);
      if (firstPassage.id !== secondPassage.id || !firstPassage.normalizedText.includes(normalizedName)) {
        risks.push(risk(
          "false-exact-phrase",
          "source-context",
          "hard",
          "候选声明为原文连续成词，但本地语料无法复核连续双字。",
        ));
      }
    } else if (proposal.relation === "clause-related" && firstPassage.id !== secondPassage.id) {
      risks.push(risk(
        "false-clause-relation",
        "source-context",
        "hard",
        "候选声明为同句取字，但两个字不在同一段落。",
      ));
    } else if (
      proposal.relation === "passage-related" &&
      (firstPassage.bookId !== secondPassage.bookId || firstPassage.workTitle !== secondPassage.workTitle)
    ) {
      risks.push(risk(
        "false-passage-relation",
        "source-context",
        "hard",
        "候选声明为同篇取字，但两个来源不属于同一作品。",
      ));
    }
  }
  return risks;
}

export function runLocalRules(
  proposal: CandidateProposal,
  passagesById: ReadonlyMap<string, FactoryPassage>,
): LocalRuleResult {
  const risks: NameRisk[] = [];
  const characters = [...proposal.givenName];
  if (characters.length !== 2 || !/^\p{Script=Han}{2}$/u.test(proposal.givenName)) {
    risks.push(risk("invalid-name-shape", "registration", "hard", "名字必须由两个汉字组成。"));
  }
  if (proposal.givenName !== normalizeSearchText(proposal.givenName)) {
    risks.push(risk("non-standard-form", "registration", "hard", "候选包含繁体、异体或非规范字形。"));
  }
  if (characters[0] === characters[1]) {
    risks.push(risk("duplicate-character", "usability", "hard", "第一版不推荐叠字名。"));
  }
  if (functionCharacterPattern.test(proposal.givenName)) {
    risks.push(risk("function-character-fragment", "usability", "hard", "候选包含容易形成残句感的虚词。"));
  }
  risks.push(...verifyProposalSources(proposal, passagesById));
  const pronunciation = derivePronunciation(proposal.givenName);
  risks.push(...pronunciation.risks);
  return {
    passed: !risks.some((item) => item.severity === "hard"),
    risks,
    pronunciation,
  };
}

export function deduplicateProposals(proposals: readonly CandidateProposal[]): CandidateProposal[] {
  const byIdentity = new Map<string, CandidateProposal>();
  for (const proposal of proposals) {
    const sourceKey = proposal.sources.map(({ passageId, character, occurrence }) => `${passageId}:${character}:${occurrence}`).join("|");
    const key = `${proposal.givenName}|${proposal.relation}|${sourceKey}`;
    if (!byIdentity.has(key)) byIdentity.set(key, proposal);
  }
  return [...byIdentity.values()].sort(
    (left, right) => left.givenName.localeCompare(right.givenName) || left.proposalId.localeCompare(right.proposalId),
  );
}
