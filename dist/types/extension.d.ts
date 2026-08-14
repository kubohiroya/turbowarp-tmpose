import { type FeatureFlags } from './config/feature-flags.js';
export declare const EXTENSION_ID = "tmpose";
export declare const VERSION: string;
export declare const DOCS_URI = "https://kubohiroya.github.io/turbowarp-tmpose/";
export declare const ACCUMULATED_POSE_CHANGED_EVENT = "TMPOSE_ACCUMULATED_POSE_CHANGED";
export declare const BLOCK_ICON_URI: string;
export interface TMPoseRuntime {
    Webcam: new (width: number, height: number, flipHorizontal: boolean) => any;
    load?(modelURL: string, metadataURL: string): Promise<any>;
    loadFromFiles?(model: File, weights: File, metadata: File): Promise<any>;
}
export interface TMPoseExtensionDependencies {
    runtime?: TMPoseRuntime;
    allowRemoteLibraries?: boolean;
    onAccumulatedPoseChanged?: (event: AccumulatedPoseChangedEventV1) => void;
}
export interface AccumulatedPoseChangedEventV1 {
    version: 1;
    poseName: string;
    previousPoseName: string;
    score: number;
    reason: 'prediction' | 'reset' | 'stop';
    timestamp: number;
}
export declare function loadScript(src: string): Promise<void>;
export declare class TMPoseExtension {
    [key: string]: any;
    constructor(featureFlags?: Partial<FeatureFlags>, dependencies?: TMPoseExtensionDependencies);
    getInfo(): {
        id: string;
        name: any;
        docsURI: string;
        blockIconURI: string;
        blocks: {
            arguments?: {
                [k: string]: {
                    menu?: any;
                    type: any;
                    defaultValue: any;
                };
            };
            disableMonitor?: boolean;
            opcode: any;
            blockType: any;
            text: any;
        }[];
        menus: {
            positionMenu: {
                acceptReporters: boolean;
                items: {
                    text: any;
                    value: string;
                }[];
            };
            previewMirroringMenu: {
                acceptReporters: boolean;
                items: {
                    text: any;
                    value: string;
                }[];
            };
            cameraMenu: {
                acceptReporters: boolean;
                items: string;
            };
        };
    };
    versionReporter(): string;
    setLastError(error: any): void;
    setModelURL(args: any): void;
    ensureLibrariesLoaded(): Promise<void>;
    cleanupCameraResources(): void;
    startCamera(): Promise<void>;
    stopCamera(): void;
    isCameraRunning(): any;
    getCameraMenuItems(): {
        text: any;
        value: string;
    }[];
    refreshCameraDevices(): Promise<any>;
    refreshCameraList(): Promise<void>;
    setCameraSelection(args: any): any;
    setCameraDeviceId(deviceId: any): any;
    private resolvedCameraSelection;
    private enqueueCameraSelection;
    private applyCameraSelection;
    updateActiveCameraInfo(): void;
    cameraCountReporter(): any;
    cameraDeviceIdReporter(): any;
    cameraDeviceNameReporter(): any;
    showPreview(): void;
    hidePreview(): void;
    isPreviewVisible(): any;
    setPreviewOpacity(args: any): void;
    setPreviewPosition(args: any): void;
    setPreviewMirroring(args: any): void;
    previewMirroringReporter(): "mirrored" | "unmirrored";
    loadModel(): Promise<void>;
    isModelLoaded(): boolean;
    usePreparedModel(model: any): void;
    clearPreparedModel(model: any): void;
    startPredict(): Promise<void>;
    stopPredict(): void;
    isPredicting(): any;
    findStageElement(): Element;
    findLikelyStageCanvas(): HTMLCanvasElement;
    validatePreviewAttachment(stage: any, canvas: any): void;
    attachPreviewToStage(): void;
    updatePreviewStyle(): void;
    startLoopIfNeeded(): void;
    private trackPreparedModelOperation;
    waitForPreparedModelIdle(model: object): Promise<void>;
    loop(generation?: any): Promise<void>;
    currentPoseReporter(): any;
    scoreReporter(): number;
    poseScoreReporter(args: any): number;
    setAccumulatedPoseParameters(args: any): void;
    setAccumulatedPoseThreshold(args: any): void;
    startAccumulatedPoseSession(now?: number): void;
    supportsAccumulatedPoseEvents(): any;
    emitAccumulatedPoseChanged(previousPoseName: string, reason: AccumulatedPoseChangedEventV1['reason']): void;
    dispose(): void;
    resetAccumulatedPose(reason?: AccumulatedPoseChangedEventV1['reason']): void;
    handleDocumentVisibilityChange(): void;
    updateAccumulatedPose(prediction: any, now?: number): void;
    updateAccumulatedPoseSelection(): void;
    accumulatedPoseReporter(): any;
    accumulatedScoreReporter(): any;
    accumulatedPoseScoreReporter(args: any): any;
    isPose(args: any): boolean;
    isPoseWithThreshold(args: any): boolean;
    cameraMsReporter(): any;
    modelLoadMsReporter(): any;
    firstPredictMsReporter(): any;
    lastErrorReporter(): any;
}
