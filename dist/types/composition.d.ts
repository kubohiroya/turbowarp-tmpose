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
export interface TMPoseComposition {
    registerPoseModel(input: PoseModelRegistrationInput): Promise<PoseModelRegistration>;
    activatePoseModel(name: unknown): void;
    releasePoseModel(name: unknown): Promise<void>;
    releaseAll(): Promise<void>;
    isPoseModelRegistered(name: unknown): boolean;
    getActivePoseModelName(): string | null;
    startCamera(): Promise<void>;
    stopCamera(): void;
    isCameraRunning(): boolean;
    startRecognition(): Promise<void>;
    stopRecognition(): void;
    isRecognizing(): boolean;
    currentPose(): string;
    confidence(): number;
    confidenceOf(name: unknown): number;
}
export interface TMPoseCompositionOptions {
    runtime: TMPoseCompositionRuntime;
    createFile?: (bytes: Uint8Array, name: string, mimeType: string) => File;
}
export declare function createTMPoseComposition(options: TMPoseCompositionOptions): TMPoseComposition;
