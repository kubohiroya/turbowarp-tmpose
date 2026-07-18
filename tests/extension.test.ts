import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {TMPoseExtension} from '../src/extension.js';

const visibleRect = {left: 0, top: 0, right: 480, bottom: 360, width: 480, height: 360};

function createElement(tagName = 'DIV', rect = visibleRect) {
  const element: any = {
    tagName,
    style: {},
    dataset: {},
    parentElement: null,
    parentNode: null,
    width: tagName === 'CANVAS' ? 480 : undefined,
    height: tagName === 'CANVAS' ? 360 : undefined,
    getBoundingClientRect: vi.fn(() => rect),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    appendChild(child: any) {
      child.parentElement = element;
      child.parentNode = element;
      return child;
    },
    removeChild(child: any) {
      child.parentElement = null;
      child.parentNode = null;
      return child;
    }
  };
  return element;
}

let querySelector: ReturnType<typeof vi.fn>;
let querySelectorAll: ReturnType<typeof vi.fn>;
let scripts: any[];

beforeEach(() => {
  scripts = [];
  querySelector = vi.fn(() => null);
  querySelectorAll = vi.fn(() => []);

  vi.stubGlobal('document', {
    scripts,
    visibilityState: 'visible',
    createElement: vi.fn((tag: string) => createElement(tag.toUpperCase())),
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
  vi.stubGlobal('Scratch', {
    BlockType: {COMMAND: 'command', REPORTER: 'reporter', BOOLEAN: 'boolean', HAT: 'hat'},
    ArgumentType: {STRING: 'string', NUMBER: 'number', BOOLEAN: 'boolean'},
    translate: (value: string | {default: string}) => typeof value === 'string' ? value : value.default,
    extensions: {unsandboxed: true, register: vi.fn()}
  });
});

afterEach(() => vi.unstubAllGlobals());

describe('TMPoseExtension', () => {
  it('exposes the expected extension ID and blocks', () => {
    const info = new TMPoseExtension().getInfo() as {id: string; blocks: unknown[]};
    expect(info.id).toBe('tmpose');
    expect(info.blocks).toHaveLength(24);
  });

  it('exposes accumulated pose blocks only when the feature flag is enabled', () => {
    const info = new TMPoseExtension({temporalPoseScoring: true}).getInfo() as {
      blocks: Array<{opcode: string}>;
    };
    expect(info.blocks).toHaveLength(30);
    expect(info.blocks.map((block) => block.opcode)).toEqual(expect.arrayContaining([
      'setAccumulatedPoseParameters',
      'setAccumulatedPoseThreshold',
      'resetAccumulatedPose',
      'accumulatedPoseReporter',
      'accumulatedScoreReporter',
      'accumulatedPoseScoreReporter'
    ]));
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
      version: 1,
      poseName: 'jump',
      previousPoseName: '',
      score: 1,
      reason: 'prediction',
      timestamp: 100
    });
    expect(emit).toHaveBeenNthCalledWith(2, 'TMPOSE_ACCUMULATED_POSE_CHANGED', {
      version: 1,
      poseName: 'stand',
      previousPoseName: 'jump',
      score: 1,
      reason: 'prediction',
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
    extension.stopPredict();
    expect(emit).toHaveBeenLastCalledWith('TMPOSE_ACCUMULATED_POSE_CHANGED', {
      version: 1,
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
      version: 1,
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
    extension.predicting = true;

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

    await extension.startPredict();
    expect(extension.activeDecayCoefficient).toBe(0.5);
    extension.setAccumulatedPoseParameters({ACCUMULATION: 1, DECAY: 0.1});
    expect(extension.decayCoefficient).toBe(0.1);
    expect(extension.activeDecayCoefficient).toBe(0.5);

    extension.stopPredict();
    await extension.startPredict();
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
    extension.stopPredict();
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
    expect(() => new TMPoseExtension().findStageElement()).toThrow('No likely stage canvas');
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

  it('does not append scripts when required globals are already loaded', async () => {
    vi.stubGlobal('tf', {});
    vi.stubGlobal('tmPose', {});
    await new TMPoseExtension().ensureLibrariesLoaded();
    expect((document.head.appendChild as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
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
