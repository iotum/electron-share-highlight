# electron-share-highlight

> Draw a live highlight border around any screen or window being shared — just like Zoom, Meet, and Teams do.

---

## How it works

When a screen share starts, the plugin creates a **transparent, frameless, always-on-top `BrowserWindow`** sized to match the capture target. It renders only a colored border, is fully click-through, and never steals focus. For window-level shares it continuously polls the target's position so the overlay tracks it as it moves or resizes.

```
Your App (renderer)          Main Process                Overlay Window
      │                           │                            │
      │  getUserMedia(sourceId)   │                            │
      │──────────────────────────►│                            │
      │                           │  resolve bounds(sourceId)  │
      │                           │  create BrowserWindow      │
      │                           │──────────────────────────► │
      │       stream              │                     [green border]
      │◄──────────────────────────│                            │
      │                           │                            │
      │  (stream.ended)           │                            │
      │──────────────────────────►│  destroy overlay           │
      │                           │──────────────────────────► │
```

---

## Installation

```bash
npm install electron-share-highlight

# Optional: enables tracking of non-Electron windows
npm install node-window-manager
```

---

## Quick Start

### 1. Main process — register the plugin

```ts
// main.ts
import { app, BrowserWindow } from 'electron';
import { registerShareHighlight } from 'electron-share-highlight';

app.whenReady().then(() => {
  registerShareHighlight(); // uses defaults

  const win = new BrowserWindow({
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  win.loadFile('index.html');
});
```

### 2. Preload — expose the bridge

```ts
// preload.ts
import 'electron-share-highlight/preload';
// your other contextBridge calls…
```

### 3. Renderer — use the wrapper

```ts
// renderer.ts
import { getDisplayMediaWithHighlight } from 'electron-share-highlight/renderer';

async function startShare(sourceId: string) {
  const stream = await getDisplayMediaWithHighlight({
    sourceId,
    style: { color: '#00c853' },
  });

  videoElement.srcObject = stream;
  // Highlight appears automatically.
  // Disappears automatically when stream.getVideoTracks()[0] fires 'ended'.
}
```

---

## API

### Main Process — `electron-share-highlight`

#### `registerShareHighlight(options?)`

Call once after `app.whenReady()`. Sets up IPC handlers.

```ts
registerShareHighlight({
  style: {
    color:         '#00c853', // border color
    pulseColor:    '#69f0ae', // pulse/animation color
    borderWidth:   4,         // px
    borderRadius:  4,         // px
    pulseDuration: 2000,      // ms — set 0 to disable animation
  },
  trackingInterval: 200,      // ms — how often to re-check window position
  autoCleanup:      true,     // destroy overlays when source window closes
});
```

#### `startHighlight(sourceId, style?, trackingInterval?)`

Programmatically start a highlight from the main process.

```ts
import { startHighlight } from 'electron-share-highlight';

await startHighlight('screen:0:0', { color: '#ff4500' });
```

#### `stopHighlight(sourceId)`

Stop a specific overlay.

#### `stopAllHighlights()`

Destroy all active overlays.

#### `getActiveHighlights(): string[]`

Returns an array of source IDs currently being highlighted.

---

### Renderer Process — `electron-share-highlight/renderer`

#### `getDisplayMediaWithHighlight(opts)`

Wraps `getUserMedia` for Electron screen capture and manages the highlight lifecycle automatically.

```ts
const stream = await getDisplayMediaWithHighlight({
  sourceId:         selectedSource.id,
  style:            { color: '#ff0000', borderWidth: 6 },
  trackingInterval: 150,
  constraints:      { audio: true },
});
```

#### `startHighlight(sourceId, style?, trackingInterval?)`

Manually show a highlight from the renderer.

#### `stopHighlight(sourceId)`

Manually hide a highlight from the renderer.

#### `stopAllHighlights()`

Hide all highlights from the renderer.

#### `patchGetDisplayMedia(style?)`

Monkey-patches `navigator.mediaDevices.getDisplayMedia` globally. Useful when you don't control the call site (third-party SDKs, WebRTC libraries, etc.).

```ts
// Call once at renderer startup
import { patchGetDisplayMedia } from 'electron-share-highlight/renderer';
patchGetDisplayMedia({ color: '#ff4500' });
```

---

## Style Options

| Option          | Type     | Default     | Description                              |
|-----------------|----------|-------------|------------------------------------------|
| `color`         | `string` | `#00c853`   | Border color (any CSS color)             |
| `pulseColor`    | `string` | `#69f0ae`   | Color at the peak of the pulse animation |
| `borderWidth`   | `number` | `4`         | Border thickness in pixels               |
| `borderRadius`  | `number` | `4`         | Border corner radius in pixels           |
| `pulseDuration` | `number` | `2000`      | Animation duration in ms (`0` = off)     |

---

## Platform Notes

| Platform    | Notes |
|-------------|-------|
| **macOS**   | Requires **Screen Recording** permission. Uses `screen-saver` window level to stay above fullscreen apps. |
| **Windows** | Works out of the box. Uses `pop-up-menu` level. |
| **Linux**   | Works on X11. Wayland support is compositor-dependent. |

### Window tracking

When highlighting a **specific window** (not the whole screen), the overlay polls its bounds every `trackingInterval` ms to follow it as it moves or resizes. Install `node-window-manager` for best results — without it the plugin falls back to matching against known `BrowserWindow` instances only.

```bash
npm install node-window-manager
```

---

## License

MIT
