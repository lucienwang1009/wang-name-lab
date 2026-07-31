import { useCallback, useState } from "react";

import {
  clearStoredProfile,
  createDefaultProfile,
  loadProfile,
  saveProfile,
  type BirthDetails,
  type LocalProfile,
  type MetaphysicsAssessment,
} from "./storage";

type ProfileUpdater = (profile: LocalProfile) => LocalProfile;

const toggleListValue = (
  values: readonly string[],
  value: string,
  maximum = Number.POSITIVE_INFINITY,
): string[] => {
  if (values.includes(value)) return values.filter((item) => item !== value);
  if (values.length >= maximum) return [...values];
  return [...values, value];
};

export function useLocalProfile() {
  const [profile, setProfileState] = useState<LocalProfile>(() => loadProfile());

  const updateProfile = useCallback((updater: ProfileUpdater) => {
    setProfileState((current) => {
      const next = updater(current);
      saveProfile(next);
      return next;
    });
  }, []);

  const setBirthStatus = useCallback(
    (birthStatus: LocalProfile["birthStatus"]) => {
      updateProfile((current) => ({ ...current, birthStatus }));
    },
    [updateProfile],
  );

  const setMetaphysicsWeight = useCallback(
    (metaphysicsWeight: number) => {
      updateProfile((current) => ({
        ...current,
        metaphysicsWeight: Math.min(0.25, Math.max(0, metaphysicsWeight)),
      }));
    },
    [updateProfile],
  );

  const updateBirth = useCallback(
    (patch: Partial<BirthDetails>) => {
      updateProfile((current) => ({
        ...current,
        birth: { ...current.birth, ...patch },
      }));
    },
    [updateProfile],
  );

  const toggleFavorite = useCallback(
    (name: string) => {
      updateProfile((current) => ({
        ...current,
        favoriteNames: toggleListValue(current.favoriteNames, name),
        rejectedNames: current.rejectedNames.filter((item) => item !== name),
      }));
    },
    [updateProfile],
  );

  const toggleRejected = useCallback(
    (name: string) => {
      updateProfile((current) => ({
        ...current,
        rejectedNames: toggleListValue(current.rejectedNames, name),
        favoriteNames: current.favoriteNames.filter((item) => item !== name),
        compareNames: current.compareNames.filter((item) => item !== name),
      }));
    },
    [updateProfile],
  );

  const toggleCompare = useCallback(
    (name: string) => {
      updateProfile((current) => ({
        ...current,
        compareNames: toggleListValue(current.compareNames, name, 4),
      }));
    },
    [updateProfile],
  );

  const updateNote = useCallback(
    (name: string, note: string) => {
      updateProfile((current) => ({
        ...current,
        notes: { ...current.notes, [name]: note },
      }));
    },
    [updateProfile],
  );

  const updateAssessment = useCallback(
    (name: string, assessment: MetaphysicsAssessment) => {
      updateProfile((current) => ({
        ...current,
        assessments: {
          ...current.assessments,
          [name]: {
            score: Math.min(100, Math.max(0, assessment.score)),
            rationale: assessment.rationale,
          },
        },
      }));
    },
    [updateProfile],
  );

  const clearProfile = useCallback(() => {
    clearStoredProfile();
    setProfileState(createDefaultProfile());
  }, []);

  return {
    profile,
    setBirthStatus,
    setMetaphysicsWeight,
    updateBirth,
    toggleFavorite,
    toggleRejected,
    toggleCompare,
    updateNote,
    updateAssessment,
    clearProfile,
  };
}

