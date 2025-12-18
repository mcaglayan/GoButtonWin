export {};

declare global {
  interface Window {
    app: {
      version: string;
      storage?: {
        loadShows: () => Promise<unknown>;
        saveShows: (data: unknown) => Promise<void>;
      };
      dialog?: {
        openAudioFile: () => Promise<string | null>;
      };
      audio?: {
        readFile: (filePath: string) => Promise<Uint8Array>;
        exportToneWav: (args: { hz: number; seconds?: number; suggestedName?: string }) => Promise<string | null>;
      };
      files?: {
        toFileUrl: (filePath: string) => string;
      };
      onMenuAction?: (handler: (action: 'save' | 'reload' | 'reset') => void) => void;
    };
  }
}
