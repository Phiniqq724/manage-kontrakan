/**
 * Converts a hue (degrees, any number, wrapped into 0-360) to a vivid hex
 * colour (HSL with 80% saturation and 50% lightness), e.g. 0 -> "#e61919".
 */
export function hueToHex(hue: number): string {
  const h = ((hue % 360) + 360) % 360;
  const s = 0.8;
  const l = 0.5;
  const a = s * Math.min(l, 1 - l);
  const channel = (n: number) => {
    const k = (n + h / 30) % 12;
    const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(v * 255).toString(16).padStart(2, "0");
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
}

/**
 * Black or white, whichever reads better on `hex` (by WCAG relative
 * luminance). Non-hex input (e.g. a theme colour name) gets white.
 */
export function readableOn(hex: string): "#000000" | "#ffffff" {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return "#ffffff";
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(m[1].slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // Contrast against black beats contrast against white above ~0.18.
  return luminance > 0.179 ? "#000000" : "#ffffff";
}
