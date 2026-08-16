export const POSE_KEYPOINT_NAMES = [
  'nose',
  'leftEye',
  'rightEye',
  'leftEar',
  'rightEar',
  'leftShoulder',
  'rightShoulder',
  'leftElbow',
  'rightElbow',
  'leftWrist',
  'rightWrist',
  'leftHip',
  'rightHip',
  'leftKnee',
  'rightKnee',
  'leftAnkle',
  'rightAnkle'
] as const;

export type PoseKeypointName = (typeof POSE_KEYPOINT_NAMES)[number];

export const POSE_BONE_CONNECTIONS: ReadonlyArray<
  readonly [PoseKeypointName, PoseKeypointName]
> = Object.freeze([
  ['leftHip', 'leftShoulder'],
  ['leftElbow', 'leftShoulder'],
  ['leftElbow', 'leftWrist'],
  ['leftHip', 'leftKnee'],
  ['leftKnee', 'leftAnkle'],
  ['rightHip', 'rightShoulder'],
  ['rightElbow', 'rightShoulder'],
  ['rightElbow', 'rightWrist'],
  ['rightHip', 'rightKnee'],
  ['rightKnee', 'rightAnkle'],
  ['leftShoulder', 'rightShoulder'],
  ['leftHip', 'rightHip']
]);

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

export type PoseOverlayConfidenceProperty =
  | 'joint-opacity'
  | 'joint-radius'
  | 'bone-opacity'
  | 'bone-width';

export interface PoseOverlayKeypoint {
  score: number;
  part: string;
  position: Readonly<{x: number; y: number}>;
}

export const DEFAULT_POSE_JOINT_STYLE: Readonly<PoseJointStyle> = Object.freeze({
  color: '#00e5ff',
  opacity: 1,
  radius: 4
});

export const DEFAULT_POSE_BONE_STYLE: Readonly<PoseBoneStyle> = Object.freeze({
  color: '#00e5ff',
  opacity: 0.9,
  width: 3
});

export const DEFAULT_POSE_OVERLAY_CONFIDENCE_SCALING: Readonly<
  PoseOverlayConfidenceScaling
> = Object.freeze({
  jointOpacity: false,
  jointRadius: false,
  boneOpacity: false,
  boneWidth: false
});

export function isPoseKeypointName(value: unknown): value is PoseKeypointName {
  return POSE_KEYPOINT_NAMES.includes(value as PoseKeypointName);
}

export function confidenceMultiplier(value: unknown): number {
  const confidence = Number(value);
  if (!Number.isFinite(confidence)) return 0;
  return Math.max(0, Math.min(1, confidence));
}
