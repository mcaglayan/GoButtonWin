import { app, BrowserWindow, Menu, dialog, ipcMain, screen, shell } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';
import { loadPersistedShows, savePersistedShows, type PersistedData } from './storage';
import { startRemoteServer, type RemoteCommand } from './remoteServer';

const isDev = !app.isPackaged;
let mainWindow: BrowserWindow | null = null;
let remoteServer: { close: () => Promise<void> } | null = null;

function sendMenuAction(action: 'save' | 'reload' | 'reset') {
  if (!mainWindow) return;
  mainWindow.webContents.send('menu:action', action);
}

function buildAppMenu() {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Save',
          accelerator: 'Ctrl+S',
          click: () => sendMenuAction('save'),
        },
        {
          label: 'Reload from Disk',
          accelerator: 'Ctrl+R',
          click: () => sendMenuAction('reload'),
        },
        {
          label: 'Reset to Seed Data',
          click: () => sendMenuAction('reset'),
        },
        { type: 'separator' },
        {
          label: 'Open Data Folder',
          click: async () => {
            await shell.openPath(app.getPath('userData'));
          },
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  const { width: workW, height: workH } = screen.getPrimaryDisplay().workAreaSize;
  // Target a comfortably-large default UI size, but clamp to the available work area.
  const contentW = Math.min(1400, Math.max(1100, workW));
  const contentH = Math.min(860, Math.max(700, workH));

  const win = new BrowserWindow({
    // On Windows, the window frame/title bar reduces the available content area.
    // useContentSize makes the width/height apply to the web contents so the UI isn't clipped.
    useContentSize: true,
    width: contentW,
    height: contentH,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#0b2a33',
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow = win;

  // Ensure DevTools ends up closed on initialization.
  // (In dev, it's easy to accidentally leave it open; this keeps startup clean.)
  win.webContents.once('did-finish-load', () => {
    win.webContents.closeDevTools();
  });

  if (isDev) {
    win.loadURL('http://127.0.0.1:5174');
  } else {
    win.loadFile(path.join(__dirname, '../../dist-renderer/index.html'));
  }
}

function sendRemoteCommand(cmd: RemoteCommand) {
  if (!mainWindow) return;
  mainWindow.webContents.send('remote:command', cmd);
}

app.whenReady().then(() => {
  buildAppMenu();

  ipcMain.handle('storage:loadShows', async () => {
    // Helpful for verifying persistence location during development.
    console.log('[storage] userData:', app.getPath('userData'));
    return await loadPersistedShows();
  });

  ipcMain.handle('storage:saveShows', async (_event, data: PersistedData) => {
    console.log('[storage] save shows.json');
    await savePersistedShows(data);
  });

  ipcMain.handle('dialog:openAudioFile', async () => {
    const res = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Audio', extensions: ['wav', 'mp3', 'aiff', 'aif', 'm4a', 'ogg', 'flac'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    if (res.canceled || res.filePaths.length === 0) return null;
    return res.filePaths[0];
  });

  ipcMain.handle('audio:readFile', async (_event, filePath: string) => {
    const buf = await fs.readFile(filePath);
    return buf;
  });

  ipcMain.handle(
    'audio:exportToneWav',
    async (_event, args: { hz: number; seconds?: number; suggestedName?: string }) => {
      const hz = Number(args?.hz);
      if (!Number.isFinite(hz) || hz <= 0) return null;

      const secondsRaw = Number(args?.seconds ?? 1.0);
      const seconds = Number.isFinite(secondsRaw) ? Math.min(60, Math.max(0.05, secondsRaw)) : 1.0;

      const suggestedBase = (args?.suggestedName ?? `Tone ${hz}Hz`).trim() || `Tone ${hz}Hz`;

      const res = await dialog.showSaveDialog({
        title: 'Export Tone as WAV',
        defaultPath: `${suggestedBase}.wav`,
        filters: [{ name: 'WAV', extensions: ['wav'] }],
      });
      if (res.canceled || !res.filePath) return null;

      const outPath = res.filePath.toLowerCase().endsWith('.wav') ? res.filePath : `${res.filePath}.wav`;

      const sampleRate = 44100;
      const numChannels = 1;
      const bytesPerSample = 2; // 16-bit PCM
      const totalSamples = Math.floor(seconds * sampleRate);

      const dataSize = totalSamples * numChannels * bytesPerSample;
      const buffer = Buffer.allocUnsafe(44 + dataSize);

      buffer.write('RIFF', 0);
      buffer.writeUInt32LE(36 + dataSize, 4);
      buffer.write('WAVE', 8);

      buffer.write('fmt ', 12);
      buffer.writeUInt32LE(16, 16);
      buffer.writeUInt16LE(1, 20);
      buffer.writeUInt16LE(numChannels, 22);
      buffer.writeUInt32LE(sampleRate, 24);
      buffer.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28);
      buffer.writeUInt16LE(numChannels * bytesPerSample, 32);
      buffer.writeUInt16LE(16, 34);

      buffer.write('data', 36);
      buffer.writeUInt32LE(dataSize, 40);

      const fadeSamples = Math.min(Math.floor(sampleRate * 0.01), Math.floor(totalSamples / 2));
      const twoPi = Math.PI * 2;

      let o = 44;
      for (let i = 0; i < totalSamples; i++) {
        const t = i / sampleRate;
        let amp = Math.sin(twoPi * hz * t);

        if (fadeSamples > 0) {
          if (i < fadeSamples) amp *= i / fadeSamples;
          else if (i > totalSamples - fadeSamples) amp *= (totalSamples - i) / fadeSamples;
        }

        const s = Math.max(-1, Math.min(1, amp));
        buffer.writeInt16LE(Math.round(s * 32767), o);
        o += 2;
      }

      await fs.writeFile(outPath, buffer);
      return outPath;
    }
  );

  createWindow();

  // LAN remote control (browser on a laptop -> HTTP -> Electron -> renderer)
  // Note: Windows Firewall may prompt the first time.
  if (!remoteServer) {
    remoteServer = startRemoteServer({
      port: 17832,
      onCommand: (cmd) => sendRemoteCommand(cmd),
    });
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', async () => {
  if (remoteServer) {
    try {
      await remoteServer.close();
    } catch {
      // ignore
    }
    remoteServer = null;
  }
});
