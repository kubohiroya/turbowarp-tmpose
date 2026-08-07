import { type AccumulatedPoseChangedEventV1 } from './extension.js';
export type { AccumulatedPoseChangedEventV1 } from './extension.js';
export interface TMPoseCompositionRuntime {
    Webcam: new (width: number, height: number, flipHorizontal: boolean) => unknown;
    loadFromFiles(model: File, weights: File, metadata: File): Promise<unknown>;
}
export interface PoseModelFileInput {
    path: unknown;
    bytes: ArrayBuffer | Uint8Array;
}
export interface PoseModelRegistrationInput {
    name: unknown;
    files: ReadonlyArray<PoseModelFileInput>;
}
export interface PoseModelRegistration {
    readonly name: string;
    readonly labels: ReadonlyArray<string>;
}
export interface AccumulatedPoseConfiguration {
    accumulationPerSecond: number;
    decayPerSecond: number;
    scoreThreshold: number;
}
export type PreviewMirroring = 'mirrored' | 'unmirrored';
export type CameraPreference = 'default' | 'front' | 'back';
export type CameraSelection = CameraPreference | Readonly<{
    deviceId: string;
}>;
export interface CameraDevice {
    readonly deviceId: string;
    readonly label: string;
}
export type AccumulatedPoseListener = (event: Readonly<AccumulatedPoseChangedEventV1>) => void;
export interface TMPoseComposition {
    registerPoseModel(input: PoseModelRegistrationInput): Promise<PoseModelRegistration>;
    activatePoseModel(name: unknown): void;
    releasePoseModel(name: unknown): Promise<void>;
    releaseAll(): Promise<void>;
    isPoseModelRegistered(name: unknown): boolean;
    getActivePoseModelName(): string | null;
    setPreviewMirroring(mode: PreviewMirroring): void;
    listCameraDevices(): Promise<ReadonlyArray<Readonly<CameraDevice>>>;
    selectCamera(selection: CameraSelection): Promise<void>;
    getCameraSelection(): CameraSelection;
    getActiveCamera(): Readonly<CameraDevice> | null;
    startCamera(): Promise<void>;
    stopCamera(): void;
    isCameraRunning(): boolean;
    startRecognition(): Promise<void>;
    stopRecognition(): void;
    isRecognizing(): boolean;
    currentPose(): string;
    confidence(): number;
    confidenceOf(name: unknown): number;
    configureAccumulatedPose(input: AccumulatedPoseConfiguration): void;
    resetAccumulatedPose(): void;
    accumulatedPose(): string;
    accumulatedScore(): number;
    accumulatedScoreOf(name: unknown): number;
    subscribeAccumulatedPose(listener: AccumulatedPoseListener): () => void;
}
export interface TMPoseCompositionOptions {
    runtime: TMPoseCompositionRuntime;
    createFile?: (bytes: Uint8Array, name: string, mimeType: string) => File;
}
export declare function createTMPoseComposition(options: TMPoseCompositionOptions): TMPoseComposition;
