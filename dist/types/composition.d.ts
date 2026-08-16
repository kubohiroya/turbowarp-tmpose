import { type AccumulatedPoseChangedEventV2 } from './extension.js';
import { type PoseBoneStyle, type PoseJointStyle, type PoseKeypointName, type PoseOverlayConfidenceScaling } from './pose-overlay.js';
export type { AccumulatedPoseChangedEventV2 } from './extension.js';
export type { PoseBoneStyle, PoseJointStyle, PoseKeypointName, PoseOverlayConfidenceScaling } from './pose-overlay.js';
export interface TMPoseCompositionRuntime {
    Webcam: new (width: number, height: number, flipHorizontal: boolean) => unknown;
    loadFromFiles(model: File, weights: File, metadata: File, options?: Readonly<{
        signal?: AbortSignal;
        parallelModelInitialization?: boolean;
    }>): Promise<unknown>;
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
export interface PoseModelRegistrationOptions {
    signal?: AbortSignal;
}
export type PoseModelInitializationPolicy = 'legacy' | 'latest-needed';
export interface AccumulatedPoseConfiguration {
    accumulationPerSecond: number;
    decayPerSecond: number;
    scoreThreshold: number;
}
export type PreviewMirroring = 'mirrored' | 'unmirrored';
export type PreviewPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center' | 'full-stage';
export type CameraPreference = 'default' | 'front' | 'back';
export type CameraSelection = CameraPreference | Readonly<{
    deviceId: string;
}>;
export interface CameraDevice {
    readonly deviceId: string;
    readonly label: string;
}
export type AccumulatedPoseListener = (event: Readonly<AccumulatedPoseChangedEventV2>) => void;
export interface TMPoseComposition {
    registerPoseModel(input: PoseModelRegistrationInput, options?: PoseModelRegistrationOptions): Promise<PoseModelRegistration>;
    activatePoseModel(name: unknown): void;
    releasePoseModel(name: unknown): Promise<void>;
    releaseAll(): Promise<void>;
    isPoseModelRegistered(name: unknown): boolean;
    getActivePoseModelName(): string | null;
    showPreview(): void;
    hidePreview(): void;
    isPreviewVisible(): boolean;
    setPreviewOpacity(opacity: number): void;
    setPreviewPosition(position: PreviewPosition): void;
    setPreviewMirroring(mode: PreviewMirroring): void;
    showPoseOverlay(): void;
    hidePoseOverlay(): void;
    isPoseOverlayVisible(): boolean;
    setPoseJointStyle(part: PoseKeypointName, style: PoseJointStyle): void;
    setPoseBoneStyle(style: PoseBoneStyle): void;
    setPoseOverlayMinimumConfidence(confidence: number): void;
    setPoseOverlayConfidenceScaling(options: PoseOverlayConfidenceScaling): void;
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
    modelInitializationPolicy?: PoseModelInitializationPolicy;
    parallelModelInitialization?: boolean;
}
export declare function createTMPoseComposition(options: TMPoseCompositionOptions): TMPoseComposition;
