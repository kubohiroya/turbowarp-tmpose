import * as tensorflow from '@tensorflow/tfjs';
import * as poseNet from '@tensorflow-models/posenet';
import * as teachableMachinePose from '@teachablemachine/pose';
import packageMetadata from '../package.json' with {type: 'json'};
import {createRuntimeModelFileLoader} from './runtime-model-loader.js';

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

const loadFromFiles = createRuntimeModelFileLoader({
  ready: () => tensorflow.ready(),
  loadClassifier: (model, weights) =>
    tensorflow.loadLayersModel(tensorflow.io.browserFiles([model, weights])),
  async loadMetadata(metadata) {
    const value: unknown = await new Response(metadata).json();
    if (
      typeof value !== 'object' ||
      value === null ||
      !Array.isArray((value as {labels?: unknown}).labels)
    ) {
      throw new Error('Invalid Metadata provided');
    }
    return value;
  },
  loadPoseNet: () =>
    poseNet.load({
      architecture: 'MobileNetV1',
      outputStride: 16,
      inputResolution: 257,
      multiplier: 0.75
    }),
  createModel: (classifier, loadedPoseNet, metadata) =>
    new teachableMachinePose.CustomPoseNet(
      classifier as tensorflow.LayersModel,
      loadedPoseNet as poseNet.PoseNet,
      metadata as teachableMachinePose.Metadata
    )
});
const runtime = Object.freeze({...teachableMachinePose, loadFromFiles});

runtimeGlobal.tf = tensorflow;
runtimeGlobal.tmPose = runtime;
runtimeGlobal[Symbol.for('@kubohiroya/turbowarp-tmpose/runtime')] = Object.freeze({
  version: packageMetadata.version,
  tensorflow: '1.3.1',
  teachableMachinePose: '0.8.3'
});
