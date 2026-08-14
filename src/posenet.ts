import packageMetadata from '../package.json' with {type: 'json'};

export type PoseNetBundleFileInput = Readonly<{
  path: string;
  mediaType?: string;
  bytes: Uint8Array | ArrayBuffer;
}>;

export type VerifiedPoseNetBundleFile = Readonly<{
  path: string;
  url: string;
  mediaType: string;
  bytes: Uint8Array;
}>;

export type PoseNetProjectBundleFile = Readonly<{
  path: string;
  mediaType: string;
  size: number;
  sha256: string;
  data: string;
}>;

export type PoseNetProjectBundle = Readonly<{
  formatVersion: 1;
  encoding: 'base64';
  files: ReadonlyArray<PoseNetProjectBundleFile>;
}>;

export type VerifiedPoseNetBundle = Readonly<{
  manifest: typeof poseNetBundleManifest;
  files: ReadonlyArray<VerifiedPoseNetBundleFile>;
}>;

export type TMPoseBrowserRuntime = Readonly<{
  Webcam: new (...args: any[]) => unknown;
  loadFromFiles(model: unknown, weights: unknown, metadata: unknown): Promise<unknown>;
}>;

export type BundledTMPoseRuntime = TMPoseBrowserRuntime &
  Readonly<{poseNetManifest: typeof poseNetBundleManifest}>;

type DigestRuntime = Pick<SubtleCrypto, 'digest'>;

type RuntimeGlobal = Record<PropertyKey, unknown> & {
  Response?: typeof Response;
  crypto?: {subtle?: DigestRuntime};
  fetch?: (...args: any[]) => Promise<unknown>;
  location?: {href?: string};
};

export const poseNetModelDefaults = Object.freeze({
  architecture: 'MobileNetV1',
  multiplier: 0.75,
  outputStride: 16,
  inputResolution: 257
} as const);

const poseNetBaseUrl =
  'https://storage.googleapis.com/tfjs-models/savedmodel/posenet/mobilenet/float/075/';
const poseNetPackageAssetDirectory = 'dist/posenet/mobilenet-v1-075-stride16';

const expectedFiles = Object.freeze([
  Object.freeze({
    path: 'model-stride16.json',
    url: `${poseNetBaseUrl}model-stride16.json`,
    mediaType: 'application/json',
    sha256: 'dd63bf2d3b983e8c80020749f135164beda00a33374c8a7be230b9598f24f798',
    size: 49_720,
    packagePath: `${poseNetPackageAssetDirectory}/model-stride16.json`,
    packageSpecifier: `${packageMetadata.name}/posenet-assets/model-stride16.json`,
    maxBytes: 64 * 1024
  }),
  Object.freeze({
    path: 'group1-shard1of2.bin',
    url: `${poseNetBaseUrl}group1-shard1of2.bin`,
    mediaType: 'application/octet-stream',
    sha256: 'ce6afc62f89782d43139fab76c641b281a82dee2cd2759aa036c4b28aea16439',
    size: 4_194_304,
    packagePath: `${poseNetPackageAssetDirectory}/group1-shard1of2.bin`,
    packageSpecifier: `${packageMetadata.name}/posenet-assets/group1-shard1of2.bin`,
    maxBytes: 4 * 1024 * 1024
  }),
  Object.freeze({
    path: 'group1-shard2of2.bin',
    url: `${poseNetBaseUrl}group1-shard2of2.bin`,
    mediaType: 'application/octet-stream',
    sha256: '2a35b8cfb86eb50928931e03dc30c0972fdd375f148b177ee40676b81a17692d',
    size: 838_476,
    packagePath: `${poseNetPackageAssetDirectory}/group1-shard2of2.bin`,
    packageSpecifier: `${packageMetadata.name}/posenet-assets/group1-shard2of2.bin`,
    maxBytes: 1024 * 1024
  })
]);

export const poseNetBundleManifest = Object.freeze({
  formatVersion: 1,
  distribution: Object.freeze({
    package: packageMetadata.name,
    version: packageMetadata.version,
    assetDirectory: poseNetPackageAssetDirectory
  }),
  model: poseNetModelDefaults,
  runtime: Object.freeze({
    package: '@tensorflow-models/posenet',
    version: '2.2.2'
  }),
  source: Object.freeze({
    provider: 'tensorflow',
    repository: 'https://github.com/tensorflow/tfjs-models/tree/v2.2.2/posenet',
    modelUrl: poseNetBaseUrl
  }),
  license: Object.freeze({
    spdx: 'Apache-2.0',
    notice: 'https://www.apache.org/licenses/LICENSE-2.0'
  }),
  limits: Object.freeze({
    maxFiles: expectedFiles.length,
    maxTotalBytes: 5 * 1024 * 1024
  }),
  files: expectedFiles
} as const);

export type PoseNetBundleManifestFile = (typeof poseNetBundleManifest.files)[number];

export type PoseNetBundleFileLoader = (
  file: PoseNetBundleManifestFile
) => Uint8Array | ArrayBuffer | Promise<Uint8Array | ArrayBuffer>;

export class TMPosePoseNetError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'TMPosePoseNetError';
    this.code = code;
  }
}

function fail(code: string, message: string): never {
  throw new TMPosePoseNetError(code, message);
}

function isRecord(value: unknown): value is Record<PropertyKey, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireBytes(value: unknown, label: string): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return fail('TMPOSE-POSENET-ASSET-001', `${label} must be a Uint8Array or ArrayBuffer.`);
}

function requireSubtleCrypto(value: unknown): DigestRuntime {
  if (!isRecord(value) || typeof value.digest !== 'function') {
    return fail('TMPOSE-POSENET-ASSET-001', 'Web Crypto subtle.digest is required.');
  }
  return value as unknown as DigestRuntime;
}

async function sha256(bytes: Uint8Array, subtleCrypto: DigestRuntime): Promise<string> {
  const digest = await subtleCrypto.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)]
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

function encodeBase64(bytes: Uint8Array): string {
  if (typeof btoa !== 'function') {
    return fail('TMPOSE-POSENET-ASSET-001', 'Base64 encoding requires btoa.');
  }
  const chunks: string[] = [];
  const chunkSize = 32 * 1024;
  for (let offset = 0; offset < bytes.byteLength; offset += chunkSize) {
    const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.byteLength));
    let binary = '';
    for (const value of chunk) binary += String.fromCharCode(value);
    chunks.push(binary);
  }
  return btoa(chunks.join(''));
}

function isBase64Character(code: number): boolean {
  return (
    (code >= 65 && code <= 90) ||
    (code >= 97 && code <= 122) ||
    (code >= 48 && code <= 57) ||
    code === 43 ||
    code === 47
  );
}

function hasValidBase64Alphabet(value: string): boolean {
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  const dataLength = value.length - padding;
  for (let index = 0; index < dataLength; index += 1) {
    if (!isBase64Character(value.charCodeAt(index))) return false;
  }
  return dataLength > 0;
}

function decodeBase64(value: unknown, label: string, maxBytes: number): Uint8Array {
  const maximumLength = Math.ceil(maxBytes / 3) * 4;
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > maximumLength ||
    value.length % 4 !== 0 ||
    !hasValidBase64Alphabet(value)
  ) {
    return fail('TMPOSE-POSENET-ASSET-001', `${label} must be bounded padded Base64.`);
  }
  if (typeof atob !== 'function') {
    return fail('TMPOSE-POSENET-ASSET-001', 'Base64 decoding requires atob.');
  }
  let decoded: string;
  try {
    decoded = atob(value);
  } catch (error) {
    return fail(
      'TMPOSE-POSENET-ASSET-001',
      `${label} is invalid Base64: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  if (decoded.length > maxBytes) {
    return fail('TMPOSE-POSENET-ASSET-004', `${label} exceeds its decoded byte limit.`);
  }
  const bytes = new Uint8Array(decoded.length);
  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }
  return bytes;
}

function canonicalProjectBundle(descriptor: unknown): PoseNetProjectBundle {
  if (
    !isRecord(descriptor) ||
    descriptor.formatVersion !== 1 ||
    descriptor.encoding !== 'base64' ||
    !Array.isArray(descriptor.files) ||
    descriptor.files.length !== expectedFiles.length
  ) {
    return fail('TMPOSE-POSENET-ASSET-001', 'PoseNet project bundle format is invalid.');
  }
  const files = expectedFiles.map((expected): PoseNetProjectBundleFile => {
    const candidate = descriptor.files.find(
      (file) => isRecord(file) && file.path === expected.path
    );
    if (
      !isRecord(candidate) ||
      candidate.mediaType !== expected.mediaType ||
      candidate.sha256 !== expected.sha256 ||
      !Number.isSafeInteger(candidate.size) ||
      Number(candidate.size) !== expected.size ||
      typeof candidate.data !== 'string'
    ) {
      return fail(
        'TMPOSE-POSENET-ASSET-001',
        `PoseNet project file metadata is invalid: ${expected.path}.`
      );
    }
    return Object.freeze({
      path: expected.path,
      mediaType: expected.mediaType,
      size: Number(candidate.size),
      sha256: expected.sha256,
      data: candidate.data
    });
  });
  return Object.freeze({formatVersion: 1, encoding: 'base64', files: Object.freeze(files)});
}

function decodeProjectBundle(descriptor: unknown): ReadonlyArray<PoseNetBundleFileInput> {
  const canonical = canonicalProjectBundle(descriptor);
  return Object.freeze(
    canonical.files.map((candidate, index) => {
      const expected = expectedFiles[index]!;
      const bytes = decodeBase64(
        candidate.data,
        `PoseNet project file ${expected.path}`,
        expected.size
      );
      if (bytes.byteLength !== candidate.size) {
        return fail(
          'TMPOSE-POSENET-ASSET-004',
          `PoseNet project file size does not match: ${expected.path}.`
        );
      }
      return Object.freeze({path: expected.path, mediaType: expected.mediaType, bytes});
    })
  );
}

export async function verifyPoseNetBundle(
  files: ReadonlyArray<PoseNetBundleFileInput>,
  {subtleCrypto = globalThis.crypto?.subtle}: {subtleCrypto?: DigestRuntime} = {}
): Promise<VerifiedPoseNetBundle> {
  const digestRuntime = requireSubtleCrypto(subtleCrypto);
  if (!Array.isArray(files) || files.length !== expectedFiles.length) {
    return fail('TMPOSE-POSENET-ASSET-004', 'PoseNet bundle must contain exactly three files.');
  }
  const verifiedFiles: VerifiedPoseNetBundleFile[] = [];
  let totalBytes = 0;
  for (const expected of expectedFiles) {
    const candidate = files.find((file) => isRecord(file) && file.path === expected.path);
    if (!candidate) {
      return fail('TMPOSE-POSENET-ASSET-002', `PoseNet file is missing: ${expected.path}.`);
    }
    const bytes = requireBytes(candidate.bytes, `PoseNet file ${expected.path}`);
    if (bytes.byteLength !== expected.size) {
      return fail(
        'TMPOSE-POSENET-ASSET-004',
        `PoseNet file size is invalid: ${expected.path}.`
      );
    }
    totalBytes += bytes.byteLength;
    if ((await sha256(bytes, digestRuntime)) !== expected.sha256) {
      return fail(
        'TMPOSE-POSENET-ASSET-003',
        `PoseNet file integrity mismatch: ${expected.path}.`
      );
    }
    verifiedFiles.push(
      Object.freeze({
        path: expected.path,
        url: expected.url,
        mediaType: expected.mediaType,
        bytes: new Uint8Array(bytes)
      })
    );
  }
  if (totalBytes > poseNetBundleManifest.limits.maxTotalBytes) {
    return fail('TMPOSE-POSENET-ASSET-004', 'PoseNet bundle exceeds its total byte limit.');
  }
  const jsonFile = verifiedFiles.find(({path}) => path === 'model-stride16.json');
  if (!jsonFile) {
    return fail('TMPOSE-POSENET-ASSET-002', 'PoseNet model JSON is missing.');
  }
  let modelJson: unknown;
  try {
    modelJson = JSON.parse(new TextDecoder().decode(jsonFile.bytes));
  } catch (error) {
    return fail(
      'TMPOSE-POSENET-ASSET-001',
      `PoseNet model JSON is invalid: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  const weightsManifest =
    isRecord(modelJson) && Array.isArray(modelJson.weightsManifest)
      ? modelJson.weightsManifest
      : [];
  const manifestPaths = weightsManifest.flatMap((entry) =>
    isRecord(entry) && Array.isArray(entry.paths) ? entry.paths : []
  );
  const expectedShardPaths = expectedFiles
    .filter(({path}) => path.endsWith('.bin'))
    .map(({path}) => path);
  if (
    manifestPaths.length !== expectedShardPaths.length ||
    expectedShardPaths.some((path) => !manifestPaths.includes(path))
  ) {
    return fail(
      'TMPOSE-POSENET-ASSET-001',
      'PoseNet model JSON references unexpected weight shards.'
    );
  }
  return Object.freeze({
    manifest: poseNetBundleManifest,
    files: Object.freeze(verifiedFiles)
  });
}

export async function loadPoseNetBundle(
  loadFile: PoseNetBundleFileLoader,
  options: {subtleCrypto?: DigestRuntime} = {}
): Promise<VerifiedPoseNetBundle> {
  if (typeof loadFile !== 'function') throw new TypeError('PoseNet file loader is required.');
  const files = await Promise.all(
    expectedFiles.map(async (file) =>
      Object.freeze({
        path: file.path,
        mediaType: file.mediaType,
        bytes: requireBytes(await loadFile(file), `PoseNet file ${file.path}`)
      })
    )
  );
  return verifyPoseNetBundle(files, options);
}

export async function createPoseNetProjectBundle(
  files: ReadonlyArray<PoseNetBundleFileInput>,
  options: {subtleCrypto?: DigestRuntime} = {}
): Promise<PoseNetProjectBundle> {
  const verified = await verifyPoseNetBundle(files, options);
  return createProjectBundleFromVerified(verified);
}

function createProjectBundleFromVerified(verified: VerifiedPoseNetBundle): PoseNetProjectBundle {
  return Object.freeze({
    formatVersion: 1,
    encoding: 'base64',
    files: Object.freeze(
      verified.files.map((file, index) =>
        Object.freeze({
          path: file.path,
          mediaType: file.mediaType,
          size: file.bytes.byteLength,
          sha256: expectedFiles[index]!.sha256,
          data: encodeBase64(file.bytes)
        })
      )
    )
  });
}

export async function createPoseNetProjectBundleFromLoader(
  loadFile: PoseNetBundleFileLoader,
  options: {subtleCrypto?: DigestRuntime} = {}
): Promise<PoseNetProjectBundle> {
  return createProjectBundleFromVerified(await loadPoseNetBundle(loadFile, options));
}

export async function loadPoseNetProjectBundle(
  descriptor: unknown,
  options: {subtleCrypto?: DigestRuntime} = {}
): Promise<VerifiedPoseNetBundle> {
  return verifyPoseNetBundle(decodeProjectBundle(descriptor), options);
}

export async function validatePoseNetProjectBundle(
  descriptor: unknown,
  options: {subtleCrypto?: DigestRuntime} = {}
): Promise<PoseNetProjectBundle> {
  await loadPoseNetProjectBundle(descriptor, options);
  return canonicalProjectBundle(descriptor);
}

function validateRuntime(value: unknown): TMPoseBrowserRuntime {
  if (
    !isRecord(value) ||
    typeof value.Webcam !== 'function' ||
    typeof value.loadFromFiles !== 'function'
  ) {
    return fail(
      'TMPOSE-POSENET-RUNTIME-001',
      'TMPose runtime must provide Webcam and loadFromFiles.'
    );
  }
  return value as unknown as TMPoseBrowserRuntime;
}

function requestUrl(input: unknown, baseUrl: string): string | null {
  const value = typeof input === 'string' ? input : isRecord(input) ? input.url : undefined;
  if (typeof value !== 'string') return null;
  try {
    return new URL(value, baseUrl).href;
  } catch {
    return null;
  }
}

export function createBundledTMPoseRuntime(options: {
  runtime: TMPoseBrowserRuntime;
  globalObject?: RuntimeGlobal;
  files?: ReadonlyArray<PoseNetBundleFileInput>;
  loadFiles?: () =>
    | ReadonlyArray<PoseNetBundleFileInput>
    | Promise<ReadonlyArray<PoseNetBundleFileInput>>;
  projectBundle?: PoseNetProjectBundle;
  subtleCrypto?: DigestRuntime;
}): BundledTMPoseRuntime {
  if (!isRecord(options)) throw new TypeError('PoseNet runtime options are required.');
  const runtime = validateRuntime(options.runtime);
  const globalObject = (options.globalObject ?? globalThis) as RuntimeGlobal;
  const ResponseConstructor = globalObject.Response ?? globalThis.Response;
  if (typeof ResponseConstructor !== 'function') {
    return fail('TMPOSE-POSENET-RUNTIME-001', 'Response constructor is required.');
  }
  const supplyCount = [options.files, options.loadFiles, options.projectBundle].filter(
    (value) => value !== undefined
  ).length;
  if (supplyCount !== 1) {
    throw new TypeError('Provide exactly one of files, loadFiles, or projectBundle.');
  }
  let verification: Promise<VerifiedPoseNetBundle> | undefined;
  const verifySupply = () => {
    verification ??= options.projectBundle
      ? loadPoseNetProjectBundle(options.projectBundle, {
          subtleCrypto: options.subtleCrypto ?? globalObject.crypto?.subtle
        })
      : Promise.resolve(
          options.loadFiles ? options.loadFiles() : options.files as ReadonlyArray<PoseNetBundleFileInput>
        ).then((files) =>
          verifyPoseNetBundle(files, {
            subtleCrypto: options.subtleCrypto ?? globalObject.crypto?.subtle
          })
        );
    return verification;
  };
  let previousLoad: Promise<unknown> = Promise.resolve();

  async function loadFromFiles(model: unknown, weights: unknown, metadata: unknown): Promise<unknown> {
    const task = async () => {
      const bundle = await verifySupply();
      const byUrl = new Map(bundle.files.map((file) => [file.url, file]));
      const previousFetch = globalObject.fetch;
      if (typeof previousFetch !== 'function') {
        return fail('TMPOSE-POSENET-RUNTIME-001', 'Browser fetch is required.');
      }
      const baseUrl = globalObject.location?.href ?? 'http://localhost/';
      const localFetch = async (input: unknown): Promise<Response> => {
        const url = requestUrl(input, baseUrl);
        const file = url ? byUrl.get(url) : undefined;
        if (!file) {
          return fail(
            'TMPOSE-POSENET-FETCH-001',
            `Unexpected PoseNet request: ${url ?? '(invalid)'}.`
          );
        }
        return new ResponseConstructor(file.bytes.slice().buffer as ArrayBuffer, {
          status: 200,
          headers: {'content-type': file.mediaType}
        });
      };
      try {
        globalObject.fetch = localFetch;
      } catch (error) {
        return fail(
          'TMPOSE-POSENET-FETCH-001',
          `PoseNet fetch interception is unavailable: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
      try {
        return await runtime.loadFromFiles(model, weights, metadata);
      } finally {
        if (globalObject.fetch === localFetch) {
          try {
            globalObject.fetch = previousFetch;
          } catch {
            // Preserve the original runtime result when a host makes fetch non-writable mid-load.
          }
        }
      }
    };
    const current = previousLoad.then(task, task);
    previousLoad = current.catch(() => undefined);
    return current;
  }

  return Object.freeze({
    Webcam: runtime.Webcam,
    loadFromFiles,
    poseNetManifest: poseNetBundleManifest
  });
}
