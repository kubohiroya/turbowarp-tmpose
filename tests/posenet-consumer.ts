import {
  createBundledTMPoseRuntime,
  createPoseNetProjectBundleFromLoader,
  loadPoseNetBundle,
  poseNetBundleManifest,
  type PoseNetBundleFileLoader,
  type PoseNetProjectBundle,
  type TMPoseRuntimeLoadOptions,
  type TMPoseBrowserRuntime
} from '@kubohiroya/turbowarp-tmpose/posenet';

const loadFile: PoseNetBundleFileLoader = async (file) => {
  const specifier: string = file.packageSpecifier;
  void specifier;
  return new Uint8Array(file.size);
};

void loadPoseNetBundle(loadFile);
void createPoseNetProjectBundleFromLoader(loadFile);

const runtime: TMPoseBrowserRuntime = {
  Webcam: class {},
  async loadFromFiles() {
    return undefined;
  }
};

const projectBundle: PoseNetProjectBundle = {
  formatVersion: 1,
  encoding: 'base64',
  files: []
};

const bundledRuntime = createBundledTMPoseRuntime({
  runtime,
  projectBundle,
  parallelModelInitialization: true
});
const loadController = new AbortController();
const loadOptions: TMPoseRuntimeLoadOptions = {
  signal: loadController.signal,
  parallelModelInitialization: true
};
void bundledRuntime.loadFromFiles({}, {}, {}, loadOptions);
const version: string = poseNetBundleManifest.distribution.version;

void bundledRuntime;
void version;
