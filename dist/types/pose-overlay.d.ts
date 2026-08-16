export declare const POSE_KEYPOINT_NAMES: readonly ["nose", "leftEye", "rightEye", "leftEar", "rightEar", "leftShoulder", "rightShoulder", "leftElbow", "rightElbow", "leftWrist", "rightWrist", "leftHip", "rightHip", "leftKnee", "rightKnee", "leftAnkle", "rightAnkle"];
export type PoseKeypointName = (typeof POSE_KEYPOINT_NAMES)[number];
export declare const POSE_BONE_CONNECTIONS: ReadonlyArray<readonly [PoseKeypointName, PoseKeypointName]>;
export interface PoseJointStyle {
    color: string;
    opacity: number;
    radius: number;
}
export interface PoseBoneStyle {
    color: string;
    opacity: number;
    width: number;
}
export interface PoseOverlayConfidenceScaling {
    jointOpacity: boolean;
    jointRadius: boolean;
    boneOpacity: boolean;
    boneWidth: boolean;
}
export type PoseOverlayConfidenceProperty = 'joint-opacity' | 'joint-radius' | 'bone-opacity' | 'bone-width';
export interface PoseOverlayKeypoint {
    score: number;
    part: string;
    position: Readonly<{
        x: number;
        y: number;
    }>;
}
export declare const DEFAULT_POSE_JOINT_STYLE: Readonly<PoseJointStyle>;
export declare const DEFAULT_POSE_BONE_STYLE: Readonly<PoseBoneStyle>;
export declare const DEFAULT_POSE_OVERLAY_CONFIDENCE_SCALING: Readonly<PoseOverlayConfidenceScaling>;
export declare function isPoseKeypointName(value: unknown): value is PoseKeypointName;
export declare function confidenceMultiplier(value: unknown): number;
