import { useEffect, useMemo, useState } from "react";

import {
  characterDictionary,
  classicalFragments,
  curatedCandidates,
  reviewedSeedMetadata,
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
} from "./components/Catalogues";
import { PersonalizedNameDiscovery } from "./components/PersonalizedNameDiscovery";
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
import type { PersonalizedCandidate } from "./domain/types";

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
  const [recommendationCandidates, setRecommendationCandidates] = useState<
    PersonalizedCandidate[]
  >([]);
  const [discoveryLoading, setDiscoveryLoading] = useState(true);
  const [discoveryError, setDiscoveryError] = useState<string>();
  const [recommendationLoadAttempt, setRecommendationLoadAttempt] = useState(0);
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
  const legacyDiscoveryCandidates = useMemo(
    () => mergeDiscoveryCandidates([], curatedCandidates),
    [],
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
        if (active) setRecommendationCandidates(candidates);
      })
      .catch((error: unknown) => {
        if (active) {
          setDiscoveryError(
            error instanceof Error ? error.message : "个性化推荐池加载失败。",
          );
        }
      })
      .finally(() => {
        if (active) setDiscoveryLoading(false);
      });
    return () => {
      active = false;
    };
  }, [corpusSearchClient, currentSection, recommendationLoadAttempt]);

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
            recommendable: Object.keys(reviewedSeedMetadata).length,
            searchOnly: 1176,
            calibration: local.profile.preference.calibrationProgress,
            fragments: classicalFragments.length,
            books: 70,
            favorites: local.profile.favoriteNames.length,
            compare: local.profile.compareNames.length,
            scenarios: birthScenarios.length,
          }}
          onNavigate={navigate}
        />
      ) : null}
      {currentSection === "explore" ? (
        <PersonalizedNameDiscovery
          candidates={recommendationCandidates}
          loading={discoveryLoading}
          error={discoveryError}
          preference={local.profile.preference}
          profile={curatedProfile}
          onPreferenceChange={local.replacePreference}
          onExposure={local.recordExposure}
          onLookup={openLookup}
          onRetry={() => setRecommendationLoadAttempt((attempt) => attempt + 1)}
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
          discoveryCandidates={legacyDiscoveryCandidates}
          personalizedCandidates={recommendationCandidates}
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
