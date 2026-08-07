import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {createTMPoseComposition} from '../src/composition.js';

type TestFile = File & {bytes: Uint8Array};

function model(labels = ['stand', 'jump']) {
  const classifier = {dispose: vi.fn()};
  const poseNet = {dispose: vi.fn()};
  return {
    model: classifier,
    posenetModel: poseNet,
    dispose: vi.fn(() => poseNet.dispose()),
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
    removeEventListener: vi.fn(),
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
    expect(firstModel.model.dispose).toHaveBeenCalledOnce();
    expect(firstModel.posenetModel.dispose).toHaveBeenCalledOnce();
    expect(firstModel.dispose).not.toHaveBeenCalled();

    const pendingRelease = composition.registerPoseModel({name: 'Late', files: files(3)});
    let releaseCompleted = false;
    const release = composition.releasePoseModel('Late').then(() => {
      releaseCompleted = true;
    });
    await Promise.resolve();
    expect(releaseCompleted).toBe(false);
    releasedPending.resolve(releasedModel);
    await release;
    await expect(pendingRelease).rejects.toMatchObject({name: 'AbortError'});
    expect(releasedModel.model.dispose).toHaveBeenCalledOnce();
    expect(releasedModel.posenetModel.dispose).toHaveBeenCalledOnce();
    expect(releasedModel.dispose).not.toHaveBeenCalled();
    expect(composition.isPoseModelRegistered('Late')).toBe(false);
  });

  it('waits for pending load disposal before releaseAll completes', async () => {
    const pendingLoad = deferred<ReturnType<typeof model>>();
    const composition = createTMPoseComposition({
      runtime: {Webcam: class {}, loadFromFiles: vi.fn(() => pendingLoad.promise)},
      createFile
    });
    const registration = composition.registerPoseModel({name: 'Pending', files: files()});
    let releaseCompleted = false;
    const release = composition.releaseAll().then(() => {
      releaseCompleted = true;
    });
    await Promise.resolve();
    expect(releaseCompleted).toBe(false);

    const loaded = model(['pending']);
    pendingLoad.resolve(loaded);
    await release;
    await expect(registration).rejects.toMatchObject({name: 'AbortError'});
    expect(loaded.model.dispose).toHaveBeenCalledOnce();
    expect(loaded.posenetModel.dispose).toHaveBeenCalledOnce();
    expect(loaded.dispose).not.toHaveBeenCalled();
    expect(releaseCompleted).toBe(true);
  });

  it('waits for a concurrent per-model release before releaseAll completes', async () => {
    const classifierDispose = deferred<void>();
    const loaded = model(['concurrent']);
    loaded.model.dispose.mockImplementation(
      (() => classifierDispose.promise) as unknown as () => void
    );
    const composition = createTMPoseComposition({
      runtime: {Webcam: class {}, loadFromFiles: vi.fn(async () => loaded)},
      createFile
    });
    await composition.registerPoseModel({name: 'Concurrent', files: files()});

    let modelReleaseCompleted = false;
    let allReleaseCompleted = false;
    const modelRelease = composition.releasePoseModel('Concurrent').then(() => {
      modelReleaseCompleted = true;
    });
    const allRelease = composition.releaseAll().then(() => {
      allReleaseCompleted = true;
    });

    await vi.waitFor(() => expect(loaded.model.dispose).toHaveBeenCalledOnce());
    expect(modelReleaseCompleted).toBe(false);
    expect(allReleaseCompleted).toBe(false);
    expect(loaded.posenetModel.dispose).not.toHaveBeenCalled();

    classifierDispose.resolve(undefined);
    await Promise.all([modelRelease, allRelease]);
    expect(modelReleaseCompleted).toBe(true);
    expect(allReleaseCompleted).toBe(true);
    expect(loaded.model.dispose).toHaveBeenCalledOnce();
    expect(loaded.posenetModel.dispose).toHaveBeenCalledOnce();
    expect(loaded.dispose).not.toHaveBeenCalled();
  });

  it('falls back to one top-level disposer for non-Teachable-Machine runtimes', async () => {
    const legacy = {
      dispose: vi.fn(),
      getClassLabels: vi.fn(() => ['legacy']),
      estimatePose: vi.fn(),
      predict: vi.fn()
    };
    const composition = createTMPoseComposition({
      runtime: {Webcam: class {}, loadFromFiles: vi.fn(async () => legacy)},
      createFile
    });
    await composition.registerPoseModel({name: 'Legacy', files: files()});
    await composition.releasePoseModel('Legacy');
    await composition.releasePoseModel('Legacy');

    expect(legacy.dispose).toHaveBeenCalledOnce();
  });

  it('rejects an incomplete official resource shape after disposing what it safely can', async () => {
    const classifier = {dispose: vi.fn()};
    const incomplete = {
      model: classifier,
      getClassLabels: vi.fn(() => ['incomplete'])
    };
    const composition = createTMPoseComposition({
      runtime: {Webcam: class {}, loadFromFiles: vi.fn(async () => incomplete)},
      createFile
    });

    await expect(
      composition.registerPoseModel({name: 'Incomplete', files: files()})
    ).rejects.toMatchObject({code: 'TMPOSE-COMPOSITION-009'});
    expect(classifier.dispose).toHaveBeenCalledOnce();
    expect(composition.isPoseModelRegistered('Incomplete')).toBe(false);
  });

  it('attempts classifier and PoseNet disposal even when one resource throws', async () => {
    const loaded = model();
    loaded.model.dispose.mockImplementation(() => {
      throw new Error('classifier dispose failed');
    });
    const composition = createTMPoseComposition({
      runtime: {Webcam: class {}, loadFromFiles: vi.fn(async () => loaded)},
      createFile
    });
    await composition.registerPoseModel({name: 'Failure', files: files()});

    await expect(composition.releasePoseModel('Failure')).rejects.toMatchObject({
      errors: [{code: 'TMPOSE-COMPOSITION-009'}]
    });
    expect(loaded.model.dispose).toHaveBeenCalledOnce();
    expect(loaded.posenetModel.dispose).toHaveBeenCalledOnce();
    expect(loaded.dispose).not.toHaveBeenCalled();
  });

  it('keeps initialized model count bounded across repeated scene-style retention', async () => {
    let activeModels = 0;
    let maximumActiveModels = 0;
    const loadedModels: ReturnType<typeof model>[] = [];
    const composition = createTMPoseComposition({
      runtime: {
        Webcam: class {},
        loadFromFiles: vi.fn(async () => {
          activeModels += 1;
          maximumActiveModels = Math.max(maximumActiveModels, activeModels);
          const loaded = model(['scene']);
          loaded.posenetModel.dispose.mockImplementation(() => {
            activeModels -= 1;
          });
          loadedModels.push(loaded);
          return loaded;
        })
      },
      createFile
    });

    for (let visit = 0; visit < 20; visit += 1) {
      await composition.registerPoseModel({name: 'ScenePose', files: files(visit + 1)});
      await composition.releasePoseModel('ScenePose');
      expect(activeModels).toBe(0);
    }
    expect(maximumActiveModels).toBe(1);
    expect(loadedModels).toHaveLength(20);
    for (const loaded of loadedModels) {
      expect(loaded.model.dispose).toHaveBeenCalledOnce();
      expect(loaded.posenetModel.dispose).toHaveBeenCalledOnce();
      expect(loaded.dispose).not.toHaveBeenCalled();
    }
    await composition.releaseAll();
    expect(activeModels).toBe(0);
  });

  it('controls preview mirroring before startup and while the camera is running', async () => {
    const stage = element();
    const canvas = element('CANVAS');
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
    vi.mocked(document.querySelector).mockReturnValue(stage);
    const composition = createTMPoseComposition({
      runtime: {Webcam: Webcam as never, loadFromFiles: vi.fn()},
      createFile
    });

    composition.setPreviewMirroring('unmirrored');
    await composition.startCamera();
    expect(Webcam).toHaveBeenCalledWith(320, 240, true);
    expect(canvas.style.transform).toBe('scaleX(-1)');

    composition.setPreviewMirroring('mirrored');
    expect(canvas.style.transform).toBe('');
    composition.stopCamera();
    composition.setPreviewMirroring('unmirrored');
    await composition.startCamera();
    expect(canvas.style.transform).toBe('scaleX(-1)');
  });

  it('rejects non-canonical composition preview mirroring values', async () => {
    const composition = createTMPoseComposition({
      runtime: {Webcam: class {}, loadFromFiles: vi.fn()},
      createFile
    });

    expect(() => composition.setPreviewMirroring('normal' as never)).toThrow(
      expect.objectContaining({code: 'TMPOSE-COMPOSITION-010'})
    );
    await composition.releaseAll();
    expect(() => composition.setPreviewMirroring('mirrored')).toThrow(
      expect.objectContaining({code: 'TMPOSE-COMPOSITION-007'})
    );
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
    expect(activeModel.model.dispose).toHaveBeenCalledOnce();
    expect(activeModel.posenetModel.dispose).toHaveBeenCalledOnce();
    expect(activeModel.dispose).not.toHaveBeenCalled();
    expect(otherModel.model.dispose).not.toHaveBeenCalled();
    expect(otherModel.posenetModel.dispose).not.toHaveBeenCalled();

    await composition.releaseAll();
    await composition.releaseAll();
    expect(composition.isRecognizing()).toBe(false);
    expect(composition.isCameraRunning()).toBe(false);
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(activeModel.model.dispose).toHaveBeenCalledOnce();
    expect(activeModel.posenetModel.dispose).toHaveBeenCalledOnce();
    expect(otherModel.model.dispose).toHaveBeenCalledOnce();
    expect(otherModel.posenetModel.dispose).toHaveBeenCalledOnce();
    expect(otherModel.dispose).not.toHaveBeenCalled();
  });

  it('preserves the camera when switching active models before releasing the old model', async () => {
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
    const oldModel = model(['old']);
    const newModel = model(['new']);
    const oldEstimate = deferred<{posenetOutput: Float32Array}>();
    oldModel.estimatePose.mockImplementation(() => oldEstimate.promise);
    const loaded = [oldModel, newModel];
    function Webcam() {
      return webcam;
    }
    const composition = createTMPoseComposition({
      runtime: {Webcam: Webcam as never, loadFromFiles: vi.fn(async () => loaded.shift()!)},
      createFile
    });
    await composition.registerPoseModel({name: 'Old', files: files(1)});
    await composition.registerPoseModel({name: 'New', files: files(2)});
    composition.activatePoseModel('Old');
    await composition.startRecognition();
    animationCallbacks.shift()!();
    await vi.waitFor(() => expect(oldModel.estimatePose).toHaveBeenCalledOnce());
    composition.stopRecognition();
    composition.activatePoseModel('New');
    let oldReleaseCompleted = false;
    const oldRelease = composition.releasePoseModel('Old').then(() => {
      oldReleaseCompleted = true;
    });
    await Promise.resolve();

    expect(oldReleaseCompleted).toBe(false);
    expect(oldModel.model.dispose).not.toHaveBeenCalled();
    oldEstimate.resolve({posenetOutput: new Float32Array([1])});
    await oldRelease;

    expect(composition.isCameraRunning()).toBe(true);
    expect(composition.getActivePoseModelName()).toBe('New');
    expect(stopTrack).not.toHaveBeenCalled();
    expect(oldModel.predict).toHaveBeenCalledOnce();
    expect(newModel.predict).not.toHaveBeenCalled();
    expect(oldModel.model.dispose).toHaveBeenCalledOnce();
    expect(oldModel.posenetModel.dispose).toHaveBeenCalledOnce();

    expect(animationCallbacks).toHaveLength(1);
    await composition.startRecognition();
    animationCallbacks.shift()!();
    await vi.waitFor(() => expect(newModel.predict).toHaveBeenCalledOnce());

    await composition.releasePoseModel('New');
    expect(composition.isCameraRunning()).toBe(false);
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(newModel.model.dispose).toHaveBeenCalledOnce();
    expect(newModel.posenetModel.dispose).toHaveBeenCalledOnce();
  });

  it('configures and publishes accumulated pose changes without score-only duplicates', async () => {
    const stage = element();
    const canvas = element('CANVAS');
    const webcam = {
      canvas,
      webcam: {srcObject: {getTracks: () => []}},
      setup: vi.fn(async () => undefined),
      play: vi.fn(async () => undefined),
      update: vi.fn()
    };
    vi.mocked(document.querySelector).mockReturnValue(stage);
    const predictions = [
      [
        {className: 'stand', probability: 0},
        {className: 'jump', probability: 1}
      ],
      [
        {className: 'stand', probability: 0},
        {className: 'jump', probability: 1}
      ],
      [
        {className: 'stand', probability: 1},
        {className: 'jump', probability: 0}
      ]
    ];
    const loaded = model();
    loaded.predict.mockImplementation(async () => predictions.shift() ?? []);
    function Webcam() {
      return webcam;
    }
    let now = 0;
    vi.stubGlobal('performance', {now: () => now});
    const composition = createTMPoseComposition({
      runtime: {Webcam: Webcam as never, loadFromFiles: vi.fn(async () => loaded)},
      createFile
    });
    composition.configureAccumulatedPose({
      accumulationPerSecond: 1,
      decayPerSecond: 0,
      scoreThreshold: 1
    });
    const events: Array<Record<string, unknown>> = [];
    const unsubscribe = composition.subscribeAccumulatedPose((event) => events.push(event));
    await composition.registerPoseModel({name: 'Active', files: files(1)});
    composition.activatePoseModel('Active');
    await composition.startRecognition();

    for (const timestamp of [1000, 2000, 3000]) {
      now = timestamp;
      animationCallbacks.shift()!();
      await vi.waitFor(() => expect(loaded.predict).toHaveBeenCalledTimes(timestamp / 1000));
    }

    expect(events.map(({poseName}) => poseName)).toEqual(['jump', 'stand']);
    expect(events.every((event) => Object.isFrozen(event))).toBe(true);
    expect(composition.accumulatedPose()).toBe('stand');
    expect(composition.accumulatedScore()).toBe(1);
    expect(composition.accumulatedScoreOf('stand')).toBe(1);
    composition.resetAccumulatedPose();
    expect(events.map(({poseName}) => poseName)).toEqual(['jump', 'stand', '']);
    unsubscribe();
    unsubscribe();
    await composition.releaseAll();
    expect(document.removeEventListener).toHaveBeenCalledWith(
      'visibilitychange',
      expect.any(Function)
    );
  });

  it('validates accumulated pose contracts and releases subscribers as a final operation', async () => {
    const composition = createTMPoseComposition({
      runtime: {Webcam: class {}, loadFromFiles: vi.fn()},
      createFile
    });
    const invalid = [
      {},
      {accumulationPerSecond: -1, decayPerSecond: 0.9, scoreThreshold: 0},
      {accumulationPerSecond: 1, decayPerSecond: 2, scoreThreshold: 0},
      {accumulationPerSecond: 1, decayPerSecond: 0.9, scoreThreshold: Number.NaN},
      {accumulationPerSecond: 1, decayPerSecond: 0.9, scoreThreshold: 0, extra: true}
    ];
    for (const value of invalid) {
      expect(() => composition.configureAccumulatedPose(value as never)).toThrow();
    }
    expect(() => composition.subscribeAccumulatedPose(null as never)).toThrow(/listener/u);
    const listener = vi.fn();
    composition.subscribeAccumulatedPose(listener);

    await composition.releaseAll();
    await composition.releaseAll();
    expect(() =>
      composition.configureAccumulatedPose({
        accumulationPerSecond: 1,
        decayPerSecond: 0.9,
        scoreThreshold: 0
      })
    ).toThrow(/released/u);
    expect(() => composition.resetAccumulatedPose()).toThrow(/released/u);
    expect(() => composition.subscribeAccumulatedPose(listener)).toThrow(/released/u);
    await expect(composition.registerPoseModel({name: 'Later', files: files()})).rejects.toThrow(
      /released/u
    );
    expect(composition.accumulatedPose()).toBe('');
    expect(composition.isRecognizing()).toBe(false);
  });

  it('isolates accumulated scores and listeners between composition instances', async () => {
    const stage = element();
    vi.mocked(document.querySelector).mockReturnValue(stage);
    const firstModel = model();
    const secondModel = model();
    firstModel.predict.mockResolvedValue([
      {className: 'jump', probability: 1},
      {className: 'stand', probability: 0}
    ]);
    secondModel.predict.mockResolvedValue([
      {className: 'jump', probability: 0},
      {className: 'stand', probability: 1}
    ]);
    const webcams = [firstModel, secondModel].map(() => ({
      canvas: element('CANVAS'),
      webcam: {srcObject: {getTracks: () => []}},
      setup: vi.fn(async () => undefined),
      play: vi.fn(async () => undefined),
      update: vi.fn()
    }));
    let webcamIndex = 0;
    function Webcam() {
      return webcams[webcamIndex++]!;
    }
    let now = 0;
    vi.stubGlobal('performance', {now: () => now});
    const first = createTMPoseComposition({
      runtime: {Webcam: Webcam as never, loadFromFiles: vi.fn(async () => firstModel)},
      createFile
    });
    const second = createTMPoseComposition({
      runtime: {Webcam: Webcam as never, loadFromFiles: vi.fn(async () => secondModel)},
      createFile
    });
    for (const composition of [first, second]) {
      composition.configureAccumulatedPose({
        accumulationPerSecond: 1,
        decayPerSecond: 1,
        scoreThreshold: 1
      });
      await composition.registerPoseModel({name: 'Shared', files: files()});
      composition.activatePoseModel('Shared');
    }
    const firstListener = vi.fn();
    const secondListener = vi.fn();
    first.subscribeAccumulatedPose(firstListener);
    second.subscribeAccumulatedPose(secondListener);
    await first.startRecognition();
    await second.startRecognition();

    now = 1000;
    for (const callback of animationCallbacks.splice(0)) callback();
    await vi.waitFor(() => {
      expect(firstModel.predict).toHaveBeenCalledOnce();
      expect(secondModel.predict).toHaveBeenCalledOnce();
    });

    expect(first.accumulatedPose()).toBe('jump');
    expect(second.accumulatedPose()).toBe('stand');
    expect(firstListener).toHaveBeenCalledOnce();
    expect(secondListener).toHaveBeenCalledOnce();
    first.resetAccumulatedPose();
    expect(first.accumulatedPose()).toBe('');
    expect(second.accumulatedPose()).toBe('stand');
    expect(firstListener).toHaveBeenCalledTimes(2);
    expect(secondListener).toHaveBeenCalledOnce();

    await first.releaseAll();
    await second.releaseAll();
  });

  it('constructs and configures the composition without global Scratch', async () => {
    vi.unstubAllGlobals();
    const composition = createTMPoseComposition({
      runtime: {Webcam: class {}, loadFromFiles: vi.fn()},
      createFile
    });
    composition.configureAccumulatedPose({
      accumulationPerSecond: 1,
      decayPerSecond: 0.9,
      scoreThreshold: 0
    });
    const unsubscribe = composition.subscribeAccumulatedPose(() => undefined);
    unsubscribe();
    await composition.releaseAll();
  });
});
