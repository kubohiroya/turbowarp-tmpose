export declare const FEATURE_FLAGS: {
    readonly temporalPoseScoring: false;
    readonly accumulatedPoseEvents: false;
};
export type FeatureFlags = Record<keyof typeof FEATURE_FLAGS, boolean>;
