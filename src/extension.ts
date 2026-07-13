import definitions from './block-definitions.json' with {type: 'json'};

export const EXTENSION_ID = 'tmpose';
export const VERSION = '1.3.0-typescript';

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

export function loadScript(src: string): Promise<void> {
  const active = loadingPromises.get(src);
  if (active) return active;

  const existing = Array.from(document.scripts).find((script) => script.src === src);
  if (existing?.dataset.tmposeLoaded === 'true') return Promise.resolve();

  const promise = new Promise<void>((resolve, reject) => {
    const script = existing ?? document.createElement('script');
    const handleLoad = () => {
      script.dataset.tmposeLoaded = 'true';
      resolve();
    };
    const handleError = () => {
      loadingPromises.delete(src);
      reject(new Error('TMPose: Failed to load script: ' + src));
    };
    script.addEventListener('load', handleLoad, {once: true});
    script.addEventListener('error', handleError, {once: true});
    if (!existing) {
      script.src = src;
      document.head.appendChild(script);
    }
  });

  loadingPromises.set(src, promise);
  return promise;
}

export class TMPoseExtension {
  [key: string]: any;

  constructor() {
    this.modelURL = '';
    this.model = null;
    this.webcam = null;
    this.cameraRunning = false;
    this.predicting = false;
    this.loopStarted = false;
    this.currentPoseName = '';
    this.score = 0;
    this.predictions = {};
    this.previewOpacity = 0.6;
    this.previewPosition = 'bottom-right';
    this.previewVisible = true;
    this.previewCanvas = null;
    this.previewStageElement = null;
    this.cameraMs = 0;
    this.modelLoadMs = 0;
    this.firstPredictMs = 0;
    this.lastError = '';
  }

  getInfo() {
    return {
      id: EXTENSION_ID,
      name: Scratch.translate(definitions.extensionName),
      blocks: definitions.blocks.map((block: any) => ({
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
    await loadScript(TFJS_URL);
    await loadScript(TMPOSE_URL);
    if (typeof tmPose === 'undefined') throw new Error('TMPose: Teachable Machine Pose could not be loaded.');
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
      this.webcam = new tmPose.Webcam(320, 240, true);
      await this.webcam.setup();
      await this.webcam.play();
      this.cameraRunning = true;
      this.cameraMs = Math.round(performance.now() - startedAt);
      this.attachPreviewToStage();
      if (!this.loopStarted) {
        this.loopStarted = true;
        void this.loop();
      }
    } catch (error) {
      this.setLastError(error);
      throw error;
    }
  }

  stopCamera() {
    try {
      this.stopPredict();
      if (!this.webcam) {
        this.cameraRunning = false;
        return;
      }
      const video = this.webcam.webcam;
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
    if (this.previewCanvas) this.updatePreviewStyle();
  }

  async loadModel() {
    if (!this.modelURL) throw new Error('TMPose: Set the model URL first.');
    if (this.model) return;
    try {
      this.lastError = '';
      const startedAt = performance.now();
      await this.ensureLibrariesLoaded();
      this.model = await tmPose.load(this.modelURL + 'model.json', this.modelURL + 'metadata.json');
      this.modelLoadMs = Math.round(performance.now() - startedAt);
    } catch (error) {
      this.setLastError(error);
      throw error;
    }
  }

  isModelLoaded() { return Boolean(this.model); }

  async startPredict() {
    try {
      this.lastError = '';
      if (!this.cameraRunning) await this.startCamera();
      await this.loadModel();
      this.predicting = true;
      if (!this.loopStarted) {
        this.loopStarted = true;
        void this.loop();
      }
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
        return {canvas, rect, style, area: rect.width * rect.height};
      })
      .filter((item) => item.rect.width >= 200 && item.rect.height >= 150)
      .filter((item) => item.style.display !== 'none')
      .filter((item) => item.style.visibility !== 'hidden')
      .filter((item) => Number(item.style.opacity || 1) !== 0)
      .sort((left, right) => right.area - left.area);

    if (visibleCandidates[0]) return visibleCandidates[0].canvas;

    const fallbackCandidates = allCanvases
      .map((canvas) => ({canvas, area: canvas.width * canvas.height}))
      .filter((item) => item.canvas.width >= 200 && item.canvas.height >= 150)
      .sort((left, right) => right.area - left.area);

    if (fallbackCandidates[0]) return fallbackCandidates[0].canvas;
    throw new Error('TMPose: No likely stage canvas was found. The editor or packager DOM may be unsupported.');
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

  async loop() {
    if (!this.cameraRunning || !this.webcam) {
      this.loopStarted = false;
      return;
    }
    try {
      this.webcam.update();
      if (this.predicting && this.model) {
        const first = this.firstPredictMs === 0;
        const startedAt = first ? performance.now() : 0;
        const estimate = await this.model.estimatePose(this.webcam.canvas);
        const prediction = await this.model.predict(estimate.posenetOutput);
        if (first) this.firstPredictMs = Math.round(performance.now() - startedAt);
        let best = {className: '', probability: 0};
        this.predictions = {};
        for (const result of prediction) {
          this.predictions[result.className] = result.probability;
          if (result.probability > best.probability) best = result;
        }
        this.currentPoseName = best.className;
        this.score = best.probability;
      }
    } catch (error) {
      this.setLastError(error);
    }
    requestAnimationFrame(() => void this.loop());
  }

  currentPoseReporter() { return this.currentPoseName; }
  scoreReporter() { return Math.round(this.score * 100) / 100; }

  poseScoreReporter(args) {
    return Math.round((this.predictions[String(args.NAME || '')] || 0) * 100) / 100;
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
