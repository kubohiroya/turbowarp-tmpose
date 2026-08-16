import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
  BLOCK_ICON_URI,
  BROWSER_RUNTIME_URL,
  DOCS_URI,
  initializeCameraReadbackContext,
  TMPoseExtension,
  VERSION
} from '../src/extension.js';
import packageMetadata from '../package.json' with {type: 'json'};

const visibleRect = {left: 0, top: 0, right: 480, bottom: 360, width: 480, height: 360};

function createElement(tagName = 'DIV', rect = visibleRect) {
  const attributes: Record<string, string> = {};
  const children: any[] = [];
  const element: any = {
    tagName,
    style: {},
    dataset: {},
    attributes,
    children,
    parentElement: null,
    parentNode: null,
    width: tagName === 'CANVAS' ? 480 : undefined,
    height: tagName === 'CANVAS' ? 360 : undefined,
    getContext: tagName === 'CANVAS' ? vi.fn(() => ({})) : undefined,
    getBoundingClientRect: vi.fn(() => rect),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    setAttribute(name: string, value: unknown) {
      attributes[name] = String(value);
    },
    getAttribute(name: string) {
      return attributes[name] ?? null;
    },
    appendChild(child: any) {
      if (!children.includes(child)) children.push(child);
      child.parentElement = element;
      child.parentNode = element;
      return child;
    },
    removeChild(child: any) {
      const index = children.indexOf(child);
      if (index >= 0) children.splice(index, 1);
      child.parentElement = null;
      child.parentNode = null;
      return child;
    }
  };
  return element;
}

let querySelector: ReturnType<typeof vi.fn>;
let querySelectorAll: ReturnType<typeof vi.fn>;
let enumerateDevices: ReturnType<typeof vi.fn>;
let scripts: any[];

beforeEach(() => {
  scripts = [];
  querySelector = vi.fn(() => null);
  querySelectorAll = vi.fn(() => []);
  enumerateDevices = vi.fn(async () => []);

  vi.stubGlobal('document', {
    scripts,
    visibilityState: 'visible',
    createElement: vi.fn((tag: string) => createElement(tag.toUpperCase())),
    createElementNS: vi.fn((_namespace: string, tag: string) => createElement(tag.toUpperCase())),
    head: {appendChild: vi.fn((script: any) => scripts.push(script))},
    addEventListener: vi.fn(),
    querySelector,
    querySelectorAll
  });
  vi.stubGlobal('window', {
    getComputedStyle: vi.fn((element: any) => ({
      position: element.style.position || 'static',
      display: element.style.display || 'block',
      visibility: element.style.visibility || 'visible',
      opacity: element.style.opacity || '1'
    }))
  });
  vi.stubGlobal('requestAnimationFrame', vi.fn());
  vi.stubGlobal('performance', {now: vi.fn(() => 100)});
  vi.stubGlobal('navigator', {mediaDevices: {enumerateDevices}});
  vi.stubGlobal('Scratch', {
    BlockType: {COMMAND: 'command', REPORTER: 'reporter', BOOLEAN: 'boolean', HAT: 'hat'},
    ArgumentType: {STRING: 'string', NUMBER: 'number', BOOLEAN: 'boolean'},
    translate: (value: string | {default: string}) => typeof value === 'string' ? value : value.default,
    extensions: {unsandboxed: true, register: vi.fn()}
  });
});

afterEach(() => vi.unstubAllGlobals());

describe('initializeCameraReadbackContext', () => {
  it('uses a normal 2D context for the TensorFlow CPU backend', () => {
    const canvas = createElement('CANVAS');

    initializeCameraReadbackContext(canvas, 'cpu');

    expect(canvas.getContext).toHaveBeenCalledWith('2d');
  });

  it('does not query the loaded TensorFlow runtime', () => {
    const canvas = createElement('CANVAS');
    const getBackend = vi.fn(() => 'cpu');
    vi.stubGlobal('tf', {getBackend});

    initializeCameraReadbackContext(canvas);

    expect(getBackend).not.toHaveBeenCalled();
    expect(canvas.getContext).toHaveBeenCalledWith('2d');
  });

  it.each(['webgl', null])('uses a normal 2D context for the %s backend', (backend) => {
    const canvas = createElement('CANVAS');

    initializeCameraReadbackContext(canvas, backend);

    expect(canvas.getContext).toHaveBeenCalledWith('2d');
  });

  it('ignores a backend query that would fail', () => {
    const canvas = createElement('CANVAS');
    const getBackend = vi.fn(() => { throw new Error('not ready'); });
    vi.stubGlobal('tf', {getBackend});

    initializeCameraReadbackContext(canvas);

    expect(getBackend).not.toHaveBeenCalled();
    expect(canvas.getContext).toHaveBeenCalledWith('2d');
  });
});

describe('TMPoseExtension', () => {
  it('exposes the expected extension ID and blocks', () => {
    const info = new TMPoseExtension().getInfo() as {
      id: string;
      docsURI: string;
      blockIconURI: string;
      blocks: Array<{opcode: string}>;
      menus: {cameraMenu: {items: string}};
    };
    expect(info.id).toBe('tmpose');
    expect(info.docsURI).toBe(DOCS_URI);
    expect(info.docsURI).toBe('https://kubohiroya.github.io/turbowarp-tmpose/');
    expect(info.blockIconURI).toBe(BLOCK_ICON_URI);
    const iconSvg = decodeURIComponent(BLOCK_ICON_URI.slice('data:image/svg+xml,'.length));
    expect(iconSvg).toContain('viewBox="0 0 64 64"');
    expect(iconSvg).toContain('<circle cx="32" cy="18" r="5"/>');
    expect(iconSvg).not.toContain('<rect');
    expect(new TMPoseExtension().versionReporter()).toBe(VERSION);
    expect(VERSION).toBe(`${packageMetadata.version}-typescript`);
    expect(info.blocks).toHaveLength(37);
    const opcodes = info.blocks.map((block) => block.opcode);
    expect(opcodes).toEqual(expect.arrayContaining([
      'startRecognition',
      'stopRecognition',
      'isRecognizing',
      'firstRecognitionMsReporter'
    ]));
    expect(opcodes).not.toEqual(expect.arrayContaining([
      'startPredict',
      'stopPredict',
      'isPredicting',
      'firstPredictMsReporter'
    ]));
    const extension = new TMPoseExtension() as Record<string, unknown>;
    expect(extension.startPredict).toBeUndefined();
    expect(extension.stopPredict).toBeUndefined();
    expect(extension.isPredicting).toBeUndefined();
    expect(extension.firstPredictMsReporter).toBeUndefined();
    expect(info.menus.cameraMenu.items).toBe('getCameraMenuItems');
  });

  it('exposes accumulated pose blocks only when the feature flag is enabled', () => {
    const info = new TMPoseExtension({
      temporalPoseScoring: true,
      poseOverlay: false
    }).getInfo() as {
      blocks: Array<{opcode: string}>;
    };
    expect(info.blocks).toHaveLength(37);
    expect(info.blocks.map((block) => block.opcode)).toEqual(expect.arrayContaining([
      'setAccumulatedPoseParameters',
      'setAccumulatedPoseThreshold',
      'resetAccumulatedPose',
      'accumulatedPoseReporter',
      'accumulatedScoreReporter',
      'accumulatedPoseScoreReporter'
    ]));
  });

  it('exposes pose overlay blocks by default and can disable them with the feature flag', () => {
    const disabled = new TMPoseExtension({poseOverlay: false}).getInfo() as {
      blocks: Array<{opcode: string}>;
    };
    const enabled = new TMPoseExtension().getInfo() as {
      blocks: Array<{opcode: string}>;
      menus: {
        poseKeypointMenu: {items: Array<{value: string}>};
        poseConfidencePropertyMenu: {items: Array<{value: string}>};
      };
    };

    expect(disabled.blocks).toHaveLength(31);
    expect(disabled.blocks.map((block) => block.opcode)).not.toContain('setPoseJointStyle');
    expect(enabled.blocks).toHaveLength(37);
    expect(enabled.blocks.map((block) => block.opcode)).toEqual(expect.arrayContaining([
      'setPoseOverlayVisibility',
      'isPoseOverlayVisible',
      'setPoseJointStyle',
      'setPoseBoneStyle',
      'setPoseOverlayMinimumConfidence',
      'setPoseConfidenceScaling'
    ]));
    expect(enabled.menus.poseKeypointMenu.items).toHaveLength(17);
    expect(enabled.menus.poseConfidencePropertyMenu.items.map(({value}) => value)).toEqual([
      'joint-opacity', 'joint-radius', 'bone-opacity', 'bone-width'
    ]);
  });

  it('reports accumulated pose event capability only when both feature flags are enabled', () => {
    expect(new TMPoseExtension().supportsAccumulatedPoseEvents()).toBe(false);
    expect(new TMPoseExtension({
      temporalPoseScoring: true
    }).supportsAccumulatedPoseEvents()).toBe(false);
    expect(new TMPoseExtension({
      temporalPoseScoring: true,
      accumulatedPoseEvents: true
    }).supportsAccumulatedPoseEvents()).toBe(true);
  });

  it('emits versioned events only when the accumulated pose name changes', () => {
    const emit = vi.fn();
    (Scratch as any).vm = {runtime: {emit}};
    const extension = new TMPoseExtension({
      temporalPoseScoring: true,
      accumulatedPoseEvents: true
    });
    extension.setAccumulatedPoseParameters({ACCUMULATION: 1, DECAY: 0});
    extension.startAccumulatedPoseSession(0);

    extension.updateAccumulatedPose([
      {className: 'jump', probability: 1},
      {className: 'stand', probability: 0}
    ], 1000);
    extension.updateAccumulatedPose([
      {className: 'jump', probability: 1},
      {className: 'stand', probability: 0}
    ], 2000);
    extension.updateAccumulatedPose([
      {className: 'jump', probability: 0},
      {className: 'stand', probability: 1}
    ], 3000);

    expect(emit).toHaveBeenCalledTimes(2);
    expect(emit).toHaveBeenNthCalledWith(1, 'TMPOSE_ACCUMULATED_POSE_CHANGED', {
      version: 2,
      poseName: 'jump',
      previousPoseName: '',
      score: 1,
      reason: 'recognition',
      timestamp: 100
    });
    expect(emit).toHaveBeenNthCalledWith(2, 'TMPOSE_ACCUMULATED_POSE_CHANGED', {
      version: 2,
      poseName: 'stand',
      previousPoseName: 'jump',
      score: 1,
      reason: 'recognition',
      timestamp: 100
    });
  });

  it('emits one empty transition for reset or stop and does not duplicate it', () => {
    const emit = vi.fn();
    (Scratch as any).vm = {runtime: {emit}};
    const extension = new TMPoseExtension({
      temporalPoseScoring: true,
      accumulatedPoseEvents: true
    });
    extension.setAccumulatedPoseParameters({ACCUMULATION: 1, DECAY: 1});
    extension.startAccumulatedPoseSession(0);
    extension.updateAccumulatedPose([{className: 'jump', probability: 1}], 1000);

    extension.resetAccumulatedPose();
    extension.stopRecognition();
    expect(emit).toHaveBeenLastCalledWith('TMPOSE_ACCUMULATED_POSE_CHANGED', {
      version: 2,
      poseName: '',
      previousPoseName: 'jump',
      score: 0,
      reason: 'reset',
      timestamp: 100
    });
    expect(emit).toHaveBeenCalledTimes(2);

    extension.startAccumulatedPoseSession(1000);
    extension.updateAccumulatedPose([{className: 'stand', probability: 1}], 2000);
    extension.stopCamera();
    expect(emit).toHaveBeenLastCalledWith('TMPOSE_ACCUMULATED_POSE_CHANGED', {
      version: 2,
      poseName: '',
      previousPoseName: 'stand',
      score: 0,
      reason: 'stop',
      timestamp: 100
    });
    expect(emit).toHaveBeenCalledTimes(4);
  });

  it('publishes its event capability on the TurboWarp runtime when registered', async () => {
    const runtime = {emit: vi.fn()};
    const register = vi.fn();
    (Scratch as any).vm = {runtime};
    (Scratch as any).extensions.register = register;

    await import('../src/index.js');

    const registeredExtension = register.mock.calls[0]?.[0];
    expect(runtime).toHaveProperty('ext_tmpose', registeredExtension);
    expect(typeof registeredExtension.supportsAccumulatedPoseEvents).toBe('function');
  });

  it('accumulates pose scores and decays previous values by elapsed time', () => {
    const extension = new TMPoseExtension({temporalPoseScoring: true});
    extension.setAccumulatedPoseParameters({ACCUMULATION: 2, DECAY: 0.5});
    extension.startAccumulatedPoseSession(0);

    extension.updateAccumulatedPose([
      {className: 'jump', probability: 0.8},
      {className: 'stand', probability: 0.2}
    ], 1000);
    expect(extension.accumulatedPoseReporter()).toBe('jump');
    expect(extension.accumulatedScoreReporter()).toBe(1.6);

    extension.updateAccumulatedPose([
      {className: 'jump', probability: 0.1},
      {className: 'stand', probability: 0.9}
    ], 2000);
    expect(extension.accumulatedPoseScoreReporter({NAME: 'jump'})).toBe(1);
    expect(extension.accumulatedPoseScoreReporter({NAME: 'stand'})).toBe(2);
    expect(extension.accumulatedPoseReporter()).toBe('stand');
    expect(extension.accumulatedScoreReporter()).toBe(2);
  });

  it('reports an accumulated pose only while its score meets the threshold', () => {
    const extension = new TMPoseExtension({temporalPoseScoring: true});
    extension.setAccumulatedPoseParameters({ACCUMULATION: 1, DECAY: 0.5});
    extension.setAccumulatedPoseThreshold({THRESHOLD: 0.75});
    extension.startAccumulatedPoseSession(0);

    extension.updateAccumulatedPose([{className: 'jump', probability: 1}], 1000);
    expect(extension.accumulatedPoseReporter()).toBe('jump');
    expect(extension.accumulatedScoreReporter()).toBe(1);

    extension.updateAccumulatedPose([{className: 'jump', probability: 0}], 2000);
    expect(extension.accumulatedPoseReporter()).toBe('');
    expect(extension.accumulatedScoreReporter()).toBe(0.5);

    extension.setAccumulatedPoseThreshold({THRESHOLD: 0.5});
    expect(extension.accumulatedPoseReporter()).toBe('jump');
    extension.setAccumulatedPoseThreshold({THRESHOLD: 0.51});
    expect(extension.accumulatedPoseReporter()).toBe('');

    extension.setAccumulatedPoseThreshold({THRESHOLD: -1});
    expect(extension.accumulatedPoseThreshold).toBe(0);
    expect(extension.accumulatedPoseReporter()).toBe('jump');
  });

  it('reports the unrounded accumulated score used by threshold selection', () => {
    const extension = new TMPoseExtension({temporalPoseScoring: true});
    extension.setAccumulatedPoseParameters({ACCUMULATION: 1, DECAY: 1});
    extension.setAccumulatedPoseThreshold({THRESHOLD: 0.5});
    extension.startAccumulatedPoseSession(0);

    extension.updateAccumulatedPose([{className: 'jump', probability: 0.499}], 1000);
    expect(extension.accumulatedScoreReporter()).toBe(0.499);
    expect(extension.accumulatedPoseScoreReporter({NAME: 'jump'})).toBe(0.499);
    expect(extension.accumulatedPoseReporter()).toBe('');
  });

  it('normalizes accumulation by elapsed time across prediction rates', () => {
    const lowFps = new TMPoseExtension({temporalPoseScoring: true});
    const highFps = new TMPoseExtension({temporalPoseScoring: true});
    for (const extension of [lowFps, highFps]) {
      extension.setAccumulatedPoseParameters({ACCUMULATION: 2, DECAY: 1});
      extension.startAccumulatedPoseSession(0);
    }

    for (let now = 500; now <= 1000; now += 500) {
      lowFps.updateAccumulatedPose([{className: 'jump', probability: 0.5}], now);
    }
    for (let now = 100; now <= 1000; now += 100) {
      highFps.updateAccumulatedPose([{className: 'jump', probability: 0.5}], now);
    }

    expect(lowFps.accumulatedPoseScoreReporter({NAME: 'jump'})).toBe(1);
    expect(highFps.accumulatedPoseScoreReporter({NAME: 'jump'})).toBeCloseTo(1, 12);
  });

  it('pauses accumulation and decay while the document is hidden', () => {
    const extension = new TMPoseExtension({temporalPoseScoring: true});
    extension.setAccumulatedPoseParameters({ACCUMULATION: 1, DECAY: 0.5});
    extension.startAccumulatedPoseSession(0);
    extension.recognizing = true;

    extension.updateAccumulatedPose([{className: 'jump', probability: 1}], 1000);
    expect(extension.accumulatedPoseScoreReporter({NAME: 'jump'})).toBe(1);

    (document as any).visibilityState = 'hidden';
    extension.handleDocumentVisibilityChange();
    extension.updateAccumulatedPose([{className: 'jump', probability: 1}], 61_000);
    expect(extension.accumulatedPoseScoreReporter({NAME: 'jump'})).toBe(1);

    vi.mocked(performance.now).mockReturnValue(61_000);
    (document as any).visibilityState = 'visible';
    extension.handleDocumentVisibilityChange();
    extension.updateAccumulatedPose([{className: 'jump', probability: 0}], 62_000);
    expect(extension.accumulatedPoseScoreReporter({NAME: 'jump'})).toBe(0.5);
  });

  it('supports accumulated scoring when document is unavailable', () => {
    vi.stubGlobal('document', undefined);
    const extension = new TMPoseExtension({temporalPoseScoring: true});
    extension.setAccumulatedPoseParameters({ACCUMULATION: 1, DECAY: 1});
    extension.startAccumulatedPoseSession(0);

    expect(() => extension.handleDocumentVisibilityChange()).not.toThrow();
    extension.updateAccumulatedPose([{className: 'jump', probability: 1}], 1000);
    expect(extension.accumulatedPoseScoreReporter({NAME: 'jump'})).toBe(1);
  });

  it('applies decay changes made during recognition to the next session', async () => {
    const extension = new TMPoseExtension({temporalPoseScoring: true});
    extension.cameraRunning = true;
    extension.model = {};
    extension.modelURL = 'https://example.com/model/';
    extension.setAccumulatedPoseParameters({ACCUMULATION: 1, DECAY: 0.5});

    await extension.startRecognition();
    expect(extension.activeDecayCoefficient).toBe(0.5);
    extension.setAccumulatedPoseParameters({ACCUMULATION: 1, DECAY: 0.1});
    expect(extension.decayCoefficient).toBe(0.1);
    expect(extension.activeDecayCoefficient).toBe(0.5);

    extension.stopRecognition();
    await extension.startRecognition();
    expect(extension.activeDecayCoefficient).toBe(0.1);
  });

  it('normalizes accumulated pose coefficients and resets temporal state', () => {
    const extension = new TMPoseExtension({temporalPoseScoring: true});
    extension.setAccumulatedPoseParameters({ACCUMULATION: -2, DECAY: 4});
    expect(extension.accumulationCoefficient).toBe(0);
    expect(extension.decayCoefficient).toBe(1);

    extension.updateAccumulatedPose([{className: 'jump', probability: 1}], 1000);
    extension.setAccumulatedPoseParameters({ACCUMULATION: 1, DECAY: 0.9});
    extension.startAccumulatedPoseSession(1000);
    extension.updateAccumulatedPose([{className: 'jump', probability: 1}], 2000);
    extension.stopRecognition();
    expect(extension.accumulatedPoseReporter()).toBe('');
    expect(extension.accumulatedScoreReporter()).toBe(0);
    expect(extension.accumulatedPoseScoreReporter({NAME: 'jump'})).toBe(0);
    expect(extension.lastAccumulationTime).toBeNull();
  });

  it('normalizes a model URL with a trailing slash', () => {
    const extension = new TMPoseExtension();
    extension.setModelURL({URL: 'https://example.com/model'});
    expect(extension.modelURL).toBe('https://example.com/model/');
  });

  it('finds the Desktop Editor stage wrapper directly', () => {
    const stage = createElement();
    querySelector.mockReturnValueOnce(stage);
    expect(new TMPoseExtension().findStageElement()).toBe(stage);
  });

  it('uses the renderer canvas mount instead of the outer Editor wrapper', () => {
    const outerStage = createElement();
    const innerStage = createElement();
    const stageCanvas = createElement('CANVAS', visibleRect);
    const monitorWrapper = createElement();
    innerStage.appendChild(stageCanvas);
    outerStage.appendChild(innerStage);
    outerStage.appendChild(monitorWrapper);
    querySelector.mockReturnValue(outerStage);
    querySelectorAll.mockReturnValue([stageCanvas]);

    expect(new TMPoseExtension().findStageElement()).toBe(innerStage);
  });

  it('finds a Packager stage canvas and prefers a 4:3 candidate', () => {
    const wide = createElement('CANVAS', {left: 0, top: 0, right: 800, bottom: 300, width: 800, height: 300});
    const stageCanvas = createElement('CANVAS', visibleRect);
    const stage = createElement();
    stage.appendChild(stageCanvas);
    querySelectorAll.mockReturnValue([wide, stageCanvas]);

    const extension = new TMPoseExtension();
    expect(extension.findLikelyStageCanvas()).toBe(stageCanvas);
    expect(extension.findStageElement()).toBe(stage);
  });

  it('throws an explicit error when no stage can be found', () => {
    expect(() => new TMPoseExtension().findStageElement()).toThrow(
      'TurboWarp stage element was not found'
    );
  });

  it('inserts the preview after the Stage canvas and behind Scratch overlays', () => {
    const stage = createElement();
    const stageCanvas = createElement('CANVAS');
    const renderOverlay = createElement();
    const previewCanvas = createElement('CANVAS');
    stage.appendChild(stageCanvas);
    stage.appendChild(renderOverlay);
    stageCanvas.nextSibling = renderOverlay;
    stage.insertBefore = vi.fn((child: any, before: any) => {
      expect(before).toBe(renderOverlay);
      child.parentElement = stage;
      child.parentNode = stage;
      return child;
    });
    querySelector.mockReturnValue(stage);
    querySelectorAll.mockReturnValue([stageCanvas]);

    const extension = new TMPoseExtension();
    extension.webcam = {canvas: previewCanvas} as never;
    extension.attachPreviewToStage();

    expect(stage.insertBefore).toHaveBeenCalledWith(previewCanvas, renderOverlay);
    expect(previewCanvas.style.zIndex).toBe('auto');
  });

  it('keeps the Editor monitor wrapper outside and after the preview mount', () => {
    const outerStage = createElement();
    const innerStage = createElement();
    const stageCanvas = createElement('CANVAS');
    const monitorWrapper = createElement();
    const previewCanvas = createElement('CANVAS');
    innerStage.appendChild(stageCanvas);
    outerStage.appendChild(innerStage);
    outerStage.appendChild(monitorWrapper);
    stageCanvas.nextSibling = null;
    innerStage.insertBefore = vi.fn((child: any, before: any) => {
      expect(before).toBeNull();
      child.parentElement = innerStage;
      child.parentNode = innerStage;
      return child;
    });
    querySelector.mockReturnValue(outerStage);
    querySelectorAll.mockReturnValue([stageCanvas]);

    const extension = new TMPoseExtension();
    extension.webcam = {canvas: previewCanvas} as never;
    extension.attachPreviewToStage();

    expect(innerStage.insertBefore).toHaveBeenCalledWith(previewCanvas, null);
    expect(previewCanvas.parentElement).toBe(innerStage);
    expect(monitorWrapper.parentElement).toBe(outerStage);
  });

  it('renders a configurable SVG pose overlay with confidence-scaled joints and bones', () => {
    const stage = createElement();
    const canvas = createElement('CANVAS');
    const extension = new TMPoseExtension({poseOverlay: true});
    extension.webcam = {canvas, webcam: {srcObject: null}};
    vi.spyOn(extension, 'findStageElement').mockReturnValue(stage);
    extension.attachPreviewToStage();

    const svg = extension.poseOverlaySvg;
    expect(stage.children).toEqual([canvas, svg]);
    expect(svg.getAttribute('viewBox')).toBe('0 0 320 240');
    expect(svg.children[0].getAttribute('data-layer')).toBe('bones');
    expect(svg.children[1].getAttribute('data-layer')).toBe('joints');
    expect(extension.poseOverlayJointElements.size).toBe(17);
    expect(extension.poseOverlayBoneElements).toHaveLength(12);

    extension.setPoseJointStyle({
      PART: 'leftShoulder', COLOR: '#ff0066', OPACITY: 0.6, RADIUS: 10
    });
    extension.setPoseBoneStyle({COLOR: 'lime', OPACITY: 0.8, WIDTH: 6});
    extension.setPoseOverlayMinimumConfidence({CONFIDENCE: 0.2});
    for (const property of ['joint-opacity', 'joint-radius', 'bone-opacity', 'bone-width']) {
      extension.setPoseConfidenceScaling({PROPERTY: property, STATE: 'on'});
    }
    extension.renderPoseOverlay([
      {part: 'leftShoulder', score: 0.5, position: {x: 100, y: 60}},
      {part: 'leftHip', score: 0.8, position: {x: 105, y: 130}},
      {part: 'nose', score: 0.1, position: {x: 160, y: 30}}
    ]);

    const shoulder = extension.poseOverlayJointElements.get('leftShoulder');
    expect(shoulder.style.display).toBe('block');
    expect(shoulder.getAttribute('cx')).toBe('100');
    expect(shoulder.getAttribute('cy')).toBe('60');
    expect(shoulder.getAttribute('fill')).toBe('#ff0066');
    expect(Number(shoulder.getAttribute('fill-opacity'))).toBeCloseTo(0.3);
    expect(Number(shoulder.getAttribute('r'))).toBeCloseTo(5);
    expect(extension.poseOverlayJointElements.get('nose').style.display).toBe('none');

    const hipShoulder = extension.poseOverlayBoneElements[0].line;
    expect(hipShoulder.style.display).toBe('block');
    expect(hipShoulder.getAttribute('stroke')).toBe('lime');
    expect(Number(hipShoulder.getAttribute('stroke-opacity'))).toBeCloseTo(0.4);
    expect(Number(hipShoulder.getAttribute('stroke-width'))).toBeCloseTo(3);

    for (const position of [
      'top-left', 'top-right', 'bottom-left', 'bottom-right', 'center', 'full-stage'
    ]) {
      extension.setPreviewPosition({POSITION: position});
      for (const property of [
        'left', 'right', 'top', 'bottom', 'width', 'height', 'transform', 'borderRadius', 'objectFit'
      ]) {
        expect(svg.style[property]).toBe(canvas.style[property]);
      }
      expect(svg.getAttribute('preserveAspectRatio')).toBe(
        position === 'full-stage' ? 'xMidYMid slice' : 'xMidYMid meet'
      );
    }

    extension.setPreviewMirroring({MIRRORING: 'unmirrored'});
    extension.setPreviewPosition({POSITION: 'full-stage'});
    expect(svg.style.transform).toBe('scaleX(-1)');
    expect(svg.style).toMatchObject({left: '0', top: '0', width: '100%', height: '100%'});
    expect(svg.getAttribute('preserveAspectRatio')).toBe('xMidYMid slice');

    extension.hidePoseOverlay();
    expect(svg.style.display).toBe('none');
    expect(canvas.style.display).toBe('block');
    extension.showPoseOverlay();
    expect(svg.style.display).toBe('block');
    extension.hidePreview();
    expect(svg.style.display).toBe('none');
    extension.showPreview();
    expect(svg.style.display).toBe('block');

    extension.stopRecognition();
    expect(shoulder.style.display).toBe('none');
    expect(hipShoulder.style.display).toBe('none');
    extension.cleanupCameraResources();
    expect(stage.children).toEqual([]);
    expect(extension.poseOverlaySvg).toBeNull();
  });

  it('routes estimated PoseNet keypoints into the SVG overlay during recognition', async () => {
    const stage = createElement();
    const canvas = createElement('CANVAS');
    const extension = new TMPoseExtension({poseOverlay: true});
    extension.webcam = {canvas, update: vi.fn()};
    extension.cameraRunning = true;
    extension.recognizing = true;
    extension.loopGeneration = 1;
    extension.model = {
      estimatePose: vi.fn(async () => ({
        pose: {
          keypoints: [
            {part: 'leftWrist', score: 0.9, position: {x: 42, y: 84}}
          ]
        },
        posenetOutput: new Float32Array([1])
      })),
      predict: vi.fn(async () => [{className: 'wave', probability: 0.95}])
    };
    vi.spyOn(extension, 'findStageElement').mockReturnValue(stage);
    extension.attachPreviewToStage();

    await extension.loop(1);

    const wrist = extension.poseOverlayJointElements.get('leftWrist');
    expect(wrist.style.display).toBe('block');
    expect(wrist.getAttribute('cx')).toBe('42');
    expect(wrist.getAttribute('cy')).toBe('84');
    expect(extension.currentPoseReporter()).toBe('wave');
    expect(extension.score).toBe(0.95);
  });

  it('throws for a zero-size visible preview when stage layout is available', () => {
    const stage = createElement();
    const canvas = createElement('CANVAS', {left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0});
    stage.appendChild(canvas);
    const extension = new TMPoseExtension();
    extension.previewVisible = true;
    expect(() => extension.validatePreviewAttachment(stage, canvas)).toThrow('zero size');
  });

  it('allows temporarily zero-size layout in a hidden document', () => {
    (document as any).visibilityState = 'hidden';
    const zero = {left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0};
    const stage = createElement('DIV', zero);
    const canvas = createElement('CANVAS', zero);
    stage.appendChild(canvas);
    expect(() => new TMPoseExtension().validatePreviewAttachment(stage, canvas)).not.toThrow();
  });

  it('stops MediaStream tracks and rolls back when preview attachment fails', async () => {
    const stop = vi.fn();
    const canvas = createElement('CANVAS');
    const webcam = {
      canvas,
      webcam: {srcObject: {getTracks: () => [{stop}]}},
      setup: vi.fn(async () => undefined),
      play: vi.fn(async () => undefined),
      update: vi.fn()
    };
    function Webcam() {
      return webcam;
    }
    vi.stubGlobal('tf', {});
    vi.stubGlobal('tmPose', {Webcam});

    const extension = new TMPoseExtension();
    vi.spyOn(extension, 'attachPreviewToStage').mockImplementation(() => {
      throw new Error('stage unavailable');
    });

    await expect(extension.startCamera()).rejects.toThrow('stage unavailable');
    expect(stop).toHaveBeenCalledOnce();
    expect(extension.webcam).toBeNull();
    expect(extension.cameraRunning).toBe(false);
    expect(extension.loopStarted).toBe(false);
    expect(extension.lastError).toContain('stage unavailable');
  });

  it('refreshes video inputs and exposes them through the dynamic camera menu', async () => {
    enumerateDevices.mockResolvedValue([
      {kind: 'audioinput', deviceId: 'microphone', label: 'Microphone'},
      {kind: 'videoinput', deviceId: 'front-id', label: 'Front Camera'},
      {kind: 'videoinput', deviceId: 'back-id', label: ''}
    ]);
    const extension = new TMPoseExtension();

    await extension.refreshCameraList();

    expect(extension.cameraCountReporter()).toBe(2);
    expect(extension.getCameraMenuItems()).toEqual([
      {text: 'default camera', value: 'default'},
      {text: 'front camera', value: 'front'},
      {text: 'back camera', value: 'back'},
      {text: 'Front Camera', value: 'front-id'},
      {text: 'camera 2', value: 'back-id'}
    ]);
  });

  it('applies front camera constraints configured before startup', async () => {
    const stage = createElement();
    const canvas = createElement('CANVAS');
    const setup = vi.fn(async () => undefined);
    const videoTrack = {
      kind: 'video',
      label: 'Built-in Front Camera',
      getSettings: () => ({deviceId: 'front-id'}),
      stop: vi.fn()
    };
    const webcam = {
      canvas,
      webcam: {srcObject: {getVideoTracks: () => [videoTrack], getTracks: () => [videoTrack]}},
      setup,
      play: vi.fn(async () => undefined),
      update: vi.fn()
    };
    function Webcam() {
      return webcam;
    }
    enumerateDevices.mockResolvedValue([
      {kind: 'videoinput', deviceId: 'front-id', label: 'Built-in Front Camera'}
    ]);
    const extension = new TMPoseExtension({}, {runtime: {Webcam} as never});
    vi.spyOn(extension, 'findStageElement').mockReturnValue(stage);

    await extension.setCameraSelection({CAMERA: 'front'});
    await extension.startCamera();

    expect(setup).toHaveBeenCalledWith({facingMode: {ideal: 'user'}});
    expect(canvas.getContext).toHaveBeenCalledOnce();
    expect(canvas.getContext).toHaveBeenCalledWith('2d');
    expect(extension.cameraDeviceIdReporter()).toBe('front-id');
    expect(extension.cameraDeviceNameReporter()).toBe('Built-in Front Camera');
  });

  it('switches a running camera by device ID without stopping recognition state', async () => {
    const stage = createElement();
    const firstStop = vi.fn();
    const secondStop = vi.fn();
    const createWebcam = (deviceId: string, label: string, stop: ReturnType<typeof vi.fn>) => {
      const track = {kind: 'video', label, getSettings: () => ({deviceId}), stop};
      return {
        canvas: createElement('CANVAS'),
        webcam: {srcObject: {getVideoTracks: () => [track], getTracks: () => [track]}},
        setup: vi.fn(async () => undefined),
        play: vi.fn(async () => undefined),
        update: vi.fn()
      };
    };
    const first = createWebcam('front-id', 'Front Camera', firstStop);
    const second = createWebcam('external-id', 'External Camera', secondStop);
    const webcams = [first, second];
    function Webcam() {
      return webcams.shift();
    }
    enumerateDevices.mockResolvedValue([
      {kind: 'videoinput', deviceId: 'front-id', label: 'Front Camera'},
      {kind: 'videoinput', deviceId: 'external-id', label: 'External Camera'}
    ]);
    const extension = new TMPoseExtension({}, {runtime: {Webcam} as never});
    vi.spyOn(extension, 'findStageElement').mockReturnValue(stage);
    await extension.startCamera();
    const model = {
      estimatePose: vi.fn(async () => ({posenetOutput: new Float32Array()})),
      predict: vi.fn(async () => [])
    };
    extension.model = model;
    extension.recognizing = true;
    extension.hidePreview();
    extension.setPreviewOpacity({OPACITY: 0.4});
    extension.setPreviewPosition({POSITION: 'center'});
    extension.setPreviewMirroring({MIRRORING: 'unmirrored'});

    await extension.setCameraSelection({CAMERA: 'external-id'});

    expect(firstStop).toHaveBeenCalledOnce();
    expect(second.setup).toHaveBeenCalledWith({deviceId: {exact: 'external-id'}});
    expect(extension.recognizing).toBe(true);
    expect(extension.model).toBe(model);
    expect(extension.cameraRunning).toBe(true);
    expect(extension.cameraDeviceIdReporter()).toBe('external-id');
    expect(extension.cameraDeviceNameReporter()).toBe('External Camera');
    expect(second.canvas.style.display).toBe('none');
    expect(second.canvas.style.opacity).toBe('0.4');
    expect(second.canvas.style.transform).toBe('translate(-50%, -50%) scaleX(-1)');
    expect(secondStop).not.toHaveBeenCalled();
  });

  it('rolls back to the previous camera when a running switch fails', async () => {
    const stage = createElement();
    const firstStop = vi.fn();
    const firstTrack = {kind: 'video', label: 'Default Camera', getSettings: () => ({deviceId: 'default-id'}), stop: firstStop};
    const rollbackTrack = {kind: 'video', label: 'Default Camera', getSettings: () => ({deviceId: 'default-id'}), stop: vi.fn()};
    const first = {
      canvas: createElement('CANVAS'),
      webcam: {srcObject: {getVideoTracks: () => [firstTrack], getTracks: () => [firstTrack]}},
      setup: vi.fn(async () => undefined), play: vi.fn(async () => undefined), update: vi.fn()
    };
    const failed = {
      canvas: createElement('CANVAS'), webcam: {srcObject: null},
      setup: vi.fn(async () => { throw new Error('camera unavailable'); }),
      play: vi.fn(async () => undefined), update: vi.fn()
    };
    const rollback = {
      canvas: createElement('CANVAS'),
      webcam: {srcObject: {getVideoTracks: () => [rollbackTrack], getTracks: () => [rollbackTrack]}},
      setup: vi.fn(async () => undefined), play: vi.fn(async () => undefined), update: vi.fn()
    };
    const webcams = [first, failed, rollback];
    function Webcam() {
      return webcams.shift();
    }
    const extension = new TMPoseExtension({}, {runtime: {Webcam} as never});
    vi.spyOn(extension, 'findStageElement').mockReturnValue(stage);
    await extension.startCamera();

    await expect(extension.setCameraSelection({CAMERA: 'missing-id'})).rejects.toThrow('camera unavailable');

    expect(firstStop).toHaveBeenCalledOnce();
    expect(failed.setup).toHaveBeenCalledWith({deviceId: {exact: 'missing-id'}});
    expect(rollback.setup).toHaveBeenCalledWith();
    expect(extension.cameraSelection).toBe('default');
    expect(extension.cameraRunning).toBe(true);
    expect(extension.cameraDeviceIdReporter()).toBe('default-id');
    expect(extension.lastError).toContain('camera unavailable');
  });

  it('supports hide then show preview', () => {
    const stage = createElement();
    const canvas = createElement('CANVAS');
    stage.appendChild(canvas);
    const extension = new TMPoseExtension();
    extension.webcam = {canvas};
    extension.previewCanvas = canvas;
    extension.previewStageElement = stage;
    vi.spyOn(extension, 'findStageElement').mockReturnValue(stage);

    extension.hidePreview();
    expect(canvas.style.display).toBe('none');
    extension.showPreview();
    expect(canvas.style.display).toBe('block');
    expect(extension.isPreviewVisible()).toBe(true);
  });

  it('keeps mirrored preview as the default and switches display mirroring at runtime', () => {
    const canvas = createElement('CANVAS');
    const extension = new TMPoseExtension();
    extension.previewCanvas = canvas;

    extension.updatePreviewStyle();
    expect(canvas.style.transform).toBe('');
    expect(extension.previewMirroringReporter()).toBe('mirrored');

    extension.setPreviewMirroring({MIRRORING: 'unmirrored'});
    expect(extension.previewMirrored).toBe(false);
    expect(canvas.style.transform).toBe('scaleX(-1)');
    expect(extension.previewMirroringReporter()).toBe('unmirrored');

    extension.setPreviewMirroring({MIRRORING: 'mirrored'});
    expect(extension.previewMirrored).toBe(true);
    expect(canvas.style.transform).toBe('');
    expect(extension.previewMirroringReporter()).toBe('mirrored');
  });

  it('composes preview mirroring with centered and full-stage layouts', () => {
    const stage = createElement();
    const canvas = createElement('CANVAS');
    stage.appendChild(canvas);
    const extension = new TMPoseExtension();
    extension.previewCanvas = canvas;
    extension.previewStageElement = stage;
    extension.setPreviewMirroring({MIRRORING: 'unmirrored'});

    extension.setPreviewPosition({POSITION: 'center'});
    expect(canvas.style.transform).toBe('translate(-50%, -50%) scaleX(-1)');

    extension.setPreviewPosition({POSITION: 'full-stage'});
    expect(canvas.style.transform).toBe('scaleX(-1)');
  });

  it('can configure an unmirrored preview before startup without changing recognition input mirroring', async () => {
    const stage = createElement();
    const canvas = createElement('CANVAS');
    const webcam = {
      canvas,
      webcam: {srcObject: null},
      setup: vi.fn(async () => undefined),
      play: vi.fn(async () => undefined),
      update: vi.fn()
    };
    const Webcam = vi.fn(function () {
      return webcam;
    });
    const extension = new TMPoseExtension({}, {runtime: {Webcam} as never});
    vi.spyOn(extension, 'findStageElement').mockReturnValue(stage);

    extension.setPreviewMirroring({MIRRORING: 'unmirrored'});
    await extension.startCamera();

    expect(Webcam).toHaveBeenCalledWith(320, 240, true);
    expect(canvas.style.transform).toBe('scaleX(-1)');
  });

  it('does not append scripts when required globals are already loaded', async () => {
    vi.stubGlobal('tf', {});
    vi.stubGlobal('tmPose', {});
    await new TMPoseExtension().ensureLibrariesLoaded();
    expect((document.head.appendChild as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  it('loads one reviewed browser runtime when TensorFlow and TM Pose are absent', async () => {
    const pending = new TMPoseExtension().ensureLibrariesLoaded();
    expect(document.head.appendChild).toHaveBeenCalledOnce();
    expect(scripts).toHaveLength(1);
    expect(scripts[0].src).toBe(BROWSER_RUNTIME_URL);
    vi.stubGlobal('tf', {version: '1.3.1'});
    vi.stubGlobal('tmPose', {Webcam: class {}});
    const loadHandler = scripts[0].addEventListener.mock.calls.find(
      ([eventName]: [string]) => eventName === 'load'
    )?.[1];
    expect(loadHandler).toBeTypeOf('function');
    loadHandler();
    await expect(pending).resolves.toBeUndefined();
  });

  it('invalidates an old asynchronous loop generation on camera cleanup', () => {
    const extension = new TMPoseExtension();
    extension.loopGeneration = 3;
    extension.webcam = {webcam: {srcObject: null}};
    extension.cameraRunning = true;
    extension.loopStarted = true;
    extension.cleanupCameraResources();
    expect(extension.loopGeneration).toBe(4);
    expect(extension.loopStarted).toBe(false);
    expect(extension.cameraRunning).toBe(false);
  });
});
