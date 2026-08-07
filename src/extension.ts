import definitions from './block-definitions.json' with {type: 'json'};
import {FEATURE_FLAGS, type FeatureFlags} from './config/feature-flags.js';

export const EXTENSION_ID = 'tmpose';
export const VERSION = '1.5.0-typescript';
export const DOCS_URI = 'https://kubohiroya.github.io/turbowarp-tmpose/';
export const ACCUMULATED_POSE_CHANGED_EVENT = 'TMPOSE_ACCUMULATED_POSE_CHANGED';

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

const TFJS_URL = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@1.3.1/dist/tf.min.js';
const TMPOSE_URL = 'https://cdn.jsdelivr.net/npm/@teachablemachine/pose@0.8.3/dist/teachablemachine-pose.min.js';

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

const loadingPromises = new Map<string, Promise<void>>();

function normalizePosition(value: unknown): string {
  return POSITION_ALIASES[String(value ?? 'bottom-right')] ?? 'bottom-right';
}

function scriptLoadedFor(src: string): boolean {
  if (src === TFJS_URL) return typeof globalThis.tf !== 'undefined';
  if (src === TMPOSE_URL) return typeof globalThis.tmPose !== 'undefined';
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
    this.previewVisible = true;
    this.previewCanvas = null;
    this.previewStageElement = null;
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
    if (typeof globalThis.tf === 'undefined') await loadScript(TFJS_URL);
    if (typeof globalThis.tmPose === 'undefined') await loadScript(TMPOSE_URL);
    if (typeof globalThis.tmPose === 'undefined') {
      throw new Error('TMPose: Teachable Machine Pose could not be loaded.');
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
    this.previewCanvas = null;
    this.previewStageElement = null;
    this.webcam = null;
    this.cameraRunning = false;
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
      await this.webcam.setup();
      await this.webcam.play();
      this.attachPreviewToStage();
      this.cameraRunning = true;
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

  showPreview() {
    try {
      this.previewVisible = true;
      if (!this.webcam?.canvas) throw new Error('TMPose: Start the camera before showing the preview.');
      this.attachPreviewToStage();
      this.previewCanvas.style.display = 'block';
      this.validatePreviewAttachment(this.previewStageElement, this.previewCanvas);
    } catch (error) {
      this.setLastError(error);
      throw error;
    }
  }

  hidePreview() {
    this.previewVisible = false;
    if (this.previewCanvas) this.previewCanvas.style.display = 'none';
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
    this.resetAccumulatedPose('stop');
  }

  isPredicting() { return this.predicting; }

  findStageElement() {
    const editorStage =
      document.querySelector('.stage_stage-wrapper_2bejr') ||
      document.querySelector('[class*="stage_stage-wrapper"]') ||
      document.querySelector('[class*="stage-wrapper"]') ||
      document.querySelector('[class*="stage-wrapper_stage-wrapper"]');
    if (editorStage) return editorStage;
    const stageCanvas = this.findLikelyStageCanvas();
    if (stageCanvas.parentElement) return stageCanvas.parentElement;
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

  attachPreviewToStage() {
    if (!this.webcam) throw new Error('TMPose: Start the camera before attaching the preview.');
    if (!this.webcam.canvas) throw new Error('TMPose: webcam.canvas is unavailable.');
    const stage = this.findStageElement();
    const canvas = this.webcam.canvas;
    this.previewCanvas = canvas;
    this.previewStageElement = stage;
    const computed = window.getComputedStyle(stage);
    if (computed.position === 'static') stage.style.position = 'relative';
    stage.style.overflow = 'hidden';
    Object.assign(canvas.style, {
      position: 'absolute', zIndex: '999', pointerEvents: 'none',
      border: '2px solid rgba(255, 255, 255, 0.7)', borderRadius: '8px',
      background: '#000', opacity: String(this.previewOpacity),
      display: this.previewVisible ? 'block' : 'none', boxSizing: 'border-box'
    });
    if (canvas.parentNode !== stage) stage.appendChild(canvas);
    this.updatePreviewStyle();
    this.validatePreviewAttachment(stage, canvas);
  }

  updatePreviewStyle() {
    const canvas = this.previewCanvas;
    if (!canvas) throw new Error('TMPose: Start the camera before positioning the preview.');
    Object.assign(canvas.style, {
      left: '', right: '', top: '', bottom: '', transform: '', objectFit: '',
      width: '35%', height: 'auto', borderRadius: '8px'
    });
    switch (this.previewPosition) {
      case 'top-left': canvas.style.left = '8px'; canvas.style.top = '8px'; break;
      case 'top-right': canvas.style.right = '8px'; canvas.style.top = '8px'; break;
      case 'bottom-left': canvas.style.left = '8px'; canvas.style.bottom = '8px'; break;
      case 'center':
        canvas.style.left = '50%'; canvas.style.top = '50%';
        canvas.style.transform = 'translate(-50%, -50%)'; break;
      case 'full-stage':
        canvas.style.left = '0'; canvas.style.top = '0'; canvas.style.width = '100%';
        canvas.style.height = '100%'; canvas.style.objectFit = 'cover'; canvas.style.borderRadius = '0'; break;
      default: canvas.style.right = '8px'; canvas.style.bottom = '8px';
    }
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
        const prediction = await this.trackPreparedModelOperation(
          model,
          (async () => {
            const estimate = await model.estimatePose(this.webcam.canvas);
            return model.predict(estimate.posenetOutput);
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
          let best = {className: '', probability: 0};
          this.predictions = {};
          for (const result of prediction) {
            this.predictions[result.className] = result.probability;
            if (result.probability > best.probability) best = result;
          }
          this.currentPoseName = best.className;
          this.score = best.probability;
          if (this.featureFlags.temporalPoseScoring) {
            this.updateAccumulatedPose(prediction);
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
