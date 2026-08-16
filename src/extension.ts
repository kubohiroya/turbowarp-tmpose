import definitions from './block-definitions.json' with {type: 'json'};
import {FEATURE_FLAGS, type FeatureFlags} from './config/feature-flags.js';
import {
  confidenceMultiplier,
  DEFAULT_POSE_BONE_STYLE,
  DEFAULT_POSE_JOINT_STYLE,
  DEFAULT_POSE_OVERLAY_CONFIDENCE_SCALING,
  isPoseKeypointName,
  POSE_BONE_CONNECTIONS,
  POSE_KEYPOINT_NAMES,
  type PoseKeypointName,
  type PoseOverlayConfidenceProperty,
  type PoseOverlayKeypoint
} from './pose-overlay.js';
import packageMetadata from '../package.json' with {type: 'json'};

export const EXTENSION_ID = 'tmpose';
export const VERSION = `${packageMetadata.version}-typescript`;
export const DOCS_URI = 'https://kubohiroya.github.io/turbowarp-tmpose/';
export const ACCUMULATED_POSE_CHANGED_EVENT = 'TMPOSE_ACCUMULATED_POSE_CHANGED';
export const BLOCK_ICON_URI = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><g fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21V8h13M43 8h13v13M8 43v13h13M43 56h13V43M32 25v15M20 31l12 5 12-5M32 40 23 52M32 40l9 12"/><circle cx="32" cy="18" r="5"/></g></svg>'
)}`;

export interface TMPoseRuntime {
  Webcam: new (width: number, height: number, flipHorizontal: boolean) => any;
  load?(modelURL: string, metadataURL: string): Promise<any>;
  loadFromFiles?(model: File, weights: File, metadata: File): Promise<any>;
}

export interface TMPoseExtensionDependencies {
  runtime?: TMPoseRuntime;
  allowRemoteLibraries?: boolean;
  onAccumulatedPoseChanged?: (event: AccumulatedPoseChangedEventV1) => void;
}

export interface AccumulatedPoseChangedEventV1 {
  version: 1;
  poseName: string;
  previousPoseName: string;
  score: number;
  reason: 'prediction' | 'reset' | 'stop';
  timestamp: number;
}

export const BROWSER_RUNTIME_URL =
  `https://cdn.jsdelivr.net/npm/@kubohiroya/turbowarp-tmpose@${packageMetadata.version}/dist/runtime.js`;

const POSITION_ITEMS = [
  {text: 'top left', value: 'top-left'},
  {text: 'top right', value: 'top-right'},
  {text: 'bottom left', value: 'bottom-left'},
  {text: 'bottom right', value: 'bottom-right'},
  {text: 'center', value: 'center'},
  {text: 'full stage', value: 'full-stage'}
];

const POSITION_ALIASES: Record<string, string> = {
  左上: 'top-left', 右上: 'top-right', 左下: 'bottom-left', 右下: 'bottom-right',
  中央: 'center', ステージ全体: 'full-stage',
  'top-left': 'top-left', 'top-right': 'top-right', 'bottom-left': 'bottom-left',
  'bottom-right': 'bottom-right', center: 'center', 'full-stage': 'full-stage'
};

const PREVIEW_MIRRORING_ITEMS = [
  {text: 'mirrored', value: 'mirrored'},
  {text: 'unmirrored', value: 'unmirrored'}
];

const PREVIEW_MIRRORING_ALIASES: Record<string, boolean> = {
  mirrored: true,
  unmirrored: false,
  mirror: true,
  normal: false,
  '左右反転': true,
  'そのまま': false
};

const POSE_OVERLAY_VISIBILITY_ITEMS = [
  {text: 'on', value: 'on'},
  {text: 'off', value: 'off'}
];

const POSE_OVERLAY_VISIBILITY_ALIASES: Record<string, boolean> = {
  on: true,
  off: false,
  show: true,
  hide: false,
  true: true,
  false: false,
  表示: true,
  非表示: false
};

const POSE_CONFIDENCE_PROPERTY_ITEMS: ReadonlyArray<{
  text: string;
  value: PoseOverlayConfidenceProperty;
}> = [
  {text: 'joint opacity', value: 'joint-opacity'},
  {text: 'joint radius', value: 'joint-radius'},
  {text: 'bone opacity', value: 'bone-opacity'},
  {text: 'bone width', value: 'bone-width'}
];

const CAMERA_SELECTION_ITEMS = [
  {text: 'default camera', value: 'default'},
  {text: 'front camera', value: 'front'},
  {text: 'back camera', value: 'back'}
];

const CAMERA_SELECTION_ALIASES: Record<string, string> = {
  default: 'default',
  front: 'front',
  back: 'back',
  user: 'front',
  environment: 'back',
  '既定': 'default',
  'インカメラ': 'front',
  '前面カメラ': 'front',
  '背面カメラ': 'back'
};

type CameraPreference = 'default' | 'front' | 'back';

type ResolvedCameraSelection =
  | {kind: 'preference'; value: CameraPreference}
  | {kind: 'device'; value: string};

const loadingPromises = new Map<string, Promise<void>>();

function normalizePosition(value: unknown): string {
  return POSITION_ALIASES[String(value ?? 'bottom-right')] ?? 'bottom-right';
}

function normalizePreviewMirroring(value: unknown): boolean {
  return PREVIEW_MIRRORING_ALIASES[String(value ?? 'mirrored').trim().toLowerCase()] ?? true;
}

function normalizeCameraSelection(value: unknown): ResolvedCameraSelection {
  const selection = String(value ?? 'default').trim();
  const normalized = CAMERA_SELECTION_ALIASES[selection.toLowerCase() || 'default'];
  if (normalized === 'default' || normalized === 'front' || normalized === 'back') {
    return {kind: 'preference', value: normalized};
  }
  return {kind: 'device', value: selection};
}

function normalizePoseOverlayVisibility(value: unknown): boolean {
  return POSE_OVERLAY_VISIBILITY_ALIASES[String(value ?? 'on').trim().toLowerCase()] ?? true;
}

function normalizePoseStyleNumber(value: unknown, fallback: number, maximum?: number): number {
  const number = value === '' ? fallback : Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, maximum === undefined ? number : Math.min(maximum, number));
}

function normalizePoseColor(value: unknown, fallback: string): string {
  const color = String(value ?? '').trim();
  return color || fallback;
}

function cameraConstraints(selection: ResolvedCameraSelection): MediaTrackConstraints | undefined {
  if (selection.kind === 'device') return {deviceId: {exact: selection.value}};
  if (selection.value === 'front') return {facingMode: {ideal: 'user'}};
  if (selection.value === 'back') return {facingMode: {ideal: 'environment'}};
  return undefined;
}

function scriptLoadedFor(src: string): boolean {
  if (src === BROWSER_RUNTIME_URL) {
    return typeof globalThis.tf !== 'undefined' && typeof globalThis.tmPose !== 'undefined';
  }
  return false;
}

export function loadScript(src: string): Promise<void> {
  if (scriptLoadedFor(src)) return Promise.resolve();

  const active = loadingPromises.get(src);
  if (active) return active;

  const existing = Array.from(document.scripts).find((script) => script.src === src);
  if (existing?.dataset.tmposeLoaded === 'true') return Promise.resolve();

  const promise = new Promise<void>((resolve, reject) => {
    const script = existing ?? document.createElement('script');
    const cleanup = () => {
      script.removeEventListener('load', handleLoad);
      script.removeEventListener('error', handleError);
    };
    const handleLoad = () => {
      cleanup();
      script.dataset.tmposeLoaded = 'true';
      resolve();
    };
    const handleError = () => {
      cleanup();
      loadingPromises.delete(src);
      reject(new Error('TMPose: Failed to load script: ' + src));
    };

    script.addEventListener('load', handleLoad, {once: true});
    script.addEventListener('error', handleError, {once: true});

    if (!existing) {
      script.src = src;
      document.head.appendChild(script);
    } else {
      queueMicrotask(() => {
        if (scriptLoadedFor(src)) handleLoad();
      });
    }
  });

  loadingPromises.set(src, promise);
  return promise;
}

function rectanglesIntersect(left: DOMRect, right: DOMRect): boolean {
  return left.right > right.left && left.left < right.right && left.bottom > right.top && left.top < right.bottom;
}

function canvasScore(width: number, height: number): number {
  if (width <= 0 || height <= 0) return Number.NEGATIVE_INFINITY;
  const area = width * height;
  const aspectPenalty = Math.abs(width / height - 4 / 3);
  return area / (1 + aspectPenalty * 4);
}

function isDocumentHidden(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden';
}

/**
 * Initialize the camera canvas before Teachable Machine or TensorFlow.js requests its context.
 * The legacy backend parameter remains accepted for compatibility, but TMPose intentionally uses
 * the browser's normal Canvas2D context. Its one-draw/one-read camera path does not demonstrate a
 * repeatable end-to-end benefit from forcing a readback-optimized context.
 */
export function initializeCameraReadbackContext(
  canvas: unknown,
  _tensorflowBackend?: string | null
): CanvasRenderingContext2D {
  if (
    typeof canvas !== 'object' ||
    canvas === null ||
    typeof (canvas as {getContext?: unknown}).getContext !== 'function'
  ) {
    throw new Error('TMPose: Webcam canvas does not provide a 2D context.');
  }
  const context = (canvas as HTMLCanvasElement).getContext('2d');
  if (!context) throw new Error('TMPose: Webcam canvas 2D context is unavailable.');
  return context;
}

export class TMPoseExtension {
  [key: string]: any;

  constructor(
    featureFlags: Partial<FeatureFlags> = {},
    dependencies: TMPoseExtensionDependencies = {}
  ) {
    this.featureFlags = {...FEATURE_FLAGS, ...featureFlags};
    this.tmPoseRuntime = dependencies.runtime ?? null;
    this.allowRemoteLibraries = dependencies.allowRemoteLibraries ?? true;
    this.onAccumulatedPoseChanged = dependencies.onAccumulatedPoseChanged ?? null;
    this.modelURL = '';
    this.model = null;
    this.webcam = null;
    this.cameraRunning = false;
    this.cameraSelection = 'default';
    this.cameraSelectionIsDeviceId = false;
    this.cameraDevices = [];
    this.activeCameraDeviceId = '';
    this.activeCameraDeviceName = '';
    this.cameraSelectionQueue = Promise.resolve();
    this.predicting = false;
    this.loopStarted = false;
    this.loopGeneration = 0;
    this.activeModelOperations = new Map();
    this.currentPoseName = '';
    this.score = 0;
    this.predictions = {};
    this.accumulationCoefficient = 1;
    this.decayCoefficient = 0.9;
    this.activeDecayCoefficient = 0.9;
    this.accumulatedPoseThreshold = 0;
    this.accumulatedPoseName = '';
    this.accumulatedScore = 0;
    this.accumulatedPredictions = {};
    this.lastAccumulationTime = null;
    this.previewOpacity = 0.6;
    this.previewPosition = 'bottom-right';
    this.previewMirrored = true;
    this.previewVisible = true;
    this.previewCanvas = null;
    this.previewStageElement = null;
    this.poseOverlayVisible = true;
    this.poseOverlayMinimumConfidence = 0.5;
    this.poseJointStyles = Object.fromEntries(
      POSE_KEYPOINT_NAMES.map((part) => [part, {...DEFAULT_POSE_JOINT_STYLE}])
    );
    this.poseBoneStyle = {...DEFAULT_POSE_BONE_STYLE};
    this.poseConfidenceScaling = {...DEFAULT_POSE_OVERLAY_CONFIDENCE_SCALING};
    this.poseOverlaySvg = null;
    this.poseOverlayJointElements = new Map();
    this.poseOverlayBoneElements = [];
    this.latestPoseKeypoints = [];
    this.cameraMs = 0;
    this.modelLoadMs = 0;
    this.firstPredictMs = 0;
    this.lastError = '';
    this.accumulatedPosePausedForBackground = isDocumentHidden();
    this.visibilityChangeListener = () => this.handleDocumentVisibilityChange();
    if (this.featureFlags.temporalPoseScoring && typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.visibilityChangeListener);
    }
  }

  getInfo() {
    return {
      id: EXTENSION_ID,
      name: Scratch.translate(definitions.extensionName),
      docsURI: DOCS_URI,
      blockIconURI: BLOCK_ICON_URI,
      blocks: definitions.blocks
        .filter((block: any) => !block.featureFlag || this.featureFlags[block.featureFlag])
        .map((block: any) => ({
          opcode: block.opcode,
          blockType: Scratch.BlockType[block.blockType],
          text: Scratch.translate(block.text),
          ...(block.disableMonitor ? {disableMonitor: true} : {}),
          ...(block.arguments ? {
            arguments: Object.fromEntries(Object.entries(block.arguments).map(([name, argument]: [string, any]) => [
              name,
              {
                type: Scratch.ArgumentType[argument.type],
                defaultValue: argument.defaultValue,
                ...(argument.menu ? {menu: argument.menu} : {})
              }
            ]))
          } : {})
        })),
      menus: {
        positionMenu: {
          acceptReporters: true,
          items: POSITION_ITEMS.map((item) => ({text: Scratch.translate(item.text), value: item.value}))
        },
        previewMirroringMenu: {
          acceptReporters: true,
          items: PREVIEW_MIRRORING_ITEMS.map((item) => ({text: Scratch.translate(item.text), value: item.value}))
        },
        poseOverlayVisibilityMenu: {
          acceptReporters: true,
          items: POSE_OVERLAY_VISIBILITY_ITEMS.map((item) => ({
            text: Scratch.translate(item.text),
            value: item.value
          }))
        },
        poseKeypointMenu: {
          acceptReporters: true,
          items: POSE_KEYPOINT_NAMES.map((part) => ({text: part, value: part}))
        },
        poseConfidencePropertyMenu: {
          acceptReporters: true,
          items: POSE_CONFIDENCE_PROPERTY_ITEMS.map((item) => ({
            text: Scratch.translate(item.text),
            value: item.value
          }))
        },
        cameraMenu: {
          acceptReporters: true,
          items: 'getCameraMenuItems'
        }
      }
    };
  }

  versionReporter() { return VERSION; }
  setLastError(error) { this.lastError = String(error?.message ?? error); }

  setModelURL(args) {
    this.modelURL = String(args.URL || '').trim();
    if (this.modelURL && !this.modelURL.endsWith('/')) this.modelURL += '/';
    this.model = null;
    this.modelLoadMs = 0;
    this.firstPredictMs = 0;
  }

  async ensureLibrariesLoaded() {
    if (this.tmPoseRuntime) return;
    if (!this.allowRemoteLibraries) {
      throw new Error('TMPose: A preloaded Teachable Machine Pose runtime is required.');
    }
    if (typeof globalThis.tf === 'undefined' || typeof globalThis.tmPose === 'undefined') {
      await loadScript(BROWSER_RUNTIME_URL);
    }
    if (typeof globalThis.tf === 'undefined' || typeof globalThis.tmPose === 'undefined') {
      throw new Error('TMPose: The reviewed browser runtime could not be loaded.');
    }
    this.tmPoseRuntime = globalThis.tmPose;
  }

  cleanupCameraResources() {
    const video = this.webcam?.webcam;
    if (video?.srcObject) {
      video.srcObject.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    }
    this.previewCanvas?.parentNode?.removeChild(this.previewCanvas);
    this.poseOverlaySvg?.parentNode?.removeChild(this.poseOverlaySvg);
    this.previewCanvas = null;
    this.previewStageElement = null;
    this.poseOverlaySvg = null;
    this.poseOverlayJointElements = new Map();
    this.poseOverlayBoneElements = [];
    this.latestPoseKeypoints = [];
    this.webcam = null;
    this.cameraRunning = false;
    this.activeCameraDeviceId = '';
    this.activeCameraDeviceName = '';
    this.loopStarted = false;
    this.loopGeneration += 1;
  }

  async startCamera() {
    if (this.cameraRunning && this.webcam) {
      this.attachPreviewToStage();
      return;
    }
    try {
      this.lastError = '';
      const startedAt = performance.now();
      await this.ensureLibrariesLoaded();
      this.webcam = new this.tmPoseRuntime.Webcam(320, 240, true);
      const constraints = cameraConstraints(this.resolvedCameraSelection());
      if (constraints) await this.webcam.setup(constraints);
      else await this.webcam.setup();
      initializeCameraReadbackContext(this.webcam.canvas);
      await this.webcam.play();
      this.attachPreviewToStage();
      this.cameraRunning = true;
      try {
        await this.refreshCameraDevices();
      } catch {
        // Camera capture can still work when device enumeration is unavailable.
      }
      this.updateActiveCameraInfo();
      this.cameraMs = Math.round(performance.now() - startedAt);
      this.startLoopIfNeeded();
    } catch (error) {
      this.cleanupCameraResources();
      this.setLastError(error);
      throw error;
    }
  }

  stopCamera() {
    try {
      this.stopPredict();
      this.cleanupCameraResources();
      this.currentPoseName = '';
      this.score = 0;
      this.predictions = {};
    } catch (error) {
      this.setLastError(error);
      throw error;
    }
  }

  isCameraRunning() { return this.cameraRunning; }

  getCameraMenuItems() {
    const fixedItems = CAMERA_SELECTION_ITEMS.map((item) => ({
      text: Scratch.translate(item.text),
      value: item.value
    }));
    const seen = new Set<string>();
    const deviceItems = [];
    this.cameraDevices.forEach((device, index) => {
      if (!device.deviceId || seen.has(device.deviceId)) return;
      seen.add(device.deviceId);
      deviceItems.push({
        text: device.label || `${Scratch.translate('camera')} ${index + 1}`,
        value: device.deviceId
      });
    });
    return [...fixedItems, ...deviceItems];
  }

  async refreshCameraDevices() {
    const mediaDevices = typeof navigator === 'undefined' ? undefined : navigator.mediaDevices;
    if (!mediaDevices || typeof mediaDevices.enumerateDevices !== 'function') {
      throw new Error('TMPose: Camera enumeration is not available in this browser.');
    }
    const devices = await mediaDevices.enumerateDevices();
    this.cameraDevices = devices
      .filter((device) => device.kind === 'videoinput')
      .map((device) => ({deviceId: device.deviceId, label: device.label}));
    return this.cameraDevices;
  }

  async refreshCameraList() {
    try {
      this.lastError = '';
      await this.refreshCameraDevices();
      if (this.cameraRunning) this.updateActiveCameraInfo();
    } catch (error) {
      this.setLastError(error);
      throw error;
    }
  }

  setCameraSelection(args) {
    const selection = normalizeCameraSelection(args.CAMERA);
    return this.enqueueCameraSelection(selection);
  }

  setCameraDeviceId(deviceId) {
    if (typeof deviceId !== 'string' || deviceId.trim().length === 0) {
      return Promise.reject(new Error('TMPose: Camera device ID must be a non-empty string.'));
    }
    return this.enqueueCameraSelection({kind: 'device', value: deviceId});
  }

  private resolvedCameraSelection(): ResolvedCameraSelection {
    return this.cameraSelectionIsDeviceId
      ? {kind: 'device', value: this.cameraSelection}
      : {kind: 'preference', value: this.cameraSelection as CameraPreference};
  }

  private enqueueCameraSelection(selection: ResolvedCameraSelection) {
    const operation = this.cameraSelectionQueue.then(() => this.applyCameraSelection(selection));
    this.cameraSelectionQueue = operation.catch(() => undefined);
    return operation;
  }

  private async applyCameraSelection(selection: ResolvedCameraSelection) {
    const previousSelection = this.cameraSelection;
    const previousSelectionIsDeviceId = this.cameraSelectionIsDeviceId;
    const wasRunning = this.cameraRunning;
    this.cameraSelection = selection.value;
    this.cameraSelectionIsDeviceId = selection.kind === 'device';
    if (!wasRunning) return;

    this.cleanupCameraResources();
    try {
      await this.startCamera();
    } catch (switchError) {
      this.cameraSelection = previousSelection;
      this.cameraSelectionIsDeviceId = previousSelectionIsDeviceId;
      try {
        await this.startCamera();
      } catch (rollbackError) {
        const error = new AggregateError(
          [switchError, rollbackError],
          'TMPose: Camera switch and rollback both failed.'
        );
        this.setLastError(error);
        throw error;
      }
      this.setLastError(switchError);
      throw switchError;
    }
  }

  updateActiveCameraInfo() {
    const stream = this.webcam?.webcam?.srcObject;
    const videoTrack = stream?.getVideoTracks?.()[0] ??
      stream?.getTracks?.().find((track) => track.kind === 'video' || track.kind === undefined);
    const settings = videoTrack?.getSettings?.() ?? {};
    const selectedDeviceId = this.cameraSelectionIsDeviceId ? this.cameraSelection : '';
    this.activeCameraDeviceId = String(settings.deviceId || selectedDeviceId);
    const device = this.cameraDevices.find((candidate) => candidate.deviceId === this.activeCameraDeviceId);
    this.activeCameraDeviceName = String(videoTrack?.label || device?.label || '');
  }

  cameraCountReporter() { return this.cameraDevices.length; }
  cameraDeviceIdReporter() { return this.activeCameraDeviceId; }
  cameraDeviceNameReporter() { return this.activeCameraDeviceName; }

  showPreview() {
    try {
      this.previewVisible = true;
      if (!this.webcam?.canvas) throw new Error('TMPose: Start the camera before showing the preview.');
      this.attachPreviewToStage();
      this.previewCanvas.style.display = 'block';
      this.updatePoseOverlayVisibility();
      this.validatePreviewAttachment(this.previewStageElement, this.previewCanvas);
    } catch (error) {
      this.setLastError(error);
      throw error;
    }
  }

  hidePreview() {
    this.previewVisible = false;
    if (this.previewCanvas) this.previewCanvas.style.display = 'none';
    this.updatePoseOverlayVisibility();
  }

  isPreviewVisible() { return this.previewVisible; }

  setPreviewOpacity(args) {
    let opacity = args.OPACITY === '' ? 0.6 : Number(args.OPACITY);
    if (Number.isNaN(opacity)) opacity = 0.6;
    this.previewOpacity = Math.max(0, Math.min(1, opacity));
    if (this.previewCanvas) this.previewCanvas.style.opacity = String(this.previewOpacity);
  }

  setPreviewPosition(args) {
    this.previewPosition = normalizePosition(args.POSITION);
    if (this.previewCanvas) {
      this.updatePreviewStyle();
      this.validatePreviewAttachment(this.previewStageElement, this.previewCanvas);
    }
  }

  setPreviewMirroring(args) {
    this.previewMirrored = normalizePreviewMirroring(args.MIRRORING);
    if (this.previewCanvas) this.updatePreviewStyle();
  }

  previewMirroringReporter() {
    return this.previewMirrored ? 'mirrored' : 'unmirrored';
  }

  setPoseOverlayVisibility(args) {
    this.poseOverlayVisible = normalizePoseOverlayVisibility(args.VISIBILITY);
    this.updatePoseOverlayVisibility();
  }

  showPoseOverlay() {
    this.poseOverlayVisible = true;
    this.updatePoseOverlayVisibility();
  }

  hidePoseOverlay() {
    this.poseOverlayVisible = false;
    this.updatePoseOverlayVisibility();
  }

  isPoseOverlayVisible() {
    return this.featureFlags.poseOverlay && this.poseOverlayVisible;
  }

  setPoseJointStyle(args) {
    const part = String(args.PART ?? '') as PoseKeypointName;
    if (!isPoseKeypointName(part)) throw new Error(`TMPose: Unknown PoseNet joint: ${part}`);
    const previous = this.poseJointStyles[part];
    this.poseJointStyles[part] = {
      color: normalizePoseColor(args.COLOR, previous.color),
      opacity: normalizePoseStyleNumber(args.OPACITY, previous.opacity, 1),
      radius: normalizePoseStyleNumber(args.RADIUS, previous.radius)
    };
    this.redrawPoseOverlay();
  }

  setPoseBoneStyle(args) {
    this.poseBoneStyle = {
      color: normalizePoseColor(args.COLOR, this.poseBoneStyle.color),
      opacity: normalizePoseStyleNumber(args.OPACITY, this.poseBoneStyle.opacity, 1),
      width: normalizePoseStyleNumber(args.WIDTH, this.poseBoneStyle.width)
    };
    this.redrawPoseOverlay();
  }

  setPoseOverlayMinimumConfidence(args) {
    this.poseOverlayMinimumConfidence = normalizePoseStyleNumber(
      args.CONFIDENCE,
      this.poseOverlayMinimumConfidence,
      1
    );
    this.redrawPoseOverlay();
  }

  setPoseConfidenceScaling(args) {
    const property = String(args.PROPERTY ?? '') as PoseOverlayConfidenceProperty;
    const key = {
      'joint-opacity': 'jointOpacity',
      'joint-radius': 'jointRadius',
      'bone-opacity': 'boneOpacity',
      'bone-width': 'boneWidth'
    }[property];
    if (!key) throw new Error(`TMPose: Unknown confidence-scaled property: ${property}`);
    this.poseConfidenceScaling[key] = normalizePoseOverlayVisibility(args.STATE);
    this.redrawPoseOverlay();
  }

  async loadModel() {
    if (this.model) return;
    if (!this.modelURL) throw new Error('TMPose: Set the model URL first.');
    try {
      this.lastError = '';
      const startedAt = performance.now();
      await this.ensureLibrariesLoaded();
      if (typeof this.tmPoseRuntime.load !== 'function') {
        throw new Error('TMPose: The Teachable Machine Pose URL loader is not available.');
      }
      this.model = await this.tmPoseRuntime.load(
        this.modelURL + 'model.json',
        this.modelURL + 'metadata.json'
      );
      this.modelLoadMs = Math.round(performance.now() - startedAt);
    } catch (error) {
      this.setLastError(error);
      throw error;
    }
  }

  isModelLoaded() { return Boolean(this.model); }

  usePreparedModel(model) {
    if (!model || typeof model !== 'object') {
      throw new TypeError('TMPose: Prepared model must be an object.');
    }
    if (this.predicting && this.model !== model) {
      throw new Error('TMPose: Stop recognition before changing the active model.');
    }
    this.model = model;
    this.modelURL = '';
    this.modelLoadMs = 0;
    this.firstPredictMs = 0;
  }

  clearPreparedModel(model) {
    if (model !== undefined && this.model !== model) return;
    this.stopPredict();
    this.model = null;
    this.modelURL = '';
    this.modelLoadMs = 0;
    this.firstPredictMs = 0;
  }

  async startPredict() {
    try {
      this.lastError = '';
      const startingNewSession = !this.predicting;
      if (!this.cameraRunning) await this.startCamera();
      await this.loadModel();
      if (startingNewSession && this.featureFlags.temporalPoseScoring) {
        this.startAccumulatedPoseSession();
      }
      this.predicting = true;
      this.startLoopIfNeeded();
    } catch (error) {
      this.setLastError(error);
      throw error;
    }
  }

  stopPredict() {
    this.predicting = false;
    this.currentPoseName = '';
    this.score = 0;
    this.predictions = {};
    this.clearPoseOverlay();
    this.resetAccumulatedPose('stop');
  }

  isPredicting() { return this.predicting; }

  findStageElement() {
    try {
      const stageCanvas = this.findLikelyStageCanvas();
      if (stageCanvas.parentElement) return stageCanvas.parentElement;
    } catch {
      // Desktop Editor layouts can expose a wrapper before their renderer canvas is measurable.
    }
    const editorStage =
      document.querySelector('.stage_stage-wrapper_2bejr') ||
      document.querySelector('[class*="stage_stage-wrapper"]') ||
      document.querySelector('[class*="stage-wrapper"]') ||
      document.querySelector('[class*="stage-wrapper_stage-wrapper"]');
    if (editorStage) return editorStage;
    throw new Error('TMPose: TurboWarp stage element was not found.');
  }

  findLikelyStageCanvas() {
    const webcamCanvas = this.webcam?.canvas ?? null;
    const allCanvases = Array.from(document.querySelectorAll('canvas'))
      .filter((canvas) => canvas !== webcamCanvas && canvas !== this.previewCanvas);

    const visibleCandidates = allCanvases
      .map((canvas) => {
        const rect = canvas.getBoundingClientRect();
        const style = window.getComputedStyle(canvas);
        return {canvas, rect, style, score: canvasScore(rect.width, rect.height)};
      })
      .filter((item) => item.rect.width >= 200 && item.rect.height >= 150)
      .filter((item) => item.style.display !== 'none')
      .filter((item) => item.style.visibility !== 'hidden')
      .filter((item) => Number(item.style.opacity || 1) !== 0)
      .sort((left, right) => right.score - left.score);

    if (visibleCandidates[0]) return visibleCandidates[0].canvas;

    const fallbackCandidates = allCanvases
      .map((canvas) => ({canvas, score: canvasScore(canvas.width, canvas.height)}))
      .filter((item) => item.canvas.width >= 200 && item.canvas.height >= 150)
      .sort((left, right) => right.score - left.score);

    if (fallbackCandidates[0]) return fallbackCandidates[0].canvas;
    throw new Error('TMPose: No likely stage canvas was found. The editor or packager DOM may be unsupported.');
  }

  validatePreviewAttachment(stage, canvas) {
    if (!stage || !canvas || canvas.parentElement !== stage) {
      throw new Error('TMPose: Preview canvas was not attached to the stage.');
    }

    const canvasStyle = window.getComputedStyle(canvas);
    if (canvasStyle.display === 'none' && this.previewVisible) {
      throw new Error('TMPose: Preview canvas is hidden by display:none.');
    }
    if (canvasStyle.visibility === 'hidden' && this.previewVisible) {
      throw new Error('TMPose: Preview canvas is hidden by visibility:hidden.');
    }

    const stageRect = stage.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const documentHidden = typeof document.visibilityState === 'string' && document.visibilityState === 'hidden';
    const layoutUnavailable = stageRect.width === 0 || stageRect.height === 0;

    if (!documentHidden && !layoutUnavailable && this.previewVisible) {
      if (canvasRect.width <= 0 || canvasRect.height <= 0) {
        throw new Error('TMPose: Preview canvas was attached but has zero size.');
      }
      if (!rectanglesIntersect(stageRect, canvasRect)) {
        throw new Error('TMPose: Preview canvas does not intersect the stage.');
      }
    }
  }

  createSvgElement(name: string): SVGElement {
    if (typeof document.createElementNS === 'function') {
      return document.createElementNS('http://www.w3.org/2000/svg', name);
    }
    return document.createElement(name) as unknown as SVGElement;
  }

  ensurePoseOverlayElement(): SVGSVGElement | null {
    if (!this.featureFlags.poseOverlay) return null;
    if (this.poseOverlaySvg) return this.poseOverlaySvg;

    const svg = this.createSvgElement('svg') as SVGSVGElement;
    svg.setAttribute('viewBox', '0 0 320 240');
    svg.setAttribute('width', '320');
    svg.setAttribute('height', '240');
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');

    const boneGroup = this.createSvgElement('g');
    boneGroup.setAttribute('data-layer', 'bones');
    this.poseOverlayBoneElements = POSE_BONE_CONNECTIONS.map(([first, second]) => {
      const line = this.createSvgElement('line') as SVGLineElement;
      line.setAttribute('data-bone', `${first}-${second}`);
      line.setAttribute('stroke-linecap', 'round');
      line.style.display = 'none';
      boneGroup.appendChild(line);
      return {first, second, line};
    });
    svg.appendChild(boneGroup);

    const jointGroup = this.createSvgElement('g');
    jointGroup.setAttribute('data-layer', 'joints');
    this.poseOverlayJointElements = new Map();
    for (const part of POSE_KEYPOINT_NAMES) {
      const circle = this.createSvgElement('circle') as SVGCircleElement;
      circle.setAttribute('data-joint', part);
      circle.style.display = 'none';
      jointGroup.appendChild(circle);
      this.poseOverlayJointElements.set(part, circle);
    }
    svg.appendChild(jointGroup);
    this.poseOverlaySvg = svg;
    return svg;
  }

  updatePoseOverlayVisibility() {
    if (!this.poseOverlaySvg) return;
    this.poseOverlaySvg.style.display =
      this.previewVisible && this.poseOverlayVisible ? 'block' : 'none';
  }

  clearPoseOverlay() {
    this.latestPoseKeypoints = [];
    for (const circle of this.poseOverlayJointElements.values()) {
      circle.style.display = 'none';
    }
    for (const {line} of this.poseOverlayBoneElements) line.style.display = 'none';
  }

  redrawPoseOverlay() {
    if (this.latestPoseKeypoints.length > 0) {
      this.renderPoseOverlay(this.latestPoseKeypoints);
    }
  }

  renderPoseOverlay(keypoints: unknown) {
    if (!this.featureFlags.poseOverlay || !this.poseOverlaySvg || !Array.isArray(keypoints)) {
      this.clearPoseOverlay();
      return;
    }
    this.latestPoseKeypoints = keypoints;
    const recognized = new Map<PoseKeypointName, PoseOverlayKeypoint>();
    for (const candidate of keypoints) {
      if (
        typeof candidate !== 'object' ||
        candidate === null ||
        !isPoseKeypointName((candidate as PoseOverlayKeypoint).part)
      ) {
        continue;
      }
      const keypoint = candidate as PoseOverlayKeypoint;
      const x = Number(keypoint.position?.x);
      const y = Number(keypoint.position?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      recognized.set(keypoint.part as PoseKeypointName, {
        part: keypoint.part,
        score: confidenceMultiplier(keypoint.score),
        position: {x, y}
      });
    }

    for (const part of POSE_KEYPOINT_NAMES) {
      const circle = this.poseOverlayJointElements.get(part);
      const keypoint = recognized.get(part);
      if (!circle || !keypoint || keypoint.score < this.poseOverlayMinimumConfidence) {
        if (circle) circle.style.display = 'none';
        continue;
      }
      const style = this.poseJointStyles[part];
      const opacityMultiplier = this.poseConfidenceScaling.jointOpacity ? keypoint.score : 1;
      const radiusMultiplier = this.poseConfidenceScaling.jointRadius ? keypoint.score : 1;
      circle.setAttribute('cx', String(keypoint.position.x));
      circle.setAttribute('cy', String(keypoint.position.y));
      circle.setAttribute('r', String(style.radius * radiusMultiplier));
      circle.setAttribute('fill', style.color);
      circle.setAttribute('fill-opacity', String(style.opacity * opacityMultiplier));
      circle.style.display = 'block';
    }

    for (const {first, second, line} of this.poseOverlayBoneElements) {
      const firstKeypoint = recognized.get(first);
      const secondKeypoint = recognized.get(second);
      if (
        !firstKeypoint ||
        !secondKeypoint ||
        firstKeypoint.score < this.poseOverlayMinimumConfidence ||
        secondKeypoint.score < this.poseOverlayMinimumConfidence
      ) {
        line.style.display = 'none';
        continue;
      }
      const confidence = Math.min(firstKeypoint.score, secondKeypoint.score);
      const opacityMultiplier = this.poseConfidenceScaling.boneOpacity ? confidence : 1;
      const widthMultiplier = this.poseConfidenceScaling.boneWidth ? confidence : 1;
      line.setAttribute('x1', String(firstKeypoint.position.x));
      line.setAttribute('y1', String(firstKeypoint.position.y));
      line.setAttribute('x2', String(secondKeypoint.position.x));
      line.setAttribute('y2', String(secondKeypoint.position.y));
      line.setAttribute('stroke', this.poseBoneStyle.color);
      line.setAttribute('stroke-opacity', String(this.poseBoneStyle.opacity * opacityMultiplier));
      line.setAttribute('stroke-width', String(this.poseBoneStyle.width * widthMultiplier));
      line.style.display = 'block';
    }
  }

  attachPreviewToStage() {
    if (!this.webcam) throw new Error('TMPose: Start the camera before attaching the preview.');
    if (!this.webcam.canvas) throw new Error('TMPose: webcam.canvas is unavailable.');
    const stage = this.findStageElement();
    const canvas = this.webcam.canvas;
    let stageCanvas: HTMLCanvasElement | null = null;
    try {
      const candidate = this.findLikelyStageCanvas();
      if (candidate.parentElement === stage) stageCanvas = candidate;
    } catch {
      // Desktop Editor layouts can expose the wrapper directly without another discoverable canvas.
    }
    this.previewCanvas = canvas;
    this.previewStageElement = stage;
    const overlay = this.ensurePoseOverlayElement();
    const computed = window.getComputedStyle(stage);
    if (computed.position === 'static') stage.style.position = 'relative';
    stage.style.overflow = 'hidden';
    Object.assign(canvas.style, {
      position: 'absolute', zIndex: 'auto', pointerEvents: 'none',
      border: '2px solid rgba(255, 255, 255, 0.7)', borderRadius: '8px',
      background: '#000', opacity: String(this.previewOpacity),
      display: this.previewVisible ? 'block' : 'none', boxSizing: 'border-box'
    });
    if (overlay) {
      Object.assign(overlay.style, {
        position: 'absolute',
        zIndex: 'auto',
        pointerEvents: 'none',
        border: '2px solid transparent',
        background: 'transparent',
        display: this.previewVisible && this.poseOverlayVisible ? 'block' : 'none',
        boxSizing: 'border-box',
        overflow: 'hidden'
      });
    }
    let insertionPoint = stageCanvas?.nextSibling ?? null;
    while (insertionPoint && (insertionPoint === canvas || insertionPoint === overlay)) {
      insertionPoint = insertionPoint.nextSibling;
    }
    if (stageCanvas && typeof stage.insertBefore === 'function') {
      stage.insertBefore(canvas, insertionPoint);
    } else if (canvas.parentNode !== stage) {
      stage.appendChild(canvas);
    }
    if (overlay) {
      if (stageCanvas && typeof stage.insertBefore === 'function') {
        stage.insertBefore(overlay, insertionPoint);
      } else if (overlay.parentNode !== stage) {
        stage.appendChild(overlay);
      }
    }
    this.updatePreviewStyle();
    this.updatePoseOverlayVisibility();
    this.validatePreviewAttachment(stage, canvas);
  }

  updatePreviewStyle() {
    const canvas = this.previewCanvas;
    if (!canvas) throw new Error('TMPose: Start the camera before positioning the preview.');
    const targets = [canvas, this.poseOverlaySvg].filter(Boolean);
    for (const target of targets) {
      Object.assign(target.style, {
        left: '', right: '', top: '', bottom: '', transform: '', objectFit: '',
        width: '35%', height: 'auto', borderRadius: '8px'
      });
    }
    let positionTransform = '';
    switch (this.previewPosition) {
      case 'top-left':
        for (const target of targets) { target.style.left = '8px'; target.style.top = '8px'; }
        break;
      case 'top-right':
        for (const target of targets) { target.style.right = '8px'; target.style.top = '8px'; }
        break;
      case 'bottom-left':
        for (const target of targets) { target.style.left = '8px'; target.style.bottom = '8px'; }
        break;
      case 'center':
        for (const target of targets) { target.style.left = '50%'; target.style.top = '50%'; }
        positionTransform = 'translate(-50%, -50%)'; break;
      case 'full-stage':
        for (const target of targets) {
          target.style.left = '0'; target.style.top = '0'; target.style.width = '100%';
          target.style.height = '100%'; target.style.objectFit = 'cover'; target.style.borderRadius = '0';
        }
        break;
      default:
        for (const target of targets) { target.style.right = '8px'; target.style.bottom = '8px'; }
    }
    const mirroringTransform = this.previewMirrored ? '' : 'scaleX(-1)';
    for (const target of targets) {
      target.style.transform = [positionTransform, mirroringTransform].filter(Boolean).join(' ');
    }
    this.poseOverlaySvg?.setAttribute(
      'preserveAspectRatio',
      this.previewPosition === 'full-stage' ? 'xMidYMid slice' : 'xMidYMid meet'
    );
  }

  startLoopIfNeeded() {
    if (this.loopStarted || !this.cameraRunning || !this.webcam) return;
    this.loopStarted = true;
    const generation = ++this.loopGeneration;
    void this.loop(generation);
  }

  private trackPreparedModelOperation<T>(model: object, operation: Promise<T>): Promise<T> {
    let active = this.activeModelOperations.get(model);
    if (!active) {
      active = new Set();
      this.activeModelOperations.set(model, active);
    }
    active.add(operation);
    void operation.then(
      () => {
        active.delete(operation);
        if (active.size === 0) this.activeModelOperations.delete(model);
      },
      () => {
        active.delete(operation);
        if (active.size === 0) this.activeModelOperations.delete(model);
      }
    );
    return operation;
  }

  async waitForPreparedModelIdle(model: object): Promise<void> {
    await Promise.allSettled([...(this.activeModelOperations.get(model) ?? [])]);
  }

  async loop(generation = this.loopGeneration) {
    if (generation !== this.loopGeneration || !this.cameraRunning || !this.webcam) {
      if (generation === this.loopGeneration) this.loopStarted = false;
      return;
    }
    try {
      this.webcam.update();
      if (this.predicting && this.model) {
        const model = this.model;
        const first = this.firstPredictMs === 0;
        const startedAt = first ? performance.now() : 0;
        const recognition = await this.trackPreparedModelOperation(
          model,
          (async () => {
            const estimate = await model.estimatePose(this.webcam.canvas);
            const prediction = await model.predict(estimate.posenetOutput);
            return {keypoints: estimate.pose?.keypoints, prediction};
          })()
        );
        if (
          generation !== this.loopGeneration ||
          !this.cameraRunning ||
          !this.predicting ||
          this.model !== model
        ) {
          // The old result is stale, but a still-running camera keeps its frame loop alive.
        } else {
          if (first) this.firstPredictMs = Math.round(performance.now() - startedAt);
          this.renderPoseOverlay(recognition.keypoints);
          let best = {className: '', probability: 0};
          this.predictions = {};
          for (const result of recognition.prediction) {
            this.predictions[result.className] = result.probability;
            if (result.probability > best.probability) best = result;
          }
          this.currentPoseName = best.className;
          this.score = best.probability;
          if (this.featureFlags.temporalPoseScoring) {
            this.updateAccumulatedPose(recognition.prediction);
          }
        }
      }
    } catch (error) {
      this.setLastError(error);
    }
    if (generation === this.loopGeneration && this.cameraRunning && this.webcam) {
      requestAnimationFrame(() => void this.loop(generation));
    } else if (generation === this.loopGeneration) {
      this.loopStarted = false;
    }
  }

  currentPoseReporter() { return this.currentPoseName; }
  scoreReporter() { return Math.round(this.score * 100) / 100; }

  poseScoreReporter(args) {
    const value = this.predictions[String(args.NAME || '')] || 0;
    return Math.round(value * 100) / 100;
  }

  setAccumulatedPoseParameters(args) {
    const accumulation = args.ACCUMULATION === '' ? 1 : Number(args.ACCUMULATION);
    const decay = args.DECAY === '' ? 0.9 : Number(args.DECAY);
    this.accumulationCoefficient = Number.isFinite(accumulation) ? Math.max(0, accumulation) : 1;
    this.decayCoefficient = Number.isFinite(decay) ? Math.max(0, Math.min(1, decay)) : 0.9;
  }

  setAccumulatedPoseThreshold(args) {
    const threshold = args.THRESHOLD === '' ? 0 : Number(args.THRESHOLD);
    this.accumulatedPoseThreshold = Number.isFinite(threshold) ? Math.max(0, threshold) : 0;
    this.updateAccumulatedPoseSelection();
  }

  startAccumulatedPoseSession(now = performance.now()) {
    this.activeDecayCoefficient = this.decayCoefficient;
    this.lastAccumulationTime = now;
  }

  supportsAccumulatedPoseEvents() {
    return this.featureFlags.temporalPoseScoring && this.featureFlags.accumulatedPoseEvents;
  }

  emitAccumulatedPoseChanged(
    previousPoseName: string,
    reason: AccumulatedPoseChangedEventV1['reason']
  ) {
    if (!this.supportsAccumulatedPoseEvents() || previousPoseName === this.accumulatedPoseName) return;
    const payload: AccumulatedPoseChangedEventV1 = {
      version: 1,
      poseName: this.accumulatedPoseName,
      previousPoseName,
      score: this.accumulatedScore,
      reason,
      timestamp: performance.now()
    };
    if (this.onAccumulatedPoseChanged) {
      try {
        this.onAccumulatedPoseChanged(payload);
      } catch {
        // Observers cannot change recognition semantics.
      }
    } else if (typeof Scratch !== 'undefined') {
      Scratch.vm?.runtime?.emit(ACCUMULATED_POSE_CHANGED_EVENT, payload);
    }
  }

  dispose() {
    this.stopCamera();
    if (this.featureFlags.temporalPoseScoring && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.visibilityChangeListener);
    }
    this.onAccumulatedPoseChanged = null;
  }

  resetAccumulatedPose(reason: AccumulatedPoseChangedEventV1['reason'] = 'reset') {
    const previousPoseName = this.accumulatedPoseName;
    this.accumulatedPoseName = '';
    this.accumulatedScore = 0;
    this.accumulatedPredictions = {};
    this.lastAccumulationTime = this.predicting ? performance.now() : null;
    this.emitAccumulatedPoseChanged(previousPoseName, reason);
  }

  handleDocumentVisibilityChange() {
    if (typeof document === 'undefined') return;
    if (isDocumentHidden()) {
      this.accumulatedPosePausedForBackground = true;
      return;
    }
    if (this.accumulatedPosePausedForBackground) {
      this.accumulatedPosePausedForBackground = false;
      this.lastAccumulationTime = this.predicting ? performance.now() : null;
    }
  }

  updateAccumulatedPose(prediction, now = performance.now()) {
    if (isDocumentHidden()) {
      this.accumulatedPosePausedForBackground = true;
      return;
    }
    if (this.accumulatedPosePausedForBackground) return;

    const elapsedSeconds = this.lastAccumulationTime === null
      ? 0
      : Math.max(0, (now - this.lastAccumulationTime) / 1000);
    const decayMultiplier = elapsedSeconds === 0
      ? 1
      : Math.pow(this.activeDecayCoefficient, elapsedSeconds);

    for (const name of Object.keys(this.accumulatedPredictions)) {
      this.accumulatedPredictions[name] *= decayMultiplier;
    }

    for (const result of prediction) {
      const name = String(result.className || '');
      const probability = Number(result.probability);
      if (!name || !Number.isFinite(probability)) continue;
      const contribution =
        Math.max(0, Math.min(1, probability)) * this.accumulationCoefficient * elapsedSeconds;
      this.accumulatedPredictions[name] = (this.accumulatedPredictions[name] || 0) + contribution;
    }

    this.lastAccumulationTime = now;
    this.updateAccumulatedPoseSelection();
  }

  updateAccumulatedPoseSelection() {
    const previousPoseName = this.accumulatedPoseName;
    this.accumulatedPoseName = '';
    this.accumulatedScore = 0;
    let bestPoseName = '';
    for (const [name, value] of Object.entries(this.accumulatedPredictions)) {
      if ((value as number) > this.accumulatedScore) {
        bestPoseName = name;
        this.accumulatedScore = value as number;
      }
    }
    if (bestPoseName && this.accumulatedScore >= this.accumulatedPoseThreshold) {
      this.accumulatedPoseName = bestPoseName;
    }
    this.emitAccumulatedPoseChanged(previousPoseName, 'prediction');
  }

  accumulatedPoseReporter() { return this.accumulatedPoseName; }
  accumulatedScoreReporter() { return this.accumulatedScore; }

  accumulatedPoseScoreReporter(args) {
    const value = this.accumulatedPredictions[String(args.NAME || '')] || 0;
    return value;
  }

  isPose(args) {
    return (this.predictions[String(args.NAME || '')] || 0) >= 0.75;
  }

  isPoseWithThreshold(args) {
    const name = String(args.NAME || '');
    let threshold = args.THRESHOLD === '' ? 0.75 : Number(args.THRESHOLD);
    if (Number.isNaN(threshold)) threshold = 0.75;
    threshold = Math.max(0, Math.min(1, threshold));
    return (this.predictions[name] || 0) >= threshold;
  }

  cameraMsReporter() { return this.cameraMs; }
  modelLoadMsReporter() { return this.modelLoadMs; }
  firstPredictMsReporter() { return this.firstPredictMs; }
  lastErrorReporter() { return this.lastError; }
}
