import { contextBridge, ipcRenderer } from 'electron';
import { pathToFileURL } from 'node:url';

contextBridge.exposeInMainWorld('app', {
  version: '0.1.0',
  storage: {
    loadShows: () => ipcRenderer.invoke('storage:loadShows'),
    saveShows: (data: unknown) => ipcRenderer.invoke('storage:saveShows', data),
  },
  dialog: {
    openAudioFile: () => ipcRenderer.invoke('dialog:openAudioFile') as Promise<string | null>,
  },
  audio: {
    readFile: (filePath: string) => ipcRenderer.invoke('audio:readFile', filePath) as Promise<Uint8Array>,
    exportToneWav: (args: { hz: number; seconds?: number; suggestedName?: string }) =>
      ipcRenderer.invoke('audio:exportToneWav', args) as Promise<string | null>,
  },
  files: {
    toFileUrl: (filePath: string) => pathToFileURL(filePath).toString(),
  },
  onMenuAction: (handler: (action: 'save' | 'reload' | 'reset') => void) => {
    ipcRenderer.on('menu:action', (_event, action) => handler(action));
  },
});

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
