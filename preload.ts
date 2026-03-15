/**
 * electron-share-highlight/preload
 *
 * Include this in your app's preload script:
 *
 *   import 'electron-share-highlight/preload';
 *   // or
 *   require('electron-share-highlight/preload');
 *
 * This exposes `window.__esh` on the renderer side, which the renderer
 * helper (electron-share-highlight/renderer) uses automatically.
 */

import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC_START,
  IPC_STOP,
  IPC_STOP_ALL,
  type HighlightStyle,
  type StartPayload,
} from './types';

const api = {
  start(payload: StartPayload): void {
    ipcRenderer.send(IPC_START, payload);
  },
  stop(sourceId: string): void {
    ipcRenderer.send(IPC_STOP, sourceId);
  },
  stopAll(): void {
    ipcRenderer.send(IPC_STOP_ALL);
  },
};

// Expose under a private namespace to avoid conflicts
contextBridge.exposeInMainWorld('__esh', api);

export type EshBridge = typeof api;
