/* Lookdev ball (PROPAGATE). A WebGL sphere whose surface is cut into square cells (a cube-sphere, N cells per face edge).
   Two progress values run through the same cell front as the page wipe:
     build  0 → 1  the ball computes itself into existence, cell by cell (cells not built yet are empty);
     hover  0 → 1  every cell swaps from look A (unevaluated) to look B (evaluated).
   Cell order is the site's wipe order, in screen space: v = column × 0.12 + row ÷ rows × 0.5 + random × 0.22.
   The accent is only ever drawn on the newest cells of a front (the band), never as a fill.
   Idle: the ball turns slowly; every few seconds one band of rows slips one cell sideways for three frames (the shear).

   LookdevBall(canvas, { variant, hoverEl, accent, cells, build, still })
     variant  'wire' | 'powder' | 'xray' | 'dither'   (see LOOKS below)
     hoverEl  element whose pointer hover / focus / tap drives the hover front (default: the canvas's parent)
     accent   function returning a CSS colour string for the front (read every half second), or a colour string
     build    start empty and compute in (true) or start built (false). Call .build(1) / .build(0) to run it.
   Returns { build(target), hover(on), variant(name), draw(now), destroy() }. */
(function () {
  'use strict';
  const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const FS = `
#extension GL_OES_standard_derivatives : enable
precision highp float;
uniform vec2 uRes;
uniform float uT, uBuild, uHover, uShear, uShY, uShH, uLook, uN;
uniform vec3 uAcc;
const vec3 INK = vec3(.914,.922,.941), INK2 = vec3(.604,.631,.69), SHADE = vec3(.353,.38,.447),
  PANEL = vec3(.086,.098,.125), GHOST = vec3(.114,.125,.161), LINE = vec3(.204,.224,.271),
  PWD = vec3(.169,.184,.22), PWDS = vec3(.071,.078,.094);
const float R = .74, VMAX = 1.08, W = .05;

mat3 rotY(float a){float c=cos(a),s=sin(a);return mat3(c,0.,-s, 0.,1.,0., s,0.,c);}
mat3 rotX(float a){float c=cos(a),s=sin(a);return mat3(1.,0.,0., 0.,c,s, 0.,-s,c);}
float hash(vec3 p){p=fract(p*.3183099+vec3(.11,.17,.13));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}

/* cube-sphere cell of an object-space unit vector: face, cell id, position inside the cell (0..1), cell centre as a unit vector */
void cell(vec3 o, out vec3 id, out vec2 f, out vec3 cen){
  vec3 a = abs(o); vec2 uv; float face;
  if (a.x >= a.y && a.x >= a.z) { face = o.x > 0. ? 0. : 1.; uv = o.yz / a.x; }
  else if (a.y >= a.z)          { face = o.y > 0. ? 2. : 3.; uv = o.xz / a.y; }
  else                          { face = o.z > 0. ? 4. : 5.; uv = o.xy / a.z; }
  uv = atan(uv) * 1.27324;                                   // equal-angle cube map: cells keep their size towards the corners
  vec2 g = (uv * .5 + .5) * uN, c = floor(min(g, uN - .001));
  f = g - c; id = vec3(c, face);
  vec2 cu = tan(((c + .5) / uN * 2. - 1.) * .785398);
  float sg = mod(face, 2.) < .5 ? 1. : -1.;
  cen = face < 2. ? vec3(sg, cu.x, cu.y) : face < 4. ? vec3(cu.x, sg, cu.y) : vec3(cu.x, cu.y, sg);
  cen = normalize(cen);
}
/* the cell front: 1 where the cell is done, band = 1 on the newest cells */
float front(float v, float P, out float band){ float t = P * (VMAX + W); float m = step(v, t); band = m * step(t - W, v); return m; }
float gridLine(vec2 f, float px){ float d = min(min(f.x, 1. - f.x), min(f.y, 1. - f.y)); return 1. - smoothstep(px * .6, px * 1.6, d); }
float bayer(vec2 q){                                         // 4×4 ordered dither threshold
  vec2 m = mod(floor(q), 4.); float i = m.x + m.y * 4.;
  float b = 0.;
  if (i < .5) b = 0.; else if (i < 1.5) b = 8.; else if (i < 2.5) b = 2.; else if (i < 3.5) b = 10.;
  else if (i < 4.5) b = 12.; else if (i < 5.5) b = 4.; else if (i < 6.5) b = 14.; else if (i < 7.5) b = 6.;
  else if (i < 8.5) b = 3.; else if (i < 9.5) b = 11.; else if (i < 10.5) b = 1.; else if (i < 11.5) b = 9.;
  else if (i < 12.5) b = 15.; else if (i < 13.5) b = 7.; else if (i < 14.5) b = 13.; else b = 5.;
  return (b + .5) / 16.;
}

void main(){
  float px = 2. / uRes.y;
  vec2 p = (gl_FragCoord.xy / uRes) * 2. - 1.;
  if (abs(p.y - uShY) < uShH) p.x -= uShear;                 // the shear: one band of rows slips one cell
  float r2 = dot(p, p);
  float cov = clamp((R - sqrt(r2)) / px + .5, 0., 1.);
  if (cov <= 0.) { gl_FragColor = vec4(0.); return; }
  mat3 M = rotY(uT * .38) * rotX(.42);                       // object = M * view
  float z = sqrt(max(R * R - r2, 0.));
  vec3 n = vec3(p, z) / R;                                   // view-space normal, front hemisphere
  vec3 id; vec2 f; vec3 cen;
  cell(M * n, id, f, cen);
  vec3 cv = cen * M;                                          // cell centre back in view space (M is orthonormal)
  float rnd = hash(id + 3.1);
  float v = (cv.x * .5 + .5) * .36 + (.5 - cv.y * .5) * .5 + rnd * .22;
  float bb, bh;
  float built = front(v, uBuild, bb);
  float done = front(v, uHover, bh);
  float lw = fwidth(f.x) + fwidth(f.y);
  float gl = gridLine(f, lw * .4);

  vec3 L = normalize(vec3(-.55, .62, .56)), H = normalize(L + vec3(0., 0., 1.));
  float lit = step(0., dot(n, L)), spec = step(.986, dot(n, H));
  float lam = clamp(dot(n, L) * .5 + .5, 0., 1.);

  /* the far hemisphere seen from inside (for the x-ray and wire looks) */
  vec3 nb = vec3(p, -z) / R; vec3 idb; vec2 fb; vec3 cb;
  cell(M * nb, idb, fb, cb);
  float glb = gridLine(fb, (fwidth(fb.x) + fwidth(fb.y)) * .5);

  vec3 shell = mix(SHADE, INK, lit); shell = mix(shell, vec3(1.), spec); shell = mix(shell, shell * .86, gl * .45);
  vec3 col; float a = 1.;
  vec3 A, B; float aA = 1., aB = 1.;
  if (uLook < .5) {                                          // WIRE: shell (A) → cells become their own wireframe (B)
    A = shell;
    B = mix(PANEL, INK, gl); B = mix(B, mix(B, INK2 * .55, glb), 1. - gl);
  } else if (uLook < 1.5) {                                  // POWDER: dark powder-coat (A) → ink shell (B)
    A = mix(PWDS, PWD, lit); A = mix(A, INK2, spec * .9); A = mix(A, LINE, gl * .8);
    B = shell;
  } else if (uLook < 2.5) {                                  // XRAY: shell (A) → hollow: only the inside of the far half (B)
    A = shell;
    float inner = step(.0, -dot(nb, L));
    B = mix(mix(PANEL, GHOST, inner), INK2, glb * .85);
    aB = 1.;
  } else {                                                   // DITHER: unevaluated ordered dither (A) → resolved one-step shell (B)
    float th = bayer(gl_FragCoord.xy / max(1., uRes.y / 120.));
    A = mix(PANEL, INK, step(th, lam * lam * 1.05)); A = mix(A, LINE, gl * .5);
    B = shell;
  }
  col = mix(A, B, done); a = mix(aA, aB, done);
  col = mix(col, uAcc, max(bh, bb));                          // the front band: the only place the accent appears
  a *= built * cov;
  gl_FragColor = vec4(col * a, a);
}`;
  const LOOKS = { wire: 0, powder: 1, xray: 2, dither: 3 };

  function parseColour(s) {
    s = String(s || '').trim();
    if (s[0] === '#') {
      if (s.length === 4) s = '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
      const n = parseInt(s.slice(1, 7), 16);
      return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
    }
    const m = s.match(/[\d.]+/g);
    return m && m.length >= 3 ? [m[0] / 255, m[1] / 255, m[2] / 255] : [.706, .941, 0];
  }

  function LookdevBall(canvas, o) {
    o = o || {};
    const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false });
    if (!gl) return null;
    gl.getExtension('OES_standard_derivatives');
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
    gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = {}; ['uRes', 'uT', 'uBuild', 'uHover', 'uShear', 'uShY', 'uShH', 'uLook', 'uN', 'uAcc'].forEach(k => { U[k] = gl.getUniformLocation(prog, k); });

    const still = matchMedia('(prefers-reduced-motion: reduce)');
    const N = o.cells || 5, IN = 480;
    let look = LOOKS[o.variant] || 0, acc = [.706, .941, 0], accT = 0;
    const st = { build: o.build === false ? 1 : 0, buildTo: o.build === false ? 1 : 0, hover: 0, hoverTo: 0, last: 0 };
    let shear = { at: 0, y: 0, until: 0 }, nextShear = 0, raf = 0, alive = true, visible = true, t0 = performance.now();

    function readAccent(now) {
      if (now - accT < 500) return; accT = now;
      acc = parseColour(typeof o.accent === 'function' ? o.accent() : o.accent || '#B4F000');
    }
    function size() {
      const dpr = Math.min(2, devicePixelRatio || 1), w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
      if (w && h && (canvas.width !== w || canvas.height !== h)) { canvas.width = w; canvas.height = h; }
    }
    const step = (cur, to, dt) => (cur < to ? Math.min(to, cur + dt / IN) : Math.max(to, cur - dt / IN));

    function draw(now) {
      size(); readAccent(now);
      const dt = st.last ? Math.min(64, now - st.last) : 16; st.last = now;
      if (still.matches) { st.build = st.buildTo; st.hover = st.hoverTo; }
      else { st.build = step(st.build, st.buildTo, dt); st.hover = step(st.hover, st.hoverTo, dt); }
      /* the shear: every 3–5 s while idle, one band of rows slips one cell for three frames (≈ 125 ms) */
      let shx = 0, shy = 0;
      if (!still.matches && st.build >= 1) {
        if (!nextShear) nextShear = now + 2500 + Math.random() * 2000;
        if (now >= nextShear && st.hover === st.hoverTo) {
          const c = 1.48 / (N * 2.2);                       // about one cell on screen
          shear = { y: (Math.floor(Math.random() * 7) - 3) * c, until: now + 125, c: (Math.random() < .5 ? -1 : 1) * c };
          nextShear = now + 3000 + Math.random() * 2000;
        }
        if (now < shear.until) { shx = shear.c; shy = shear.y; }
      }
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(U.uRes, canvas.width, canvas.height);
      gl.uniform1f(U.uT, still.matches ? 1.2 : (now - t0) / 1000);
      gl.uniform1f(U.uBuild, st.build); gl.uniform1f(U.uHover, st.hover);
      gl.uniform1f(U.uShear, shx); gl.uniform1f(U.uShY, shy); gl.uniform1f(U.uShH, shx ? 1.48 / (N * 4.4) : -1);
      gl.uniform1f(U.uLook, look); gl.uniform1f(U.uN, N); gl.uniform3fv(U.uAcc, acc);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    function loop(now) {
      raf = 0; if (!alive) return;
      draw(now);
      const moving = st.build !== st.buildTo || st.hover !== st.hoverTo;
      if (visible && !document.hidden && (!still.matches || moving)) raf = requestAnimationFrame(loop);
    }
    const kick = () => { if (!raf && alive) raf = requestAnimationFrame(loop); };

    const el = o.hoverEl || canvas.parentElement;
    const on = () => { st.hoverTo = 1; kick(); }, off = () => { st.hoverTo = 0; kick(); };
    const tap = e => { if (e.pointerType !== 'mouse') { st.hoverTo = st.hoverTo ? 0 : 1; kick(); } };
    if (el && o.hoverEl !== false) {
      el.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') on(); });
      el.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') off(); });
      el.addEventListener('pointerup', tap);
      el.addEventListener('focusin', on); el.addEventListener('focusout', off);
    }
    const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) kick(); }) : null;
    if (io) io.observe(canvas);
    document.addEventListener('visibilitychange', kick);
    still.addEventListener && still.addEventListener('change', kick);
    kick();

    return {
      build(v) { st.buildTo = v ? 1 : 0; kick(); },
      hover(v) { st.hoverTo = v ? 1 : 0; kick(); },
      variant(name) { look = LOOKS[name] || 0; kick(); },
      get built() { return st.build; },
      draw,
      set(b, h) { st.build = st.buildTo = b; st.hover = st.hoverTo = h; kick(); },
      destroy() { alive = false; if (io) io.disconnect(); }
    };
  }
  window.LookdevBall = LookdevBall;
})();
