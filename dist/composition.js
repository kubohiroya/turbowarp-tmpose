const extensionName = "TMPose";
const blocks = [{ "opcode": "versionReporter", "blockType": "REPORTER", "text": "TMPose version", "description": "Returns the extension version." }, { "opcode": "setModelURL", "blockType": "COMMAND", "text": "set model URL to [URL]", "description": "Sets the Teachable Machine Pose model URL.", "arguments": { "URL": { "type": "STRING", "defaultValue": "https://teachablemachine.withgoogle.com/models/XXXX/" } } }, { "opcode": "startCamera", "blockType": "COMMAND", "text": "start camera", "description": "Starts the camera and attaches the preview." }, { "opcode": "stopCamera", "blockType": "COMMAND", "text": "stop camera", "description": "Stops the camera and prediction loop." }, { "opcode": "isCameraRunning", "blockType": "BOOLEAN", "text": "camera is running?", "description": "Reports whether the camera is running." }, { "opcode": "refreshCameraList", "blockType": "COMMAND", "text": "refresh camera list", "description": "Refreshes the list of available video input devices." }, { "opcode": "setCameraSelection", "blockType": "COMMAND", "text": "set camera to [CAMERA]", "description": "Selects the default, front, back, or a detected camera and switches a running camera.", "arguments": { "CAMERA": { "type": "STRING", "menu": "cameraMenu", "defaultValue": "default" } } }, { "opcode": "cameraCountReporter", "blockType": "REPORTER", "text": "camera count", "description": "Returns the number of video input devices found by the latest refresh." }, { "opcode": "cameraDeviceIdReporter", "blockType": "REPORTER", "text": "camera device ID", "description": "Returns the active camera device ID when available." }, { "opcode": "cameraDeviceNameReporter", "blockType": "REPORTER", "text": "camera device name", "description": "Returns the active camera device name when available." }, { "opcode": "showPreview", "blockType": "COMMAND", "text": "show camera preview", "description": "Shows the camera preview." }, { "opcode": "hidePreview", "blockType": "COMMAND", "text": "hide camera preview", "description": "Hides the camera preview." }, { "opcode": "isPreviewVisible", "blockType": "BOOLEAN", "text": "camera preview is visible?", "description": "Reports whether the preview is configured as visible." }, { "opcode": "setPreviewOpacity", "blockType": "COMMAND", "text": "set camera preview opacity to [OPACITY]", "description": "Sets preview opacity from 0 to 1.", "arguments": { "OPACITY": { "type": "NUMBER", "defaultValue": 0.6 } } }, { "opcode": "setPreviewPosition", "blockType": "COMMAND", "text": "set camera preview position to [POSITION]", "description": "Sets the preview position on the stage.", "arguments": { "POSITION": { "type": "STRING", "menu": "positionMenu", "defaultValue": "bottom-right" } } }, { "opcode": "setPreviewMirroring", "blockType": "COMMAND", "text": "set camera preview to [MIRRORING]", "description": "Sets whether the preview is mirrored without changing the recognition input.", "arguments": { "MIRRORING": { "type": "STRING", "menu": "previewMirroringMenu", "defaultValue": "mirrored" } } }, { "opcode": "previewMirroringReporter", "blockType": "REPORTER", "text": "camera preview mirroring", "description": "Returns mirrored or unmirrored for the current preview setting." }, { "opcode": "loadModel", "blockType": "COMMAND", "text": "load model", "description": "Loads the configured pose model." }, { "opcode": "isModelLoaded", "blockType": "BOOLEAN", "text": "model is loaded?", "description": "Reports whether the model is loaded." }, { "opcode": "startPredict", "blockType": "COMMAND", "text": "start recognition", "description": "Starts pose recognition." }, { "opcode": "stopPredict", "blockType": "COMMAND", "text": "stop recognition", "description": "Stops pose recognition." }, { "opcode": "isPredicting", "blockType": "BOOLEAN", "text": "recognition is running?", "description": "Reports whether recognition is running." }, { "opcode": "currentPoseReporter", "blockType": "REPORTER", "text": "current pose", "description": "Returns the highest-scoring pose label." }, { "opcode": "scoreReporter", "blockType": "REPORTER", "text": "confidence", "description": "Returns the confidence of the current pose." }, { "opcode": "poseScoreReporter", "blockType": "REPORTER", "text": "confidence of [NAME]", "description": "Returns the confidence for a named pose.", "arguments": { "NAME": { "type": "STRING", "defaultValue": "jump" } } }, { "opcode": "setAccumulatedPoseParameters", "blockType": "COMMAND", "text": "set accumulated pose accumulation [ACCUMULATION] decay [DECAY]", "description": "Sets the accumulation rate per second and the decay retained per second; decay changes apply to the next recognition session.", "featureFlag": "temporalPoseScoring", "arguments": { "ACCUMULATION": { "type": "NUMBER", "defaultValue": 1 }, "DECAY": { "type": "NUMBER", "defaultValue": 0.9 } } }, { "opcode": "setAccumulatedPoseThreshold", "blockType": "COMMAND", "text": "set accumulated pose threshold [THRESHOLD]", "description": "Sets the minimum accumulated score required to report a pose; values below the threshold report an empty string.", "featureFlag": "temporalPoseScoring", "arguments": { "THRESHOLD": { "type": "NUMBER", "defaultValue": 0 } } }, { "opcode": "resetAccumulatedPose", "blockType": "COMMAND", "text": "reset accumulated pose scores", "description": "Clears all accumulated pose scores.", "featureFlag": "temporalPoseScoring" }, { "opcode": "accumulatedPoseReporter", "blockType": "REPORTER", "text": "accumulated pose", "description": "Returns the pose label whose accumulated score is highest and meets the threshold, or an empty string otherwise.", "featureFlag": "temporalPoseScoring" }, { "opcode": "accumulatedScoreReporter", "blockType": "REPORTER", "text": "accumulated score", "description": "Returns the highest accumulated pose score without rounding.", "featureFlag": "temporalPoseScoring" }, { "opcode": "accumulatedPoseScoreReporter", "blockType": "REPORTER", "text": "accumulated score of [NAME]", "description": "Returns the accumulated score for a named pose without rounding.", "featureFlag": "temporalPoseScoring", "arguments": { "NAME": { "type": "STRING", "defaultValue": "jump" } } }, { "opcode": "isPose", "blockType": "BOOLEAN", "text": "pose is [NAME]?", "description": "Reports whether the named pose has at least 0.75 confidence.", "arguments": { "NAME": { "type": "STRING", "defaultValue": "jump" } } }, { "opcode": "isPoseWithThreshold", "blockType": "BOOLEAN", "text": "pose is [NAME] with confidence at least [THRESHOLD]?", "description": "Reports whether the named pose meets the given threshold.", "arguments": { "NAME": { "type": "STRING", "defaultValue": "jump" }, "THRESHOLD": { "type": "NUMBER", "defaultValue": 0.75 } } }, { "opcode": "cameraMsReporter", "blockType": "REPORTER", "text": "camera startup time (ms)", "description": "Returns camera startup time in milliseconds." }, { "opcode": "modelLoadMsReporter", "blockType": "REPORTER", "text": "model load time (ms)", "description": "Returns model load time in milliseconds." }, { "opcode": "firstPredictMsReporter", "blockType": "REPORTER", "text": "first recognition time (ms)", "description": "Returns first prediction time in milliseconds." }, { "opcode": "lastErrorReporter", "blockType": "REPORTER", "text": "last error", "description": "Returns the latest recorded error message." }];
const definitions = {
  extensionName,
  blocks
};
const FEATURE_FLAGS = {
  temporalPoseScoring: false,
  accumulatedPoseEvents: false
};
const EXTENSION_ID = "tmpose";
const VERSION = "1.6.0-typescript";
const DOCS_URI = "https://kubohiroya.github.io/turbowarp-tmpose/";
const ACCUMULATED_POSE_CHANGED_EVENT = "TMPOSE_ACCUMULATED_POSE_CHANGED";
const TFJS_URL = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@1.3.1/dist/tf.min.js";
const TMPOSE_URL = "https://cdn.jsdelivr.net/npm/@teachablemachine/pose@0.8.3/dist/teachablemachine-pose.min.js";
const POSITION_ITEMS = [
  { text: "top left", value: "top-left" },
  { text: "top right", value: "top-right" },
  { text: "bottom left", value: "bottom-left" },
  { text: "bottom right", value: "bottom-right" },
  { text: "center", value: "center" },
  { text: "full stage", value: "full-stage" }
];
const POSITION_ALIASES = {
  左上: "top-left",
  右上: "top-right",
  左下: "bottom-left",
  右下: "bottom-right",
  中央: "center",
  ステージ全体: "full-stage",
  "top-left": "top-left",
  "top-right": "top-right",
  "bottom-left": "bottom-left",
  "bottom-right": "bottom-right",
  center: "center",
  "full-stage": "full-stage"
};
const PREVIEW_MIRRORING_ITEMS = [
  { text: "mirrored", value: "mirrored" },
  { text: "unmirrored", value: "unmirrored" }
];
const PREVIEW_MIRRORING_ALIASES = {
  mirrored: true,
  unmirrored: false,
  mirror: true,
  normal: false,
  "左右反転": true,
  "そのまま": false
};
const CAMERA_SELECTION_ITEMS = [
  { text: "default camera", value: "default" },
  { text: "front camera", value: "front" },
  { text: "back camera", value: "back" }
];
const CAMERA_SELECTION_ALIASES = {
  default: "default",
  front: "front",
  back: "back",
  user: "front",
  environment: "back",
  "既定": "default",
  "インカメラ": "front",
  "前面カメラ": "front",
  "背面カメラ": "back"
};
const loadingPromises = /* @__PURE__ */ new Map();
function normalizePosition(value) {
  return POSITION_ALIASES[String(value ?? "bottom-right")] ?? "bottom-right";
}
function normalizePreviewMirroring(value) {
  return PREVIEW_MIRRORING_ALIASES[String(value ?? "mirrored").trim().toLowerCase()] ?? true;
}
function normalizeCameraSelection(value) {
  const selection = String(value ?? "default").trim();
  if (!selection) return "default";
  return CAMERA_SELECTION_ALIASES[selection.toLowerCase()] ?? selection;
}
function cameraConstraints(selection) {
  if (selection === "front") return { facingMode: { ideal: "user" } };
  if (selection === "back") return { facingMode: { ideal: "environment" } };
  if (selection === "default") return void 0;
  return { deviceId: { exact: selection } };
}
function scriptLoadedFor(src) {
  if (src === TFJS_URL) return typeof globalThis.tf !== "undefined";
  if (src === TMPOSE_URL) return typeof globalThis.tmPose !== "undefined";
  return false;
}
function loadScript(src) {
  if (scriptLoadedFor(src)) return Promise.resolve();
  const active = loadingPromises.get(src);
  if (active) return active;
  const existing = Array.from(document.scripts).find((script) => script.src === src);
  if (existing?.dataset.tmposeLoaded === "true") return Promise.resolve();
  const promise = new Promise((resolve, reject) => {
    const script = existing ?? document.createElement("script");
    const cleanup = () => {
      script.removeEventListener("load", handleLoad);
      script.removeEventListener("error", handleError);
    };
    const handleLoad = () => {
      cleanup();
      script.dataset.tmposeLoaded = "true";
      resolve();
    };
    const handleError = () => {
      cleanup();
      loadingPromises.delete(src);
      reject(new Error("TMPose: Failed to load script: " + src));
    };
    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });
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
function rectanglesIntersect(left, right) {
  return left.right > right.left && left.left < right.right && left.bottom > right.top && left.top < right.bottom;
}
function canvasScore(width, height) {
  if (width <= 0 || height <= 0) return Number.NEGATIVE_INFINITY;
  const area = width * height;
  const aspectPenalty = Math.abs(width / height - 4 / 3);
  return area / (1 + aspectPenalty * 4);
}
function isDocumentHidden() {
  return typeof document !== "undefined" && document.visibilityState === "hidden";
}
class TMPoseExtension {
  constructor(featureFlags = {}, dependencies = {}) {
    this.featureFlags = { ...FEATURE_FLAGS, ...featureFlags };
    this.tmPoseRuntime = dependencies.runtime ?? null;
    this.allowRemoteLibraries = dependencies.allowRemoteLibraries ?? true;
    this.onAccumulatedPoseChanged = dependencies.onAccumulatedPoseChanged ?? null;
    this.modelURL = "";
    this.model = null;
    this.webcam = null;
    this.cameraRunning = false;
    this.cameraSelection = "default";
    this.cameraDevices = [];
    this.activeCameraDeviceId = "";
    this.activeCameraDeviceName = "";
    this.cameraSelectionQueue = Promise.resolve();
    this.predicting = false;
    this.loopStarted = false;
    this.loopGeneration = 0;
    this.activeModelOperations = /* @__PURE__ */ new Map();
    this.currentPoseName = "";
    this.score = 0;
    this.predictions = {};
    this.accumulationCoefficient = 1;
    this.decayCoefficient = 0.9;
    this.activeDecayCoefficient = 0.9;
    this.accumulatedPoseThreshold = 0;
    this.accumulatedPoseName = "";
    this.accumulatedScore = 0;
    this.accumulatedPredictions = {};
    this.lastAccumulationTime = null;
    this.previewOpacity = 0.6;
    this.previewPosition = "bottom-right";
    this.previewMirrored = true;
    this.previewVisible = true;
    this.previewCanvas = null;
    this.previewStageElement = null;
    this.cameraMs = 0;
    this.modelLoadMs = 0;
    this.firstPredictMs = 0;
    this.lastError = "";
    this.accumulatedPosePausedForBackground = isDocumentHidden();
    this.visibilityChangeListener = () => this.handleDocumentVisibilityChange();
    if (this.featureFlags.temporalPoseScoring && typeof document !== "undefined") {
      document.addEventListener("visibilitychange", this.visibilityChangeListener);
    }
  }
  getInfo() {
    return {
      id: EXTENSION_ID,
      name: Scratch.translate(definitions.extensionName),
      docsURI: DOCS_URI,
      blocks: definitions.blocks.filter((block) => !block.featureFlag || this.featureFlags[block.featureFlag]).map((block) => ({
        opcode: block.opcode,
        blockType: Scratch.BlockType[block.blockType],
        text: Scratch.translate(block.text),
        ...block.disableMonitor ? { disableMonitor: true } : {},
        ...block.arguments ? {
          arguments: Object.fromEntries(Object.entries(block.arguments).map(([name, argument]) => [
            name,
            {
              type: Scratch.ArgumentType[argument.type],
              defaultValue: argument.defaultValue,
              ...argument.menu ? { menu: argument.menu } : {}
            }
          ]))
        } : {}
      })),
      menus: {
        positionMenu: {
          acceptReporters: true,
          items: POSITION_ITEMS.map((item) => ({ text: Scratch.translate(item.text), value: item.value }))
        },
        previewMirroringMenu: {
          acceptReporters: true,
          items: PREVIEW_MIRRORING_ITEMS.map((item) => ({ text: Scratch.translate(item.text), value: item.value }))
        },
        cameraMenu: {
          acceptReporters: true,
          items: "getCameraMenuItems"
        }
      }
    };
  }
  versionReporter() {
    return VERSION;
  }
  setLastError(error) {
    this.lastError = String(error?.message ?? error);
  }
  setModelURL(args) {
    this.modelURL = String(args.URL || "").trim();
    if (this.modelURL && !this.modelURL.endsWith("/")) this.modelURL += "/";
    this.model = null;
    this.modelLoadMs = 0;
    this.firstPredictMs = 0;
  }
  async ensureLibrariesLoaded() {
    if (this.tmPoseRuntime) return;
    if (!this.allowRemoteLibraries) {
      throw new Error("TMPose: A preloaded Teachable Machine Pose runtime is required.");
    }
    if (typeof globalThis.tf === "undefined") await loadScript(TFJS_URL);
    if (typeof globalThis.tmPose === "undefined") await loadScript(TMPOSE_URL);
    if (typeof globalThis.tmPose === "undefined") {
      throw new Error("TMPose: Teachable Machine Pose could not be loaded.");
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
    this.activeCameraDeviceId = "";
    this.activeCameraDeviceName = "";
    this.loopStarted = false;
    this.loopGeneration += 1;
  }
  async startCamera() {
    if (this.cameraRunning && this.webcam) {
      this.attachPreviewToStage();
      return;
    }
    try {
      this.lastError = "";
      const startedAt = performance.now();
      await this.ensureLibrariesLoaded();
      this.webcam = new this.tmPoseRuntime.Webcam(320, 240, true);
      const constraints = cameraConstraints(this.cameraSelection);
      if (constraints) await this.webcam.setup(constraints);
      else await this.webcam.setup();
      await this.webcam.play();
      this.attachPreviewToStage();
      this.cameraRunning = true;
      try {
        await this.refreshCameraDevices();
      } catch {
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
      this.currentPoseName = "";
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
  getCameraMenuItems() {
    const fixedItems = CAMERA_SELECTION_ITEMS.map((item) => ({
      text: Scratch.translate(item.text),
      value: item.value
    }));
    const seen = /* @__PURE__ */ new Set();
    const deviceItems = [];
    this.cameraDevices.forEach((device, index) => {
      if (!device.deviceId || seen.has(device.deviceId)) return;
      seen.add(device.deviceId);
      deviceItems.push({
        text: device.label || `${Scratch.translate("camera")} ${index + 1}`,
        value: device.deviceId
      });
    });
    return [...fixedItems, ...deviceItems];
  }
  async refreshCameraDevices() {
    const mediaDevices = typeof navigator === "undefined" ? void 0 : navigator.mediaDevices;
    if (!mediaDevices || typeof mediaDevices.enumerateDevices !== "function") {
      throw new Error("TMPose: Camera enumeration is not available in this browser.");
    }
    const devices = await mediaDevices.enumerateDevices();
    this.cameraDevices = devices.filter((device) => device.kind === "videoinput").map((device) => ({ deviceId: device.deviceId, label: device.label }));
    return this.cameraDevices;
  }
  async refreshCameraList() {
    try {
      this.lastError = "";
      await this.refreshCameraDevices();
      if (this.cameraRunning) this.updateActiveCameraInfo();
    } catch (error) {
      this.setLastError(error);
      throw error;
    }
  }
  setCameraSelection(args) {
    const selection = normalizeCameraSelection(args.CAMERA);
    const operation = this.cameraSelectionQueue.then(() => this.applyCameraSelection(selection));
    this.cameraSelectionQueue = operation.catch(() => void 0);
    return operation;
  }
  async applyCameraSelection(selection) {
    const previousSelection = this.cameraSelection;
    const wasRunning = this.cameraRunning;
    this.cameraSelection = selection;
    if (!wasRunning) return;
    this.cleanupCameraResources();
    try {
      await this.startCamera();
    } catch (switchError) {
      this.cameraSelection = previousSelection;
      try {
        await this.startCamera();
      } catch (rollbackError) {
        const error = new AggregateError(
          [switchError, rollbackError],
          "TMPose: Camera switch and rollback both failed."
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
    const videoTrack = stream?.getVideoTracks?.()[0] ?? stream?.getTracks?.().find((track) => track.kind === "video" || track.kind === void 0);
    const settings = videoTrack?.getSettings?.() ?? {};
    const selectedDeviceId = ["default", "front", "back"].includes(this.cameraSelection) ? "" : this.cameraSelection;
    this.activeCameraDeviceId = String(settings.deviceId || selectedDeviceId);
    const device = this.cameraDevices.find((candidate) => candidate.deviceId === this.activeCameraDeviceId);
    this.activeCameraDeviceName = String(videoTrack?.label || device?.label || "");
  }
  cameraCountReporter() {
    return this.cameraDevices.length;
  }
  cameraDeviceIdReporter() {
    return this.activeCameraDeviceId;
  }
  cameraDeviceNameReporter() {
    return this.activeCameraDeviceName;
  }
  showPreview() {
    try {
      this.previewVisible = true;
      if (!this.webcam?.canvas) throw new Error("TMPose: Start the camera before showing the preview.");
      this.attachPreviewToStage();
      this.previewCanvas.style.display = "block";
      this.validatePreviewAttachment(this.previewStageElement, this.previewCanvas);
    } catch (error) {
      this.setLastError(error);
      throw error;
    }
  }
  hidePreview() {
    this.previewVisible = false;
    if (this.previewCanvas) this.previewCanvas.style.display = "none";
  }
  isPreviewVisible() {
    return this.previewVisible;
  }
  setPreviewOpacity(args) {
    let opacity = args.OPACITY === "" ? 0.6 : Number(args.OPACITY);
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
    return this.previewMirrored ? "mirrored" : "unmirrored";
  }
  async loadModel() {
    if (this.model) return;
    if (!this.modelURL) throw new Error("TMPose: Set the model URL first.");
    try {
      this.lastError = "";
      const startedAt = performance.now();
      await this.ensureLibrariesLoaded();
      if (typeof this.tmPoseRuntime.load !== "function") {
        throw new Error("TMPose: The Teachable Machine Pose URL loader is not available.");
      }
      this.model = await this.tmPoseRuntime.load(
        this.modelURL + "model.json",
        this.modelURL + "metadata.json"
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
  usePreparedModel(model) {
    if (!model || typeof model !== "object") {
      throw new TypeError("TMPose: Prepared model must be an object.");
    }
    if (this.predicting && this.model !== model) {
      throw new Error("TMPose: Stop recognition before changing the active model.");
    }
    this.model = model;
    this.modelURL = "";
    this.modelLoadMs = 0;
    this.firstPredictMs = 0;
  }
  clearPreparedModel(model) {
    if (model !== void 0 && this.model !== model) return;
    this.stopPredict();
    this.model = null;
    this.modelURL = "";
    this.modelLoadMs = 0;
    this.firstPredictMs = 0;
  }
  async startPredict() {
    try {
      this.lastError = "";
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
    this.currentPoseName = "";
    this.score = 0;
    this.predictions = {};
    this.resetAccumulatedPose("stop");
  }
  isPredicting() {
    return this.predicting;
  }
  findStageElement() {
    const editorStage = document.querySelector(".stage_stage-wrapper_2bejr") || document.querySelector('[class*="stage_stage-wrapper"]') || document.querySelector('[class*="stage-wrapper"]') || document.querySelector('[class*="stage-wrapper_stage-wrapper"]');
    if (editorStage) return editorStage;
    const stageCanvas = this.findLikelyStageCanvas();
    if (stageCanvas.parentElement) return stageCanvas.parentElement;
    throw new Error("TMPose: TurboWarp stage element was not found.");
  }
  findLikelyStageCanvas() {
    const webcamCanvas = this.webcam?.canvas ?? null;
    const allCanvases = Array.from(document.querySelectorAll("canvas")).filter((canvas) => canvas !== webcamCanvas && canvas !== this.previewCanvas);
    const visibleCandidates = allCanvases.map((canvas) => {
      const rect = canvas.getBoundingClientRect();
      const style = window.getComputedStyle(canvas);
      return { canvas, rect, style, score: canvasScore(rect.width, rect.height) };
    }).filter((item) => item.rect.width >= 200 && item.rect.height >= 150).filter((item) => item.style.display !== "none").filter((item) => item.style.visibility !== "hidden").filter((item) => Number(item.style.opacity || 1) !== 0).sort((left, right) => right.score - left.score);
    if (visibleCandidates[0]) return visibleCandidates[0].canvas;
    const fallbackCandidates = allCanvases.map((canvas) => ({ canvas, score: canvasScore(canvas.width, canvas.height) })).filter((item) => item.canvas.width >= 200 && item.canvas.height >= 150).sort((left, right) => right.score - left.score);
    if (fallbackCandidates[0]) return fallbackCandidates[0].canvas;
    throw new Error("TMPose: No likely stage canvas was found. The editor or packager DOM may be unsupported.");
  }
  validatePreviewAttachment(stage, canvas) {
    if (!stage || !canvas || canvas.parentElement !== stage) {
      throw new Error("TMPose: Preview canvas was not attached to the stage.");
    }
    const canvasStyle = window.getComputedStyle(canvas);
    if (canvasStyle.display === "none" && this.previewVisible) {
      throw new Error("TMPose: Preview canvas is hidden by display:none.");
    }
    if (canvasStyle.visibility === "hidden" && this.previewVisible) {
      throw new Error("TMPose: Preview canvas is hidden by visibility:hidden.");
    }
    const stageRect = stage.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    const documentHidden = typeof document.visibilityState === "string" && document.visibilityState === "hidden";
    const layoutUnavailable = stageRect.width === 0 || stageRect.height === 0;
    if (!documentHidden && !layoutUnavailable && this.previewVisible) {
      if (canvasRect.width <= 0 || canvasRect.height <= 0) {
        throw new Error("TMPose: Preview canvas was attached but has zero size.");
      }
      if (!rectanglesIntersect(stageRect, canvasRect)) {
        throw new Error("TMPose: Preview canvas does not intersect the stage.");
      }
    }
  }
  attachPreviewToStage() {
    if (!this.webcam) throw new Error("TMPose: Start the camera before attaching the preview.");
    if (!this.webcam.canvas) throw new Error("TMPose: webcam.canvas is unavailable.");
    const stage = this.findStageElement();
    const canvas = this.webcam.canvas;
    this.previewCanvas = canvas;
    this.previewStageElement = stage;
    const computed = window.getComputedStyle(stage);
    if (computed.position === "static") stage.style.position = "relative";
    stage.style.overflow = "hidden";
    Object.assign(canvas.style, {
      position: "absolute",
      zIndex: "999",
      pointerEvents: "none",
      border: "2px solid rgba(255, 255, 255, 0.7)",
      borderRadius: "8px",
      background: "#000",
      opacity: String(this.previewOpacity),
      display: this.previewVisible ? "block" : "none",
      boxSizing: "border-box"
    });
    if (canvas.parentNode !== stage) stage.appendChild(canvas);
    this.updatePreviewStyle();
    this.validatePreviewAttachment(stage, canvas);
  }
  updatePreviewStyle() {
    const canvas = this.previewCanvas;
    if (!canvas) throw new Error("TMPose: Start the camera before positioning the preview.");
    Object.assign(canvas.style, {
      left: "",
      right: "",
      top: "",
      bottom: "",
      transform: "",
      objectFit: "",
      width: "35%",
      height: "auto",
      borderRadius: "8px"
    });
    let positionTransform = "";
    switch (this.previewPosition) {
      case "top-left":
        canvas.style.left = "8px";
        canvas.style.top = "8px";
        break;
      case "top-right":
        canvas.style.right = "8px";
        canvas.style.top = "8px";
        break;
      case "bottom-left":
        canvas.style.left = "8px";
        canvas.style.bottom = "8px";
        break;
      case "center":
        canvas.style.left = "50%";
        canvas.style.top = "50%";
        positionTransform = "translate(-50%, -50%)";
        break;
      case "full-stage":
        canvas.style.left = "0";
        canvas.style.top = "0";
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        canvas.style.objectFit = "cover";
        canvas.style.borderRadius = "0";
        break;
      default:
        canvas.style.right = "8px";
        canvas.style.bottom = "8px";
    }
    const mirroringTransform = this.previewMirrored ? "" : "scaleX(-1)";
    canvas.style.transform = [positionTransform, mirroringTransform].filter(Boolean).join(" ");
  }
  startLoopIfNeeded() {
    if (this.loopStarted || !this.cameraRunning || !this.webcam) return;
    this.loopStarted = true;
    const generation = ++this.loopGeneration;
    void this.loop(generation);
  }
  trackPreparedModelOperation(model, operation) {
    let active = this.activeModelOperations.get(model);
    if (!active) {
      active = /* @__PURE__ */ new Set();
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
  async waitForPreparedModelIdle(model) {
    await Promise.allSettled([...this.activeModelOperations.get(model) ?? []]);
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
        if (generation !== this.loopGeneration || !this.cameraRunning || !this.predicting || this.model !== model) {
        } else {
          if (first) this.firstPredictMs = Math.round(performance.now() - startedAt);
          let best = { className: "", probability: 0 };
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
  currentPoseReporter() {
    return this.currentPoseName;
  }
  scoreReporter() {
    return Math.round(this.score * 100) / 100;
  }
  poseScoreReporter(args) {
    const value = this.predictions[String(args.NAME || "")] || 0;
    return Math.round(value * 100) / 100;
  }
  setAccumulatedPoseParameters(args) {
    const accumulation = args.ACCUMULATION === "" ? 1 : Number(args.ACCUMULATION);
    const decay = args.DECAY === "" ? 0.9 : Number(args.DECAY);
    this.accumulationCoefficient = Number.isFinite(accumulation) ? Math.max(0, accumulation) : 1;
    this.decayCoefficient = Number.isFinite(decay) ? Math.max(0, Math.min(1, decay)) : 0.9;
  }
  setAccumulatedPoseThreshold(args) {
    const threshold = args.THRESHOLD === "" ? 0 : Number(args.THRESHOLD);
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
  emitAccumulatedPoseChanged(previousPoseName, reason) {
    if (!this.supportsAccumulatedPoseEvents() || previousPoseName === this.accumulatedPoseName) return;
    const payload = {
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
      }
    } else if (typeof Scratch !== "undefined") {
      Scratch.vm?.runtime?.emit(ACCUMULATED_POSE_CHANGED_EVENT, payload);
    }
  }
  dispose() {
    this.stopCamera();
    if (this.featureFlags.temporalPoseScoring && typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", this.visibilityChangeListener);
    }
    this.onAccumulatedPoseChanged = null;
  }
  resetAccumulatedPose(reason = "reset") {
    const previousPoseName = this.accumulatedPoseName;
    this.accumulatedPoseName = "";
    this.accumulatedScore = 0;
    this.accumulatedPredictions = {};
    this.lastAccumulationTime = this.predicting ? performance.now() : null;
    this.emitAccumulatedPoseChanged(previousPoseName, reason);
  }
  handleDocumentVisibilityChange() {
    if (typeof document === "undefined") return;
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
    const elapsedSeconds = this.lastAccumulationTime === null ? 0 : Math.max(0, (now - this.lastAccumulationTime) / 1e3);
    const decayMultiplier = elapsedSeconds === 0 ? 1 : Math.pow(this.activeDecayCoefficient, elapsedSeconds);
    for (const name of Object.keys(this.accumulatedPredictions)) {
      this.accumulatedPredictions[name] *= decayMultiplier;
    }
    for (const result of prediction) {
      const name = String(result.className || "");
      const probability = Number(result.probability);
      if (!name || !Number.isFinite(probability)) continue;
      const contribution = Math.max(0, Math.min(1, probability)) * this.accumulationCoefficient * elapsedSeconds;
      this.accumulatedPredictions[name] = (this.accumulatedPredictions[name] || 0) + contribution;
    }
    this.lastAccumulationTime = now;
    this.updateAccumulatedPoseSelection();
  }
  updateAccumulatedPoseSelection() {
    const previousPoseName = this.accumulatedPoseName;
    this.accumulatedPoseName = "";
    this.accumulatedScore = 0;
    let bestPoseName = "";
    for (const [name, value] of Object.entries(this.accumulatedPredictions)) {
      if (value > this.accumulatedScore) {
        bestPoseName = name;
        this.accumulatedScore = value;
      }
    }
    if (bestPoseName && this.accumulatedScore >= this.accumulatedPoseThreshold) {
      this.accumulatedPoseName = bestPoseName;
    }
    this.emitAccumulatedPoseChanged(previousPoseName, "prediction");
  }
  accumulatedPoseReporter() {
    return this.accumulatedPoseName;
  }
  accumulatedScoreReporter() {
    return this.accumulatedScore;
  }
  accumulatedPoseScoreReporter(args) {
    const value = this.accumulatedPredictions[String(args.NAME || "")] || 0;
    return value;
  }
  isPose(args) {
    return (this.predictions[String(args.NAME || "")] || 0) >= 0.75;
  }
  isPoseWithThreshold(args) {
    const name = String(args.NAME || "");
    let threshold = args.THRESHOLD === "" ? 0.75 : Number(args.THRESHOLD);
    if (Number.isNaN(threshold)) threshold = 0.75;
    threshold = Math.max(0, Math.min(1, threshold));
    return (this.predictions[name] || 0) >= threshold;
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
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function compositionError(code, message) {
  const error = new Error(message);
  Object.defineProperty(error, "code", { value: code });
  return error;
}
function abortError(name) {
  const error = new Error(`TMPose model registration was cancelled: ${name}`);
  error.name = "AbortError";
  return error;
}
function aggregateCompositionError(code, message, errors) {
  const error = new AggregateError(errors, message);
  Object.defineProperty(error, "code", { value: code });
  return error;
}
function disposableResource(value) {
  return isRecord(value) && typeof value.dispose === "function" ? value : null;
}
function hasOfficialResourceShape(model) {
  return Object.hasOwn(model, "model") || Object.hasOwn(model, "posenetModel");
}
function hasCompleteDisposalContract(model) {
  if (!hasOfficialResourceShape(model)) return disposableResource(model) !== null;
  const classifier = disposableResource(model.model);
  const poseNet = disposableResource(model.posenetModel);
  return classifier !== null && poseNet !== null && classifier !== poseNet;
}
function requireName(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw compositionError("TMPOSE-COMPOSITION-001", "Pose model name must be a non-empty string.");
  }
  return value.trim();
}
function copyBytes(value, path) {
  let bytes;
  if (value instanceof ArrayBuffer) bytes = new Uint8Array(value);
  else if (value instanceof Uint8Array) bytes = value;
  else {
    throw compositionError(
      "TMPOSE-COMPOSITION-002",
      `Pose model file ${path} must provide an ArrayBuffer or Uint8Array.`
    );
  }
  if (bytes.byteLength === 0) {
    throw compositionError("TMPOSE-COMPOSITION-002", `Pose model file ${path} is empty.`);
  }
  return Uint8Array.from(bytes);
}
function labelsFor(model) {
  const labels = model.getClassLabels?.();
  if (labels === void 0) return Object.freeze([]);
  if (!Array.isArray(labels) || labels.some((label) => typeof label !== "string")) {
    throw compositionError("TMPOSE-COMPOSITION-004", "Loaded pose model returned invalid labels.");
  }
  return Object.freeze([...labels]);
}
function defaultCreateFile(bytes, name, mimeType) {
  if (typeof File !== "function") {
    throw compositionError("TMPOSE-COMPOSITION-003", "The browser File API is not available.");
  }
  return new File([bytes], name, { type: mimeType });
}
function validateRuntime(value) {
  if (!isRecord(value) || typeof value.loadFromFiles !== "function" || typeof value.Webcam !== "function") {
    throw new TypeError("TMPose composition runtime must provide loadFromFiles and Webcam.");
  }
  return value;
}
function validateAccumulatedPoseConfiguration(value) {
  if (!isRecord(value) || Object.keys(value).length !== 3 || !Object.hasOwn(value, "accumulationPerSecond") || !Object.hasOwn(value, "decayPerSecond") || !Object.hasOwn(value, "scoreThreshold")) {
    throw compositionError(
      "TMPOSE-COMPOSITION-008",
      "Accumulated pose configuration must provide accumulationPerSecond, decayPerSecond, and scoreThreshold."
    );
  }
  const accumulationPerSecond = value.accumulationPerSecond;
  const decayPerSecond = value.decayPerSecond;
  const scoreThreshold = value.scoreThreshold;
  if (typeof accumulationPerSecond !== "number" || !Number.isFinite(accumulationPerSecond) || accumulationPerSecond < 0 || typeof decayPerSecond !== "number" || !Number.isFinite(decayPerSecond) || decayPerSecond < 0 || decayPerSecond > 1 || typeof scoreThreshold !== "number" || !Number.isFinite(scoreThreshold) || scoreThreshold < 0) {
    throw compositionError(
      "TMPOSE-COMPOSITION-008",
      "Accumulated pose configuration values are out of range."
    );
  }
  return { accumulationPerSecond, decayPerSecond, scoreThreshold };
}
function validatePreviewMirroring(value) {
  if (value !== "mirrored" && value !== "unmirrored") {
    throw compositionError(
      "TMPOSE-COMPOSITION-010",
      "Preview mirroring must be either mirrored or unmirrored."
    );
  }
  return value;
}
function validateFiles(input, createFile) {
  if (!Array.isArray(input.files) || input.files.length !== 3) {
    throw compositionError(
      "TMPOSE-COMPOSITION-002",
      "A pose model must contain model.json, metadata.json, and exactly one weights .bin file."
    );
  }
  const files = /* @__PURE__ */ new Map();
  for (const candidate of input.files) {
    if (!isRecord(candidate) || typeof candidate.path !== "string" || candidate.path.length === 0) {
      throw compositionError("TMPOSE-COMPOSITION-002", "Pose model file path is invalid.");
    }
    const path = candidate.path;
    if (path.includes("/") || path.includes("\\") || files.has(path)) {
      throw compositionError(
        "TMPOSE-COMPOSITION-002",
        `Pose model file path must be a unique root filename: ${path}`
      );
    }
    const validName = path === "model.json" || path === "metadata.json" || path.endsWith(".bin");
    if (!validName) {
      throw compositionError("TMPOSE-COMPOSITION-002", `Unsupported pose model file: ${path}`);
    }
    const mimeType = path.endsWith(".json") ? "application/json" : "application/octet-stream";
    const file = createFile(copyBytes(candidate.bytes, path), path, mimeType);
    if (!isRecord(file) || file.name !== path) {
      throw compositionError("TMPOSE-COMPOSITION-003", `File factory returned an invalid ${path}.`);
    }
    files.set(path, file);
  }
  const model = files.get("model.json");
  const metadata = files.get("metadata.json");
  const weights = [...files.entries()].filter(([path]) => path.endsWith(".bin"));
  if (!model || !metadata || weights.length !== 1) {
    throw compositionError(
      "TMPOSE-COMPOSITION-002",
      "A pose model must contain model.json, metadata.json, and exactly one weights .bin file."
    );
  }
  return { model, weights: weights[0][1], metadata };
}
function createTMPoseComposition(options) {
  if (!isRecord(options)) throw new TypeError("TMPose composition options must be an object.");
  const runtime = validateRuntime(options.runtime);
  const createFile = options.createFile ?? defaultCreateFile;
  if (typeof createFile !== "function") throw new TypeError("createFile must be a function.");
  const accumulatedPoseListeners = /* @__PURE__ */ new Set();
  const extension = new TMPoseExtension(
    { temporalPoseScoring: true, accumulatedPoseEvents: true },
    {
      runtime,
      allowRemoteLibraries: false,
      onAccumulatedPoseChanged(event) {
        const immutableEvent = Object.freeze({ ...event });
        for (const listener of [...accumulatedPoseListeners]) {
          try {
            listener(immutableEvent);
          } catch {
          }
        }
      }
    }
  );
  const models = /* @__PURE__ */ new Map();
  const versions = /* @__PURE__ */ new Map();
  const pendingRegistrations = /* @__PURE__ */ new Map();
  const modelDisposals = /* @__PURE__ */ new WeakMap();
  const activeModelDisposals = /* @__PURE__ */ new Set();
  const resourceDisposals = /* @__PURE__ */ new WeakMap();
  let activeName = null;
  let released = false;
  let releasePromise = null;
  function ensureActive() {
    if (released) {
      throw compositionError("TMPOSE-COMPOSITION-007", "TMPose composition has been released.");
    }
  }
  function nextVersion(name) {
    const version = (versions.get(name) ?? 0) + 1;
    versions.set(name, version);
    return version;
  }
  function trackRegistration(name, operation) {
    let pending = pendingRegistrations.get(name);
    if (!pending) {
      pending = /* @__PURE__ */ new Set();
      pendingRegistrations.set(name, pending);
    }
    pending.add(operation);
    void operation.then(
      () => {
        pending.delete(operation);
        if (pending.size === 0) pendingRegistrations.delete(name);
      },
      () => {
        pending.delete(operation);
        if (pending.size === 0) pendingRegistrations.delete(name);
      }
    );
    return operation;
  }
  async function waitForRegistrations(operations, errors) {
    const results = await Promise.allSettled(operations);
    for (const result of results) {
      if (result.status === "rejected" && result.reason?.name !== "AbortError") {
        errors.push(result.reason);
      }
    }
  }
  async function waitForModelDisposals(operations, errors) {
    const results = await Promise.allSettled(operations);
    for (const result of results) {
      if (result.status === "rejected") errors.push(result.reason);
    }
  }
  async function disposeResource(resource) {
    const existing = resourceDisposals.get(resource);
    if (existing) return existing;
    const operation = Promise.resolve().then(() => resource.dispose());
    resourceDisposals.set(resource, operation);
    return operation;
  }
  function disposeModel(model) {
    const existing = modelDisposals.get(model);
    if (existing) return existing;
    const operation = Promise.resolve().then(async () => {
      await extension.waitForPreparedModelIdle(model);
      const errors = [];
      let resources;
      if (hasOfficialResourceShape(model)) {
        const classifier = disposableResource(model.model);
        const poseNet = disposableResource(model.posenetModel);
        resources = [classifier, poseNet].filter(
          (resource) => resource !== null
        );
        if (!classifier || !poseNet || classifier === poseNet) {
          errors.push(
            compositionError(
              "TMPOSE-COMPOSITION-009",
              "Loaded pose model does not expose distinct disposable classifier and PoseNet resources."
            )
          );
        }
      } else {
        const legacy = disposableResource(model);
        resources = legacy ? [legacy] : [];
        if (!legacy) {
          errors.push(
            compositionError(
              "TMPOSE-COMPOSITION-009",
              "Loaded pose model does not expose a complete disposal contract."
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
          "TMPOSE-COMPOSITION-009",
          "TMPose could not completely dispose a loaded pose model.",
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
  function stopActiveModel(model) {
    const errors = [];
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
  const composition = {
    registerPoseModel(input) {
      let name;
      let files;
      let version;
      try {
        ensureActive();
        if (!isRecord(input)) {
          throw compositionError("TMPOSE-COMPOSITION-001", "Pose model input must be an object.");
        }
        name = requireName(input.name);
        files = validateFiles(input, createFile);
        if (activeName === name && extension.isPredicting()) {
          throw compositionError(
            "TMPOSE-COMPOSITION-005",
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
          throw compositionError("TMPOSE-COMPOSITION-004", `TMPose failed to load model ${name}.`);
        }
        const model = loaded;
        if (!hasCompleteDisposalContract(model)) {
          await disposeModel(model);
        }
        if (versions.get(name) !== version) {
          await disposeModel(model);
          throw abortError(name);
        }
        let registration;
        try {
          registration = Object.freeze({ name, labels: labelsFor(model) });
          if (activeName === name) extension.usePreparedModel(model);
        } catch (error) {
          await disposeModel(model);
          throw error;
        }
        const previous = models.get(name);
        models.set(name, { model, registration });
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
          "TMPOSE-COMPOSITION-006",
          `Pose model is not registered: ${normalizedName}`
        );
      }
      if (extension.isPredicting() && activeName !== normalizedName) {
        throw compositionError(
          "TMPOSE-COMPOSITION-005",
          "Stop recognition before changing the active pose model."
        );
      }
      extension.usePreparedModel(entry.model);
      activeName = normalizedName;
    },
    async releasePoseModel(name) {
      ensureActive();
      const normalizedName = requireName(name);
      nextVersion(normalizedName);
      const pending = [...pendingRegistrations.get(normalizedName) ?? []];
      const entry = models.get(normalizedName);
      const errors = [];
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
        for (const name of versions.keys()) nextVersion(name);
        const startedDisposals = [...activeModelDisposals];
        const pending = [...pendingRegistrations.values()].flatMap((operations) => [
          ...operations
        ]);
        const entries = [...models.values()].reverse();
        const activeEntry = activeName ? models.get(activeName) : null;
        models.clear();
        const errors = [];
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
        await waitForRegistrations(pending, errors);
        await waitForModelDisposals(startedDisposals, errors);
        try {
          extension.dispose();
        } catch (error) {
          errors.push(error);
        }
        if (errors.length > 0) {
          throw new AggregateError(errors, "Failed to release all pose models.");
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
    setPreviewMirroring(mode) {
      ensureActive();
      extension.setPreviewMirroring({ MIRRORING: validatePreviewMirroring(mode) });
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
        throw compositionError("TMPOSE-COMPOSITION-006", "Activate a pose model first.");
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
      return Number(extension.poseScoreReporter({ NAME: requireName(name) }));
    },
    configureAccumulatedPose(input) {
      ensureActive();
      const configuration = validateAccumulatedPoseConfiguration(input);
      extension.setAccumulatedPoseParameters({
        ACCUMULATION: configuration.accumulationPerSecond,
        DECAY: configuration.decayPerSecond
      });
      extension.setAccumulatedPoseThreshold({ THRESHOLD: configuration.scoreThreshold });
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
      return Number(extension.accumulatedPoseScoreReporter({ NAME: requireName(name) }));
    },
    subscribeAccumulatedPose(listener) {
      ensureActive();
      if (typeof listener !== "function") {
        throw compositionError(
          "TMPOSE-COMPOSITION-008",
          "Accumulated pose listener must be a function."
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
export {
  createTMPoseComposition
};
