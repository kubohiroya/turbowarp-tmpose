import {
  createTMPoseComposition,
  type AccumulatedPoseChangedEventV1,
  type PoseModelRegistration,
  type TMPoseComposition,
  type TMPoseCompositionRuntime
} from '@kubohiroya/turbowarp-tmpose/composition';

declare const runtime: TMPoseCompositionRuntime;

const composition: TMPoseComposition = createTMPoseComposition({runtime});
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
