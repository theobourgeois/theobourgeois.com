import { layoutWithLines, prepareWithSegments, type PreparedTextWithSegments } from "@chenglou/pretext";
import { bump, easeOutCubic, span } from "./timeline";

// A README comes in a block at a time, as the git view's rows do: text rises on a red/blue split, images wipe in
// left to right, and each gives its light to the trails while it moves. Blocks on screen when the page opens go in
// order; the rest go as they're scrolled to.

type Kind = "text" | "image" | "block";

interface Unit {
  el: HTMLElement;
  kind: Kind;
  /** When it starts (seconds, the frame clock's), or never yet. */
  at: number;
  q: number;
  prepared: PreparedTextWithSegments | null;
  font: string;
}

const DUR: Record<Kind, number> = { text: 0.5, image: 0.8, block: 0.5 };
const STAGGER = 0.07;

/** Every picture in it has loaded (or failed: then there's nothing to wait for). */
const loaded = (el: HTMLElement) => Array.from(el.querySelectorAll("img")).every((img) => img.complete);

export class Reveal {
  private units: Unit[] = [];
  private armed = false;
  /** The soonest the next block may start, so blocks arriving together still go one after another. */
  private next = 0;

  constructor(
    private root: HTMLElement,
    private wake: () => void,
  ) {
    // Where a block is, checked as the page scrolls (an observer would count a still-loading picture, no taller
    // than nothing, as on screen).
    root.addEventListener("scroll", () => wake(), { passive: true });
  }

  /** A README's blocks, hidden until each is revealed (or all shown at once). */
  set(article: Element, instant: boolean) {
    this.clear();
    for (const child of Array.from(article.children) as HTMLElement[]) {
      if (child.matches("ul, ol")) for (const li of Array.from(child.children) as HTMLElement[]) this.add(li, "text");
      else if (child.querySelector("img") && !child.textContent?.trim()) this.add(child, "image");
      else if (child.matches("pre, table, hr, .highlight, .snippet-clipboard-content, markdown-accessiblity-table")) this.add(child, "block");
      else this.add(child, "text");
    }
    this.units.forEach((u) => this.apply(u, instant ? 1 : 0));
    this.wake();
  }

  /** The page is showing: what's in view can start. */
  arm() {
    if (this.armed) return;
    this.armed = true;
    this.wake();
  }

  clear() {
    this.units = [];
    this.armed = false;
    this.next = 0;
  }

  /** Move what's revealing, giving its light to `emit`. Whether anything's moving, and where the newest light is. */
  step(now: number, emit: CanvasRenderingContext2D | null, scale: number) {
    let busy = false;
    let center: [number, number] | null = null;
    const view = this.root.getBoundingClientRect();
    for (const u of this.units) {
      if (u.q >= 1) continue;
      if (u.at === Infinity) {
        // A picture waits until it's here, or its wipe would show an empty box.
        if (!this.armed || !loaded(u.el)) continue;
        const r = u.el.getBoundingClientRect();
        if (r.top > view.bottom - 40 || r.bottom < view.top) continue;
        u.at = Math.max(now, this.next);
        this.next = u.at + STAGGER;
      }
      const q = span(now, u.at, DUR[u.kind]);
      this.apply(u, q);
      busy = true;
      if (emit && q > 0 && q < 1 && this.emit(emit, scale, u, q)) {
        const r = u.el.getBoundingClientRect();
        center = [r.x + r.width / 2, r.y + r.height / 2];
      }
    }
    return { busy, center };
  }

  private add(el: HTMLElement, kind: Kind) {
    this.units.push({ el, kind, at: Infinity, q: -1, prepared: null, font: "" });
    if (kind === "image")
      el.querySelectorAll("img").forEach((img) => {
        img.addEventListener("load", this.wake, { once: true });
        img.addEventListener("error", this.wake, { once: true });
      });
  }

  private apply(u: Unit, q: number) {
    if (q === u.q) return;
    u.q = q;
    const e = easeOutCubic(q);
    const s = u.el.style;
    if (u.kind === "image") {
      // The wipe clips the pictures, never the block: a clipped block never counts as on screen, so never starts.
      s.opacity = String(Math.min(1, q * 3));
      const clip = q >= 1 ? "" : `inset(0 ${(1 - e) * 100}% 0 0)`;
      u.el.querySelectorAll("img").forEach((img) => (img.style.clipPath = clip));
      return;
    }
    const d = (1 - e) * 4;
    s.opacity = String(e);
    s.transform = q >= 1 ? "" : `translateY(${(1 - e) * 10}px)`;
    s.textShadow = d > 0.1 ? `${-d}px 0 rgb(255 0 0 / 0.7), ${d}px 0 rgb(0 160 255 / 0.7)` : "";
  }

  private emit(ctx: CanvasRenderingContext2D, scale: number, u: Unit, q: number) {
    const a = bump(q);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = ctx.strokeStyle = "#fff";

    if (u.kind === "image") {
      // Only as much of the picture as has wiped in, and only pictures the browser lets a canvas read.
      const e = easeOutCubic(q);
      let any = false;
      u.el.querySelectorAll("img").forEach((img) => {
        if (img.crossOrigin !== "anonymous" || !img.complete || !img.naturalWidth) return;
        const r = img.getBoundingClientRect();
        ctx.globalAlpha = a * 0.55;
        ctx.drawImage(img, 0, 0, img.naturalWidth * e, img.naturalHeight, r.x, r.y, r.width * e, r.height);
        any = true;
      });
      return any;
    }

    if (u.kind === "block") {
      const r = u.el.getBoundingClientRect();
      ctx.globalAlpha = a * 0.5;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(r.x, r.y, r.width, r.height);
      return true;
    }

    // Text: laid out by pretext in the block's own font and width, so the light lines up with the words.
    const target = u.el.querySelector<HTMLElement>("h1, h2, h3, h4, h5, h6") ?? u.el;
    const text = (target.textContent ?? "").replace(/\s+/g, " ").trim();
    if (!text) return false;
    const cs = getComputedStyle(target);
    const size = parseFloat(cs.fontSize);
    const lineHeight = parseFloat(cs.lineHeight) || size * 1.4;
    const font = `${cs.fontWeight} ${size}px ${cs.fontFamily}`;
    if (!u.prepared || u.font !== font) {
      u.prepared = prepareWithSegments(text, font);
      u.font = font;
    }
    const r = target.getBoundingClientRect();
    ctx.font = font;
    const m = ctx.measureText(text);
    const ascent = m.fontBoundingBoxAscent ?? size * 0.97;
    const descent = m.fontBoundingBoxDescent ?? size * 0.24;
    const baseline = (lineHeight - (ascent + descent)) / 2 + ascent;
    const { lines } = layoutWithLines(u.prepared, Math.round(r.width * 4) / 4, lineHeight);
    ctx.globalAlpha = a * 0.6;
    lines.forEach((line, j) => ctx.fillText(line.text, r.x, r.y + j * lineHeight + baseline));
    return true;
  }
}
