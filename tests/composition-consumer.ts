import {
  createTMPoseComposition,
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

void registration;
