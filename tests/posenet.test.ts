import {readFile} from 'node:fs/promises';
import {describe, expect, it, vi} from 'vitest';
import {
  createBundledTMPoseRuntime,
  createPoseNetProjectBundle,
  createPoseNetProjectBundleFromLoader,
  loadPoseNetBundle,
  loadPoseNetProjectBundle,
  poseNetBundleManifest,
  verifyPoseNetBundle
} from '../src/posenet.js';

const assetDirectory = new URL(
  '../assets/posenet/mobilenet-v1-075-stride16/',
  import.meta.url
);

async function sourceFiles() {
  return Promise.all(
    poseNetBundleManifest.files.map(async ({path, mediaType}) => ({
      path,
      mediaType,
      bytes: new Uint8Array(await readFile(new URL(path, assetDirectory)))
    }))
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return {promise, resolve};
}

describe('PoseNet offline bundle', () => {
  it('loads and verifies the packaged MobileNetV1 model supply', async () => {
    const verified = await loadPoseNetBundle(
      ({path}) => readFile(new URL(path, assetDirectory)),
      {subtleCrypto: crypto.subtle}
    );

    expect(verified.manifest).toBe(poseNetBundleManifest);
    expect(verified.files.map(({path}) => path)).toEqual([
      'model-stride16.json',
      'group1-shard1of2.bin',
      'group1-shard2of2.bin'
    ]);
    expect(verified.files.map(({bytes}) => bytes.byteLength)).toEqual([
      49_720,
      4_194_304,
      838_476
    ]);
    expect(verified.files.reduce((total, {bytes}) => total + bytes.byteLength, 0)).toBe(5_082_500);
  });

  it('rejects missing, tampered, and oversized model data with stable codes', async () => {
    const files = await sourceFiles();
    const tampered = files.map((file) => ({...file, bytes: new Uint8Array(file.bytes)}));
    tampered[1]!.bytes[0] ^= 0xff;

    await expect(
      verifyPoseNetBundle(tampered, {subtleCrypto: crypto.subtle})
    ).rejects.toMatchObject({code: 'TMPOSE-POSENET-ASSET-003'});
    await expect(
      verifyPoseNetBundle(files.slice(0, 2), {subtleCrypto: crypto.subtle})
    ).rejects.toMatchObject({code: 'TMPOSE-POSENET-ASSET-004'});

    const oversized = files.map((file) => ({...file, bytes: new Uint8Array(file.bytes)}));
    oversized[0]!.bytes = new Uint8Array(65 * 1024);
    await expect(
      verifyPoseNetBundle(oversized, {subtleCrypto: crypto.subtle})
    ).rejects.toMatchObject({code: 'TMPOSE-POSENET-ASSET-004'});
  });

  it('starts all independent SHA-256 checks before waiting for any one file', async () => {
    const files = await sourceFiles();
    const expectedDigests = await Promise.all(
      files.map(({bytes}) => crypto.subtle.digest('SHA-256', bytes))
    );
    const gates = expectedDigests.map(() => deferred<ArrayBuffer>());
    let digestCalls = 0;
    const verification = verifyPoseNetBundle(files, {
      subtleCrypto: {
        digest() {
          const gate = gates[digestCalls];
          digestCalls += 1;
          return gate!.promise;
        }
      }
    });

    await vi.waitFor(() => expect(digestCalls).toBe(3));
    gates.forEach((gate, index) => gate.resolve(expectedDigests[index]!));
    await expect(verification).resolves.toMatchObject({manifest: poseNetBundleManifest});
  });

  it('rejects a pre-cancelled verification before hashing any file', async () => {
    const controller = new AbortController();
    controller.abort('not-needed');
    const digest = vi.fn();

    await expect(
      verifyPoseNetBundle(await sourceFiles(), {
        subtleCrypto: {digest},
        signal: controller.signal
      })
    ).rejects.toMatchObject({name: 'AbortError', code: 'TMPOSE-POSENET-ABORTED'});
    expect(digest).not.toHaveBeenCalled();
  });

  it('round-trips explicit Base64 project model data losslessly', async () => {
    const descriptor = await createPoseNetProjectBundleFromLoader(
      ({path}) => readFile(new URL(path, assetDirectory)),
      {subtleCrypto: crypto.subtle}
    );
    const restored = await loadPoseNetProjectBundle(descriptor, {
      subtleCrypto: crypto.subtle
    });

    expect(descriptor.encoding).toBe('base64');
    expect(descriptor.files.map(({path, mediaType, size}) => ({path, mediaType, size}))).toEqual(
      poseNetBundleManifest.files.map(({path, mediaType, size}) => ({path, mediaType, size}))
    );
    expect(restored.files.map(({bytes}) => bytes.byteLength)).toEqual([
      49_720,
      4_194_304,
      838_476
    ]);
  });

  it('verifies project data lazily once and serves only pinned PoseNet URLs', async () => {
    const descriptor = await createPoseNetProjectBundle(await sourceFiles(), {
      subtleCrypto: crypto.subtle
    });
    let digestCalls = 0;
    const events: string[] = [];
    const subtleCrypto = {
      digest(algorithm: AlgorithmIdentifier, data: BufferSource) {
        events.push('digest');
        digestCalls += 1;
        return crypto.subtle.digest(algorithm, data);
      }
    };
    const originalFetch = vi.fn(async () => {
      throw new Error('External fetch must not run.');
    });
    const globalObject = {
      Response,
      crypto: {subtle: subtleCrypto},
      location: {href: 'https://preview.invalid/'},
      fetch: originalFetch
    };
    let runtimeCalls = 0;
    const runtime = {
      Webcam: class {},
      async loadFromFiles() {
        events.push('classifier-start');
        runtimeCalls += 1;
        const response = await globalObject.fetch(poseNetBundleManifest.files[0].url);
        expect((await response.arrayBuffer()).byteLength).toBe(49_720);
        await expect(
          globalObject.fetch('https://example.invalid/not-posenet.bin')
        ).rejects.toMatchObject({code: 'TMPOSE-POSENET-FETCH-001'});
        return {ok: true};
      }
    };
    const wrapped = createBundledTMPoseRuntime({
      runtime,
      globalObject,
      projectBundle: descriptor,
      subtleCrypto
    });

    expect(digestCalls).toBe(0);
    await expect(wrapped.loadFromFiles({}, {}, {})).resolves.toEqual({ok: true});
    expect(digestCalls).toBe(3);
    expect(events.indexOf('classifier-start')).toBeLessThan(events.indexOf('digest'));
    await expect(wrapped.loadFromFiles({}, {}, {})).resolves.toEqual({ok: true});
    expect(digestCalls).toBe(3);
    expect(runtimeCalls).toBe(2);
    expect(originalFetch).not.toHaveBeenCalled();
    expect(globalObject.fetch).toBe(originalFetch);
  });

  it('never exposes invalid PoseNet bytes and disposes a concurrently loaded classifier', async () => {
    const files = await sourceFiles();
    files[2]!.bytes[0] ^= 0xff;
    const classifier = {dispose: vi.fn()};
    const poseNet = {dispose: vi.fn()};
    const runtime = {
      Webcam: class {},
      loadFromFiles: vi.fn(async () => ({model: classifier, posenetModel: poseNet}))
    };
    const wrapped = createBundledTMPoseRuntime({
      runtime,
      globalObject: {Response, crypto, fetch: vi.fn()},
      files,
      subtleCrypto: crypto.subtle
    });

    await expect(wrapped.loadFromFiles({}, {}, {})).rejects.toMatchObject({
      code: 'TMPOSE-POSENET-ASSET-003'
    });
    expect(runtime.loadFromFiles).toHaveBeenCalledOnce();
    expect(classifier.dispose).toHaveBeenCalledOnce();
    expect(poseNet.dispose).toHaveBeenCalledOnce();
  });

  it('drops an aborted queued load before invoking the underlying runtime', async () => {
    const firstLoad = deferred<{ok: boolean}>();
    const runtime = {
      Webcam: class {},
      loadFromFiles: vi.fn(() => firstLoad.promise)
    };
    const wrapped = createBundledTMPoseRuntime({
      runtime,
      globalObject: {Response, crypto, fetch: vi.fn()},
      files: await sourceFiles(),
      subtleCrypto: crypto.subtle
    });
    const first = wrapped.loadFromFiles({}, {}, {});
    await vi.waitFor(() => expect(runtime.loadFromFiles).toHaveBeenCalledOnce());
    const controller = new AbortController();
    const skipped = wrapped.loadFromFiles({}, {}, {}, {signal: controller.signal});
    controller.abort('superseded');

    firstLoad.resolve({ok: true});
    await expect(first).resolves.toEqual({ok: true});
    await expect(skipped).rejects.toMatchObject({
      name: 'AbortError',
      code: 'TMPOSE-POSENET-ABORTED'
    });
    expect(runtime.loadFromFiles).toHaveBeenCalledOnce();
  });

  it('disposes a late running result and restores fetch after cancellation', async () => {
    const pendingLoad = deferred<unknown>();
    const classifier = {dispose: vi.fn()};
    const poseNet = {dispose: vi.fn()};
    const originalFetch = vi.fn();
    const globalObject = {Response, crypto, fetch: originalFetch};
    const runtime = {
      Webcam: class {},
      loadFromFiles: vi.fn(() => pendingLoad.promise)
    };
    const wrapped = createBundledTMPoseRuntime({
      runtime,
      globalObject,
      files: await sourceFiles(),
      subtleCrypto: crypto.subtle
    });
    const controller = new AbortController();
    const loading = wrapped.loadFromFiles({}, {}, {}, {signal: controller.signal});
    await vi.waitFor(() => expect(runtime.loadFromFiles).toHaveBeenCalledOnce());

    controller.abort('scene-skipped');
    pendingLoad.resolve({model: classifier, posenetModel: poseNet});
    await expect(loading).rejects.toMatchObject({
      name: 'AbortError',
      code: 'TMPOSE-POSENET-ABORTED'
    });
    expect(classifier.dispose).toHaveBeenCalledOnce();
    expect(poseNet.dispose).toHaveBeenCalledOnce();
    expect(globalObject.fetch).toBe(originalFetch);
  });

  it('forwards latency-first parallel initialization only when explicitly enabled', async () => {
    const runtime = {
      Webcam: class {},
      loadFromFiles: vi.fn(async () => ({ok: true}))
    };
    const wrapped = createBundledTMPoseRuntime({
      runtime,
      globalObject: {Response, crypto, fetch: vi.fn()},
      files: await sourceFiles(),
      subtleCrypto: crypto.subtle,
      parallelModelInitialization: true
    });

    await expect(wrapped.loadFromFiles({}, {}, {})).resolves.toEqual({ok: true});
    expect(runtime.loadFromFiles.mock.calls[0]?.[3]).toEqual({
      parallelModelInitialization: true
    });
    expect(() =>
      createBundledTMPoseRuntime({
        runtime,
        files: [],
        parallelModelInitialization: 'yes' as never
      })
    ).toThrow('parallelModelInitialization must be a boolean.');
  });
});
