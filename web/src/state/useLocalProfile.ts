import { useCallback, useState } from "react";

import {
  clearStoredProfile,
  createDefaultPreference,
  createDefaultProfile,
  loadProfile,
  saveProfile,
  type BirthDetails,
  type LocalProfile,
  type MetaphysicsAssessment,
  type PairwiseChoice,
  type PreferenceWeights,
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

const withExplicitFeedback = (
  current: Record<string, number>,
  name: string,
  value: number | undefined,
): Record<string, number> => {
  const next = { ...current };
  if (value === undefined) delete next[name];
  else next[name] = value;
  return next;
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
        metaphysicsWeight: Math.min(0.1, Math.max(0, metaphysicsWeight)),
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
      updateProfile((current) => {
        const removing = current.favoriteNames.includes(name);
        return {
          ...current,
          favoriteNames: toggleListValue(current.favoriteNames, name),
          rejectedNames: current.rejectedNames.filter((item) => item !== name),
          preference: {
            ...current.preference,
            explicitFeedback: withExplicitFeedback(
              current.preference.explicitFeedback,
              name,
              removing ? undefined : 1,
            ),
          },
        };
      });
    },
    [updateProfile],
  );

  const toggleRejected = useCallback(
    (name: string) => {
      updateProfile((current) => {
        const removing = current.rejectedNames.includes(name);
        return {
          ...current,
          rejectedNames: toggleListValue(current.rejectedNames, name),
          favoriteNames: current.favoriteNames.filter((item) => item !== name),
          compareNames: current.compareNames.filter((item) => item !== name),
          preference: {
            ...current.preference,
            explicitFeedback: withExplicitFeedback(
              current.preference.explicitFeedback,
              name,
              removing ? undefined : -1,
            ),
          },
        };
      });
    },
    [updateProfile],
  );

  const toggleCompare = useCallback(
    (name: string) => {
      updateProfile((current) => {
        const removing = current.compareNames.includes(name);
        return {
          ...current,
          compareNames: toggleListValue(current.compareNames, name, 4),
          preference: {
            ...current.preference,
            explicitFeedback: withExplicitFeedback(
              current.preference.explicitFeedback,
              name,
              removing ? undefined : 0.25,
            ),
          },
        };
      });
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

  const setPreferenceWeights = useCallback(
    (weights: PreferenceWeights) => {
      updateProfile((current) => ({
        ...current,
        preference: { ...current.preference, weights },
      }));
    },
    [updateProfile],
  );

  const recordPairwiseOutcome = useCallback(
    (leftName: string, rightName: string, choice: PairwiseChoice) => {
      updateProfile((current) => ({
        ...current,
        preference: {
          ...current.preference,
          feedback: [
            ...current.preference.feedback,
            { leftName, rightName, choice },
          ],
          calibrationProgress: Math.min(
            8,
            current.preference.calibrationProgress + 1,
          ),
        },
      }));
    },
    [updateProfile],
  );

  const recordExplicitFeedback = useCallback(
    (name: string, value: number | undefined) => {
      updateProfile((current) => ({
        ...current,
        preference: {
          ...current.preference,
          explicitFeedback: withExplicitFeedback(
            current.preference.explicitFeedback,
            name,
            value === undefined ? undefined : Math.min(1, Math.max(-1, value)),
          ),
        },
      }));
    },
    [updateProfile],
  );

  const recordExposure = useCallback(
    (names: readonly string[]) => {
      updateProfile((current) => {
        const exposureCounts = { ...current.preference.exposureCounts };
        for (const name of names) exposureCounts[name] = (exposureCounts[name] ?? 0) + 1;
        return {
          ...current,
          preference: { ...current.preference, exposureCounts },
        };
      });
    },
    [updateProfile],
  );

  const resetCalibration = useCallback(() => {
    updateProfile((current) => ({
      ...current,
      preference: createDefaultPreference(),
    }));
  }, [updateProfile]);

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
    setPreferenceWeights,
    recordPairwiseOutcome,
    recordExplicitFeedback,
    recordExposure,
    resetCalibration,
    clearProfile,
  };
}
