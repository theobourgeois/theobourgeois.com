// The echo behind everything: MilkDrop's (and the editor's World Loop's) feedback. Whatever's drawn into `source`
// this frame is laid over last frame's picture, which has flowed and zoomed a little about a centre, its red, green
// and blue zooming at slightly different rates, so white light leaves trails that split into RGB as they go. It runs at a fraction of the screen's
// resolution (the trails are soft anyway) and only while something's moving: at rest it costs nothing.

export interface TrailParams {
  /** Where the echo zooms about, in CSS pixels: an echo spreads from (or falls into) what made it. */
  center: [number, number];
  /** Echo zoom per second: above 1 blooms out of the centre, below falls into it. */
  zoom: number;
  /** How far apart red and blue zoom (red faster), so trails split into RGB. */
  sep: number;
  /** Seconds for an echo to fade to a tenth. */
  trail: number;
  /** Swirl of the echo itself, strongest in the middle, radians per second. */
  swirl: number;
  /** How hard the echo flows through noise. */
  warp: number;
}

const VERT = `attribute vec2 aPos;
varying vec2 vUv;
void main() { vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

const HEAD = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vUv;
`;

const UPDATE = `${HEAD}
uniform sampler2D uPrev;
uniform sampler2D uNow;
uniform vec2 uCenter;
uniform vec2 uTexel;
uniform float uHasNow, uRatio, uDt, uTime, uZoom, uSep, uTrail, uSwirl, uWarp;

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return v;
}

// Four taps a hair apart: blurred a little every frame, an echo melts into smoke instead of stamping copies.
vec4 fetch(vec2 p, vec2 c, float zoom) {
  vec2 at = (p / pow(zoom, uDt) + c) / vec2(uRatio, 1.0) + 0.5;
  vec2 inside = step(vec2(0.0), at) * step(at, vec2(1.0));
  vec2 o = uTexel * 0.7;
  vec4 sum = texture2D(uPrev, at + vec2(o.x, o.y)) + texture2D(uPrev, at + vec2(-o.x, o.y))
           + texture2D(uPrev, at + vec2(o.x, -o.y)) + texture2D(uPrev, at - o);
  return sum * 0.25 * inside.x * inside.y;
}

void main() {
  // Last frame's picture about the centre: flowing (swirled and warped by this frame's share of a second), then
  // zoomed, each channel at its own rate.
  vec2 c = (uCenter - 0.5) * vec2(uRatio, 1.0);
  vec2 p = (vUv - 0.5) * vec2(uRatio, 1.0) - c;
  p = rot(uSwirl * uDt * exp(-length(p) * 1.7)) * p;
  vec2 q = p * 2.4;
  p -= (vec2(fbm(q + uTime * 0.16), fbm(q - uTime * 0.13 + 5.2)) - 0.5) * uWarp * uDt * 1.5;
  vec4 r = fetch(p, c, uZoom * (1.0 + uSep));
  vec4 g = fetch(p, c, uZoom);
  vec4 b = fetch(p, c, uZoom * (1.0 - uSep));
  vec4 prev = vec4(r.r, g.g, b.b, max(max(r.a, g.a), b.a));
  // A level's step off every frame too, or 8-bit echoes get stuck just above black and never end.
  vec4 echo = max(prev * pow(0.1, uDt / uTrail) - 1.0 / 255.0, 0.0);
  echo.rgb = min(echo.rgb, echo.a);
  vec4 now = uHasNow > 0.5 ? texture2D(uNow, vUv) : vec4(0.0);
  gl_FragColor = now + echo - now * echo;
}`;

const SHOW = `${HEAD}
uniform sampler2D uTex;
void main() { gl_FragColor = texture2D(uTex, vUv); }`;

export class Trails {
  /** Draw this frame's light into here, in CSS pixels (its transform is set by `begin`). */
  readonly source = document.createElement("canvas");
  readonly ctx = this.source.getContext("2d")!;
  /** Backing pixels per CSS pixel. */
  scale = 1;
  private width = 1;
  private height = 1;
  private cssWidth = 1;
  private cssHeight = 1;
  private state: WebGLTexture[] = [];
  private fbos: WebGLFramebuffer[] = [];
  private now: WebGLTexture;
  private cur = 0;
  private live = false;
  private lost = false;
  private update: { program: WebGLProgram; u: Record<string, WebGLUniformLocation | null> };
  private show: { program: WebGLProgram; u: Record<string, WebGLUniformLocation | null> };

  static create(canvas: HTMLCanvasElement): Trails | null {
    const gl = canvas.getContext("webgl", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "low-power",
    });
    if (!gl) return null;
    try {
      return new Trails(canvas, gl);
    } catch (e) {
      console.warn("trails off:", e);
      return null;
    }
  }

  private constructor(
    readonly canvas: HTMLCanvasElement,
    private gl: WebGLRenderingContext,
  ) {
    this.update = this.program(UPDATE, ["uPrev", "uNow", "uHasNow", "uCenter", "uTexel", "uRatio", "uDt", "uTime", "uZoom", "uSep", "uTrail", "uSwirl", "uWarp"]);
    this.show = this.program(SHOW, ["uTex"]);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    this.now = this.texture();
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      this.lost = true;
    });
  }

  private program(frag: string, uniforms: string[]) {
    const gl = this.gl;
    const shader = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
      return s;
    };
    const program = gl.createProgram()!;
    gl.attachShader(program, shader(gl.VERTEX_SHADER, VERT));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, frag));
    gl.bindAttribLocation(program, 0, "aPos");
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program) ?? "link");
    return { program, u: Object.fromEntries(uniforms.map((n) => [n, gl.getUniformLocation(program, n)])) };
  }

  private texture() {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }

  resize(cssWidth: number, cssHeight: number, devicePixelRatio: number) {
    // Soft by design: about 0.75 of a device pixel, never wider than 1280.
    this.scale = Math.min(devicePixelRatio * 0.75, 1280 / cssWidth, 1.5);
    this.cssWidth = cssWidth;
    this.cssHeight = cssHeight;
    const w = Math.max(1, Math.round(cssWidth * this.scale));
    const h = Math.max(1, Math.round(cssHeight * this.scale));
    if (w === this.width && h === this.height && this.state.length) return;
    this.width = this.canvas.width = this.source.width = w;
    this.height = this.canvas.height = this.source.height = h;
    const gl = this.gl;
    this.fbos.forEach((f) => gl.deleteFramebuffer(f));
    this.state.forEach((t) => gl.deleteTexture(t));
    this.state = [this.texture(), this.texture()];
    this.fbos = this.state.map((tex) => {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      const fbo = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      return fbo;
    });
    this.live = true;
    this.clear();
  }

  /** A clean source for this frame, set up to draw light in CSS pixels. */
  begin() {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.globalCompositeOperation = "lighter";
    return ctx;
  }

  step(dt: number, time: number, p: TrailParams, hasSource: boolean) {
    if (this.lost) return;
    const gl = this.gl;
    if (hasSource) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.now);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.source);
    }
    const next = 1 - this.cur;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbos[next]);
    gl.viewport(0, 0, this.width, this.height);
    const { program, u } = this.update;
    gl.useProgram(program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.state[this.cur]);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.now);
    gl.uniform1i(u.uPrev, 0);
    gl.uniform1i(u.uNow, 1);
    gl.uniform1f(u.uHasNow, hasSource ? 1 : 0);
    gl.uniform1f(u.uRatio, this.width / this.height);
    gl.uniform1f(u.uDt, dt);
    gl.uniform1f(u.uTime, time);
    gl.uniform2f(u.uTexel, 1 / this.width, 1 / this.height);
    gl.uniform2f(u.uCenter, p.center[0] / this.cssWidth, 1 - p.center[1] / this.cssHeight);
    gl.uniform1f(u.uZoom, p.zoom);
    gl.uniform1f(u.uSep, p.sep);
    gl.uniform1f(u.uTrail, p.trail);
    gl.uniform1f(u.uSwirl, p.swirl);
    gl.uniform1f(u.uWarp, p.warp);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.useProgram(this.show.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.state[next]);
    gl.uniform1i(this.show.u.uTex, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    this.cur = next;
    this.live = true;
  }

  /** Wipe the echo (once it's faded out, so nothing lingers a level above black). */
  clear() {
    if (!this.live || this.lost) return;
    const gl = this.gl;
    gl.clearColor(0, 0, 0, 0);
    for (const fbo of [...this.fbos, null]) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.viewport(0, 0, this.width, this.height);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    this.live = false;
  }
}
