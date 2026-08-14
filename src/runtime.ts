import * as tensorflow from '@tensorflow/tfjs';
import * as teachableMachinePose from '@teachablemachine/pose';
import packageMetadata from '../package.json' with {type: 'json'};

type RuntimeGlobal = typeof globalThis & {
  tf?: typeof tensorflow;
  tmPose?: typeof teachableMachinePose;
  [key: symbol]: unknown;
};

const runtimeGlobal = globalThis as RuntimeGlobal;
if (runtimeGlobal.tf !== undefined && runtimeGlobal.tf !== tensorflow) {
  throw new Error('TMPose browser runtime found a different global TensorFlow.js instance.');
}
if (runtimeGlobal.tmPose !== undefined && runtimeGlobal.tmPose !== teachableMachinePose) {
  throw new Error('TMPose browser runtime found a different global Teachable Machine Pose instance.');
}

runtimeGlobal.tf = tensorflow;
runtimeGlobal.tmPose = teachableMachinePose;
runtimeGlobal[Symbol.for('@kubohiroya/turbowarp-tmpose/runtime')] = Object.freeze({
  version: packageMetadata.version,
  tensorflow: '1.3.1',
  teachableMachinePose: '0.8.3'
});
