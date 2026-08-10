import {
  createTMPoseComposition,
  type AccumulatedPoseChangedEventV1,
  type CameraDevice,
  type CameraPreference,
  type CameraSelection,
  type PoseModelRegistration,
  type PreviewMirroring,
  type PreviewPosition,
  type TMPoseComposition,
  type TMPoseCompositionRuntime
} from '@kubohiroya/turbowarp-tmpose/composition';

declare const runtime: TMPoseCompositionRuntime;

const composition: TMPoseComposition = createTMPoseComposition({runtime});
const previewMirroring: PreviewMirroring = 'unmirrored';
composition.setPreviewMirroring(previewMirroring);
const previewPosition: PreviewPosition = 'full-stage';
composition.setPreviewPosition(previewPosition);
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
const registration: Promise<PoseModelRegistration> = composition.registerPoseModel({
  name: 'RescuePose',
  files: [
    {path: 'model.json', bytes: new Uint8Array([1])},
    {path: 'weights.bin', bytes: new Uint8Array([2])},
    {path: 'metadata.json', bytes: new Uint8Array([3])}
  ]
});
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
