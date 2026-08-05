import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {createTMPoseComposition} from '../src/composition.js';

type TestFile = File & {bytes: Uint8Array};

function model(labels = ['stand', 'jump']) {
  return {
    dispose: vi.fn(),
    getClassLabels: vi.fn(() => labels),
    estimatePose: vi.fn(async () => ({posenetOutput: new Float32Array([1])})),
    predict: vi.fn(async () => [
      {className: 'stand', probability: 0.2},
      {className: 'jump', probability: 0.8}
    ])
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return {promise, resolve};
}

function files(seed = 1) {
  return [
    {path: 'model.json', bytes: new Uint8Array([seed, 1])},
    {path: 'weights.bin', bytes: new Uint8Array([seed, 2])},
    {path: 'metadata.json', bytes: new Uint8Array([seed, 3])}
  ];
}

function createFile(bytes: Uint8Array, name: string, type: string): File {
  return {bytes, name, type} as TestFile;
}

function element(tagName = 'DIV') {
  const value: any = {
    tagName,
    style: {},
    parentElement: null,
    parentNode: null,
    width: tagName === 'CANVAS' ? 480 : undefined,
    height: tagName === 'CANVAS' ? 360 : undefined,
    getBoundingClientRect: vi.fn(() => ({
      left: 0, top: 0, right: 480, bottom: 360, width: 480, height: 360
    })),
    appendChild(child: any) {
      child.parentElement = value;
      child.parentNode = value;
      return child;
    },
    removeChild(child: any) {
      child.parentElement = null;
      child.parentNode = null;
      return child;
    }
  };
  return value;
}

let registerExtension: ReturnType<typeof vi.fn>;
let appendScript: ReturnType<typeof vi.fn>;
let animationCallbacks: Array<() => void>;

beforeEach(() => {
  registerExtension = vi.fn();
  appendScript = vi.fn();
  animationCallbacks = [];
  vi.stubGlobal('Scratch', {
    extensions: {unsandboxed: true, register: registerExtension}
  });
  vi.stubGlobal('document', {
    scripts: [],
    visibilityState: 'visible',
    head: {appendChild: appendScript},
    addEventListener: vi.fn(),
    querySelector: vi.fn(() => null),
    querySelectorAll: vi.fn(() => [])
  });
  vi.stubGlobal('window', {
    getComputedStyle: vi.fn((target: any) => ({
      position: target.style.position || 'static',
      display: target.style.display || 'block',
      visibility: target.style.visibility || 'visible',
      opacity: target.style.opacity || '1'
    }))
  });
  vi.stubGlobal('requestAnimationFrame', vi.fn((callback: () => void) => {
    animationCallbacks.push(callback);
    return animationCallbacks.length;
  }));
});

afterEach(() => vi.unstubAllGlobals());

describe('TMPose composition API', () => {
  it('copies and loads the three canonical files without registering blocks', async () => {
    const loaded = model();
    const loadFromFiles = vi.fn(async () => loaded);
    const inputFiles = files();
    const composition = createTMPoseComposition({
      runtime: {Webcam: class {}, loadFromFiles},
      createFile
    });
    const pending = composition.registerPoseModel({name: ' RescuePose ', files: inputFiles});
    inputFiles.forEach(({bytes}) => bytes.fill(9));

    await expect(pending).resolves.toEqual({name: 'RescuePose', labels: ['stand', 'jump']});
    expect(registerExtension).not.toHaveBeenCalled();
    expect(loadFromFiles).toHaveBeenCalledOnce();
    const [modelFile, weightsFile, metadataFile] = loadFromFiles.mock.calls[0] as TestFile[];
    expect([modelFile.name, weightsFile.name, metadataFile.name]).toEqual([
      'model.json', 'weights.bin', 'metadata.json'
    ]);
    expect([modelFile.type, weightsFile.type, metadataFile.type]).toEqual([
      'application/json', 'application/octet-stream', 'application/json'
    ]);
    expect([...modelFile.bytes]).toEqual([1, 1]);
    expect([...weightsFile.bytes]).toEqual([1, 2]);
    expect([...metadataFile.bytes]).toEqual([1, 3]);
  });

  it('rejects malformed model sets before invoking the runtime loader', async () => {
    const loadFromFiles = vi.fn();
    const composition = createTMPoseComposition({
      runtime: {Webcam: class {}, loadFromFiles},
      createFile
    });
    const invalid = [
      {name: '', files: files()},
      {name: 'Missing', files: files().slice(0, 2)},
      {name: 'Extra', files: [...files(), {path: 'extra.bin', bytes: new Uint8Array([1])}]},
      {
        name: 'TwoWeights',
        files: [
          {path: 'model.json', bytes: new Uint8Array([1])},
          {path: 'first.bin', bytes: new Uint8Array([2])},
          {path: 'second.bin', bytes: new Uint8Array([3])}
        ]
      },
      {
        name: 'Nested',
        files: [
          {path: 'model.json', bytes: new Uint8Array([1])},
          {path: 'nested/weights.bin', bytes: new Uint8Array([2])},
          {path: 'metadata.json', bytes: new Uint8Array([3])}
        ]
      },
      {
        name: 'Empty',
        files: [
          {path: 'model.json', bytes: new Uint8Array()},
          {path: 'weights.bin', bytes: new Uint8Array([2])},
          {path: 'metadata.json', bytes: new Uint8Array([3])}
        ]
      }
    ];
    for (const input of invalid) {
      await expect(composition.registerPoseModel(input)).rejects.toThrow();
    }
    expect(loadFromFiles).not.toHaveBeenCalled();
    expect(() => createTMPoseComposition({runtime: {} as never})).toThrow(/loadFromFiles/u);
  });

  it('caches named models and isolates active state between instances', async () => {
    const firstModels = [model(['first']), model(['second'])];
    const secondModel = model(['isolated']);
    const first = createTMPoseComposition({
      runtime: {
        Webcam: class {},
        loadFromFiles: vi.fn(async () => firstModels.shift()!)
      },
      createFile
    });
    const second = createTMPoseComposition({
      runtime: {Webcam: class {}, loadFromFiles: vi.fn(async () => secondModel)},
      createFile
    });
    await first.registerPoseModel({name: 'First', files: files(1)});
    await first.registerPoseModel({name: 'Second', files: files(2)});
    await second.registerPoseModel({name: 'First', files: files(3)});
    first.activatePoseModel('Second');
    second.activatePoseModel('First');

    expect(first.getActivePoseModelName()).toBe('Second');
    expect(second.getActivePoseModelName()).toBe('First');
    await first.releasePoseModel('First');
    expect(first.isPoseModelRegistered('First')).toBe(false);
    expect(second.isPoseModelRegistered('First')).toBe(true);
  });

  it('disposes stale models from concurrent replace and pending release', async () => {
    const firstPending = deferred<ReturnType<typeof model>>();
    const secondPending = deferred<ReturnType<typeof model>>();
    const releasedPending = deferred<ReturnType<typeof model>>();
    const loadFromFiles = vi
      .fn()
      .mockImplementationOnce(() => firstPending.promise)
      .mockImplementationOnce(() => secondPending.promise)
      .mockImplementationOnce(() => releasedPending.promise);
    const composition = createTMPoseComposition({
      runtime: {Webcam: class {}, loadFromFiles},
      createFile
    });
    const firstModel = model(['stale']);
    const secondModel = model(['latest']);
    const releasedModel = model(['released']);
    const first = composition.registerPoseModel({name: 'Shared', files: files(1)});
    const second = composition.registerPoseModel({name: 'Shared', files: files(2)});
    secondPending.resolve(secondModel);
    await expect(second).resolves.toEqual({name: 'Shared', labels: ['latest']});
    firstPending.resolve(firstModel);
    await expect(first).rejects.toMatchObject({name: 'AbortError'});
    expect(firstModel.dispose).toHaveBeenCalledOnce();

    const pendingRelease = composition.registerPoseModel({name: 'Late', files: files(3)});
    await composition.releasePoseModel('Late');
    releasedPending.resolve(releasedModel);
    await expect(pendingRelease).rejects.toMatchObject({name: 'AbortError'});
    expect(releasedModel.dispose).toHaveBeenCalledOnce();
    expect(composition.isPoseModelRegistered('Late')).toBe(false);
  });

  it('runs recognition only with the active model and releases camera and models once', async () => {
    const stage = element();
    const canvas = element('CANVAS');
    const stopTrack = vi.fn();
    const webcam = {
      canvas,
      webcam: {srcObject: {getTracks: () => [{stop: stopTrack}]}},
      setup: vi.fn(async () => undefined),
      play: vi.fn(async () => undefined),
      update: vi.fn()
    };
    vi.mocked(document.querySelector).mockReturnValue(stage);
    const activeModel = model();
    const otherModel = model(['other']);
    const loaded = [activeModel, otherModel];
    function Webcam() {
      return webcam;
    }
    const composition = createTMPoseComposition({
      runtime: {Webcam: Webcam as never, loadFromFiles: vi.fn(async () => loaded.shift()!)},
      createFile
    });
    await composition.registerPoseModel({name: 'Active', files: files(1)});
    await composition.registerPoseModel({name: 'Other', files: files(2)});
    composition.activatePoseModel('Active');
    await composition.startRecognition();
    expect(composition.isRecognizing()).toBe(true);
    expect(composition.isCameraRunning()).toBe(true);
    expect(appendScript).not.toHaveBeenCalled();
    expect(animationCallbacks).toHaveLength(1);
    animationCallbacks.shift()!();
    await vi.waitFor(() => expect(composition.currentPose()).toBe('jump'));
    expect(composition.confidence()).toBe(0.8);
    expect(composition.confidenceOf('stand')).toBe(0.2);
    expect(activeModel.predict).toHaveBeenCalledOnce();
    expect(otherModel.predict).not.toHaveBeenCalled();

    await composition.releasePoseModel('Active');
    expect(composition.isRecognizing()).toBe(false);
    expect(composition.isCameraRunning()).toBe(false);
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(activeModel.dispose).toHaveBeenCalledOnce();
    expect(otherModel.dispose).not.toHaveBeenCalled();

    await composition.releaseAll();
    await composition.releaseAll();
    expect(composition.isRecognizing()).toBe(false);
    expect(composition.isCameraRunning()).toBe(false);
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(activeModel.dispose).toHaveBeenCalledOnce();
    expect(otherModel.dispose).toHaveBeenCalledOnce();
  });
});
