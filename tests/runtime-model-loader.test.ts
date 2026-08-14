import {describe, expect, it, vi} from 'vitest';
import {
  createRuntimeModelFileLoader,
  type RuntimeModelLoaderDependencies
} from '../src/runtime-model-loader.js';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return {promise, resolve, reject};
}

const modelFile = {name: 'model.json'} as File;
const weightsFile = {name: 'weights.bin'} as File;
const metadataFile = {name: 'metadata.json'} as File;

function dependencies(overrides: Partial<RuntimeModelLoaderDependencies> = {}) {
  const classifier = {dispose: vi.fn()};
  const poseNet = {dispose: vi.fn()};
  const metadata = {labels: ['stand']};
  const combined = {classifier, poseNet, metadata};
  const value: RuntimeModelLoaderDependencies = {
    ready: vi.fn(async () => undefined),
    loadClassifier: vi.fn(async () => classifier),
    loadMetadata: vi.fn(async () => metadata),
    loadPoseNet: vi.fn(async () => poseNet),
    createModel: vi.fn(() => combined),
    ...overrides
  };
  return {value, classifier, poseNet, metadata, combined};
}

describe('cancellable TMPose runtime model loader', () => {
  it('does not start any model phase when already cancelled', async () => {
    const setup = dependencies();
    const controller = new AbortController();
    controller.abort('scene-skipped');

    await expect(
      createRuntimeModelFileLoader(setup.value)(
        modelFile,
        weightsFile,
        metadataFile,
        {signal: controller.signal}
      )
    ).rejects.toMatchObject({name: 'AbortError', code: 'TMPOSE-RUNTIME-ABORTED'});
    expect(setup.value.ready).not.toHaveBeenCalled();
    expect(setup.value.loadClassifier).not.toHaveBeenCalled();
  });

  it('stops after TensorFlow readiness when cancellation occurs there', async () => {
    const ready = deferred<void>();
    const setup = dependencies({ready: vi.fn(() => ready.promise)});
    const controller = new AbortController();
    const loading = createRuntimeModelFileLoader(setup.value)(
      modelFile,
      weightsFile,
      metadataFile,
      {signal: controller.signal}
    );

    controller.abort('scene-skipped');
    ready.resolve();
    await expect(loading).rejects.toMatchObject({code: 'TMPOSE-RUNTIME-ABORTED'});
    expect(setup.value.loadClassifier).not.toHaveBeenCalled();
  });

  it('stops at the classifier boundary and disposes the late classifier', async () => {
    const classifierGate = deferred<unknown>();
    const setup = dependencies({
      loadClassifier: vi.fn(() => classifierGate.promise)
    });
    const controller = new AbortController();
    const loading = createRuntimeModelFileLoader(setup.value)(
      modelFile,
      weightsFile,
      metadataFile,
      {signal: controller.signal}
    );

    await vi.waitFor(() => expect(setup.value.loadClassifier).toHaveBeenCalledOnce());
    controller.abort('superseded');
    classifierGate.resolve(setup.classifier);
    await expect(loading).rejects.toMatchObject({code: 'TMPOSE-RUNTIME-ABORTED'});
    expect(setup.classifier.dispose).toHaveBeenCalledOnce();
    expect(setup.value.loadMetadata).not.toHaveBeenCalled();
    expect(setup.value.loadPoseNet).not.toHaveBeenCalled();
  });

  it('stops at the metadata boundary without starting PoseNet', async () => {
    const metadataGate = deferred<unknown>();
    const setup = dependencies({
      loadMetadata: vi.fn(() => metadataGate.promise)
    });
    const controller = new AbortController();
    const loading = createRuntimeModelFileLoader(setup.value)(
      modelFile,
      weightsFile,
      metadataFile,
      {signal: controller.signal}
    );

    await vi.waitFor(() => expect(setup.value.loadMetadata).toHaveBeenCalledOnce());
    controller.abort('superseded');
    metadataGate.resolve(setup.metadata);
    await expect(loading).rejects.toMatchObject({code: 'TMPOSE-RUNTIME-ABORTED'});
    expect(setup.classifier.dispose).toHaveBeenCalledOnce();
    expect(setup.value.loadPoseNet).not.toHaveBeenCalled();
  });

  it('disposes classifier and PoseNet once when cancelled during PoseNet loading', async () => {
    const poseNetGate = deferred<unknown>();
    const setup = dependencies({
      loadPoseNet: vi.fn(() => poseNetGate.promise)
    });
    const controller = new AbortController();
    const loading = createRuntimeModelFileLoader(setup.value)(
      modelFile,
      weightsFile,
      metadataFile,
      {signal: controller.signal}
    );

    await vi.waitFor(() => expect(setup.value.loadPoseNet).toHaveBeenCalledOnce());
    controller.abort('scene-skipped');
    poseNetGate.resolve(setup.poseNet);
    await expect(loading).rejects.toMatchObject({code: 'TMPOSE-RUNTIME-ABORTED'});
    expect(setup.classifier.dispose).toHaveBeenCalledOnce();
    expect(setup.poseNet.dispose).toHaveBeenCalledOnce();
    expect(setup.value.createModel).not.toHaveBeenCalled();
  });

  it('starts all independent phases together only when parallel loading is enabled', async () => {
    const classifierGate = deferred<unknown>();
    const metadataGate = deferred<unknown>();
    const poseNetGate = deferred<unknown>();
    const events: string[] = [];
    const setup = dependencies({
      loadClassifier: vi.fn(() => {
        events.push('classifier');
        return classifierGate.promise;
      }),
      loadMetadata: vi.fn(() => {
        events.push('metadata');
        return metadataGate.promise;
      }),
      loadPoseNet: vi.fn(() => {
        events.push('posenet');
        return poseNetGate.promise;
      })
    });
    const loading = createRuntimeModelFileLoader(setup.value)(
      modelFile,
      weightsFile,
      metadataFile,
      {parallelModelInitialization: true}
    );

    await vi.waitFor(() => expect(events).toEqual(['classifier', 'metadata', 'posenet']));
    classifierGate.resolve(setup.classifier);
    metadataGate.resolve(setup.metadata);
    poseNetGate.resolve(setup.poseNet);
    await expect(loading).resolves.toBe(setup.combined);
    expect(setup.classifier.dispose).not.toHaveBeenCalled();
    expect(setup.poseNet.dispose).not.toHaveBeenCalled();
  });

  it('waits for and disposes fulfilled parallel resources after cancellation', async () => {
    const classifierGate = deferred<unknown>();
    const metadataGate = deferred<unknown>();
    const poseNetGate = deferred<unknown>();
    const setup = dependencies({
      loadClassifier: vi.fn(() => classifierGate.promise),
      loadMetadata: vi.fn(() => metadataGate.promise),
      loadPoseNet: vi.fn(() => poseNetGate.promise)
    });
    const controller = new AbortController();
    const loading = createRuntimeModelFileLoader(setup.value)(
      modelFile,
      weightsFile,
      metadataFile,
      {signal: controller.signal, parallelModelInitialization: true}
    );

    await vi.waitFor(() => expect(setup.value.loadPoseNet).toHaveBeenCalledOnce());
    controller.abort('scene-skipped');
    classifierGate.resolve(setup.classifier);
    metadataGate.resolve(setup.metadata);
    poseNetGate.resolve(setup.poseNet);
    await expect(loading).rejects.toMatchObject({code: 'TMPOSE-RUNTIME-ABORTED'});
    expect(setup.classifier.dispose).toHaveBeenCalledOnce();
    expect(setup.poseNet.dispose).toHaveBeenCalledOnce();
  });

  it('surfaces cleanup failures together with the load failure', async () => {
    const loadFailure = new Error('PoseNet failed');
    const cleanupFailure = new Error('classifier cleanup failed');
    const classifier = {dispose: vi.fn(() => Promise.reject(cleanupFailure))};
    const setup = dependencies({
      loadClassifier: vi.fn(async () => classifier),
      loadPoseNet: vi.fn(async () => {
        throw loadFailure;
      })
    });

    const loading = createRuntimeModelFileLoader(setup.value)(
      modelFile,
      weightsFile,
      metadataFile
    );
    await expect(loading).rejects.toMatchObject({
      name: 'AggregateError',
      errors: [loadFailure, cleanupFailure]
    });
    expect(classifier.dispose).toHaveBeenCalledOnce();
  });

  it('validates the new load options', async () => {
    const setup = dependencies();
    const load = createRuntimeModelFileLoader(setup.value);

    await expect(
      load(modelFile, weightsFile, metadataFile, {
        parallelModelInitialization: 'yes' as unknown as boolean
      })
    ).rejects.toThrow('parallelModelInitialization must be a boolean.');
    expect(setup.value.ready).not.toHaveBeenCalled();
  });
});
