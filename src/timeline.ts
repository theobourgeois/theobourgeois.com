// Transitions aren't played backwards: going in, the title glides up and a panel shows; going home, the panel dies
// out and the title condenses back out of the echo; between panels, one dies out as the next shows. Seconds.
export const IN = {
  sub: { start: 0, dur: 0.45 },
  nav: { start: 0, dur: 0.3 },
  dim: { start: 0, dur: 0.6 },
  title: { start: 0.05, dur: 0.75 },
  /** When the panel starts to show. */
  panel: 0.55,
};

export const OUT = {
  top: { start: 0, dur: 0.3 },
  dim: { start: 0.15, dur: 0.7 },
  title: { start: 0.3, scatter: 0.25, dur: 0.8 },
  sub: { start: 0.7, dur: 0.5 },
  nav: { start: 0.85, dur: 0.4 },
  end: 1.3,
};

/** One panel to another: the next starts showing as the last is mostly gone. */
export const SWAP = { show: 0.35 };

// Each panel's own show, from when it starts.
export const GIT = {
  label: { start: 0, dur: 0.4 },
  graph: { start: 0.05, spread: 0.75, row: 0.012, dur: 0.35 },
  rows: { start: 0.6, stagger: 0.07, dur: 0.45 },
  end: 1.2,
};

export const PROJECT = {
  crumb: { start: 0, dur: 0.35 },
  body: { start: 0.12, dur: 0.5 },
  end: 0.62,
};

/** Any panel dying out: a bad-signal flicker, the graph's cells going at random. */
export const HIDE = { dur: 0.45, scatter: 0.3, cell: 0.12 };

export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
export const clamp01 = (x: number) => clamp(x, 0, 1);
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
/** Where `t` is inside [start, start + dur], 0..1. */
export const span = (t: number, start: number, dur: number) => clamp01((t - start) / dur);
/** 0 at rest on either end, 1 mid-flight: how hard something is moving, so how much it glows and trails. */
export const bump = (x: number) => Math.sin(Math.PI * clamp01(x));

export const easeOutCubic = (x: number) => 1 - (1 - x) ** 3;
export const easeInOutQuart = (x: number) => (x < 0.5 ? 8 * x ** 4 : 1 - (-2 * x + 2) ** 4 / 2);

/** A stable 0..1 per (i, k). */
export const rand = (i: number, k: number) => {
  const s = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** A bad-signal flicker: at 24 steps a second, dropping out more often as `q` rises. */
export const flicker = (t: number, k: number, q: number) => (rand(Math.floor(t * 24), k) >= q ? 1 : 0.15);
