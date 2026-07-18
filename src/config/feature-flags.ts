export const FEATURE_FLAGS = {
  temporalPoseScoring: false,
  accumulatedPoseEvents: false
} as const;

export type FeatureFlags = Record<keyof typeof FEATURE_FLAGS, boolean>;
