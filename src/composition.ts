import {TMPoseExtension, type AccumulatedPoseChangedEventV1} from './extension.js';

export type {AccumulatedPoseChangedEventV1} from './extension.js';

export interface TMPoseCompositionRuntime {
  Webcam: new (width: number, height: number, flipHorizontal: boolean) => unknown;
  loadFromFiles(model: File, weights: File, metadata: File): Promise<unknown>;
}

export interface PoseModelFileInput {
  path: unknown;
  bytes: ArrayBuffer | Uint8Array;
}

export interface PoseModelRegistrationInput {
  name: unknown;
  files: ReadonlyArray<PoseModelFileInput>;
}

export interface PoseModelRegistration {
  readonly name: string;
  readonly labels: ReadonlyArray<string>;
}

export interface AccumulatedPoseConfiguration {
  accumulationPerSecond: number;
  decayPerSecond: number;
  scoreThreshold: number;
}

export type AccumulatedPoseListener = (event: Readonly<AccumulatedPoseChangedEventV1>) => void;

export interface TMPoseComposition {
  registerPoseModel(input: PoseModelRegistrationInput): Promise<PoseModelRegistration>;
  activatePoseModel(name: unknown): void;
  releasePoseModel(name: unknown): Promise<void>;
  releaseAll(): Promise<void>;
  isPoseModelRegistered(name: unknown): boolean;
  getActivePoseModelName(): string | null;
  startCamera(): Promise<void>;
  stopCamera(): void;
  isCameraRunning(): boolean;
  startRecognition(): Promise<void>;
  stopRecognition(): void;
  isRecognizing(): boolean;
  currentPose(): string;
  confidence(): number;
  confidenceOf(name: unknown): number;
  configureAccumulatedPose(input: AccumulatedPoseConfiguration): void;
  resetAccumulatedPose(): void;
  accumulatedPose(): string;
  accumulatedScore(): number;
  accumulatedScoreOf(name: unknown): number;
  subscribeAccumulatedPose(listener: AccumulatedPoseListener): () => void;
}

export interface TMPoseCompositionOptions {
  runtime: TMPoseCompositionRuntime;
  createFile?: (bytes: Uint8Array, name: string, mimeType: string) => File;
}

type LoadedPoseModel = {
  dispose?: () => void | Promise<void>;
  getClassLabels?: () => unknown;
};

type ModelEntry = {
  model: LoadedPoseModel;
  registration: PoseModelRegistration;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function compositionError(code: string, message: string): Error {
  const error = new Error(message);
  Object.defineProperty(error, 'code', {value: code});
  return error;
}

function abortError(name: string): Error {
  const error = new Error(`TMPose model registration was cancelled: ${name}`);
  error.name = 'AbortError';
  return error;
}

function requireName(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw compositionError('TMPOSE-COMPOSITION-001', 'Pose model name must be a non-empty string.');
  }
  return value.trim();
}

function copyBytes(value: unknown, path: string): Uint8Array {
  let bytes: Uint8Array;
  if (value instanceof ArrayBuffer) bytes = new Uint8Array(value);
  else if (value instanceof Uint8Array) bytes = value;
  else {
    throw compositionError(
      'TMPOSE-COMPOSITION-002',
      `Pose model file ${path} must provide an ArrayBuffer or Uint8Array.`
    );
  }
  if (bytes.byteLength === 0) {
    throw compositionError('TMPOSE-COMPOSITION-002', `Pose model file ${path} is empty.`);
  }
  return Uint8Array.from(bytes);
}

function labelsFor(model: LoadedPoseModel): ReadonlyArray<string> {
  const labels = model.getClassLabels?.();
  if (labels === undefined) return Object.freeze([]);
  if (!Array.isArray(labels) || labels.some((label) => typeof label !== 'string')) {
    throw compositionError('TMPOSE-COMPOSITION-004', 'Loaded pose model returned invalid labels.');
  }
  return Object.freeze([...labels]);
}

function defaultCreateFile(bytes: Uint8Array, name: string, mimeType: string): File {
  if (typeof File !== 'function') {
    throw compositionError('TMPOSE-COMPOSITION-003', 'The browser File API is not available.');
  }
  return new File([bytes], name, {type: mimeType});
}

function validateRuntime(value: unknown): TMPoseCompositionRuntime {
  if (
    !isRecord(value) ||
    typeof value.loadFromFiles !== 'function' ||
    typeof value.Webcam !== 'function'
  ) {
    throw new TypeError('TMPose composition runtime must provide loadFromFiles and Webcam.');
  }
  return value as unknown as TMPoseCompositionRuntime;
}

function validateAccumulatedPoseConfiguration(value: unknown): AccumulatedPoseConfiguration {
  if (
    !isRecord(value) ||
    Object.keys(value).length !== 3 ||
    !Object.hasOwn(value, 'accumulationPerSecond') ||
    !Object.hasOwn(value, 'decayPerSecond') ||
    !Object.hasOwn(value, 'scoreThreshold')
  ) {
    throw compositionError(
      'TMPOSE-COMPOSITION-008',
      'Accumulated pose configuration must provide accumulationPerSecond, decayPerSecond, and scoreThreshold.'
    );
  }
  const accumulationPerSecond = value.accumulationPerSecond;
  const decayPerSecond = value.decayPerSecond;
  const scoreThreshold = value.scoreThreshold;
  if (
    typeof accumulationPerSecond !== 'number' ||
    !Number.isFinite(accumulationPerSecond) ||
    accumulationPerSecond < 0 ||
    typeof decayPerSecond !== 'number' ||
    !Number.isFinite(decayPerSecond) ||
    decayPerSecond < 0 ||
    decayPerSecond > 1 ||
    typeof scoreThreshold !== 'number' ||
    !Number.isFinite(scoreThreshold) ||
    scoreThreshold < 0
  ) {
    throw compositionError(
      'TMPOSE-COMPOSITION-008',
      'Accumulated pose configuration values are out of range.'
    );
  }
  return {accumulationPerSecond, decayPerSecond, scoreThreshold};
}

function validateFiles(
  input: PoseModelRegistrationInput,
  createFile: NonNullable<TMPoseCompositionOptions['createFile']>
): {model: File; weights: File; metadata: File} {
  if (!Array.isArray(input.files) || input.files.length !== 3) {
    throw compositionError(
      'TMPOSE-COMPOSITION-002',
      'A pose model must contain model.json, metadata.json, and exactly one weights .bin file.'
    );
  }
  const files = new Map<string, File>();
  for (const candidate of input.files) {
    if (!isRecord(candidate) || typeof candidate.path !== 'string' || candidate.path.length === 0) {
      throw compositionError('TMPOSE-COMPOSITION-002', 'Pose model file path is invalid.');
    }
    const path = candidate.path;
    if (path.includes('/') || path.includes('\\') || files.has(path)) {
      throw compositionError(
        'TMPOSE-COMPOSITION-002',
        `Pose model file path must be a unique root filename: ${path}`
      );
    }
    const validName = path === 'model.json' || path === 'metadata.json' || path.endsWith('.bin');
    if (!validName) {
      throw compositionError('TMPOSE-COMPOSITION-002', `Unsupported pose model file: ${path}`);
    }
    const mimeType = path.endsWith('.json') ? 'application/json' : 'application/octet-stream';
    const file = createFile(copyBytes(candidate.bytes, path), path, mimeType);
    if (!isRecord(file) || file.name !== path) {
      throw compositionError('TMPOSE-COMPOSITION-003', `File factory returned an invalid ${path}.`);
    }
    files.set(path, file as File);
  }
  const model = files.get('model.json');
  const metadata = files.get('metadata.json');
  const weights = [...files.entries()].filter(([path]) => path.endsWith('.bin'));
  if (!model || !metadata || weights.length !== 1) {
    throw compositionError(
      'TMPOSE-COMPOSITION-002',
      'A pose model must contain model.json, metadata.json, and exactly one weights .bin file.'
    );
  }
  return {model, weights: weights[0]![1], metadata};
}

export function createTMPoseComposition(options: TMPoseCompositionOptions): TMPoseComposition {
  if (!isRecord(options)) throw new TypeError('TMPose composition options must be an object.');
  const runtime = validateRuntime(options.runtime);
  const createFile = options.createFile ?? defaultCreateFile;
  if (typeof createFile !== 'function') throw new TypeError('createFile must be a function.');
  const accumulatedPoseListeners = new Set<AccumulatedPoseListener>();
  const extension = new TMPoseExtension(
    {temporalPoseScoring: true, accumulatedPoseEvents: true},
    {
      runtime,
      allowRemoteLibraries: false,
      onAccumulatedPoseChanged(event) {
        const immutableEvent = Object.freeze({...event});
        for (const listener of [...accumulatedPoseListeners]) {
          try {
            listener(immutableEvent);
          } catch {
            // Observers cannot change recognition semantics.
          }
        }
      }
    }
  );
  const models = new Map<string, ModelEntry>();
  const versions = new Map<string, number>();
  const disposedModels = new WeakSet<object>();
  let activeName: string | null = null;
  let released = false;
  let releasePromise: Promise<void> | null = null;

  function ensureActive(): void {
    if (released) {
      throw compositionError('TMPOSE-COMPOSITION-007', 'TMPose composition has been released.');
    }
  }

  function nextVersion(name: string): number {
    const version = (versions.get(name) ?? 0) + 1;
    versions.set(name, version);
    return version;
  }

  async function disposeModel(model: LoadedPoseModel): Promise<void> {
    if (disposedModels.has(model)) return;
    disposedModels.add(model);
    await model.dispose?.();
  }

  function stopActiveModel(model: LoadedPoseModel): unknown[] {
    const errors: unknown[] = [];
    try {
      extension.stopCamera();
    } catch (error) {
      errors.push(error);
    }
    try {
      extension.clearPreparedModel(model);
    } catch (error) {
      errors.push(error);
    }
    activeName = null;
    return errors;
  }

  const composition: TMPoseComposition = {
    async registerPoseModel(input) {
      ensureActive();
      if (!isRecord(input)) {
        throw compositionError('TMPOSE-COMPOSITION-001', 'Pose model input must be an object.');
      }
      const name = requireName(input.name);
      const files = validateFiles(input, createFile);
      if (activeName === name && extension.isPredicting()) {
        throw compositionError(
          'TMPOSE-COMPOSITION-005',
          `Stop recognition before replacing active pose model ${name}.`
        );
      }
      const version = nextVersion(name);
      const loaded = await runtime.loadFromFiles(files.model, files.weights, files.metadata);
      if (!isRecord(loaded)) {
        throw compositionError('TMPOSE-COMPOSITION-004', `TMPose failed to load model ${name}.`);
      }
      const model = loaded as LoadedPoseModel;
      if (versions.get(name) !== version) {
        await disposeModel(model);
        throw abortError(name);
      }
      let registration: PoseModelRegistration;
      try {
        registration = Object.freeze({name, labels: labelsFor(model)});
        if (activeName === name) extension.usePreparedModel(model);
      } catch (error) {
        await disposeModel(model);
        throw error;
      }
      const previous = models.get(name);
      models.set(name, {model, registration});
      if (previous) await disposeModel(previous.model);
      return registration;
    },

    activatePoseModel(name) {
      ensureActive();
      const normalizedName = requireName(name);
      const entry = models.get(normalizedName);
      if (!entry) {
        throw compositionError(
          'TMPOSE-COMPOSITION-006',
          `Pose model is not registered: ${normalizedName}`
        );
      }
      if (extension.isPredicting() && activeName !== normalizedName) {
        throw compositionError(
          'TMPOSE-COMPOSITION-005',
          'Stop recognition before changing the active pose model.'
        );
      }
      extension.usePreparedModel(entry.model);
      activeName = normalizedName;
    },

    async releasePoseModel(name) {
      ensureActive();
      const normalizedName = requireName(name);
      nextVersion(normalizedName);
      const entry = models.get(normalizedName);
      if (!entry) return;
      models.delete(normalizedName);
      const errors = activeName === normalizedName ? stopActiveModel(entry.model) : [];
      try {
        await disposeModel(entry.model);
      } catch (error) {
        errors.push(error);
      }
      if (errors.length > 0) {
        throw new AggregateError(errors, `Failed to release pose model ${normalizedName}.`);
      }
    },

    async releaseAll() {
      if (releasePromise) return releasePromise;
      released = true;
      accumulatedPoseListeners.clear();
      releasePromise = (async () => {
        for (const name of versions.keys()) nextVersion(name);
        const entries = [...models.values()].reverse();
        const activeEntry = activeName ? models.get(activeName) : null;
        models.clear();
        const errors: unknown[] = [];
        if (activeEntry) {
          errors.push(...stopActiveModel(activeEntry.model));
        } else {
          try {
            extension.stopCamera();
          } catch (error) {
            errors.push(error);
          }
          activeName = null;
        }
        for (const entry of entries) {
          try {
            await disposeModel(entry.model);
          } catch (error) {
            errors.push(error);
          }
        }
        try {
          extension.dispose();
        } catch (error) {
          errors.push(error);
        }
        if (errors.length > 0) {
          throw new AggregateError(errors, 'Failed to release all pose models.');
        }
      })();
      return releasePromise;
    },

    isPoseModelRegistered(name) {
      return models.has(requireName(name));
    },

    getActivePoseModelName() {
      return activeName;
    },

    startCamera() {
      ensureActive();
      return extension.startCamera();
    },

    stopCamera() {
      extension.stopCamera();
    },

    isCameraRunning() {
      return extension.isCameraRunning();
    },

    async startRecognition() {
      ensureActive();
      if (!activeName) {
        throw compositionError('TMPOSE-COMPOSITION-006', 'Activate a pose model first.');
      }
      await extension.startPredict();
    },

    stopRecognition() {
      extension.stopPredict();
    },

    isRecognizing() {
      return extension.isPredicting();
    },

    currentPose() {
      return String(extension.currentPoseReporter());
    },

    confidence() {
      return Number(extension.scoreReporter());
    },

    confidenceOf(name) {
      return Number(extension.poseScoreReporter({NAME: requireName(name)}));
    },

    configureAccumulatedPose(input) {
      ensureActive();
      const configuration = validateAccumulatedPoseConfiguration(input);
      extension.setAccumulatedPoseParameters({
        ACCUMULATION: configuration.accumulationPerSecond,
        DECAY: configuration.decayPerSecond
      });
      extension.setAccumulatedPoseThreshold({THRESHOLD: configuration.scoreThreshold});
    },

    resetAccumulatedPose() {
      ensureActive();
      extension.resetAccumulatedPose();
    },

    accumulatedPose() {
      return String(extension.accumulatedPoseReporter());
    },

    accumulatedScore() {
      return Number(extension.accumulatedScoreReporter());
    },

    accumulatedScoreOf(name) {
      return Number(extension.accumulatedPoseScoreReporter({NAME: requireName(name)}));
    },

    subscribeAccumulatedPose(listener) {
      ensureActive();
      if (typeof listener !== 'function') {
        throw compositionError(
          'TMPOSE-COMPOSITION-008',
          'Accumulated pose listener must be a function.'
        );
      }
      accumulatedPoseListeners.add(listener);
      let subscribed = true;
      return () => {
        if (!subscribed) return;
        subscribed = false;
        accumulatedPoseListeners.delete(listener);
      };
    }
  };
  return Object.freeze(composition);
}
