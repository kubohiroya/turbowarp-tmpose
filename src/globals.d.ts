interface TurboWarpExtension {
  getInfo(): Record<string, unknown>;
}

interface ScratchApi {
  extensions: {
    unsandboxed: boolean;
    register(extension: TurboWarpExtension): void;
  };
  vm?: {
    runtime?: {
      emit(eventName: string, payload: unknown): void;
      ext_tmpose?: {
        supportsAccumulatedPoseEvents(): boolean;
      };
    };
  };
  BlockType: Record<'COMMAND' | 'REPORTER' | 'BOOLEAN' | 'HAT', string>;
  ArgumentType: Record<'STRING' | 'NUMBER' | 'BOOLEAN', string>;
  translate(
    value: string | {default: string; description?: string},
    placeholders?: Record<string, string | number>
  ): string;
}

declare const Scratch: ScratchApi;
declare const tmPose: any;
