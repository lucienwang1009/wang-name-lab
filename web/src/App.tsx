import { useEffect, useMemo, useState } from "react";

import {
  characterDictionary,
  classicalFragments,
  curatedCandidates,
  generationCharacters,
} from "./data/nameSystemData";
import {
  buildBirthScenarios,
  generateAllusionCandidates,
  generateRawPool,
  rankCuratedCandidates,
} from "./domain/nameSystem";
import { useLocalProfile } from "./state/useLocalProfile";
import { AppShell, type SectionId } from "./components/AppShell";
import {
  AllusionLibrary,
  CuratedRanking,
  NameExplorer,
} from "./components/Catalogues";
import {
  BirthProfile,
  CompareDrawer,
  CompareTable,
  Methodology,
} from "./components/DecisionSections";
import { FunnelOverview } from "./components/FunnelOverview";

const sections = new Set<SectionId>([
  "overview",
  "explore",
  "allusions",
  "curated",
  "compare",
  "birth",
  "method",
]);

let rawCandidatesCache: ReturnType<typeof generateRawPool> | undefined;

function getRawCandidates() {
  rawCandidatesCache ??= generateRawPool(generationCharacters);
  return rawCandidatesCache;
}

function sectionFromHash(): SectionId {
  const value = window.location.hash.replace(/^#\/?/, "") as SectionId;
  return sections.has(value) ? value : "overview";
}

export default function App() {
  const [currentSection, setCurrentSection] = useState<SectionId>(() =>
    sectionFromHash(),
  );
  const local = useLocalProfile();

  const rawCandidateCount =
    generationCharacters.length * (generationCharacters.length - 1);
  const rawCandidates =
    currentSection === "explore" ? getRawCandidates() : [];
  const allusionCandidates = useMemo(
    () =>
      generateAllusionCandidates(
        classicalFragments,
        new Set(characterDictionary.map((entry) => entry.char)),
      ),
    [],
  );
  const rankedCandidates = useMemo(
    () => rankCuratedCandidates(curatedCandidates),
    [],
  );
  const birthScenarios = useMemo(
    () => buildBirthScenarios("2026-08-20", "2026-08-30"),
    [],
  );

  useEffect(() => {
    const handleHash = () => {
      setCurrentSection(sectionFromHash());
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  const navigate = (section: SectionId) => {
    if (currentSection === section) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    window.location.hash = section;
  };

  const curatedProfile = {
    favoriteNames: local.profile.favoriteNames,
    rejectedNames: local.profile.rejectedNames,
    compareNames: local.profile.compareNames,
    notes: local.profile.notes,
    toggleFavorite: local.toggleFavorite,
    toggleRejected: local.toggleRejected,
    toggleCompare: local.toggleCompare,
    updateNote: local.updateNote,
  };

  return (
    <AppShell
      currentSection={currentSection}
      favoriteCount={local.profile.favoriteNames.length}
      compareCount={local.profile.compareNames.length}
      onNavigate={navigate}
    >
      {currentSection === "overview" ? (
        <FunnelOverview
          counts={{
            raw: rawCandidateCount,
            characters: generationCharacters.length,
            fragments: classicalFragments.length,
            corpora: new Set(
              classicalFragments.map((fragment) => fragment.corpus),
            ).size,
            allusions: allusionCandidates.length,
            curated: rankedCandidates.length,
            passing: rankedCandidates.filter(
              (candidate) => candidate.gate === "通过",
            ).length,
            favorites: local.profile.favoriteNames.length,
            compare: local.profile.compareNames.length,
            scenarios: birthScenarios.length,
          }}
          onNavigate={navigate}
        />
      ) : null}
      {currentSection === "explore" ? (
        <NameExplorer candidates={rawCandidates} />
      ) : null}
      {currentSection === "allusions" ? (
        <AllusionLibrary
          candidates={allusionCandidates}
          fragments={classicalFragments}
        />
      ) : null}
      {currentSection === "curated" ? (
        <CuratedRanking candidates={rankedCandidates} profile={curatedProfile} />
      ) : null}
      {currentSection === "compare" ? (
        <CompareTable
          candidates={rankedCandidates}
          profile={local.profile}
          onRemove={local.toggleCompare}
          onNavigate={navigate}
        />
      ) : null}
      {currentSection === "birth" ? (
        <BirthProfile
          candidates={rankedCandidates}
          profile={local.profile}
          setBirthStatus={local.setBirthStatus}
          setMetaphysicsWeight={local.setMetaphysicsWeight}
          updateBirth={local.updateBirth}
          updateAssessment={local.updateAssessment}
        />
      ) : null}
      {currentSection === "method" ? (
        <Methodology profile={local.profile} clearProfile={local.clearProfile} />
      ) : null}

      {currentSection !== "compare" ? (
        <CompareDrawer
          names={local.profile.compareNames}
          onRemove={local.toggleCompare}
          onOpen={() => navigate("compare")}
        />
      ) : null}
    </AppShell>
  );
}
