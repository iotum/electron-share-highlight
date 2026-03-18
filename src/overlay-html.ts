import type { HighlightStyle } from './types';

export function buildOverlayHTML(style: Required<HighlightStyle>): string {
  const animationCss = style.pulseDuration > 0
    ? `
      @keyframes esh-pulse {
        0%, 100% {
          border-color: ${style.color};
          box-shadow: 0 0 0 0 ${hexToRgba(style.color, 0.5)};
        }
        50% {
          border-color: ${style.pulseColor};
          box-shadow: 0 0 8px 2px ${hexToRgba(style.pulseColor, 0.0)};
        }
      }
      animation: esh-pulse ${style.pulseDuration}ms ease-in-out infinite;
    `
    : `border-color: ${style.color};`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    *, *::before, *::after {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    html, body {
      width: 100%;
      height: 100%;
      background: transparent;
      overflow: hidden;
    }
    .esh-border {
      position: fixed;
      inset: 0;
      border: ${style.borderWidth}px solid ${style.color};
      border-radius: ${style.borderRadius}px;
      pointer-events: none;
      ${animationCss}
    }
  </style>
</head>
<body>
  <div class="esh-border"></div>
</body>
</html>`;
}

/** Convert a hex color + alpha to rgba() string (best-effort, falls back to the hex). */
function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return hex;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}
