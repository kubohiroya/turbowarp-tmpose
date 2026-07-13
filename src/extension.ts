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
  '左上': 'top-left', '右上': 'top-right', '左下': 'bottom-left', '右下': 'bottom-right',
  '中央': 'center', 'ステージ全体': 'full-stage',
  'top-left': 'top-left', 'top-right': 'top-right', 'bottom-left': 'bottom-left',
  'bottom-right': 'bottom-right', center: 'center', 'full-stage': 'full-stage'
};

function normalizePosition(value: unknown): string {
  const raw = String(value ?? 'bottom-right');
  return POSITION_ALIASES[raw] ?? 'bottom-right';
}

const loadScript = (src: string) =>
  new Promise<void>((resolve, reject) => {
    const existing = Array.from(document.scripts).find((script) => script.src === src);
    if (existing) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('TMPose: Failed to load script: ' + src));
    document.head.appendChild(script);
  });

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
    const blockTypeMap = Scratch.BlockType;
    const argumentTypeMap = Scratch.ArgumentType;
    return {
      id: EXTENSION_ID,
      name: Scratch.translate(definitions.extensionName),
      blocks: definitions.blocks.map((block: any) => ({
        opcode: block.opcode,
        blockType: blockTypeMap[block.blockType],
        text: Scratch.translate(block.text),
        ...(block.disableMonitor ? {disableMonitor: true} : {}),
        ...(block.arguments ? {
          arguments: Object.fromEntries(
            Object.entries(block.arguments).map(([name, argument]: [string, any]) => [
              name,
              {
                type: argumentTypeMap[argument.type],
                defaultValue: argument.defaultValue,
                ...(argument.menu ? {menu: argument.menu} : {})
              }
            ])
          )
        } : {})
      })),
      menus: {
        positionMenu: {
          acceptReporters: true,
          items: POSITION_ITEMS.map((item) => ({
            text: Scratch.translate(item.text),
            value: item.value
          }))
        }
      }
    };
  }

  versionReporter() {
    return VERSION;
  }

  setLastError(error) {
    this.lastError = String(error && error.message ? error.message : error);
  }

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
    if (typeof tmPose === 'undefined') {
      throw new Error('TMPose: Teachable Machine Pose could not be loaded.');
    }
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
        this.loop();
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
      if (video && video.srcObject) {
        video.srcObject.getTracks().forEach((track) => track.stop());
        video.srcObject = null;
      }
      if (this.previewCanvas && this.previewCanvas.parentNode) {
        this.previewCanvas.parentNode.removeChild(this.previewCanvas);
      }
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

  isCameraRunning() {
    return this.cameraRunning;
  }

  showPreview() {
    try {
      this.previewVisible = true;
      if (!this.webcam || !this.webcam.canvas) {
        throw new Error('TMPose: Start the camera before showing the preview.');
      }
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

  isPreviewVisible() {
    return this.previewVisible;
  }

  setPreviewOpacity(args) {
    let opacity = Number(args.OPACITY);
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
      this.model = await tmPose.load(
        this.modelURL + 'model.json',
        this.modelURL + 'metadata.json'
      );
      this.modelLoadMs = Math.round(performance.now() - startedAt);
    } catch (error) {
      this.setLastError(error);
      throw error;
    }
  }

  isModelLoaded() {
    return Boolean(this.model);
  }

  async startPredict() {
    try {
      this.lastError = '';
      if (!this.cameraRunning) await this.startCamera();
      await this.loadModel();
      this.predicting = true;
      if (!this.loopStarted) {
        this.loopStarted = true;
        this.loop();
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

  isPredicting() {
    return this.predicting;
  }

  findStageElement() {
    const editorStage =
      document.querySelector('.stage_stage-wrapper_2bejr') ||
      document.querySelector('[class*="stage_stage-wrapper"]') ||
      document.querySelector('[class*="stage-wrapper"]') ||
      document.querySelector('[class*="stage-wrapper_stage-wrapper"]');
    if (editorStage) return editorStage;
    const stageCanvas = this.findLikelyStageCanvas();
    if (stageCanvas && stageCanvas.parentElement) return stageCanvas.parentElement;
    throw new Error('TMPose: TurboWarp stage element was not found.');
  }

  findLikelyStageCanvas() {
    const webcamCanvas = this.webcam?.canvas ?? null;
    const candidates = Array.from(document.querySelectorAll('canvas'))
      .filter((canvas) => canvas !== webcamCanvas)
      .filter((canvas) => canvas !== this.previewCanvas)
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
    if (candidates.length === 0) {
      throw new Error('TMPose: No likely stage canvas was found. The editor or packager DOM may be unsupported.');
    }
    return candidates[0].canvas;
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
    canvas.style.position = 'absolute';
    canvas.style.zIndex = '999';
    canvas.style.pointerEvents = 'none';
    canvas.style.border = '2px solid rgba(255, 255, 255, 0.7)';
    canvas.style.borderRadius = '8px';
    canvas.style.background = '#000';
    canvas.style.opacity = String(this.previewOpacity);
    canvas.style.display = this.previewVisible ? 'block' : 'none';
    canvas.style.boxSizing = 'border-box';
    if (canvas.parentNode !== stage) stage.appendChild(canvas);
    this.updatePreviewStyle();
    const rect = canvas.getBoundingClientRect();
    if (this.previewVisible && (rect.width === 0 || rect.height === 0)) {
      throw new Error('TMPose: Preview canvas was attached but has zero size.');
    }
  }

  updatePreviewStyle() {
    const canvas = this.previewCanvas;
    if (!canvas) throw new Error('TMPose: Start the camera before positioning the preview.');
    canvas.style.left = '';
    canvas.style.right = '';
    canvas.style.top = '';
    canvas.style.bottom = '';
    canvas.style.transform = '';
    canvas.style.objectFit = '';
    canvas.style.width = '35%';
    canvas.style.height = 'auto';
    canvas.style.borderRadius = '8px';
    switch (this.previewPosition) {
      case 'top-left':
        canvas.style.left = '8px';
        canvas.style.top = '8px';
        break;
      case 'top-right':
        canvas.style.right = '8px';
        canvas.style.top = '8px';
        break;
      case 'bottom-left':
        canvas.style.left = '8px';
        canvas.style.bottom = '8px';
        break;
      case 'center':
        canvas.style.left = '50%';
        canvas.style.top = '50%';
        canvas.style.transform = 'translate(-50%, -50%)';
        break;
      case 'full-stage':
        canvas.style.left = '0';
        canvas.style.top = '0';
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.objectFit = 'cover';
        canvas.style.borderRadius = '0';
        break;
      case 'bottom-right':
      default:
        canvas.style.right = '8px';
        canvas.style.bottom = '8px';
        break;
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
    requestAnimationFrame(() => this.loop());
  }

  currentPoseReporter() {
    return this.currentPoseName;
  }

  scoreReporter() {
    return Math.round(this.score * 100) / 100;
  }

  poseScoreReporter(args) {
    const name = String(args.NAME || '');
    const value = this.predictions[name] || 0;
    return Math.round(value * 100) / 100;
  }

  isPose(args) {
    const name = String(args.NAME || '');
    return this.currentPoseName === name && this.score >= 0.75;
  }

  isPoseWithThreshold(args) {
    const name = String(args.NAME || '');
    let threshold = Number(args.THRESHOLD);
    if (Number.isNaN(threshold)) threshold = 0.75;
    threshold = Math.max(0, Math.min(1, threshold));
    return this.currentPoseName === name && this.score >= threshold;
  }

  cameraMsReporter() {
    return this.cameraMs;
  }

  modelLoadMsReporter() {
    return this.modelLoadMs;
  }

  firstPredictMsReporter() {
    return this.firstPredictMs;
  }

  lastErrorReporter() {
    return this.lastError;
  }
}
