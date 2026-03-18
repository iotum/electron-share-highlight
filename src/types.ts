// ─── IPC Channel Names ─────────────────────────────────────────────────────

export const IPC_START   = 'esh:start';
export const IPC_STOP    = 'esh:stop';
export const IPC_STOP_ALL = 'esh:stop-all';
export const IPC_UPDATE  = 'esh:update';   // internal: overlay bounds changed

// ─── Public Types ───────────────────────────────────────────────────────────

/** Visual style of the highlight border */
export interface HighlightStyle {
  /**
   * Border color (CSS color string).
   * @default '#00c853'
   */
  color?: string;

  /**
   * Secondary/pulse color. Set equal to `color` to disable animation.
   * @default '#69f0ae'
   */
  pulseColor?: string;

  /**
   * Border thickness in pixels.
   * @default 4
   */
  borderWidth?: number;

  /**
   * Border radius in pixels.
   * @default 4
   */
  borderRadius?: number;

  /**
   * Pulse animation duration in milliseconds. Set to 0 to disable.
   * @default 2000
   */
  pulseDuration?: number;
}

/** Configuration for the plugin */
export interface ShareHighlightOptions {
  /**
   * Visual style of the overlay border.
   */
  style?: HighlightStyle;

  /**
   * How often (ms) to re-check and reposition the overlay when
   * tracking a specific window (not a full screen).
   * @default 200
   */
  trackingInterval?: number;

  /**
   * If true, the overlay will automatically stop and clean up when
   * the BrowserWindow that initiated it is closed.
   * @default true
   */
  autoCleanup?: boolean;
}

/** Describes the resolved bounds of a capture source */
export interface SourceBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The type of a desktop capture source */
export type SourceType = 'screen' | 'window';

/** Internal payload sent over IPC */
export interface StartPayload {
  sourceId: string;
  style: Required<HighlightStyle>;
  trackingInterval: number;
}
