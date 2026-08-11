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

export type PreviewMirroring = 'mirrored' | 'unmirrored';

export type PreviewPosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'center'
  | 'full-stage';

export type CameraPreference = 'default' | 'front' | 'back';

export type CameraSelection = CameraPreference | Readonly<{deviceId: string}>;

export interface CameraDevice {
  readonly deviceId: string;
  readonly label: string;
}

export type AccumulatedPoseListener = (event: Readonly<AccumulatedPoseChangedEventV1>) => void;

export interface TMPoseComposition {
  registerPoseModel(input: PoseModelRegistrationInput): Promise<PoseModelRegistration>;
  activatePoseModel(name: unknown): void;
  releasePoseModel(name: unknown): Promise<void>;
  releaseAll(): Promise<void>;
  isPoseModelRegistered(name: unknown): boolean;
  getActivePoseModelName(): string | null;
  showPreview(): void;
  hidePreview(): void;
  isPreviewVisible(): boolean;
  setPreviewPosition(position: PreviewPosition): void;
  setPreviewMirroring(mode: PreviewMirroring): void;
  listCameraDevices(): Promise<ReadonlyArray<Readonly<CameraDevice>>>;
  selectCamera(selection: CameraSelection): Promise<void>;
  getCameraSelection(): CameraSelection;
  getActiveCamera(): Readonly<CameraDevice> | null;
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
  model?: unknown;
  posenetModel?: unknown;
};

type DisposableResource = {
  dispose: () => void | Promise<void>;
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

function aggregateCompositionError(code: string, message: string, errors: unknown[]): AggregateError {
  const error = new AggregateError(errors, message);
  Object.defineProperty(error, 'code', {value: code});
  return error;
}

function disposableResource(value: unknown): DisposableResource | null {
  return isRecord(value) && typeof value.dispose === 'function'
    ? (value as unknown as DisposableResource)
    : null;
}

function hasOfficialResourceShape(model: LoadedPoseModel): boolean {
  return Object.hasOwn(model, 'model') || Object.hasOwn(model, 'posenetModel');
}

function hasCompleteDisposalContract(model: LoadedPoseModel): boolean {
  if (!hasOfficialResourceShape(model)) return disposableResource(model) !== null;
  const classifier = disposableResource(model.model);
  const poseNet = disposableResource(model.posenetModel);
  return classifier !== null && poseNet !== null && classifier !== poseNet;
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

function validatePreviewMirroring(value: unknown): PreviewMirroring {
  if (value !== 'mirrored' && value !== 'unmirrored') {
    throw compositionError(
      'TMPOSE-COMPOSITION-010',
      'Preview mirroring must be either mirrored or unmirrored.'
    );
  }
  return value;
}

function validatePreviewPosition(value: unknown): PreviewPosition {
  if (
    value !== 'top-left' &&
    value !== 'top-right' &&
    value !== 'bottom-left' &&
    value !== 'bottom-right' &&
    value !== 'center' &&
    value !== 'full-stage'
  ) {
    throw compositionError(
      'TMPOSE-COMPOSITION-013',
      'Preview position must be top-left, top-right, bottom-left, bottom-right, center, or full-stage.'
    );
  }
  return value;
}

function validateCameraSelection(value: unknown): CameraSelection {
  if (value === 'default' || value === 'front' || value === 'back') return value;
  if (
    !isRecord(value) ||
    Object.keys(value).length !== 1 ||
    !Object.hasOwn(value, 'deviceId') ||
    typeof value.deviceId !== 'string' ||
    value.deviceId.trim().length === 0
  ) {
    throw compositionError(
      'TMPOSE-COMPOSITION-011',
      'Camera selection must be default, front, back, or an object with one non-empty deviceId.'
    );
  }
  return Object.freeze({deviceId: value.deviceId});
}

function copyCameraSelection(selection: CameraSelection): CameraSelection {
  return typeof selection === 'string'
    ? selection
    : Object.freeze({deviceId: selection.deviceId});
}

function canonicalCameraDevices(value: unknown): ReadonlyArray<Readonly<CameraDevice>> {
  if (!Array.isArray(value)) {
    throw compositionError(
      'TMPOSE-COMPOSITION-012',
      'Camera device enumeration returned an invalid result.'
    );
  }
  const devices: CameraDevice[] = [];
  const seenDeviceIds = new Set<string>();
  for (const candidate of value) {
    if (!isRecord(candidate) || typeof candidate.deviceId !== 'string') continue;
    const deviceId = candidate.deviceId;
    if (deviceId.trim().length === 0 || seenDeviceIds.has(deviceId)) continue;
    seenDeviceIds.add(deviceId);
    devices.push(Object.freeze({
      deviceId,
      label: typeof candidate.label === 'string' ? candidate.label : ''
    }));
  }
  return Object.freeze(devices);
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
  const pendingRegistrations = new Map<string, Set<Promise<PoseModelRegistration>>>();
  const modelDisposals = new WeakMap<object, Promise<void>>();
  const activeModelDisposals = new Set<Promise<void>>();
  const resourceDisposals = new WeakMap<object, Promise<void>>();
  let activeName: string | null = null;
  let cameraSelection: CameraSelection = 'default';
  let cameraSelectionQueue: Promise<void> = Promise.resolve();
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

  function trackRegistration(
    name: string,
    operation: Promise<PoseModelRegistration>
  ): Promise<PoseModelRegistration> {
    let pending = pendingRegistrations.get(name);
    if (!pending) {
      pending = new Set();
      pendingRegistrations.set(name, pending);
    }
    pending.add(operation);
    void operation.then(
      () => {
        pending!.delete(operation);
        if (pending!.size === 0) pendingRegistrations.delete(name);
      },
      () => {
        pending!.delete(operation);
        if (pending!.size === 0) pendingRegistrations.delete(name);
      }
    );
    return operation;
  }

  async function waitForRegistrations(
    operations: ReadonlyArray<Promise<PoseModelRegistration>>,
    errors: unknown[]
  ): Promise<void> {
    const results = await Promise.allSettled(operations);
    for (const result of results) {
      if (result.status === 'rejected' && result.reason?.name !== 'AbortError') {
        errors.push(result.reason);
      }
    }
  }

  async function waitForModelDisposals(
    operations: ReadonlyArray<Promise<void>>,
    errors: unknown[]
  ): Promise<void> {
    const results = await Promise.allSettled(operations);
    for (const result of results) {
      if (result.status === 'rejected') errors.push(result.reason);
    }
  }

  async function disposeResource(resource: DisposableResource): Promise<void> {
    const existing = resourceDisposals.get(resource);
    if (existing) return existing;
    const operation = Promise.resolve().then(() => resource.dispose());
    resourceDisposals.set(resource, operation);
    return operation;
  }

  function disposeModel(model: LoadedPoseModel): Promise<void> {
    const existing = modelDisposals.get(model);
    if (existing) return existing;
    const operation = Promise.resolve().then(async () => {
      await extension.waitForPreparedModelIdle(model);
      const errors: unknown[] = [];
      let resources: DisposableResource[];
      if (hasOfficialResourceShape(model)) {
        const classifier = disposableResource(model.model);
        const poseNet = disposableResource(model.posenetModel);
        resources = [classifier, poseNet].filter(
          (resource): resource is DisposableResource => resource !== null
        );
        if (!classifier || !poseNet || classifier === poseNet) {
          errors.push(
            compositionError(
              'TMPOSE-COMPOSITION-009',
              'Loaded pose model does not expose distinct disposable classifier and PoseNet resources.'
            )
          );
        }
      } else {
        const legacy = disposableResource(model);
        resources = legacy ? [legacy] : [];
        if (!legacy) {
          errors.push(
            compositionError(
              'TMPOSE-COMPOSITION-009',
              'Loaded pose model does not expose a complete disposal contract.'
            )
          );
        }
      }
      for (const resource of resources) {
        try {
          await disposeResource(resource);
        } catch (error) {
          errors.push(error);
        }
      }
      if (errors.length > 0) {
        throw aggregateCompositionError(
          'TMPOSE-COMPOSITION-009',
          'TMPose could not completely dispose a loaded pose model.',
          errors
        );
      }
    });
    modelDisposals.set(model, operation);
    activeModelDisposals.add(operation);
    void operation.then(
      () => activeModelDisposals.delete(operation),
      () => activeModelDisposals.delete(operation)
    );
    return operation;
  }

  function stopActiveModel(model: LoadedPoseModel): unknown[] {
    const errors: unknown[] = [];
    try {
      extension.clearPreparedModel(model);
    } catch (error) {
      errors.push(error);
    }
    activeName = null;
    return errors;
  }

  const composition: TMPoseComposition = {
    registerPoseModel(input) {
      let name: string;
      let files: ReturnType<typeof validateFiles>;
      let version: number;
      try {
        ensureActive();
        if (!isRecord(input)) {
          throw compositionError('TMPOSE-COMPOSITION-001', 'Pose model input must be an object.');
        }
        name = requireName(input.name);
        files = validateFiles(input, createFile);
        if (activeName === name && extension.isPredicting()) {
          throw compositionError(
            'TMPOSE-COMPOSITION-005',
            `Stop recognition before replacing active pose model ${name}.`
          );
        }
        version = nextVersion(name);
      } catch (error) {
        return Promise.reject(error);
      }
      const operation = (async () => {
        const loaded = await runtime.loadFromFiles(files.model, files.weights, files.metadata);
        if (!isRecord(loaded)) {
          throw compositionError('TMPOSE-COMPOSITION-004', `TMPose failed to load model ${name}.`);
        }
        const model = loaded as LoadedPoseModel;
        if (!hasCompleteDisposalContract(model)) {
          await disposeModel(model);
        }
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
      })();
      return trackRegistration(name, operation);
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
      const pending = [...(pendingRegistrations.get(normalizedName) ?? [])];
      const entry = models.get(normalizedName);
      const errors: unknown[] = [];
      if (entry) {
        models.delete(normalizedName);
        if (activeName === normalizedName) errors.push(...stopActiveModel(entry.model));
        try {
          await disposeModel(entry.model);
        } catch (error) {
          errors.push(error);
        }
      }
      await waitForRegistrations(pending, errors);
      if (errors.length > 0) {
        throw new AggregateError(errors, `Failed to release pose model ${normalizedName}.`);
      }
    },

    async releaseAll() {
      if (releasePromise) return releasePromise;
      released = true;
      accumulatedPoseListeners.clear();
      releasePromise = (async () => {
        await cameraSelectionQueue;
        cameraSelection = 'default';
        for (const name of versions.keys()) nextVersion(name);
        const startedDisposals = [...activeModelDisposals];
        const pending = [...pendingRegistrations.values()].flatMap((operations) => [
          ...operations
        ]);
        const entries = [...models.values()].reverse();
        const activeEntry = activeName ? models.get(activeName) : null;
        models.clear();
        const errors: unknown[] = [];
        if (activeEntry) {
          errors.push(...stopActiveModel(activeEntry.model));
        }
        try {
          extension.stopCamera();
        } catch (error) {
          errors.push(error);
        }
        activeName = null;
        for (const entry of entries) {
          try {
            await disposeModel(entry.model);
          } catch (error) {
            errors.push(error);
          }
        }
        await waitForRegistrations(pending, errors);
        await waitForModelDisposals(startedDisposals, errors);
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

    showPreview() {
      ensureActive();
      extension.showPreview();
    },

    hidePreview() {
      ensureActive();
      extension.hidePreview();
    },

    isPreviewVisible() {
      ensureActive();
      return extension.isPreviewVisible();
    },

    setPreviewPosition(position) {
      ensureActive();
      extension.setPreviewPosition({POSITION: validatePreviewPosition(position)});
    },

    setPreviewMirroring(mode) {
      ensureActive();
      extension.setPreviewMirroring({MIRRORING: validatePreviewMirroring(mode)});
    },

    async listCameraDevices() {
      ensureActive();
      try {
        const devices = await extension.refreshCameraDevices();
        ensureActive();
        return canonicalCameraDevices(devices);
      } catch (error) {
        if (released) ensureActive();
        const wrapped = compositionError(
          'TMPOSE-COMPOSITION-012',
          'Camera device enumeration is unavailable.'
        );
        Object.defineProperty(wrapped, 'cause', {value: error});
        throw wrapped;
      }
    },

    selectCamera(selection) {
      let canonicalSelection: CameraSelection;
      try {
        ensureActive();
        canonicalSelection = validateCameraSelection(selection);
      } catch (error) {
        return Promise.reject(error);
      }
      const operation = cameraSelectionQueue.then(async () => {
        ensureActive();
        if (typeof canonicalSelection === 'string') {
          await extension.setCameraSelection({CAMERA: canonicalSelection});
        } else {
          await extension.setCameraDeviceId(canonicalSelection.deviceId);
        }
        ensureActive();
        cameraSelection = canonicalSelection;
      });
      cameraSelectionQueue = operation.catch(() => undefined);
      return operation;
    },

    getCameraSelection() {
      ensureActive();
      return copyCameraSelection(cameraSelection);
    },

    getActiveCamera() {
      ensureActive();
      if (!extension.isCameraRunning()) return null;
      const deviceId = String(extension.cameraDeviceIdReporter());
      if (deviceId.trim().length === 0) return null;
      return Object.freeze({
        deviceId,
        label: String(extension.cameraDeviceNameReporter())
      });
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
