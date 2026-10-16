import { measureNaturalWidth, prepare, prepareWithSegments } from "@chenglou/pretext";

// A named font, not system-ui: pretext (and canvas) measure it the same everywhere.
export const FAMILY = '"Inter Variable", sans-serif';
export const MONO = '"JetBrains Mono Variable", monospace';
export const font = (weight: number, size: number, family = FAMILY) => `${weight} ${size}px ${family}`;

/** A line of text laid out a letter at a time, so each letter can fly on its own. */
export interface GlyphRun {
  chars: string[];
  /** Each letter's x from the run's left edge, kerning and letter spacing in. */
  xs: number[];
  advances: number[];
  width: number;
  size: number;
  font: string;
  ascent: number;
  descent: number;
}

const measurer = document.createElement("canvas").getContext("2d")!;

export function glyphRun(text: string, weight: number, size: number, letterSpacingEm = 0, family = FAMILY): GlyphRun {
  const f = font(weight, size, family);
  const ls = letterSpacingEm * size;
  const prepared = prepareWithSegments(text, f);
  const chars: string[] = [];
  const xs: number[] = [];
  let x = 0;
  prepared.segments.forEach((segment, s) => {
    const letters = Array.from(segment);
    letters.forEach((ch, j) => {
      const within = j === 0 ? 0 : measureNaturalWidth(prepare(letters.slice(0, j).join(""), f));
      xs.push(x + within + chars.length * ls);
      chars.push(ch);
    });
    x += prepared.widths[s];
  });
  const width = x + (chars.length - 1) * ls;
  const advances = xs.map((xi, i) => (i + 1 < xs.length ? xs[i + 1] - ls : width) - xi);
  measurer.font = f;
  const m = measurer.measureText(text);
  return {
    chars,
    xs,
    advances,
    width,
    size,
    font: f,
    ascent: m.fontBoundingBoxAscent ?? size * 0.97,
    descent: m.fontBoundingBoxDescent ?? size * 0.24,
  };
}

/** The baseline inside a line box `lineHeight` tall, as CSS centres the font's ascent and descent in it. */
export const baseline = (run: GlyphRun, lineHeight: number, scale = 1) =>
  (lineHeight - (run.ascent + run.descent) * scale) / 2 + run.ascent * scale;

/** One letter of a run, turned about its middle; `split` pulls its red and blue apart. */
export function glyph(
  ctx: CanvasRenderingContext2D,
  pixelRatio: number,
  run: GlyphRun,
  i: number,
  x: number,
  y: number,
  scale: number,
  rotation: number,
  split: number,
  alpha: number,
  color: string,
) {
  const ch = run.chars[i];
  if (ch === " " || alpha <= 0.002) return;
  const w = run.advances[i];
  const cy = run.size * 0.36;
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  ctx.translate(x + (w * scale) / 2, y - cy * scale);
  ctx.rotate(rotation);
  ctx.scale(scale, scale);
  ctx.globalAlpha = alpha;
  if (split > 0.25) {
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = "#f00";
    ctx.fillText(ch, -w / 2 - split, cy);
    ctx.fillStyle = "#0f0";
    ctx.fillText(ch, -w / 2, cy);
    ctx.fillStyle = "#00f";
    ctx.fillText(ch, -w / 2 + split, cy);
    ctx.globalCompositeOperation = "source-over";
  } else {
    ctx.fillStyle = color;
    ctx.fillText(ch, -w / 2, cy);
  }
}
