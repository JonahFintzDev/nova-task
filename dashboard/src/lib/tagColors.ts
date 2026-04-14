// node_modules
import { md5 } from 'js-md5';

// types
import type { Tag } from '@/@types/index';

export type UiThemeMode = 'dark' | 'light';

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function relativeLuminance(r: number, g: number, b: number): number {
  const lin = (c: number) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const R = lin(r);
  const G = lin(g);
  const B = lin(b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sat = clamp(s, 0, 100) / 100;
  const light = clamp(l, 0, 100) / 100;
  const a = sat * Math.min(light, 1 - light);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = light - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(clamp(c * 255, 0, 255));
  };
  return [f(0), f(8), f(4)];
}

function toHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [r, g, b]
      .map((x) =>
        clamp(Math.round(x), 0, 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}

function parseHexColor(raw: string): [number, number, number] | null {
  const s = raw.trim().replace(/^#/, '');
  if (s.length === 3) {
    const r = parseInt(s[0] + s[0], 16);
    const g = parseInt(s[1] + s[1], 16);
    const b = parseInt(s[2] + s[2], 16);
    return Number.isFinite(r) && Number.isFinite(g) && Number.isFinite(b) ? [r, g, b] : null;
  }
  if (s.length === 6 && /^[0-9a-fA-F]+$/.test(s)) {
    const r = parseInt(s.slice(0, 2), 16);
    const g = parseInt(s.slice(2, 4), 16);
    const b = parseInt(s.slice(4, 6), 16);
    return [r, g, b];
  }
  return null;
}

/** Map MD5 hex digest to a hue in [0, 360). */
function hueFromMd5Digest(digest: string): number {
  return parseInt(digest.slice(0, 8), 16) % 360;
}

function contrastTextOnRgb(r: number, g: number, b: number): string {
  const lum = relativeLuminance(r, g, b);
  return lum > 0.52 ? '#141414' : '#f2f2f7';
}

function borderFromRgb(r: number, g: number, b: number, theme: UiThemeMode): string {
  if (theme === 'dark') {
    return toHex(clamp(r * 0.72, 0, 255), clamp(g * 0.72, 0, 255), clamp(b * 0.72, 0, 255));
  }
  return toHex(clamp(r * 0.82, 0, 255), clamp(g * 0.82, 0, 255), clamp(b * 0.82, 0, 255));
}

/**
 * Deterministic pill colors from MD5(tag.id). Custom `tag.color` (hex) overrides the background hue
 * but text/border are still chosen for contrast.
 */
export function tagPillStyles(tag: Tag, theme: UiThemeMode): Record<string, string> {
  const digest = md5(tag.id);
  const hue = hueFromMd5Digest(digest);

  const custom = tag.color?.trim() ? parseHexColor(tag.color) : null;
  let r: number;
  let g: number;
  let b: number;

  if (custom) {
    [r, g, b] = custom;
  } else if (theme === 'dark') {
    [r, g, b] = hslToRgb(hue, 56, 38);
  } else {
    [r, g, b] = hslToRgb(hue, 44, 90);
  }

  let textColor: string;
  if (custom || theme === 'dark') {
    textColor = contrastTextOnRgb(r, g, b);
  } else {
    const [tr, tg, tb] = hslToRgb(hue, 52, 30);
    textColor = toHex(tr, tg, tb);
  }

  return {
    backgroundColor: toHex(r, g, b),
    color: textColor,
    borderColor: borderFromRgb(r, g, b, theme),
  };
}

/** Suggestion row: outline chip using the same MD5 hue, readable on the current surface. */
export function tagSuggestionStyles(tag: Tag, theme: UiThemeMode): Record<string, string> {
  const hue = hueFromMd5Digest(md5(tag.id));
  if (theme === 'dark') {
    const [br, bg, bb] = hslToRgb(hue, 42, 52);
    const [tr, tg, tb] = hslToRgb(hue, 28, 86);
    return {
      borderColor: toHex(br, bg, bb),
      color: toHex(tr, tg, tb),
      backgroundColor: 'transparent',
    };
  }
  const [br, bg, bb] = hslToRgb(hue, 44, 42);
  const [tr, tg, tb] = hslToRgb(hue, 48, 22);
  return {
    borderColor: toHex(br, bg, bb),
    color: toHex(tr, tg, tb),
    backgroundColor: 'transparent',
  };
}
