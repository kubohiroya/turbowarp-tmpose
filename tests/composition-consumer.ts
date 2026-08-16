import {
  createTMPoseComposition,
  type AccumulatedPoseChangedEventV1,
  type CameraDevice,
  type CameraPreference,
  type CameraSelection,
  type PoseBoneStyle,
  type PoseJointStyle,
  type PoseKeypointName,
  type PoseModelInitializationPolicy,
  type PoseModelRegistration,
  type PoseModelRegistrationOptions,
  type PreviewMirroring,
  type PreviewPosition,
  type PoseOverlayConfidenceScaling,
  type TMPoseComposition,
  type TMPoseCompositionRuntime
} from '@kubohiroya/turbowarp-tmpose/composition';

declare const runtime: TMPoseCompositionRuntime;

const initializationPolicy: PoseModelInitializationPolicy = 'latest-needed';
const composition: TMPoseComposition = createTMPoseComposition({
  runtime,
  modelInitializationPolicy: initializationPolicy,
  parallelModelInitialization: true
});
const previewMirroring: PreviewMirroring = 'unmirrored';
composition.setPreviewMirroring(previewMirroring);
const previewPosition: PreviewPosition = 'full-stage';
composition.setPreviewPosition(previewPosition);
const poseKeypoint: PoseKeypointName = 'leftWrist';
const poseJointStyle: PoseJointStyle = {color: '#ff00aa', opacity: 0.8, radius: 6};
const poseBoneStyle: PoseBoneStyle = {color: '#00e5ff', opacity: 0.9, width: 3};
const poseConfidenceScaling: PoseOverlayConfidenceScaling = {
  jointOpacity: true,
  jointRadius: true,
  boneOpacity: true,
  boneWidth: true
};
composition.setPoseJointStyle(poseKeypoint, poseJointStyle);
composition.setPoseBoneStyle(poseBoneStyle);
composition.setPoseOverlayMinimumConfidence(0.5);
composition.setPoseOverlayConfidenceScaling(poseConfidenceScaling);
composition.hidePoseOverlay();
if (!composition.isPoseOverlayVisible()) composition.showPoseOverlay();
composition.hidePreview();
const previewVisible: boolean = composition.isPreviewVisible();
if (!previewVisible) composition.showPreview();
const cameraPreference: CameraPreference = 'front';
const cameraSelection: CameraSelection = {deviceId: 'session-only-device-id'};
const cameraDevices: Promise<ReadonlyArray<Readonly<CameraDevice>>> =
  composition.listCameraDevices();
void composition.selectCamera(cameraPreference);
void composition.selectCamera(cameraSelection);
const currentCameraSelection: CameraSelection = composition.getCameraSelection();
const activeCamera: Readonly<CameraDevice> | null = composition.getActiveCamera();
const registrationController = new AbortController();
const registrationOptions: PoseModelRegistrationOptions = {
  signal: registrationController.signal
};
const registration: Promise<PoseModelRegistration> = composition.registerPoseModel(
  {
    name: 'RescuePose',
    files: [
      {path: 'model.json', bytes: new Uint8Array([1])},
      {path: 'weights.bin', bytes: new Uint8Array([2])},
      {path: 'metadata.json', bytes: new Uint8Array([3])}
    ]
  },
  registrationOptions
);
composition.configureAccumulatedPose({
  accumulationPerSecond: 1,
  decayPerSecond: 0.9,
  scoreThreshold: 0
});
const unsubscribe: () => void = composition.subscribeAccumulatedPose(
  (event: Readonly<AccumulatedPoseChangedEventV1>) => {
    void event.poseName;
  }
);
unsubscribe();

void registration;
void cameraDevices;
void currentCameraSelection;
void activeCamera;
