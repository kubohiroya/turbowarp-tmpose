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
    vi.stubGlobal('tf', {});
    vi.stubGlobal('tmPose', {Webcam: vi.fn(() => webcam)});

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
