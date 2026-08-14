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
export type BundledTMPoseRuntime = TMPoseBrowserRuntime & Readonly<{
    poseNetManifest: typeof poseNetBundleManifest;
}>;
type DigestRuntime = Pick<SubtleCrypto, 'digest'>;
type RuntimeGlobal = Record<PropertyKey, unknown> & {
    Response?: typeof Response;
    crypto?: {
        subtle?: DigestRuntime;
    };
    fetch?: (...args: any[]) => Promise<unknown>;
    location?: {
        href?: string;
    };
};
export declare const poseNetModelDefaults: Readonly<{
    readonly architecture: "MobileNetV1";
    readonly multiplier: 0.75;
    readonly outputStride: 16;
    readonly inputResolution: 257;
}>;
export declare const poseNetBundleManifest: Readonly<{
    readonly formatVersion: 1;
    readonly distribution: Readonly<{
        package: string;
        version: string;
        assetDirectory: "dist/posenet/mobilenet-v1-075-stride16";
    }>;
    readonly model: Readonly<{
        readonly architecture: "MobileNetV1";
        readonly multiplier: 0.75;
        readonly outputStride: 16;
        readonly inputResolution: 257;
    }>;
    readonly runtime: Readonly<{
        package: "@tensorflow-models/posenet";
        version: "2.2.2";
    }>;
    readonly source: Readonly<{
        provider: "tensorflow";
        repository: "https://github.com/tensorflow/tfjs-models/tree/v2.2.2/posenet";
        modelUrl: "https://storage.googleapis.com/tfjs-models/savedmodel/posenet/mobilenet/float/075/";
    }>;
    readonly license: Readonly<{
        spdx: "Apache-2.0";
        notice: "https://www.apache.org/licenses/LICENSE-2.0";
    }>;
    readonly limits: Readonly<{
        maxFiles: number;
        maxTotalBytes: number;
    }>;
    readonly files: readonly (Readonly<{
        path: "model-stride16.json";
        url: "https://storage.googleapis.com/tfjs-models/savedmodel/posenet/mobilenet/float/075/model-stride16.json";
        mediaType: "application/json";
        sha256: "dd63bf2d3b983e8c80020749f135164beda00a33374c8a7be230b9598f24f798";
        size: 49720;
        packagePath: "dist/posenet/mobilenet-v1-075-stride16/model-stride16.json";
        packageSpecifier: `${string}/posenet-assets/model-stride16.json`;
        maxBytes: number;
    }> | Readonly<{
        path: "group1-shard1of2.bin";
        url: "https://storage.googleapis.com/tfjs-models/savedmodel/posenet/mobilenet/float/075/group1-shard1of2.bin";
        mediaType: "application/octet-stream";
        sha256: "ce6afc62f89782d43139fab76c641b281a82dee2cd2759aa036c4b28aea16439";
        size: 4194304;
        packagePath: "dist/posenet/mobilenet-v1-075-stride16/group1-shard1of2.bin";
        packageSpecifier: `${string}/posenet-assets/group1-shard1of2.bin`;
        maxBytes: number;
    }> | Readonly<{
        path: "group1-shard2of2.bin";
        url: "https://storage.googleapis.com/tfjs-models/savedmodel/posenet/mobilenet/float/075/group1-shard2of2.bin";
        mediaType: "application/octet-stream";
        sha256: "2a35b8cfb86eb50928931e03dc30c0972fdd375f148b177ee40676b81a17692d";
        size: 838476;
        packagePath: "dist/posenet/mobilenet-v1-075-stride16/group1-shard2of2.bin";
        packageSpecifier: `${string}/posenet-assets/group1-shard2of2.bin`;
        maxBytes: number;
    }>)[];
}>;
export type PoseNetBundleManifestFile = (typeof poseNetBundleManifest.files)[number];
export type PoseNetBundleFileLoader = (file: PoseNetBundleManifestFile) => Uint8Array | ArrayBuffer | Promise<Uint8Array | ArrayBuffer>;
export declare class TMPosePoseNetError extends Error {
    readonly code: string;
    constructor(code: string, message: string);
}
export declare function verifyPoseNetBundle(files: ReadonlyArray<PoseNetBundleFileInput>, { subtleCrypto }?: {
    subtleCrypto?: DigestRuntime;
}): Promise<VerifiedPoseNetBundle>;
export declare function loadPoseNetBundle(loadFile: PoseNetBundleFileLoader, options?: {
    subtleCrypto?: DigestRuntime;
}): Promise<VerifiedPoseNetBundle>;
export declare function createPoseNetProjectBundle(files: ReadonlyArray<PoseNetBundleFileInput>, options?: {
    subtleCrypto?: DigestRuntime;
}): Promise<PoseNetProjectBundle>;
export declare function createPoseNetProjectBundleFromLoader(loadFile: PoseNetBundleFileLoader, options?: {
    subtleCrypto?: DigestRuntime;
}): Promise<PoseNetProjectBundle>;
export declare function loadPoseNetProjectBundle(descriptor: unknown, options?: {
    subtleCrypto?: DigestRuntime;
}): Promise<VerifiedPoseNetBundle>;
export declare function validatePoseNetProjectBundle(descriptor: unknown, options?: {
    subtleCrypto?: DigestRuntime;
}): Promise<PoseNetProjectBundle>;
export declare function createBundledTMPoseRuntime(options: {
    runtime: TMPoseBrowserRuntime;
    globalObject?: RuntimeGlobal;
    files?: ReadonlyArray<PoseNetBundleFileInput>;
    loadFiles?: () => ReadonlyArray<PoseNetBundleFileInput> | Promise<ReadonlyArray<PoseNetBundleFileInput>>;
    projectBundle?: PoseNetProjectBundle;
    subtleCrypto?: DigestRuntime;
}): BundledTMPoseRuntime;
export {};
