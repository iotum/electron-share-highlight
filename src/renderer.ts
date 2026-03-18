/**
 * electron-share-highlight/renderer
 *
 * Use in your renderer process to wrap getDisplayMedia / getUserMedia
 * and automatically show/hide the highlight overlay.
 */

import type { HighlightStyle, ShareHighlightOptions, StartPayload } from './types';

// Resolved default style (mirrors main.ts defaults — kept in sync manually)
const DEFAULT_STYLE: Required<HighlightStyle> = {
  color:         '#00c853',
  pulseColor:    '#69f0ae',
  borderWidth:   4,
  borderRadius:  4,
  pulseDuration: 2000,
};

type EshBridge = {
  start(payload: StartPayload): void;
  stop(sourceId: string): void;
  stopAll(): void;
};

function getBridge(): EshBridge {
  const b = (window as any).__esh as EshBridge | undefined;
  if (!b) {
    throw new Error(
      '[electron-share-highlight] Bridge not found. ' +
      'Make sure you import "electron-share-highlight/preload" in your preload script.',
    );
  }
  return b;
}

// ─── Public renderer API ─────────────────────────────────────────────────────

export interface GetDisplayMediaHighlightOptions {
  /** Forwarded to navigator.mediaDevices.getUserMedia as the video constraint. */
  sourceId: string;

  /** Visual style overrides for this share session. */
  style?: HighlightStyle;

  /** Tracking interval override (ms). */
  trackingInterval?: number;

  /** Constraints forwarded to getUserMedia (merged with sourceId). */
  constraints?: MediaStreamConstraints;
}

/**
 * Drop-in wrapper around `getUserMedia` for Electron screen capture.
 * Automatically shows the highlight border when the stream starts and
 * removes it when the stream ends.
 *
 * @example
 * ```ts
 * import { getDisplayMediaWithHighlight } from 'electron-share-highlight/renderer';
 *
 * const stream = await getDisplayMediaWithHighlight({
 *   sourceId: selectedSource.id,
 *   style: { color: '#ff0000' },
 * });
 * videoEl.srcObject = stream;
 * ```
 */
export async function getDisplayMediaWithHighlight(
  opts: GetDisplayMediaHighlightOptions,
): Promise<MediaStream> {
  const bridge = getBridge();

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    ...opts.constraints,
    video: {
      // @ts-ignore — Electron-specific constraint
      mandatory: {
        chromeMediaSource:   'desktop',
        chromeMediaSourceId: opts.sourceId,
      },
    },
  });

  // Show highlight
  bridge.start({
    sourceId:         opts.sourceId,
    style:            { ...DEFAULT_STYLE, ...opts.style },
    trackingInterval: opts.trackingInterval ?? 200,
  });

  // Auto-remove when stream ends
  const track = stream.getVideoTracks()[0];
  if (track) {
    track.addEventListener('ended', () => {
      bridge.stop(opts.sourceId);
    }, { once: true });
  }

  return stream;
}

/**
 * Manually start the highlight for a given source id.
 * Use this if you manage the media stream yourself.
 */
export function startHighlight(
  sourceId: string,
  style?: HighlightStyle,
  trackingInterval = 200,
): void {
  getBridge().start({
    sourceId,
    style:            { ...DEFAULT_STYLE, ...style },
    trackingInterval,
  });
}

/**
 * Manually stop the highlight for a given source id.
 */
export function stopHighlight(sourceId: string): void {
  getBridge().stop(sourceId);
}

/**
 * Stop all active highlights.
 */
export function stopAllHighlights(): void {
  getBridge().stopAll();
}

/**
 * Patch `navigator.mediaDevices.getDisplayMedia` globally so that any
 * call to it (e.g. from third-party SDKs) automatically shows the
 * highlight.
 *
 * Call once at renderer startup.
 *
 * @example
 * ```ts
 * import { patchGetDisplayMedia } from 'electron-share-highlight/renderer';
 * patchGetDisplayMedia({ color: '#ff4500' });
 * ```
 */
export function patchGetDisplayMedia(style?: HighlightStyle): void {
  const bridge  = getBridge();
  const original = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);

  navigator.mediaDevices.getDisplayMedia = async (constraints?: DisplayMediaStreamOptions) => {
    const stream = await original(constraints);

    // Best-effort: try to extract the sourceId from the stream
    const track    = stream.getVideoTracks()[0];
    const settings = track?.getSettings() as any;
    const sourceId: string | undefined =
      settings?.deviceId ?? settings?.chromeMediaSourceId;

    if (sourceId) {
      bridge.start({
        sourceId,
        style:            { ...DEFAULT_STYLE, ...style },
        trackingInterval: 200,
      });

      track?.addEventListener('ended', () => bridge.stop(sourceId), { once: true });
    }

    return stream;
  };
}
