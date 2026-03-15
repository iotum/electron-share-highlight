import {
  BrowserWindow,
  desktopCapturer,
  ipcMain,
  screen,
  type Display,
} from 'electron';

import {
  IPC_START,
  IPC_STOP,
  IPC_STOP_ALL,
  type HighlightStyle,
  type ShareHighlightOptions,
  type SourceBounds,
  type StartPayload,
} from './types';

import { buildOverlayHTML } from './overlay-html';

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_STYLE: Required<HighlightStyle> = {
  color:        '#00c853',
  pulseColor:   '#69f0ae',
  borderWidth:  4,
  borderRadius: 4,
  pulseDuration: 2000,
};

const DEFAULT_OPTIONS: Required<ShareHighlightOptions> = {
  style:            DEFAULT_STYLE,
  trackingInterval: 200,
  autoCleanup:      true,
};

// ─── Internal State ──────────────────────────────────────────────────────────

interface OverlayEntry {
  window:   BrowserWindow;
  tracker?: ReturnType<typeof setInterval>;
}

const overlays = new Map<string, OverlayEntry>();
let registered = false;

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Call once during app setup (after `app.whenReady()`).
 * Registers the IPC handlers that the renderer / preload bridge uses,
 * and optionally accepts default options.
 *
 * @example
 * ```ts
 * import { registerShareHighlight } from 'electron-share-highlight';
 *
 * app.whenReady().then(() => {
 *   registerShareHighlight({ style: { color: '#ff0000' } });
 * });
 * ```
 */
export function registerShareHighlight(options: ShareHighlightOptions = {}): void {
  if (registered) return;
  registered = true;

  const resolved = mergeOptions(options);

  ipcMain.on(IPC_START, (_e: Electron.IpcMainEvent, payload: StartPayload) => {
    const style    = { ...resolved.style,            ...payload.style };
    const interval = payload.trackingInterval ?? resolved.trackingInterval;
    startHighlight(payload.sourceId, style, interval);
  });

  ipcMain.on(IPC_STOP, (_e: Electron.IpcMainEvent, sourceId: string) => {
    stopHighlight(sourceId);
  });

  ipcMain.on(IPC_STOP_ALL, () => {
    stopAllHighlights();
  });
}

/**
 * Programmatically start a highlight from the main process.
 *
 * @param sourceId  - A `desktopCapturer` source id (`screen:…` or `window:…`).
 * @param options   - Optional per-call style/tracking overrides.
 */
export async function startHighlight(
  sourceId: string,
  styleOverride?: HighlightStyle,
  trackingInterval = DEFAULT_OPTIONS.trackingInterval,
): Promise<void> {
  // Destroy any existing overlay for this source
  stopHighlight(sourceId);

  const style = { ...DEFAULT_STYLE, ...styleOverride };
  const bounds = await resolveSourceBounds(sourceId);

  if (!bounds) {
    console.warn(`[electron-share-highlight] Could not resolve bounds for: ${sourceId}`);
    return;
  }

  const overlay = createOverlayWindow(bounds, style);
  const entry: OverlayEntry = { window: overlay };

  // For window sources, poll for position/size changes
  if (sourceId.startsWith('window:')) {
    entry.tracker = setInterval(async () => {
      if (overlay.isDestroyed()) {
        clearInterval(entry.tracker);
        overlays.delete(sourceId);
        return;
      }
      const updated = await resolveSourceBounds(sourceId);
      if (updated) overlay.setBounds(updated);
    }, trackingInterval);
  }

  overlay.on('closed', () => {
    clearInterval(entry.tracker);
    overlays.delete(sourceId);
  });

  overlays.set(sourceId, entry);
}

/**
 * Stop the highlight overlay for a specific source.
 */
export function stopHighlight(sourceId: string): void {
  const entry = overlays.get(sourceId);
  if (!entry) return;
  clearInterval(entry.tracker);
  if (!entry.window.isDestroyed()) entry.window.destroy();
  overlays.delete(sourceId);
}

/**
 * Stop all active highlight overlays.
 */
export function stopAllHighlights(): void {
  for (const [id] of overlays) stopHighlight(id);
}

/**
 * Returns the source IDs currently being highlighted.
 */
export function getActiveHighlights(): string[] {
  return [...overlays.keys()];
}

// ─── Internal helpers ────────────────────────────────────────────────────────

function createOverlayWindow(
  bounds: SourceBounds,
  style: Required<HighlightStyle>,
): BrowserWindow {
  const win = new BrowserWindow({
    x:          bounds.x,
    y:          bounds.y,
    width:      bounds.width,
    height:     bounds.height,
    transparent: true,
    frame:       false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable:   false,
    hasShadow:   false,
    resizable:   false,
    movable:     false,
    webPreferences: {
      // No node integration needed — pure HTML/CSS overlay
      nodeIntegration:    false,
      contextIsolation:   true,
      devTools:           false,
    },
  });

  // Stay above fullscreen apps on macOS / Windows
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setIgnoreMouseEvents(true);

  const html = buildOverlayHTML(style);
  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

  return win;
}

async function resolveSourceBounds(sourceId: string): Promise<SourceBounds | null> {
  // ── Full-screen source ────────────────────────────────────────────────────
  if (sourceId.startsWith('screen:')) {
    return resolveScreenBounds(sourceId);
  }

  // ── Window source ─────────────────────────────────────────────────────────
  if (sourceId.startsWith('window:')) {
    return resolveWindowBounds(sourceId);
  }

  return null;
}

async function resolveScreenBounds(sourceId: string): Promise<SourceBounds | null> {
  try {
    const sources = await desktopCapturer.getSources({ types: ['screen'] });
    const source  = sources.find((s: Electron.DesktopCapturerSource) => s.id === sourceId);
    if (!source) return null;

    const displays: Display[] = screen.getAllDisplays();

    // Electron exposes display_id on the source object (not in the typedefs yet)
    const displayId = (source as any).display_id as string | undefined;
    const display   = displayId
      ? displays.find(d => String(d.id) === displayId) ?? displays[0]
      : displays[0];

    return display.bounds;
  } catch {
    return null;
  }
}

async function resolveWindowBounds(sourceId: string): Promise<SourceBounds | null> {
  // Try node-window-manager (optional dep) first
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    const { windowManager } = require('node-window-manager') as typeof import('node-window-manager');

    // sourceId format: "window:<pid>:<nativeHandle>" (varies by platform)
    const parts  = sourceId.split(':');
    const handle = parseInt(parts[2] ?? parts[1], 10);

    const windows = windowManager.getWindows();
    const win     = windows.find((w: { id: number }) => w.id === handle);

    if (win) {
      const b = win.getBounds();
      return { x: b.x, y: b.y, width: b.width, height: b.height };
    }
  } catch {
    // node-window-manager not available — fall through to fallback
  }

  // Fallback: match against existing BrowserWindows (works for Electron-owned windows)
  const parts  = sourceId.split(':');
  const handle = parseInt(parts[2] ?? parts[1], 10);

  for (const win of BrowserWindow.getAllWindows()) {
    if ((win as any).getNativeWindowHandle?.()?.readUInt32LE?.(0) === handle) {
      const [x, y] = win.getPosition();
      const [w, h] = win.getSize();
      return { x, y, width: w, height: h };
    }
  }

  return null;
}

function mergeOptions(opts: ShareHighlightOptions): Required<ShareHighlightOptions> {
  return {
    style:            { ...DEFAULT_STYLE,   ...opts.style },
    trackingInterval: opts.trackingInterval ?? DEFAULT_OPTIONS.trackingInterval,
    autoCleanup:      opts.autoCleanup      ?? DEFAULT_OPTIONS.autoCleanup,
  };
}
