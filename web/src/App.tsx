import { useEffect, useMemo, useState } from "react";

import {
  characterDictionary,
  classicalFragments,
  curatedCandidates,
} from "./data/nameSystemData";
import {
  buildBirthScenarios,
  generateAllusionCandidates,
  rankCuratedCandidates,
} from "./domain/nameSystem";
import { mergeDiscoveryCandidates } from "./domain/discovery";
import { useLocalProfile } from "./state/useLocalProfile";
import { AppShell, type SectionId } from "./components/AppShell";
import {
  AllusionLibrary,
  ClassicsNameDiscovery,
} from "./components/Catalogues";
import {
  BirthProfile,
  CompareDrawer,
  CompareTable,
  Methodology,
} from "./components/DecisionSections";
import { FunnelOverview } from "./components/FunnelOverview";
import {
  corpusSearcher,
  type CorpusSearchClient,
} from "./corpus/searchCorpus";
import type { CorpusDiscoveryCandidate } from "./corpus/types";

const sections = new Set<SectionId>([
  "overview",
  "explore",
  "allusions",
  "compare",
  "birth",
  "method",
]);

function sectionFromHash(): SectionId {
  const value = window.location.hash.replace(/^#\/?/, "").split("?")[0] ?? "";
  if (value === "curated") return "explore";
  const section = value as SectionId;
  return sections.has(section) ? section : "overview";
}

function nameFromHash(): string {
  const query = window.location.hash.split("?")[1];
  return query ? new URLSearchParams(query).get("name") ?? "" : "";
}

interface AppProps {
  corpusSearchClient?: CorpusSearchClient;
}

export default function App({
  corpusSearchClient = corpusSearcher,
}: AppProps = {}) {
  const [currentSection, setCurrentSection] = useState<SectionId>(() =>
    sectionFromHash(),
  );
  const [lookupName, setLookupName] = useState(() => nameFromHash());
  const [corpusDiscovery, setCorpusDiscovery] = useState<
    CorpusDiscoveryCandidate[]
  >([]);
  const [discoveryLoading, setDiscoveryLoading] = useState(true);
  const [discoveryError, setDiscoveryError] = useState<string>();
  const local = useLocalProfile();

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
  const discoveryCandidates = useMemo(
    () => mergeDiscoveryCandidates(corpusDiscovery, curatedCandidates),
    [corpusDiscovery],
  );
  const birthScenarios = useMemo(
    () => buildBirthScenarios("2026-08-20", "2026-08-30"),
    [],
  );

  useEffect(() => {
    const handleHash = () => {
      setCurrentSection(sectionFromHash());
      setLookupName(nameFromHash());
      window.scrollTo({ top: 0, behavior: "smooth" });
    };
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, []);

  useEffect(() => {
    if (currentSection !== "explore" && currentSection !== "compare") return;
    let active = true;
    setDiscoveryLoading(true);
    setDiscoveryError(undefined);
    void corpusSearchClient
      .discover()
      .then((candidates) => {
        if (active) setCorpusDiscovery(candidates);
      })
      .catch((error: unknown) => {
        if (active) {
          setDiscoveryError(
            error instanceof Error ? error.message : "典籍寻名池加载失败。",
          );
        }
      })
      .finally(() => {
        if (active) setDiscoveryLoading(false);
      });
    return () => {
      active = false;
    };
  }, [corpusSearchClient, currentSection]);

  const navigate = (section: SectionId) => {
    if (currentSection === section) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    window.location.hash = section;
  };

  const openLookup = (name: string) => {
    window.location.hash = `allusions?name=${encodeURIComponent(name)}`;
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
            discovery: 1200,
            gradeA: 900,
            gradeB: 300,
            fragments: classicalFragments.length,
            corpora: new Set(
              classicalFragments.map((fragment) => fragment.corpus),
            ).size,
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
        <ClassicsNameDiscovery
          candidates={discoveryCandidates}
          loading={discoveryLoading}
          error={discoveryError}
          profile={curatedProfile}
          onLookup={openLookup}
        />
      ) : null}
      {currentSection === "allusions" ? (
        <AllusionLibrary
          candidates={allusionCandidates}
          fragments={classicalFragments}
          corpusSearchClient={corpusSearchClient}
          initialQuery={lookupName}
        />
      ) : null}
      {currentSection === "compare" ? (
        <CompareTable
          candidates={rankedCandidates}
          discoveryCandidates={discoveryCandidates}
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
