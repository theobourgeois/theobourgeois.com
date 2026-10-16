export interface Day {
  date: string;
  weekday: number;
  count: number;
  level: number;
}

/** How a cell looks this frame: shown (0..1), its size (0..1 of a cell), and how hot white it burns. */
export interface CellLook {
  a: number;
  s: number;
  flash: number;
}

// How white each contribution level sits at rest.
const REST = [0.08, 0.3, 0.5, 0.74, 0.96];

/** The contribution calendar, crisp on its own canvas; how each cell looks over time is the caller's. */
export class Graph {
  weeks: Day[][] = [];
  cols = 0;
  cell = 13;
  gap = 3;
  hoverable = false;
  onHover?: (c: number, r: number) => void;
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private hover: { c: number; r: number } | null = null;

  constructor(
    readonly canvas: HTMLCanvasElement,
    private tip: HTMLElement,
  ) {
    this.ctx = canvas.getContext("2d")!;
    canvas.addEventListener("pointermove", (e) => this.move(e.offsetX, e.offsetY));
    canvas.addEventListener("pointerleave", () => this.leave());
  }

  /** The most recent weeks that fit. */
  get shown() {
    return this.weeks.slice(-this.cols);
  }

  /** The whole year, at a smaller cell where it won't fit; the page scrolls it sideways, latest week in view. */
  layout(maxWidth: number) {
    const fits = (cell: number, gap: number) => Math.floor((maxWidth + gap) / (cell + gap));
    this.cell = fits(13, 3) >= this.weeks.length ? 13 : 11;
    this.cols = this.weeks.length;
    const step = this.cell + this.gap;
    const w = Math.max(1, this.cols * step - this.gap);
    const h = 7 * step - this.gap;
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
  }

  private box(c: number, r: number, s: number, ox = 0, oy = 0) {
    const step = this.cell + this.gap;
    const size = this.cell * s;
    return [ox + c * step + (this.cell - size) / 2, oy + r * step + (this.cell - size) / 2, size] as const;
  }

  draw(look: (c: number, r: number, day: Day) => CellLook | null) {
    const { ctx, dpr } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.shown.forEach((week, c) =>
      week.forEach((day) => {
        const l = look(c, day.weekday, day);
        if (!l || l.a <= 0) return;
        const [x, y, size] = this.box(c, day.weekday, l.s);
        ctx.globalAlpha = l.a;
        ctx.fillStyle = `rgb(255 255 255 / ${REST[day.level]})`;
        ctx.fillRect(x, y, size, size);
        if (l.flash > 0) {
          ctx.globalAlpha = l.a * l.flash;
          ctx.fillStyle = "#fff";
          ctx.fillRect(x, y, size, size);
        }
      }),
    );
    if (this.hover) {
      const [x, y, size] = this.box(this.hover.c, this.hover.r, 1);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1;
      ctx.strokeRect(x - 2.5, y - 2.5, size + 5, size + 5);
    }
  }

  /** Light for the trails, at the graph's place on screen. Whether any cell gave some. */
  emit(ctx: CanvasRenderingContext2D, scale: number, glow: (c: number, r: number, day: Day) => number, ox: number, oy: number) {
    let any = false;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = "#fff";
    this.shown.forEach((week, c) =>
      week.forEach((day) => {
        const a = glow(c, day.weekday, day);
        if (a <= 0.003) return;
        const [x, y, size] = this.box(c, day.weekday, 1, ox, oy);
        ctx.globalAlpha = a;
        ctx.fillRect(x, y, size, size);
        any = true;
      }),
    );
    return any;
  }

  /** Where a cell's middle is, from the graph's top left. */
  centerOf(c: number, r: number) {
    const step = this.cell + this.gap;
    return [c * step + this.cell / 2, r * step + this.cell / 2] as const;
  }

  emitCell(ctx: CanvasRenderingContext2D, scale: number, c: number, r: number, ox: number, oy: number, alpha: number) {
    const [x, y, size] = this.box(c, r, 1, ox, oy);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#fff";
    ctx.fillRect(x, y, size, size);
  }

  private move(px: number, py: number) {
    if (!this.hoverable) return this.leave();
    const step = this.cell + this.gap;
    const c = Math.floor(px / step);
    const r = Math.floor(py / step);
    const day = this.shown[c]?.find((d) => d.weekday === r);
    if (!day || px % step > this.cell || py % step > this.cell) return this.leave();
    if (this.hover?.c === c && this.hover.r === r) return;
    this.hover = { c, r };
    const when = new Date(`${day.date}T00:00`).toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
    this.tip.textContent = `${day.count} · ${when.toLowerCase()}`;
    // Centred on its cell, but tucked inward near either end so it never runs off a phone's edge.
    const x = c * step + this.cell / 2;
    const w = this.cols * step - this.gap;
    const shift = x < 110 ? "-12px" : x > w - 110 ? "calc(-100% + 12px)" : "-50%";
    this.tip.style.left = `${x}px`;
    this.tip.style.top = `${r * step}px`;
    this.tip.style.transform = `translate(${shift}, calc(-100% - 8px))`;
    this.tip.classList.add("show");
    this.onHover?.(c, r);
  }

  leave() {
    if (!this.hover) return;
    this.hover = null;
    this.tip.classList.remove("show");
    this.onHover?.(-1, -1);
  }
}
