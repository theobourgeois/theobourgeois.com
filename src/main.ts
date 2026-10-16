import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "./style.css";
import { clearCache, layoutWithLines, prepareWithSegments, type PreparedTextWithSegments } from "@chenglou/pretext";
import { Graph, type CellLook, type Day } from "./graph";
import { FAMILY, MONO, baseline, font, glyph, glyphRun, type GlyphRun } from "./text";
import { GIT, HIDE, IN, OUT, PROJECT, SWAP, bump, clamp, clamp01, easeInOutQuart, easeOutCubic, flicker, lerp, rand, span } from "./timeline";
import { Trails, type TrailParams } from "./trails";

interface Repo {
  name: string;
  description: string | null;
  url: string;
  stars: number;
  branch: string | null;
}

interface GitHub {
  total: number;
  weeks: Day[][];
  pinned: Repo[];
}

/** Where you are: home, the git view, or a project's page. */
type Route = "home" | "git" | `p:${string}`;
type Panel = "git" | "project";

const TITLE = "theobourgeois.com";
const SUBTITLE = "building cool shit";
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const GITHUB_MARK =
  '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/></svg>';

const $ = <T extends HTMLElement = HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const crisp = $<HTMLCanvasElement>("#crisp");
const cctx = crisp.getContext("2d")!;
const trails = reduceMotion ? null : Trails.create($<HTMLCanvasElement>("#trails"));
const dim = $(".dim");
const veil = $(".veil");
const nav = $(".nav");
const gitBtn = $<HTMLButtonElement>("#go-git");
const homeBtn = $<HTMLButtonElement>("#go-home");
const gitView = $(".git-view");
const total = $(".git-total");
const list = $(".projects");
const graph = new Graph($<HTMLCanvasElement>(".graph"), $(".tip"));
const graphScroll = $(".graph-scroll");
const projectView = $(".project-view");
const crumb = $(".crumb");
const crumbGit = $<HTMLAnchorElement>(".crumb-git");
const crumbName = $(".crumb-name");
const crumbStars = $(".crumb-stars");
const crumbGh = $<HTMLAnchorElement>(".crumb-gh");
const readme = $(".readme");

type Fx = Omit<TrailParams, "center">;
// The title's move: an echo blooming out of where it left. The content: an echo that mostly stays put, splitting.
const IN_FX: Fx = { zoom: 1.22, sep: 0.05, trail: 0.5, swirl: 0.35, warp: 0.3 };
const SETTLE_FX: Fx = { zoom: 1.04, sep: 0.08, trail: 0.45, swirl: 0, warp: 0.25 };
// Home: everything falls back into the middle, where the title condenses.
const OUT_FX: Fx = { zoom: 0.82, sep: 0.05, trail: 0.5, swirl: -0.35, warp: 0.3 };
// A hover glows out of the thing itself, a little, splitting as it goes.
const HOVER_FX: Fx = { zoom: 1.12, sep: 0.09, trail: 0.32, swirl: 0, warp: 0.15 };

const ROW_LINE = 20;
/** Samples per frame in the title's streak of light. */
const STREAK = 5;
/** Any `s` past every timeline: things at rest. */
const REST = 99;

interface Row {
  el: HTMLElement;
  name: HTMLElement;
  desc: HTMLElement | null;
  text: string;
  prepared: PreparedTextWithSegments | null;
  size: number;
  q: number;
}

let rows: Row[] = [];
const repos = new Map<string, Repo>();
let vw = 0;
let vh = 0;
let dpr = 1;
let title: GlyphRun;
let sub: GlyphRun;
let mono: GlyphRun;
const home = { x: 0, y: 0 };
const top = { x: 0, y: 0, scale: 1 };
const subAt = { x: 0, y: 0 };

function layout() {
  vw = innerWidth;
  vh = innerHeight;
  dpr = Math.min(devicePixelRatio || 1, 2);

  let size = clamp(Math.round(vw * 0.075), 36, 96);
  title = glyphRun(TITLE, 600, size, -0.045);
  if (title.width > vw - 48) {
    size = Math.floor((size * (vw - 48)) / title.width);
    title = glyphRun(TITLE, 600, size, -0.045);
  }
  const subSize = clamp(Math.round(vw * 0.018), 16, 22);
  sub = glyphRun(SUBTITLE, 500, subSize, -0.01);

  // Home: title, subtitle and the buttons, centred as one block.
  const gap = Math.round(size * 0.22);
  const subLine = Math.round(subSize * 1.3);
  const navGap = 28;
  const navH = 33;
  const blockTop = Math.round((vh - (size + gap + subLine + navGap + navH)) / 2 - vh * 0.02);
  home.x = (vw - title.width) / 2;
  home.y = blockTop + baseline(title, size);
  subAt.x = (vw - sub.width) / 2;
  subAt.y = blockTop + size + gap + baseline(sub, subLine);
  nav.style.top = `${blockTop + size + gap + subLine + navGap}px`;

  // Everywhere else: the title small at the top, a panel under it.
  const topSize = vw < 640 ? 18 : 20;
  const topY = 26;
  top.scale = topSize / size;
  top.x = (vw - title.width * top.scale) / 2;
  top.y = topY + baseline(title, topSize, top.scale);
  Object.assign(homeBtn.style, {
    left: `${top.x - 10}px`,
    top: `${topY - 8}px`,
    width: `${title.width * top.scale + 20}px`,
    height: `${topSize + 16}px`,
  });
  gitView.style.top = projectView.style.top = `${topY + topSize + 36}px`;

  crisp.width = Math.round(vw * dpr);
  crisp.height = Math.round(vh * dpr);
  trails?.resize(vw, vh, devicePixelRatio || 1);
  graph.layout(Math.min(vw - 48, 845));
  graphScroll.scrollLeft = graphScroll.scrollWidth;

  // The rows' text size is the CSS's (smaller on phones): prepare their descriptions in it.
  rows.forEach((row) => {
    const size = parseFloat(getComputedStyle(row.el).fontSize);
    if (row.desc && size !== row.size) row.prepared = prepareWithSegments(row.text, font(400, size, MONO));
    row.size = size;
  });
  mono = glyphRun("A", 400, rows[0]?.size ?? 13, 0, MONO);
}

// ---- drawing -------------------------------------------------------------------------------------------------

let emitted = false;
const WHITE = "#fff";
const titleCenter = (): [number, number] => [vw / 2, home.y - title.size * 0.35];
const rgbSplit = (d: number) => (d > 0.1 ? `${-d}px 0 rgb(255 0 0 / 0.7), ${d}px 0 rgb(0 160 255 / 0.7)` : "");

/** Going in: the title glides up as one piece, the subtitle fading as it spreads. At REST: the title up top. */
function drawIn(s: number, emit: CanvasRenderingContext2D | null) {
  const q = span(s, IN.sub.start, IN.sub.dur);
  if (q < 1) {
    const mid = (sub.chars.length - 1) / 2;
    cctx.font = sub.font;
    if (emit) emit.font = sub.font;
    for (let i = 0; i < sub.chars.length; i++) {
      const x = subAt.x + sub.xs[i] + (i - mid) * q * sub.size * 0.3;
      const y = subAt.y - q * 10;
      glyph(cctx, dpr, sub, i, x, y, 1, 0, q * 4, 0.7 * (1 - easeOutCubic(q)), WHITE);
      if (emit && q > 0) glyph(emit, trails!.scale, sub, i, x, y, 1, 0, 0, 0.55 * (1 - q), WHITE);
    }
    if (emit && q > 0) emitted = true;
  }

  const titleAt = (t: number) => {
    const u = span(t, IN.title.start, IN.title.dur);
    const e = easeInOutQuart(u);
    return { v: bump(u) ** 1.5, e, sc: Math.exp(lerp(0, Math.log(top.scale), e)) };
  };
  const draw = (ctx: CanvasRenderingContext2D, ratio: number, t: number, split: number, alpha: (v: number) => number) => {
    const { v, e, sc } = titleAt(t);
    const y = lerp(home.y, top.y, e);
    for (let i = 0; i < title.chars.length; i++) {
      const x = lerp(home.x + title.xs[i], top.x + title.xs[i] * top.scale, e);
      glyph(ctx, ratio, title, i, x, y, sc, 0, split * v, alpha(v), WHITE);
    }
  };
  cctx.font = title.font;
  draw(cctx, dpr, s, 5, () => 1);
  // As light it's a streak, sampled across the frame's whole move, so its echo smears rather than stamps copies.
  if (emit && titleAt(s).v > 0.01) {
    emit.font = title.font;
    for (let j = 1; j <= STREAK; j++) draw(emit, trails!.scale, lerp(sPrev, s, j / STREAK), 0, (v) => (v * 0.4) / Math.sqrt(STREAK));
    emitted = true;
  }
}

/** Going home: the small title cuts out, and the big one condenses out of the echo, its letters in any order. */
function drawOut(s: number, emit: CanvasRenderingContext2D | null) {
  cctx.font = title.font;
  if (emit) emit.font = title.font;
  const q = span(s, OUT.top.start, OUT.top.dur);
  if (q < 1) {
    for (let i = 0; i < title.chars.length; i++) {
      const x = top.x + title.xs[i] * top.scale;
      glyph(cctx, dpr, title, i, x, top.y, top.scale, 0, q * 30, (1 - q) * flicker(s, i, q), WHITE);
      if (emit && q > 0) glyph(emit, trails!.scale, title, i, x, top.y, top.scale, 0, 0, 0.5 * (1 - q), WHITE);
    }
    if (emit && q > 0) emitted = true;
  }

  const [cx] = titleCenter();
  for (let i = 0; i < title.chars.length; i++) {
    const u = span(s, OUT.title.start + rand(i, 5) * OUT.title.scatter, OUT.title.dur - OUT.title.scatter);
    if (u <= 0) continue;
    const e = easeOutCubic(u);
    const sc = 1 + (1 - e) * 0.05;
    const x = cx + (home.x + title.xs[i] - cx) * sc;
    const alpha = u < 1 ? e * flicker(s, i + 40, (1 - u) * 0.6) : 1;
    glyph(cctx, dpr, title, i, x, home.y, sc, 0, (1 - e) * 10, alpha, WHITE);
    if (emit && u < 1) {
      glyph(emit, trails!.scale, title, i, x, home.y, sc, 0, 0, bump(u) * 0.7, WHITE);
      emitted = true;
    }
  }

  const p = span(s, OUT.sub.start, OUT.sub.dur);
  if (p > 0) {
    const e = easeOutCubic(p);
    const mid = (sub.chars.length - 1) / 2;
    cctx.font = sub.font;
    if (emit) emit.font = sub.font;
    for (let i = 0; i < sub.chars.length; i++) {
      const x = subAt.x + sub.xs[i] + (i - mid) * (1 - e) * sub.size * 0.25;
      glyph(cctx, dpr, sub, i, x, subAt.y, 1, 0, (1 - e) * 4, 0.7 * e, WHITE);
      if (emit && p < 1) glyph(emit, trails!.scale, sub, i, x, subAt.y, 1, 0, 0, bump(p) * 0.4, WHITE);
    }
    if (emit && p < 1) emitted = true;
  }
}

/** An element's own text as light, in its own font, where it sits (left-aligned unless `centred`). */
function emitText(ctx: CanvasRenderingContext2D, el: Element, alpha: number, centred = false) {
  const text = el.textContent?.trim();
  if (!text) return;
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  const size = parseFloat(cs.fontSize);
  ctx.setTransform(trails!.scale, 0, 0, trails!.scale, 0, 0);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = WHITE;
  ctx.font = `${cs.fontWeight} ${size}px ${cs.fontFamily}`;
  const x = centred ? r.x + (r.width - ctx.measureText(text).width) / 2 : r.x;
  ctx.fillText(text, x, Math.min(r.y + r.height / 2, r.y + size * 0.7) + size * 0.35);
  emitted = true;
}

/** A project's text as light, where the row has it (pretext wraps the description as the CSS does). */
function emitRow(ctx: CanvasRenderingContext2D, row: Row, alpha: number) {
  ctx.setTransform(trails!.scale, 0, 0, trails!.scale, 0, 0);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = WHITE;
  const b = baseline(mono, ROW_LINE);
  const n = row.name.getBoundingClientRect();
  ctx.font = font(500, row.size, MONO);
  ctx.fillText(row.name.textContent ?? "", n.x, n.y + b);
  if (row.desc && row.prepared) {
    const d = row.desc.getBoundingClientRect();
    ctx.font = font(400, row.size, MONO);
    const { lines } = layoutWithLines(row.prepared, Math.round(d.width * 4) / 4, ROW_LINE);
    lines.forEach((line, j) => ctx.fillText(line.text, d.x, d.y + j * ROW_LINE + b));
  }
  emitted = true;
}

function setRow(row: Row, q: number) {
  if (q === row.q) return;
  const e = easeOutCubic(q);
  row.el.style.opacity = String(e);
  row.el.style.transform = `translateX(${(1 - e) * -6}px)`;
  row.el.style.textShadow = rgbSplit((1 - e) * 4);
  row.q = q;
}

// ---- panels: each shows and hides on its own clock (t from when it starts) -----------------------------------

const AT_REST: CellLook = { a: 1, s: 1, flash: 0 };

function hidePanel(el: HTMLElement) {
  el.style.visibility = "hidden";
  el.classList.remove("live");
}

/** The git view: the cells sweep in left to right, landing white-hot and cooling to their level; then the list. */
function gitShow(t: number, emit: CanvasRenderingContext2D | null) {
  if (t < 0) return hidePanel(gitView);
  gitView.style.visibility = "visible";
  gitView.style.opacity = "1";
  gitView.classList.toggle("live", t >= GIT.end - 0.2);
  total.style.opacity = String(easeOutCubic(span(t, GIT.label.start, GIT.label.dur)));

  const stagger = GIT.graph.spread / Math.max(graph.cols - 1, 1);
  const p = (c: number, r: number) => span(t, GIT.graph.start + c * stagger + r * GIT.graph.row, GIT.graph.dur);
  graph.draw((c, r, day) => {
    const u = p(c, r);
    if (u <= 0) return null;
    if (u >= 1) return AT_REST;
    return { a: clamp01(u * 2), s: 0.5 + 0.5 * easeOutCubic(u), flash: (1 - u) ** 2 * (day.level ? 1 : 0.3) };
  });
  if (emit) {
    const r = graph.canvas.getBoundingClientRect();
    const glow = (c: number, rr: number, day: Day) => {
      const u = p(c, rr);
      return u > 0 && u < 1 ? bump(u) * (day.level ? 0.2 + 0.4 * (day.level / 4) : 0.05) : 0;
    };
    if (graph.emit(emit, trails!.scale, glow, r.x, r.y)) emitted = true;
  }

  rows.forEach((row, k) => {
    const q = span(t, GIT.rows.start + k * GIT.rows.stagger, GIT.rows.dur);
    setRow(row, q);
    if (emit && q > 0 && q < 1) emitRow(emit, row, bump(q) * 0.6);
  });
}

/** Any panel dies on a bad signal; the git view's cells also go out at random, a last flash of white each. */
function gitHide(t: number, emit: CanvasRenderingContext2D | null) {
  const q = span(t, 0, HIDE.dur);
  if (q >= 1) return hidePanel(gitView);
  gitView.style.visibility = "visible";
  gitView.style.opacity = String((1 - q) * flicker(t, 99, q));
  gitView.classList.remove("live");
  const p = (c: number, r: number) => span(t, rand(c * 7 + r, 9) * HIDE.scatter, HIDE.cell);
  graph.draw((c, r) => {
    const d = p(c, r);
    return d >= 1 ? null : { a: 1 - d, s: 1, flash: d };
  });
  if (emit && q > 0) {
    const r = graph.canvas.getBoundingClientRect();
    const glow = (c: number, rr: number, day: Day) => {
      const d = p(c, rr);
      return d > 0 && d < 1 ? bump(d) * (day.level ? 0.5 : 0.1) : 0;
    };
    if (graph.emit(emit, trails!.scale, glow, r.x, r.y)) emitted = true;
    rows.forEach((row) => emitRow(emit, row, 0.35 * (1 - q)));
  }
}

let readmeState: "loading" | "ready" | "none" = "loading";

/** A project's page: the crumb comes in on a split, then the README rises into place. */
function projectShow(t: number, emit: CanvasRenderingContext2D | null) {
  if (t < 0) return hidePanel(projectView);
  projectView.style.visibility = "visible";
  projectView.style.opacity = "1";
  projectView.classList.toggle("live", t >= PROJECT.end - 0.1);
  const c = span(t, PROJECT.crumb.start, PROJECT.crumb.dur);
  const ce = easeOutCubic(c);
  crumb.style.opacity = String(ce);
  crumb.style.textShadow = rgbSplit((1 - ce) * 4);
  const b = span(t, PROJECT.body.start, PROJECT.body.dur);
  const be = easeOutCubic(b);
  readme.style.opacity = readmeState === "loading" ? "0" : String(be);
  readme.style.transform = `translateY(${(1 - be) * 14}px)`;
  if (emit) {
    if (c > 0 && c < 1) emitText(emit, crumbName, bump(c) * 0.7);
    const h1 = readme.querySelector("h1");
    if (h1 && readmeState === "ready" && b > 0 && b < 1) emitText(emit, h1, bump(b) * 0.5);
  }
}

function projectHide(t: number, emit: CanvasRenderingContext2D | null) {
  const q = span(t, 0, HIDE.dur);
  if (q >= 1) return hidePanel(projectView);
  projectView.style.visibility = "visible";
  projectView.style.opacity = String((1 - q) * flicker(t, 77, q));
  projectView.classList.remove("live");
  if (emit && q > 0) {
    emitText(emit, crumbName, 0.35 * (1 - q));
    const h1 = readme.querySelector("h1");
    if (h1) emitText(emit, h1, 0.3 * (1 - q));
  }
}

const panelOf = (r: Route): Panel | null => (r === "home" ? null : r === "git" ? "git" : "project");
const panelEl = (p: Panel) => (p === "git" ? gitView : projectView);
const showPanel = (p: Panel, t: number, emit: CanvasRenderingContext2D | null) => (p === "git" ? gitShow(t, emit) : projectShow(t, emit));
const hidePanelAt = (p: Panel, t: number, emit: CanvasRenderingContext2D | null) => (p === "git" ? gitHide(t, emit) : projectHide(t, emit));
const showEnd = (p: Panel) => (p === "git" ? GIT.end : PROJECT.end);
/** A project's page sits on more dark, for reading. */
const veilOf = (r: Route) => (panelOf(r) === "project" ? 1 : 0);

function render(emit: CanvasRenderingContext2D | null) {
  cctx.setTransform(1, 0, 0, 1, 0, 0);
  cctx.clearRect(0, 0, crisp.width, crisp.height);
  const to = panelOf(at);
  const from = panelOf(prev);
  const others = (...keep: (Panel | null)[]) =>
    (["git", "project"] as const).forEach((p) => !keep.includes(p) && hidePanel(panelEl(p)));
  const blend = easeOutCubic(span(s, 0, 0.6));
  let navOpacity = 0;

  if (!dir) {
    others(to);
    if (to) {
      drawIn(REST, null);
      showPanel(to, REST, null);
    } else {
      drawOut(REST, null);
      navOpacity = 1;
    }
    dim.style.opacity = to ? "1" : "0";
    veil.style.opacity = String(veilOf(at));
  } else if (dir === "in") {
    others(to);
    drawIn(s, emit);
    showPanel(to!, s - IN.panel, emit);
    const q = span(s, IN.nav.start, IN.nav.dur);
    navOpacity = 1 - q;
    if (emit && q > 0 && q < 1) emitText(emit, gitBtn, 0.6 * (1 - q), true);
    dim.style.opacity = String(easeOutCubic(span(s, IN.dim.start, IN.dim.dur)));
    veil.style.opacity = String(lerp(0, veilOf(at), blend));
  } else if (dir === "out") {
    others(from);
    drawOut(s, emit);
    hidePanelAt(from!, s, emit);
    navOpacity = easeOutCubic(span(s, OUT.nav.start, OUT.nav.dur));
    dim.style.opacity = String(1 - easeOutCubic(span(s, OUT.dim.start, OUT.dim.dur)));
    veil.style.opacity = String(lerp(veilOf(prev), 0, blend));
  } else {
    others(from, to);
    drawIn(REST, null);
    // One project to another (history only) shares a panel: it just shows again.
    if (from !== to) hidePanelAt(from!, s, emit);
    showPanel(to!, s - (from !== to ? SWAP.show : 0), emit);
    dim.style.opacity = "1";
    veil.style.opacity = String(lerp(veilOf(prev), veilOf(at), blend));
  }

  nav.style.opacity = String(navOpacity);
  nav.style.visibility = navOpacity > 0 ? "visible" : "hidden";
  homeBtn.style.visibility = to && dir !== "in" && dir !== "out" ? "visible" : "hidden";
  graph.hoverable = !dir && at === "git";
  if (!graph.hoverable) graph.leave();
}

// ---- the clock -----------------------------------------------------------------------------------------------

let at: Route = "home";
/** Where the current transition came from. */
let prev: Route = "home";
let dir: "in" | "out" | "swap" | null = null;
let s = 0;
/** Where `s` was last frame: the title's streak runs from there. */
let sPrev = 0;
let queued: Route | null = null;
let raf = 0;
let last = 0;
let aliveUntil = 0;
let dirty = true;
let fx: TrailParams = { ...IN_FX, center: [0, 0] };
const bursts: { at: number; center: [number, number]; draw: (ctx: CanvasRenderingContext2D, alpha: number) => void }[] = [];
const BURST = 0.4;

const transitionEnd = () =>
  dir === "in" ? IN.panel + showEnd(panelOf(at)!) : dir === "out" ? OUT.end : SWAP.show + showEnd(panelOf(at)!);

function panelCenter(): [number, number] {
  const p = panelOf(at);
  if (!p) return titleCenter();
  const r = panelEl(p).getBoundingClientRect();
  return [vw / 2, r.y + Math.min(r.height, vh - r.y) / 2];
}

function transitionFx(): TrailParams {
  if (dir === "out") return { ...OUT_FX, center: titleCenter() };
  if (dir === "swap") return { ...SETTLE_FX, center: panelCenter() };
  // The title's bloom eases into the panel's settle, about the panel's middle.
  const w = span(s, 0.45, 0.4);
  const [tx, ty] = titleCenter();
  const [px, py] = panelCenter();
  const mix = (k: keyof Fx) => lerp(IN_FX[k], SETTLE_FX[k], w);
  return {
    zoom: mix("zoom"),
    sep: mix("sep"),
    trail: mix("trail"),
    swirl: mix("swirl"),
    warp: mix("warp"),
    center: [lerp(tx, px, w), lerp(ty, py, w)],
  };
}

function frame(ms: number) {
  raf = 0;
  const now = ms / 1000;
  const dt = Math.min(Math.max(now - last, 0), 0.05);
  last = now;
  const end = transitionEnd();
  sPrev = s;
  if (dir) {
    s = reduceMotion ? end : Math.min(end, s + dt);
    dirty = true;
  }

  const emit = trails ? trails.begin() : null;
  emitted = false;
  if (dirty) {
    render(emit);
    dirty = false;
  }
  if (dir) fx = transitionFx();
  if (dir && s >= end) {
    // Landed: draw once more at rest, so what's only live at rest (the home link, the graph's hover) turns on.
    dir = null;
    dirty = true;
    const next = queued;
    queued = null;
    if (next && next !== at) start(next);
  }

  if (emit) {
    let drew = false;
    for (let i = bursts.length - 1; i >= 0; i--) {
      const age = now - bursts[i].at;
      if (age > BURST) bursts.splice(i, 1);
      else {
        bursts[i].draw(emit, 1 - age / BURST);
        if (!dir) fx = { ...HOVER_FX, center: bursts[i].center };
        drew = true;
      }
    }
    if (drew) emitted = true;
  }

  if (trails) {
    if (emitted) aliveUntil = now + fx.trail * 4 + 0.3;
    if (now < aliveUntil) trails.step(dt, now, fx, emitted);
    else trails.clear();
  }
  if (dir || dirty || now < aliveUntil || bursts.length) raf = requestAnimationFrame(frame);
}

function kick() {
  if (raf) return;
  last = performance.now() / 1000;
  raf = requestAnimationFrame(frame);
}

function burst(center: () => [number, number], draw: (ctx: CanvasRenderingContext2D, alpha: number) => void) {
  if (!trails || dir) return;
  bursts.push({ at: performance.now() / 1000, center: center(), draw });
  kick();
}

/** Off somewhere; one asked for mid-transition waits for this one to land. */
function start(where: Route) {
  if (dir) {
    queued = where;
    return;
  }
  if (where === at) return;
  const from = panelOf(at);
  const to = panelOf(where);
  prev = at;
  at = where;
  if (to === "project") openProject(where.slice(2));
  dir = !from ? "in" : !to ? "out" : "swap";
  s = sPrev = 0;
  kick();
}

const routeOf = (hash: string): Route =>
  hash.startsWith("#git/") ? `p:${decodeURIComponent(hash.slice(5))}` : hash === "#git" ? "git" : "home";
const urlOf = (r: Route) =>
  r === "home" ? location.pathname + location.search : r === "git" ? "#git" : `#git/${encodeURIComponent(r.slice(2))}`;

function go(where: Route) {
  if (where !== (queued ?? at)) history.pushState(null, "", urlOf(where));
  start(where);
}

/** Plain clicks go through the site; modified ones (new tab, etc.) are the browser's. */
const plainClick = (e: MouseEvent) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

// ---- a project's page: its README, as GitHub renders it --------------------------------------------------------

let projectName = "";
const readmes = new Map<string, Promise<string | null>>();

function loadReadme(name: string) {
  let html = readmes.get(name);
  if (!html) {
    html = fetch(`/data/readme/${encodeURIComponent(name)}.html`)
      .then((r) => (r.ok ? r.text() : null))
      .catch(() => null);
    readmes.set(name, html);
  }
  return html;
}

function fillCrumb() {
  const repo = repos.get(projectName);
  crumbName.textContent = projectName;
  crumbStars.textContent = repo && repo.stars > 0 ? `★${repo.stars}` : "";
  crumbGh.href = repo?.url ?? `https://github.com/theobourgeois/${projectName}`;
}

function openProject(name: string) {
  projectName = name;
  readmeState = "loading";
  readme.replaceChildren();
  projectView.scrollTop = 0;
  fillCrumb();
  loadReadme(name).then((html) => {
    if (projectName !== name) return;
    if (html) fillReadme(name, html);
    else {
      const p = document.createElement("p");
      p.textContent = repos.get(name)?.description ?? "";
      readme.replaceChildren(p);
    }
    readmeState = html ? "ready" : "none";
    dirty = true;
    kick();
  });
}

/** GitHub's HTML, with its relative images and links pointed back at the repo, and its own anchors kept in-page. */
function fillReadme(name: string, html: string) {
  const repo = repos.get(name);
  const path = repo ? new URL(repo.url).pathname.slice(1) : `theobourgeois/${name}`;
  const branch = repo?.branch ?? "main";
  const relative = (u: string) => !/^([a-z]+:|\/\/|#|data:)/i.test(u);
  const clean = (u: string) => u.replace(/^\.?\//, "");
  const raw = (u: string) => `https://raw.githubusercontent.com/${path}/${branch}/${clean(u)}`;
  readme.innerHTML = html;
  readme.querySelectorAll(".anchor").forEach((a) => a.remove());
  readme.querySelectorAll("img").forEach((img) => {
    const src = img.getAttribute("src") ?? "";
    if (relative(src)) img.src = raw(src);
    img.loading = "lazy";
    img.decoding = "async";
  });
  readme.querySelectorAll<HTMLSourceElement>("source[srcset]").forEach((source) => {
    const srcset = source.getAttribute("srcset")!;
    if (relative(srcset)) source.srcset = raw(srcset);
  });
  readme.querySelectorAll("a[href]").forEach((a) => {
    const href = a.getAttribute("href")!;
    if (href.startsWith("#")) return;
    if (relative(href)) {
      const isImage = /\.(png|jpe?g|gif|webp|svg|avif)$/i.test(href);
      a.setAttribute("href", isImage ? raw(href) : `https://github.com/${path}/blob/${branch}/${clean(href)}`);
    }
    a.setAttribute("target", "_blank");
    a.setAttribute("rel", "noopener");
  });
}

// A README's own #links scroll within it (GitHub prefixes its heading ids), not through the site's routes.
readme.addEventListener("click", (e) => {
  const a = (e.target as Element).closest<HTMLAnchorElement>('a[href^="#"]');
  if (!a) return;
  e.preventDefault();
  const id = decodeURIComponent(a.getAttribute("href")!.slice(1));
  readme.querySelector(`[id="user-content-${CSS.escape(id)}"], [id="${CSS.escape(id)}"]`)?.scrollIntoView({ behavior: "smooth" });
});

// ---- wiring --------------------------------------------------------------------------------------------------

const center = (el: Element): [number, number] => {
  const r = el.getBoundingClientRect();
  return [r.x + r.width / 2, r.y + r.height / 2];
};

function setup(data: GitHub) {
  graph.weeks = data.weeks;
  total.textContent = `${data.total.toLocaleString("en")} contributions / last 12 months`;
  data.pinned.forEach((repo) => repos.set(repo.name, repo));
  if (projectName) fillCrumb();
  rows = data.pinned.map((repo, k) => {
    const li = document.createElement("li");
    li.className = "project";
    const cell = <K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text: string) => {
      const el = document.createElement(tag);
      el.className = cls;
      el.textContent = text;
      li.append(el);
      return el;
    };
    cell("span", "idx", String(k + 1).padStart(2, "0"));
    const name = cell("a", "name", repo.name);
    name.href = urlOf(`p:${repo.name}`);
    name.addEventListener("click", (e) => {
      if (!plainClick(e)) return;
      e.preventDefault();
      go(`p:${repo.name}`);
    });
    const desc = repo.description ? cell("span", "desc", repo.description) : null;
    cell("span", "stars", repo.stars > 0 ? `★${repo.stars}` : "");
    const gh = cell("a", "gh", "");
    gh.href = repo.url;
    gh.target = "_blank";
    gh.rel = "noopener";
    gh.setAttribute("aria-label", `${repo.name} on GitHub`);
    gh.innerHTML = GITHUB_MARK;
    const row: Row = { el: li, name, desc, text: repo.description ?? "", prepared: null, size: 0, q: -1 };
    li.addEventListener("pointerenter", () => {
      loadReadme(repo.name);
      burst(() => center(li), (ctx, a) => emitRow(ctx, row, a * 0.7));
    });
    return row;
  });
  list.replaceChildren(...rows.map((r) => r.el));
}

graph.onHover = (c, r) => {
  dirty = true;
  kick();
  if (c < 0) return;
  burst(
    () => {
      const rect = graph.canvas.getBoundingClientRect();
      const [x, y] = graph.centerOf(c, r);
      return [rect.x + x, rect.y + y];
    },
    (ctx, a) => {
      const rect = graph.canvas.getBoundingClientRect();
      graph.emitCell(ctx, trails!.scale, c, r, rect.x, rect.y, a);
    },
  );
};

gitBtn.addEventListener("click", () => go("git"));
gitBtn.addEventListener("pointerenter", () => burst(() => center(gitBtn), (ctx, a) => emitText(ctx, gitBtn, a * 0.8, true)));
homeBtn.addEventListener("click", () => go("home"));
homeBtn.addEventListener("pointerenter", () =>
  burst(
    () => [vw / 2, top.y - title.size * top.scale * 0.35],
    (ctx, a) => {
      ctx.font = title.font;
      title.chars.forEach((_, i) => glyph(ctx, trails!.scale, title, i, top.x + title.xs[i] * top.scale, top.y, top.scale, 0, 0, a * 0.8, WHITE));
    },
  ),
);
crumbGit.addEventListener("click", (e) => {
  if (!plainClick(e)) return;
  e.preventDefault();
  go("git");
});
crumbGit.addEventListener("pointerenter", () => burst(() => center(crumbGit), (ctx, a) => emitText(ctx, crumbGit, a * 0.8)));
addEventListener("popstate", () => start(routeOf(location.hash)));
addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  if (panelOf(at) === "project") go("git");
  else if (at === "git") go("home");
});
addEventListener("resize", () => {
  layout();
  dirty = true;
  kick();
});

async function boot() {
  const data = fetch("/data/github.json").then((r) => r.json() as Promise<GitHub>);
  const fonts = Promise.all(
    [`600 40px ${FAMILY}`, `500 16px ${FAMILY}`, `400 13px ${MONO}`, `500 13px ${MONO}`].map((f) => document.fonts.load(f, TITLE + SUBTITLE)),
  );
  await Promise.race([fonts, new Promise((r) => setTimeout(r, 2500))]);
  layout();
  crisp.classList.add("ready");
  start(routeOf(location.hash));
  kick();
  data
    .then((d) => {
      setup(d);
      layout();
      dirty = true;
      kick();
    })
    .catch((e) => console.warn("no github data:", e));
  // A font that turned up late: measure again with it.
  fonts.then(() => {
    clearCache();
    rows.forEach((row) => (row.size = 0));
    layout();
    dirty = true;
    kick();
  });
}

boot();
