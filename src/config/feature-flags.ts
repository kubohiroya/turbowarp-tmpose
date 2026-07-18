export const FEATURE_FLAGS = {
  temporalPoseScoring: false
} as const;

export type FeatureFlags = Record<keyof typeof FEATURE_FLAGS, boolean>;
