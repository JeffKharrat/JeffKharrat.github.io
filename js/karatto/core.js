/* カラット: the core. A hollow cavity in the planet's heart; the AI (the player) hangs at its centre from pipes; the
   cavity wall is its memory, a keyboard of every JLPT kanji. Two views: the base view (the AI and the corporation's
   panels) and the wall view (on the gantry, looking around the wall). Clicking a key presses it and opens its file. */
import * as THREE from '../vendor/three.module.min.js';
import { loadKanji, keyStates, progress, TIERS, LEVELS } from './model.js?v=7';
import * as store from './store.js?v=7';
import { files, updateFlags } from './evidence.js?v=7';
import { openAudit } from './audit.js?v=7';
import { leafSVG, leafFavicon } from './leaf.js?v=7';
import { advance, hourOf } from './sim.js?v=7';
import { openMgmt, briefing, decide, mgmtOpen, refreshMgmt } from './mgmt.js?v=7';

const $ = s => document.querySelector(s);
const QS = new URLSearchParams(location.search), DEMO = QS.has('demo'), EMBED = QS.has('embed') && parent !== window;   // embed: opened over the site from Tau Jeffy VI
const ACC = new THREE.Color('#FFE600'), WARM = new THREE.Color('#FFF0A0');   // the AI's light: yellow
const sm5 = t => { t = Math.min(1, Math.max(0, t)); return t * t * t * (t * (t * 6 - 15) + 10); };

/* ---------------- renderer, scene ---------------- */
const canvas = $('#k3');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene(); scene.background = new THREE.Color('#050608');
const camera = new THREE.PerspectiveCamera(56, 1, .3, 1000);
const UT = { value: 0 };

/* the cavity's proportions */
const RC = 100, ROWS = 18, PITCH = .03, RW = 34, KH = 1.1;          // cavity radius, key rows, key pitch (rad), gantry radius, key height
const dir = (t, p) => new THREE.Vector3(Math.sin(t) * Math.cos(p), Math.sin(p), Math.cos(t) * Math.cos(p));

/* ---------------- shared GLSL ---------------- */
const HASH = `float hash(vec3 c){ return fract(sin(dot(c, vec3(12.9898,78.233,37.719))) * 43758.5453); }
float grid(vec2 g, float w){ vec2 fw = max(fwidth(g), vec2(1e-4)), f = fract(g), e = min(f, 1. - f), l = 1. - smoothstep(fw * w, fw * (w + 1.), e); return max(l.x, l.y); }`;

/* ---------------- the cavity shell ---------------- */
function cavity() {
  const g = new THREE.SphereGeometry(RC + 3, 96, 64);
  const m = new THREE.ShaderMaterial({ side: THREE.BackSide, uniforms: { uTime: UT, uAcc: { value: ACC } },
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `precision highp float; uniform float uTime; uniform vec3 uAcc; varying vec3 vP; ${HASH}
void main(){
  vec3 d = normalize(vP); float th = atan(d.x, d.z), ph = asin(d.y);
  vec2 g = vec2(th / .06, ph / .06), cell = floor(g);
  float h = hash(vec3(cell, 1.)), gl = grid(g, .6), gm = grid(g / 4., .8);
  vec3 c = vec3(.055, .062, .078) * (.8 + .4 * h);
  c = mix(c, vec3(.13, .145, .18), gl * .55); c = mix(c, vec3(.2, .22, .27), gm * .6);
  float lamp = step(.985, h) * step(.2, abs(ph)) * (.6 + .4 * sin(uTime * 1.3 + h * 40.));
  c += vec3(.75, .8, .9) * lamp * .35;                                  // a few service lights in the panels
  float top = smoothstep(.95, 1.25, ph), pit = smoothstep(-.95, -1.3, ph);
  c += uAcc * .25 * top + uAcc * .12 * pit;                             // the shaft above, the machinery below
  c *= .55 + .45 * smoothstep(-1.4, .4, ph);
  gl_FragColor = vec4(c, 1.);
}` });
  scene.add(new THREE.Mesh(g, m));
}

/* ---------------- the AI ---------------- */
let AI = null;
function theAI() {
  const R = 13, grp = new THREE.Group(); scene.add(grp);
  const m = new THREE.ShaderMaterial({ uniforms: { uTime: UT, uAcc: { value: ACC }, uPulse: { value: 0 } },
    vertexShader: `varying vec3 vP, vN, vW; void main(){ vP = position; vN = normalize(normalMatrix * normal); vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `precision highp float; uniform float uTime, uPulse; uniform vec3 uAcc; varying vec3 vP, vN, vW; ${HASH}
void main(){
  vec3 d = normalize(vP); float th = atan(d.x, d.z), ph = asin(d.y);
  float cw = .045, rowsW = max(cos(ph), .15);
  vec2 g = vec2(th / cw * rowsW, ph / cw), cell = floor(g);
  float h = hash(vec3(cell, 7.)), h2 = hash(vec3(cell, 3.));
  float seam = grid(g, .5), plate = grid(g / vec2(6., 4.), 1.2);
  vec3 N = normalize(vN), V = normalize(cameraPosition - vW), L = normalize(vec3(.2, 1., .35));
  float dif = max(dot(N, L), 0.) * .6 + .4, fr = pow(1. - abs(dot(N, V)), 3.);
  /* the armour: gunmetal plates, a little variation per panel, deep seams */
  vec3 c = vec3(.085, .092, .11) * (.75 + .5 * hash(vec3(floor(g / vec2(6., 4.)), 9.))) * dif;
  c = mix(c, vec3(.03, .032, .04), seam * .6); c = mix(c, vec3(.015), plate * .9);
  /* the mind: a band round the equator where cells fire, thoughts travelling round it */
  float band = 1. - smoothstep(.13, .16, abs(ph)), edge = smoothstep(.12, .16, abs(ph)) * (1. - smoothstep(.16, .19, abs(ph)));
  float run = fract(th / 6.2832 * 3. - uTime * .12), wave = smoothstep(.0, .25, run) * (1. - smoothstep(.25, .9, run));
  float fire = step(.55, h * .7 + wave * .5) * (.5 + .5 * sin(uTime * (3. + h2 * 9.) + h * 40.));
  vec3 cool = mix(uAcc * 1.6, vec3(1., .97, .85), step(.86, h2));
  c = mix(c, vec3(.02, .022, .03) + cool * fire * (.6 + uPulse), band);
  c += uAcc * edge * 1.2;
  /* elsewhere a few service lights blink on the plates */
  float svc = step(.992, h) * step(.5, fract(uTime * .4 + h2)) * (1. - band);
  c += vec3(.9, .95, 1.) * svc * .8;
  c += uAcc * fr * (.35 + uPulse * .8);
  gl_FragColor = vec4(c, 1.);
}` });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(R, 128, 96), m); grp.add(shell);
  /* rings of the AI, slowly turning */
  const rings = [];
  [[R * 1.28, .32, .08], [R * 1.42, .14, -.32], [R * 1.58, .1, .55]].forEach(([r, w, tilt], i) => {
    const t = new THREE.Mesh(new THREE.TorusGeometry(r, w, 6, 160), new THREE.ShaderMaterial({ uniforms: { uTime: UT, uAcc: { value: ACC }, uK: { value: i } },
      vertexShader: `varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
      fragmentShader: `precision highp float; uniform float uTime, uK; uniform vec3 uAcc; varying vec2 vU;
void main(){ float s = fract(vU.x * (40. + uK * 18.) - uTime * (.25 + uK * .1)); vec3 c = mix(vec3(.07,.075,.09), uAcc * 1.3, step(.9, s) * (uK < .5 ? .6 : 1.)); gl_FragColor = vec4(c, 1.); }` }));
    t.rotation.x = Math.PI / 2 + tilt; t.rotation.y = tilt * .6; grp.add(t); rings.push(t);
  });
  /* glow sprite behind it */
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(R * 6, R * 6), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uAcc: { value: ACC }, uTime: UT },
    vertexShader: `varying vec2 vU; void main(){ vU = uv; vec4 c = modelViewMatrix * vec4(0.,0.,0.,1.); c.xy += position.xy; gl_Position = projectionMatrix * c; }`,
    fragmentShader: `precision highp float; uniform vec3 uAcc; uniform float uTime; varying vec2 vU; void main(){ float d = length(vU - .5) * 2.; float a = exp(-d * d * 5.) * .55 * (.9 + .1 * sin(uTime * 1.3)); gl_FragColor = vec4(uAcc * a, 1.); }` }));
  glow.renderOrder = -1; grp.add(glow);
  AI = { grp, m, rings, R };
}

/* ---------------- pipes: hanging from the ceiling to the AI, data running down them ---------------- */
function pipes() {
  const mat = new THREE.ShaderMaterial({ uniforms: { uTime: UT, uAcc: { value: ACC } },
    vertexShader: `varying vec2 vU; varying vec3 vN, vW; void main(){ vU = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `precision highp float; uniform float uTime; uniform vec3 uAcc; varying vec2 vU; varying vec3 vN, vW; ${HASH}
void main(){
  vec3 n = normalize(vN), L = normalize(-vW); float dif = max(dot(n, L), 0.);
  float band = step(.9, fract(vU.x * 60.)), seam = step(.96, fract(vU.y * 4.));
  vec3 c = vec3(.09, .1, .12) * (.5 + .7 * dif) + vec3(.06) * band + vec3(.04) * seam;
  float pkt = fract(vU.x * 6. + uTime * .35 + hash(vec3(floor(vU.y * 4.), 2., 3.)) * .3);
  c += uAcc * smoothstep(.93, 1., pkt) * step(.6, fract(vU.y * 4.)) * 1.4;     // packets of data sliding down to the AI
  gl_FragColor = vec4(c, 1.);
}` });
  const add = (pts, r) => { const curve = new THREE.CatmullRomCurve3(pts); scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 80, r, 10, false), mat)); };
  for (let i = 0; i < 8; i++) {                                            // from the ceiling, sagging a little, into the AI's top
    const a = i / 8 * Math.PI * 2 + .55, top = dir(a, 1.12 + (i % 2) * .12).multiplyScalar(RC + 2);
    const start = dir(a, .9).multiplyScalar(AI.R * .9), mid = start.clone().lerp(top, .5); mid.y -= 9 + (i % 3) * 4; mid.multiplyScalar(1.05);
    add([top, top.clone().lerp(mid, .5).add(new THREE.Vector3(0, -3, 0)), mid, start.clone().multiplyScalar(1.4), start], i % 2 ? .7 : 1.15);
  }
  for (let i = 0; i < 4; i++) {                                            // down into the machinery below
    const a = i / 4 * Math.PI * 2 + .6, bot = dir(a, -1.2).multiplyScalar(RC + 2), start = dir(a, -.85).multiplyScalar(AI.R * .9);
    const mid = start.clone().lerp(bot, .5); mid.y += 6;
    add([start, start.clone().multiplyScalar(1.5), mid, bot], .9);
  }
  for (let i = 0; i < 10; i++) {                                           // slack cables between the ceiling and the AI's shoulders
    const a = i / 10 * Math.PI * 2 + 1.1, top = dir(a, .95 + (i % 3) * .1).multiplyScalar(RC), start = dir(a + .25, .55).multiplyScalar(AI.R * .98);
    const mid = start.clone().lerp(top, .45); mid.y -= 14 + (i % 4) * 3;
    add([top, mid, start], .28);
  }
}

/* ---------------- the gantry: a ring walkway around the AI, three bridges to it ---------------- */
function gantry() {
  const m = new THREE.ShaderMaterial({ uniforms: {},
    vertexShader: `varying vec3 vN, vW; void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `precision highp float; varying vec3 vN, vW; void main(){ float dif = max(dot(normalize(vN), normalize(-vW)), 0.); gl_FragColor = vec4(vec3(.1,.11,.13) * (.45 + .8 * dif), 1.); }` });
  const deck = new THREE.Mesh(new THREE.TorusGeometry(RW, 1.6, 4, 180), m); deck.rotation.x = Math.PI / 2; deck.scale.z = .25; deck.position.y = -4.2; scene.add(deck);
  const rail = new THREE.Mesh(new THREE.TorusGeometry(RW + 1.4, .12, 6, 180), m); rail.rotation.x = Math.PI / 2; rail.position.y = -2.6; scene.add(rail);
  for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(2.4, .4, RW - AI.R * 1.75), m); const a = i / 3 * Math.PI * 2 + .5;
    b.position.set(Math.sin(a) * (RW + AI.R * 1.75) / 2, -4.2, Math.cos(a) * (RW + AI.R * 1.75) / 2); b.rotation.y = a; scene.add(b); }
}

/* ---------------- the memory wall: a keyboard of every kanji ---------------- */
let KD = null, WALL = null;
function layout() {
  /* sections by JLPT level (N5 first), divisions as column blocks inside each section, keys row-major inside a block */
  const P = new Array(KD.list.length), sections = []; let col = 0;
  for (const lv of LEVELS) {
    const c0 = col, divs = KD.meta.levels[lv].divs, blocks = [];
    for (let d = 0; d < divs; d++) {
      const keys = KD.list.filter(x => x.l === lv && x.d === d), w = Math.ceil(keys.length / ROWS);
      keys.forEach((x, i) => { P[x.n] = { c: col + i % w, r: Math.floor(i / w) }; });
      blocks.push({ d, c0: col, c1: col + w - 1 }); col += w + 1;
    }
    sections.push({ lv, c0, c1: col - 2, blocks }); col += 2;
  }
  /* columns run left to right as seen from the centre, so θ falls as the column grows */
  const C = col - 3, th0 = Math.PI - C * PITCH / 2, th1 = Math.PI + C * PITCH / 2;
  const angle = (c, r) => ({ t: th1 - c * PITCH, p: ((ROWS - 1) / 2 - r) * PITCH });
  return { P, sections, C, th0, th1, angle };
}

function glyphAtlas() {
  const S = 48, AC = 85, AR = Math.ceil(KD.list.length / AC), cv = document.createElement('canvas'); cv.width = AC * S; cv.height = AR * S;
  const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = `500 ${Math.round(S * .78)}px "M PLUS 1 Code", "Noto Sans JP", "Hiragino Sans", "Yu Gothic", sans-serif`;
  KD.list.forEach((k, i) => x.fillText(k.k, (i % AC) * S + S / 2, Math.floor(i / AC) * S + S / 2 + S * .04));
  const t = new THREE.CanvasTexture(cv); t.flipY = false; t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return { tex: t, AC, AR };
}

function keyGeometry() {
  /* a keycap: a tapered box, base 2.66 square, top 2.1, height KH; attribute aFace: 0 the top, 1 a side */
  const b = 1.33, t = 1.05, P = [], N = [], U = [], F = [];
  const quad = (a, c, d, e, f, uv) => { const n = new THREE.Vector3().subVectors(c, a).cross(new THREE.Vector3().subVectors(e, a)).normalize();
    for (const [v, u] of [[a, uv[0]], [c, uv[1]], [d, uv[2]], [a, uv[0]], [d, uv[2]], [e, uv[3]]]) { P.push(v.x, v.y, v.z); N.push(n.x, n.y, n.z); U.push(u[0], u[1]); F.push(f); } };
  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  const B = [v(-b, -b, 0), v(b, -b, 0), v(b, b, 0), v(-b, b, 0)], T = [v(-t, -t, KH), v(t, -t, KH), v(t, t, KH), v(-t, t, KH)];
  quad(T[0], T[1], T[2], T[3], 0, [[0, 0], [1, 0], [1, 1], [0, 1]]);
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; quad(B[i], B[j], T[j], T[i], 1, [[0, 0], [1, 0], [1, 1], [0, 1]]); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setAttribute('aFace', new THREE.Float32BufferAttribute(F, 1)); return g;
}

function buildWall() {
  const L = layout(), n = KD.list.length, atlas = glyphAtlas(), g = keyGeometry();
  const iG = new Float32Array(n), iS = new Float32Array(n * 4), iF0 = new Float32Array(n * 4), iF1 = new Float32Array(n * 4);
  KD.list.forEach((k, i) => { iG[i] = i; const w = k.fa.map(f => f.w).slice(0, 6); for (let j = 0; j < 4; j++) iF0[i * 4 + j] = w[j] || 0; iF1[i * 4] = w[4] || 0; iF1[i * 4 + 1] = w[5] || 0; iF1[i * 4 + 2] = k.r ? 0 : Math.min(6, k.fa.length); });
  g.setAttribute('iGlyph', new THREE.InstancedBufferAttribute(iG, 1));
  const aS = new THREE.InstancedBufferAttribute(iS, 4); aS.setUsage(THREE.DynamicDrawUsage); g.setAttribute('iState', aS);
  g.setAttribute('iF0', new THREE.InstancedBufferAttribute(iF0, 4));
  const aF1 = new THREE.InstancedBufferAttribute(iF1, 4); aF1.setUsage(THREE.DynamicDrawUsage); g.setAttribute('iF1', aF1);
  const U = { uAtlas: { value: atlas.tex }, uAC: { value: atlas.AC }, uAR: { value: atlas.AR }, uTime: UT, uAcc: { value: ACC }, uWarm: { value: WARM }, uRipC: { value: new THREE.Vector3() }, uRipT: { value: -1 } };
  const m = new THREE.ShaderMaterial({ uniforms: U, extensions: { derivatives: true },
    vertexShader: `attribute float aFace, iGlyph; attribute vec4 iState, iF0, iF1; uniform float uTime, uRipT; uniform vec3 uRipC;
varying vec2 vU; varying float vFace, vG, vRip, vZ; varying vec4 vS, vF0, vF1; varying vec3 vN, vW;
void main(){
  vU = uv; vFace = aFace; vG = iGlyph; vS = iState; vF0 = iF0; vF1 = iF1; vZ = position.z / ${KH.toFixed(2)};
  vec3 p = position; p.z += iState.z * .35 - iState.w * .6;               // hover lifts it, a press pushes it in
  vec4 kc = modelMatrix * instanceMatrix * vec4(0., 0., 0., 1.);
  float d = distance(kc.xyz, uRipC), t = uRipT;
  vRip = t < 0. ? 0. : exp(-pow((d - t * 42.) / 4.5, 2.)) * exp(-t * 1.8);  // the light ripple of a press, through the neighbours
  p.z += vRip * .25;
  vec4 w = modelMatrix * instanceMatrix * vec4(p, 1.); vW = w.xyz; vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`,
    fragmentShader: `precision highp float; uniform sampler2D uAtlas; uniform float uAC, uAR, uTime; uniform vec3 uAcc, uWarm;
varying vec2 vU; varying float vFace, vG, vRip, vZ; varying vec4 vS, vF0, vF1; varying vec3 vN, vW;
void main(){
  /* per-key values arrive interpolated; round them so a glyph index or a mask never lands a hair off */
  float lvl = floor(vS.x + .5), cov = floor(vS.y + .5), hov = vS.z, gi = floor(vG + .5);
  vec3 n = normalize(vN), L = normalize(-vW); float dif = max(dot(n, L), 0.);
  /* the level's light: none, dim, acquired (cool white), integrated (warm), mastered (the accent) */
  vec3 lc = lvl < 1.5 ? vec3(0.) : lvl < 2.5 ? vec3(.62, .66, .74) : lvl < 3.5 ? uWarm : uAcc;
  float li = lvl < 1.5 ? 0. : lvl < 2.5 ? .35 : lvl < 3.5 ? .55 : 1.;
  vec3 cap = vec3(.115, .125, .15) * (.45 + .75 * dif);
  vec3 c;
  if (vFace < .5) {
    c = cap * 1.15;
    /* sampled outside any branch so the mip level stays defined; masked to the legend area */
    vec2 gu = (vU - vec2(.12, .2)) / .76, gc = clamp(gu, 0., 1.);
    float inside = step(0., gu.x) * step(gu.x, 1.) * step(0., gu.y) * step(gu.y, 1.);
    vec2 cell = vec2(mod(gi, uAC), floor((gi + .5) / uAC));
    float a = texture2D(uAtlas, (cell + vec2(gc.x, 1. - gc.y)) / vec2(uAC, uAR)).a * inside;
    vec3 legend = lvl < .5 ? vec3(.24, .26, .31) : lvl < 1.5 ? vec3(.5, .53, .6) : mix(vec3(.85, .87, .9), lc * 1.25 + .1, .35);
    c = mix(c, legend + lc * li * .35, a);
    /* the strip under the legend: one segment per facet, sized by its weight, lit when covered */
    float nf = floor(vF1.z + .5);
    if (nf > .5 && vU.y > .07 && vU.y < .15 && vU.x > .12 && vU.x < .88) {
      float x = (vU.x - .12) / .76, acc = 0., seg = -1., edge = 0.;
      float w[6]; w[0] = vF0.x; w[1] = vF0.y; w[2] = vF0.z; w[3] = vF0.w; w[4] = vF1.x; w[5] = vF1.y;
      for (int i = 0; i < 6; i++) { if (float(i) < nf) { float a0 = acc; acc += w[i]; if (x >= a0 && x < acc) { seg = float(i); edge = min(x - a0, acc - x); } } }
      float on = seg < 0. ? 0. : step(.5, mod(floor(cov / pow(2., seg)), 2.));
      vec3 sc = mix(vec3(.2, .22, .27), lvl > 3.5 ? uAcc * 1.5 : lc * 1.2 + .05, on);
      c = mix(c, sc, step(.012, edge));
    }
    float rim = 1. - smoothstep(.0, .05, min(min(vU.x, 1. - vU.x), min(vU.y, 1. - vU.y)));
    c += (hov * .9 + vRip * 1.4) * uAcc * rim + vRip * uAcc * .25;
  } else {
    /* the sides: dark, the level's light leaking out at the foot of the key */
    c = cap * .75 + lc * li * pow(1. - vZ, 2.) * .9;
    c += uAcc * (hov * .35 + vRip * .9) * (1. - vZ);
  }
  gl_FragColor = vec4(c, 1.);
}` });
  const mesh = new THREE.InstancedMesh(g, m, n), M = new THREE.Matrix4(), pos = [];
  KD.list.forEach((k, i) => {
    const { t, p } = L.angle(L.P[i].c, L.P[i].r), d = dir(t, p), o = d.clone().multiplyScalar(RC - .3);
    const z = d.clone().negate(), x = new THREE.Vector3(-Math.cos(t), 0, Math.sin(t)), y = new THREE.Vector3().crossVectors(z, x);   // x right, y up, seen from the centre
    M.makeBasis(x, y, z).setPosition(o); mesh.setMatrixAt(i, M); pos.push(o.clone().addScaledVector(z, KH));
  });
  mesh.frustumCulled = false; scene.add(mesh);
  /* the plate behind the keys, ribs between sections, rails above and below, tier plaques, shutters */
  const grid = new Map(); KD.list.forEach((k, i) => grid.set(L.P[i].c + ':' + L.P[i].r, i));
  WALL = { L, mesh, U, aS, aF1, pos, grid, shutters: [], plaques: [] };
  wallDressing();
}

function wallDressing() {
  const { L } = WALL, half = (ROWS / 2 + .9) * PITCH, t0 = L.th0 - PITCH, t1 = L.th0 + (L.C + 1) * PITCH;
  /* the plate */
  const plate = new THREE.SphereGeometry(RC + .2, 240, 24, t0 + Math.PI / 2 * 0, t1 - t0, Math.PI / 2 - half, half * 2);
  const pm = new THREE.ShaderMaterial({ side: THREE.BackSide, extensions: { derivatives: true }, uniforms: { uP: { value: PITCH } },
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
    fragmentShader: `precision highp float; uniform float uP; varying vec3 vP; ${HASH}
void main(){ vec3 d = normalize(vP); vec2 g = vec2(atan(d.x, d.z), asin(d.y)) / uP + .5; float gl = grid(g, .5);
  vec3 c = mix(vec3(.04, .045, .055), vec3(.09, .1, .12), gl); gl_FragColor = vec4(c, 1.); }` });
  /* SphereGeometry: phi 0 points to −x, which is our θ = −π/2; rotating by +π/2 lines phi up with θ */
  const plateM = new THREE.Mesh(plate, pm); plateM.rotation.y = Math.PI / 2; scene.add(plateM);
  const metal = new THREE.ShaderMaterial({ vertexShader: `varying vec3 vN, vW; void main(){ vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: `precision highp float; varying vec3 vN, vW; void main(){ float dif = max(dot(normalize(vN), normalize(-vW)), 0.); gl_FragColor = vec4(vec3(.11,.12,.14) * (.4 + .9 * dif), 1.); }` });
  /* rails above and below the keys */
  for (const s of [-1, 1]) {
    const pts = []; for (let i = 0; i <= 120; i++) pts.push(dir(t0 + (t1 - t0) * i / 120, s * (half + .012)).multiplyScalar(RC - 1));
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 240, 1.1, 8), metal));
  }
  /* great ribs between the sections, running up and down the cavity */
  const ribAt = t => { const pts = []; for (let i = 0; i <= 40; i++) pts.push(dir(t, -1.25 + 2.5 * i / 40).multiplyScalar(RC - 1.5)); scene.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 1.8, 10), metal)); };
  L.sections.forEach((s, i) => { if (i) ribAt(L.angle(s.c0 - 1.5, 0).t); });
  ribAt(t0 - PITCH * .5); ribAt(t1 + PITCH * .5);
  for (let i = 0; i < 6; i++) ribAt(t1 + (2 * Math.PI - (t1 - t0)) * (i + 1) / 7);   // the rest of the cavity
  /* tier plaques above each section */
  L.sections.forEach((s, i) => {
    const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 192; const x = cv.getContext('2d');
    const T = TIERS[i]; x.fillStyle = '#E9EBF0'; x.font = '700 104px Tektur, sans-serif'; x.textBaseline = 'middle'; x.fillText('N' + s.lv, 16, 100);
    x.font = '600 64px "M PLUS 1", sans-serif'; x.fillText(T.name, 230, 82); x.fillStyle = '#9AA1B0'; x.font = '500 30px "M PLUS 1 Code", monospace'; x.fillText(T.en.toUpperCase() + ' · ' + (KD.meta.levels[s.lv].n) + ' KANJI', 232, 150);
    const tex = new THREE.CanvasTexture(cv), w = 30, h = w * 192 / 1024;
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    const tc = L.angle(s.c0, 0).t - 15 / RC, p = half + .06, d = dir(tc, p).multiplyScalar(RC - 3);
    pl.position.copy(d); pl.lookAt(0, d.y * .55, 0); scene.add(pl); WALL.plaques.push(pl);
  });
  /* shutters over the sections not yet unlocked */
  L.sections.forEach((s, i) => {
    const a0 = L.angle(s.c1 + .6, 0).t, a1 = L.angle(s.c0 - .6, 0).t;
    const g = new THREE.SphereGeometry(RC - 2.2, Math.max(8, Math.round((a1 - a0) / .01)), 16, 0, a1 - a0, Math.PI / 2 - half, half * 2);
    const m = new THREE.ShaderMaterial({ side: THREE.BackSide, extensions: { derivatives: true }, uniforms: { uOpen: { value: 0 }, uAcc: { value: ACC } },
      vertexShader: `varying vec2 vU; varying vec3 vP; void main(){ vU = uv; vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
      fragmentShader: `precision highp float; uniform float uOpen; uniform vec3 uAcc; varying vec2 vU; ${HASH}
void main(){ if (vU.y < uOpen) discard;
  float slat = fract(vU.y * 34.), edge = smoothstep(.0, .08, slat) * smoothstep(1., .85, slat);
  vec3 c = vec3(.13, .14, .17) * (.55 + .45 * edge);
  float hz = step(.5, fract((vU.x * 60. + vU.y * 20.))) * step(vU.y, .06);       // hazard stripes along the foot
  c = mix(c, vec3(.9, .62, .1), hz * .8);
  gl_FragColor = vec4(c, 1.); }` });
    const sh = new THREE.Mesh(g, m); sh.rotation.y = a0 + Math.PI / 2; scene.add(sh);
    WALL.shutters.push({ mesh: sh, m, lv: s.lv, open: 0, target: 0 });
  });
}

/* ---------------- state → keys ---------------- */
let SAVE = null, DECK = null, S = null, PROG = null;
function certifiedSet() { const c = new Set(); if (SAVE) for (const [id, w] of Object.entries(SAVE.words)) if (w.cert) c.add(+id); return c; }
const manualSet = () => new Set(Object.keys((SAVE && SAVE.kanji) || {}));
/* mark or unmark a kanji as acquired by hand */
const persist = () => { if (!DEMO) store.store(SAVE, null); };
function setManual(ks, on) {
  SAVE.kanji = SAVE.kanji || {}; let n = 0;
  for (const k of ks) { if (!KD.byK.has(k)) continue; if (on && !SAVE.kanji[k]) { SAVE.kanji[k] = Date.now(); n++; } if (!on && SAVE.kanji[k]) { delete SAVE.kanji[k]; n++; } }
  if (n) { persist(); applyState(); }
  return n;
}
function applyState() {
  const deck = DECK || [], cert = certifiedSet();
  S = keyStates(KD, deck, cert, manualSet()); PROG = progress(KD, S);
  summary();
  const a = WALL.aS.array, f1 = WALL.aF1.array;
  KD.list.forEach((k, i) => {
    a[i * 4] = S[i].lvl; let mask = 0; k.fa.slice(0, 6).forEach((f, j) => { if (S[i].covered.has(f.id)) mask |= 1 << j; }); a[i * 4 + 1] = mask;
  });
  WALL.aS.needsUpdate = true; WALL.aF1.needsUpdate = true;
  /* shutters: N5 always open; each next section opens with the tier before it */
  WALL.shutters.forEach((s, i) => { s.target = i <= PROG.tier + 1 ? 1 : 0; if (!applyState.done) s.open = s.target; });
  applyState.done = true;
  ui();
}

/* ---------------- views ---------------- */
const VIEW = { mode: 'base', yaw: Math.PI, pitch: .02, fov: 56, t: 1, from: null, to: null, front: Math.PI };
/* the base view looks across the cavity at the AI with the frontier behind it: the division being worked on.
   On a tall screen the AI is centred and the camera backs off. */
const basePose = () => {
  const f = Math.min(1, Math.max(0, (camera.aspect - .8) / .8)), k = 1 + (1 - f) * .35, Y = new THREE.Vector3(0, 1, 0), r = VIEW.front - Math.PI - .32 * f;
  const E = new THREE.Vector3(14 * f, 7, 70 * k).applyAxisAngle(Y, r), T = new THREE.Vector3(-12 * f, 1, 0).applyAxisAngle(Y, r); return { E, q: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(E, T, new THREE.Vector3(0, 1, 0))), fov: 56 }; };
const wallPose = () => { const E = new THREE.Vector3(Math.sin(VIEW.yaw) * RW, 0, Math.cos(VIEW.yaw) * RW), T = E.clone().add(dir(VIEW.yaw, VIEW.pitch)); return { E, q: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(E, T, new THREE.Vector3(0, 1, 0))), fov: VIEW.fov }; };
function go(mode) {
  if (mode === VIEW.mode) return;
  VIEW.from = { E: camera.position.clone(), q: camera.quaternion.clone(), fov: camera.fov }; VIEW.mode = mode; VIEW.t = 0;
  document.body.classList.toggle('wall', mode === 'wall'); $('#b-wall').style.display = mode === 'wall' ? 'none' : ''; $('#b-base').style.display = mode === 'wall' ? '' : 'none';
  if (mode === 'base') closeFile();
}
function poseNow() { return VIEW.mode === 'wall' ? wallPose() : basePose(); }

/* ---------------- input: look around, hover, press ---------------- */
const mouse = { x: 0, y: 0, down: false, dx: 0, moved: 0, inside: false };
let hover = -1, press = { i: -1, t: 0 }, ripT = -1;
canvas.addEventListener('pointerdown', e => { mouse.down = true; mouse.moved = 0; mouse.lx = e.clientX; mouse.ly = e.clientY; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', e => {
  mouse.x = e.clientX; mouse.y = e.clientY; mouse.inside = true;
  if (mouse.down && VIEW.mode === 'wall') {
    const dx = e.clientX - mouse.lx, dy = e.clientY - mouse.ly; mouse.lx = e.clientX; mouse.ly = e.clientY; mouse.moved += Math.abs(dx) + Math.abs(dy);
    const k = .0032 * VIEW.fov / 56; VIEW.yaw += dx * k; VIEW.pitch = Math.max(-.42, Math.min(.42, VIEW.pitch + dy * k));
  }
});
canvas.addEventListener('pointerup', e => {
  mouse.down = false; mouse.x = e.clientX; mouse.y = e.clientY; mouse.inside = true;
  const hit = pick(); if (hit >= 0) hover = hit;                      // pick now: don't wait for the next frame's hover
  if (!(mouse.moved < 6 && VIEW.mode === 'wall' && hit >= 0)) return;
  if (BATCH) { const k = KD.list[hover], on = !S[hover].manual; if (on && S[hover].lvl >= 2) { toast(k.k + ' is already in memory through your words.'); return; }
    setManual([k.k], on); press = { i: hover, t: 0 }; ripT = 0; WALL.U.uRipC.value.copy(WALL.pos[hover]); toast((on ? '取得 · ' : '取消 · ') + k.k + ' · ' + Object.keys(SAVE.kanji).length + ' marked by hand', 1400); }
  else pressKey(hover);
});
/* batch mode: each click marks or unmarks a key, without opening its file */
let BATCH = false;
$('#b-batch').onclick = () => { BATCH = !BATCH; $('#b-batch').classList.toggle('on', BATCH); document.body.classList.toggle('batch', BATCH); if (BATCH) { closeFile(); toast('Batch mode: click the kanji you already know to mark them acquired. Click again to undo.', 4200); } };
canvas.addEventListener('pointerleave', () => { mouse.inside = false; });
canvas.addEventListener('wheel', e => { if (VIEW.mode !== 'wall') return; e.preventDefault(); VIEW.fov = Math.max(18, Math.min(62, VIEW.fov * (1 + Math.sign(e.deltaY) * .08))); }, { passive: false });
const surface = () => parent.postMessage('karatto:surface', location.origin);
if (EMBED) { const b = document.createElement('button'); b.className = 'btn'; b.id = 'b-surf'; b.innerHTML = '地上<small>Back to the surface</small>'; $('#bar').prepend(b); b.onclick = surface; }
addEventListener('keydown', e => {
  if (EMBED && e.key === 'Escape' && VIEW.mode === 'base' && !$('#set').classList.contains('on')) { surface(); return; }
  if (VIEW.mode !== 'wall') return;
  if (e.key === 'ArrowLeft') VIEW.yaw += .05; if (e.key === 'ArrowRight') VIEW.yaw -= .05; if (e.key === 'ArrowUp') VIEW.pitch = Math.min(.42, VIEW.pitch + .04); if (e.key === 'ArrowDown') VIEW.pitch = Math.max(-.42, VIEW.pitch - .04);
  if (e.key === 'Escape') { if ($('#file').classList.contains('on')) closeFile(); else go('base'); }
});
/* which key is under the mouse: the ray meets the sphere of the key tops, its angles give the column and row */
const ray = new THREE.Raycaster();
function pick() {
  if (!mouse.inside || VIEW.mode !== 'wall' || VIEW.t < 1) return -1;
  const r = canvas.getBoundingClientRect(); ray.setFromCamera({ x: (mouse.x - r.left) / r.width * 2 - 1, y: -(mouse.y - r.top) / r.height * 2 + 1 }, camera);
  const o = ray.ray.origin, d = ray.ray.direction, R = RC - .3 - KH, b = o.dot(d), c = o.lengthSq() - R * R, t = -b + Math.sqrt(b * b - c);
  const h = o.clone().addScaledVector(d, t).normalize(), th = Math.atan2(h.x, h.z), ph = Math.asin(h.y);
  let col = Math.round(((WALL.L.th1 - th) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) / PITCH), row = Math.round((ROWS - 1) / 2 - ph / PITCH);
  const i = WALL.grid.get(col + ':' + row); if (i === undefined) return -1;
  const s = WALL.shutters[LEVELS.indexOf(KD.list[i].l)]; if (s && s.open < .5) return -1;
  return i;
}
function pressKey(i) { press = { i, t: 0 }; ripT = 0; WALL.U.uRipC.value.copy(WALL.pos[i]); openFile(i); }

/* ---------------- the kanji's file ---------------- */
const LV = ['No word in the deck', 'In the deck, not yet in memory', 'Acquired', 'Integrated', 'Mastered'];
const LVJ = ['未登録', '未記憶', '取得', '統合', '掌握'];
function openFile(i) {
  const k = KD.list[i], s = S[i], deckById = new Map((DECK || []).map(w => [w.id, w])), cert = certifiedSet();
  const words = [...new Set(s.words)].map(id => deckById.get(id)).filter(Boolean);
  const fac = k.fa.map(f => {
    const cov = s.covered.has(f.id), mine = words.filter(w => (w._facets || []).some(x => x.k === k.k && x.facet === f.id));
    const ex = cov ? mine.filter(w => cert.has(w.id)).map(w => w.written || w.expr).slice(0, 3) : f.ex.slice(0, 3).map(e => e[0] + '（' + e[1] + '）');
    return `<div class="fa${cov ? ' cov' : ''}"><span class="r">${f.t === 'juku' ? '〈' + f.lab + '〉' : f.lab}</span><span class="w"><s style="width:${Math.round(f.w * 100)}%"></s></span><span class="lbl">${Math.round(f.w * 100)}%</span>
      <span class="ex">${cov ? 'In memory: <span>' + ex.join('、') + '</span>' : (mine.length ? 'In the deck: <span>' + mine.map(w => w.written || w.expr).slice(0, 3).join('、') + '</span> · ' : '') + 'Common: ' + ex.join('、')}</span></div>`;
  }).join('');
  const wl = words.map(w => `<div class="wd"><b>${w.written || w.expr.replace(/\[[^\]]*\]/g, '')}</b><span>${(w.meaning || '').slice(0, 40)}</span><span class="s">${cert.has(w.id) ? '記憶済 · in memory' : 'in the deck'}</span></div>`).join('') || '<p class="lbl">No word with this kanji in ジェフの日本語 yet.</p>';
  $('#file-c').innerHTML = `<div class="head"><div class="big">${k.k}</div><div class="meta"><div class="lbl">N${k.l} · ${TIERS[LEVELS.indexOf(k.l)].name} · division ${k.d + 1}</div>
      <div class="st">${LVJ[s.lvl]} · ${LV[s.lvl]}</div><div class="lbl" style="margin-top:4px">${k.m.join(' · ')}</div></div></div>
    <h4>Usage covered · ${Math.round(s.cov * 100)}%</h4>${k.r ? '<p class="lbl">A rare kanji: no common word uses it, so it has no usage map.</p>' : fac}
    <h4>Your words · ${words.length}</h4>${wl}
    <h4>Readings</h4><div class="lbl">音 ${k.on.join('、') || '—'} &nbsp; 訓 ${k.kun.join('、') || '—'}</div>
    <div class="grp man">${s.manual ? `<span class="lbl">Marked acquired by hand · ${new Date(SAVE.kanji[k.k]).toLocaleDateString()}</span> <button class="btn" id="f-man">Undo</button>`
      : s.lvl >= 2 ? '' : `<button class="btn" id="f-man">取得済みにする<small>I know this kanji: mark it acquired</small></button>`}</div>`;
  const fm = $('#f-man'); if (fm) fm.onclick = () => { setManual([k.k], !s.manual); openFile(i); };
  $('#file').classList.add('on');
}
function closeFile() { $('#file').classList.remove('on'); }
$('#file-x').onclick = closeFile;

/* ---------------- the summary the planet reads (same origin, no kanji data needed there) ---------------- */
function summary() {
  const lev = {}; for (const [l, v] of Object.entries(PROG.lev)) lev[l] = { a: v.a, n: v.n, m: v.m };
  const div = {}; for (const v of Object.values(PROG.div)) (div[v.l] = div[v.l] || [])[v.d] = Math.round(v.a / v.n * 100) / 100;
  const counts = [0, 0, 0, 0, 0]; S.forEach(s => counts[s.lvl]++);
  try { localStorage.setItem('karatto.summary', JSON.stringify({ t: Date.now(), tier: PROG.tier, lev, div, counts, corp: SAVE.corp })); } catch (e) {}
}

/* ---------------- the corporation's panels ---------------- */
function ui() {
  const cert = certifiedSet(), lv = PROG.lev, tier = PROG.tier;
  const counts = [0, 0, 0, 0, 0]; S.forEach(s => counts[s.lvl]++);
  const fame = fameOf(), level = Math.floor(Math.sqrt(fame / 50)) + 1, next = Math.pow(level, 2) * 50, prev = Math.pow(level - 1, 2) * 50;
  $('#tier').textContent = tier < 0 ? '創業準備中 · Founding' : TIERS[tier].name + ' · ' + TIERS[tier].en;
  $('#famebar').style.width = Math.round((fame - prev) / (next - prev) * 100) + '%'; $('#famelv').textContent = 'Level ' + level;
  /* the division being worked on: the first one under 80% */
  const divs = Object.values(PROG.div).sort((a, b) => LEVELS.indexOf(a.l) - LEVELS.indexOf(b.l) || a.d - b.d), cur = divs.find(d => d.a / d.n < .8);
  const fb = cur ? WALL.L.sections[LEVELS.indexOf(cur.l)].blocks[cur.d] : null;
  if (fb) VIEW.front = WALL.L.angle((fb.c0 + fb.c1) / 2, 0).t;
  $('#divn').textContent = cur ? 'N' + cur.l + ' division ' + (cur.d + 1) + ' · ' + Math.round(cur.a / cur.n * 100) + '%' : 'All divisions held';
  const c = SAVE.corp, Sm = SAVE.sim; $('#r-funds').textContent = (c.funds < 0 ? '−¥' : '¥') + Math.abs(Math.round(c.funds)).toLocaleString(); $('#r-fame').textContent = fame.toLocaleString(); $('#r-data').textContent = Math.floor(c.data).toLocaleString(); $('#r-stab').textContent = Math.round(c.stability);
  if (Sm) { $('#r-share').textContent = '¥' + Sm.share.toLocaleString(); $('#r-pop').textContent = Math.round(Sm.pop.w + Sm.pop.c + Sm.pop.e).toLocaleString(); }
  const ne = Sm ? Sm.ev.length : 0; $('#b-mgmt').innerHTML = `経営${ne ? `<i>${ne}</i>` : ''}<small>Management${ne ? ' · ' + ne + ' decision' + (ne > 1 ? 's' : '') : ''}</small>`;
  const deckN = (DECK || []).length;
  $('#dirs').innerHTML = (tier < 0 ? [
    `創業: found the corporation. Commit your first 100 words to memory (${cert.size}/100).`,
    `Hold the N5 board: 80% of its keys acquired (${lv[5] ? Math.round(lv[5].a / lv[5].n * 100) : 0}%).`,
  ] : [`Advance the next division.`]).concat(Sm && Sm.dir ? [`取締役会: ${simDir()}`] : []).map(t => `<li>${t}</li>`).join('');
  $('#mem').innerHTML = [`Deck: ${deckN} words${DEMO ? ' (demo)' : ''}`, `In memory: ${cert.size}`, `Keys: ${counts[2]} acquired · ${counts[3]} integrated · ${counts[4]} mastered`, `Uncharted keys: ${counts[0]}`].map(t => `<li>${t}</li>`).join('');
  $('#jump').innerHTML = WALL.L.sections.map((s, i) => { const L2 = lv[s.lv] || { a: 0, n: 1 }; return `<button class="btn" data-s="${i}">N${s.lv}<span class="tn"> ${TIERS[i].name}</span><i><s style="width:${Math.round(L2.a / L2.n * 100)}%"></s></i></button>`; }).join('');
  $('#jump').querySelectorAll('button').forEach(b => b.onclick = () => { const s = WALL.L.sections[+b.dataset.s]; VIEW.yaw = WALL.L.angle((s.c0 + Math.min(s.c1, s.c0 + 20)) / 2, 0).t; VIEW.pitch = 0; });
  const nf = files(SAVE).length; $('#b-audit').innerHTML = `審査${nf ? `<i>${nf}</i>` : ''}<small>Audit room · ${nf} file${nf === 1 ? '' : 's'}</small>`;
  links();
}
let ANKI_OK = false, SRC = '';
function links() {
  const tok = store.token.get();
  $('#links').innerHTML = [
    `<span class="dot ${ANKI_OK ? 'ok' : 'warn'}"></span>Anki ${ANKI_OK ? 'connected (read-only)' : 'not reachable'}`,
    `<span class="dot ${tok ? 'ok' : 'warn'}"></span>Save: ${tok ? 'synced to your private gist' : 'this browser only'}${SRC ? ' · loaded from ' + SRC : ''}`,
  ].map(t => `<li>${t}</li>`).join('');
}
function toast(t, ms = 2600) { const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => e.classList.remove('on'), ms); }

/* ---------------- settings: Anki, the gist, export ---------------- */
function settings() {
  const tok = store.token.get();
  $('#set-c').innerHTML = `<div class="lbl">設定 · Settings</div>
    <div class="grp"><b>Anki</b> <span class="lbl">${ANKI_OK ? '· connected' : '· not reachable'}</span>
      <p>The game only reads the deck ジェフの日本語; it never changes anything in Anki. Needs Anki open with the AnkiConnect add-on, and this site allowed in its config (webCorsOriginList).</p>
      <button class="btn" id="s-anki">Read the deck from Anki</button></div>
    <div class="grp"><b>Sync between your PCs</b> <span class="lbl">${tok ? '· token set' : '· not set'}</span>
      <p>Paste a GitHub token that can only read and write gists. The game keeps your save in a private gist and finds it on your other PC.</p>
      <input id="s-tok" type="password" placeholder="github_pat_…" value="${tok ? '••••••••' : ''}">
      <button class="btn" id="s-save">Save token</button> <button class="btn" id="s-clear">Forget token</button></div>
    <div class="grp"><b>Kanji you already know</b> <span class="lbl">· ${Object.keys(SAVE.kanji || {}).length} marked by hand</span>
      <p>Paste any text: every JLPT kanji in it is marked acquired (the minimum). Words you commit to memory later take them further. Batch mode on the wall does the same one key at a time.</p>
      <textarea id="s-kan" rows="3" placeholder="日本語、学生、先生…"></textarea>
      <button class="btn" id="s-kan-go">Mark these acquired</button> <button class="btn" id="s-kan-clear">Clear all hand marks</button></div>
    <div class="grp"><b>Backup</b><p>A copy of your save as a file.</p><button class="btn" id="s-exp">Export save</button></div>`;
  $('#set').classList.add('on');
  $('#s-anki').onclick = async () => { try { toast('Reading the deck…', 60000); DECK = await store.loadDeckFromAnki((a, b) => toast(`Reading the deck… ${a}/${b}`, 60000)); store.store(SAVE, DECK); applyState(); toast(`Deck read: ${DECK.length} words.`); } catch (e) { toast('Anki not reachable: ' + e.message, 5000); } };
  $('#s-save').onclick = () => { const v = $('#s-tok').value.trim(); if (v && !v.startsWith('•')) { store.token.set(v); store.push(SAVE, DECK).then(() => toast('Synced to your private gist.')).catch(e => toast('GitHub refused the token: ' + e.message, 5000)); } links(); };
  $('#s-clear').onclick = () => { store.token.set(''); links(); toast('Token forgotten on this PC.'); };
  $('#s-exp').onclick = () => store.exportSave(SAVE);
  $('#s-kan-go').onclick = () => { const ks = [...new Set([...$('#s-kan').value].filter(c => KD.byK.has(c)))]; const n = setManual(ks, true); toast(`${n} kanji marked acquired (${ks.length - n} were already).`); settings(); };
  $('#s-kan-clear').onclick = () => { if (!confirm('Remove every hand mark? Words in memory are kept.')) return; const n = setManual(Object.keys(SAVE.kanji || {}), false); toast(n + ' hand marks removed.'); settings(); };
}
$('#b-set').onclick = settings; $('#set-x').onclick = () => $('#set').classList.remove('on');
function audit(tab) {
  if (!DECK || !DECK.length) { toast('No deck yet: Settings → Read the deck.'); return; }
  closeFile(); document.body.classList.add('audit');
  openAudit({ save: SAVE, deck: DECK, KD, founding: PROG.tier < 0, demo: DEMO, tab, persist,
    onClose: ids => { document.body.classList.remove('audit'); if (ids.length) { applyState(); const i = KD.list.findIndex(k => DECK.find(w => w.id === ids[ids.length - 1] && (w._facets || []).some(f => f.k === k.k))); if (i >= 0) { ripT = 0; WALL.U.uRipC.value.copy(WALL.pos[i]); } toast(ids.length + ' word' + (ids.length > 1 ? 's' : '') + ' committed to memory.'); } else ui(); } });
}
$('#b-audit').onclick = () => audit();

/* ---------------- the living planet: the simulation, the console, briefings and decisions ---------------- */
function fameOf() {
  const cert = certifiedSet(), counts = [0, 0, 0, 0, 0]; S.forEach(s => counts[s.lvl]++);
  return cert.size * 10 + counts[2] * 5 + counts[3] * 15 + counts[4] * 40 + Math.round((SAVE.sim && SAVE.sim.fameB) || 0);
}
function simCtx() {
  const counts = [0, 0, 0, 0, 0], fc = SAVE.corp.factory || {}; S.forEach(s => counts[s.lvl]++);
  return { mem: certifiedSet().size, acq: counts[2] + counts[3] + counts[4], tier: PROG.tier, div: Object.values(PROG.div).filter(d => d.a / d.n >= .8).length, up: (fc.conv ? 1 : 0) + (fc.qc ? 1 : 0) + (fc.ext ? 1 : 0), fame: fameOf(), tech: SAVE.corp.tech || {} };
}
function simDir() { const d = SAVE.sim.dir; return { funds: `funds ¥${d.goal.toLocaleString()}`, stab: `stability ${d.goal}+`, ship: `ship ${d.goal} products`, mem: `${d.goal} words in memory`, poll: `pollution ≤ ${d.goal}` }[d.k] + ' this quarter'; }
const busy = () => document.body.classList.contains('audit') || mgmtOpen() || (document.getElementById('mgm') || { classList: { contains: () => false } }).classList.contains('on');
function nextDecision() { const e = SAVE.sim && SAVE.sim.ev[0]; if (!e || busy()) return; decide(SAVE, e, persist, () => { ui(); refreshMgmt(); setTimeout(nextDecision, 300); }); }
function mgmt(tab) {
  closeFile(); document.body.classList.add('audit');
  openMgmt({ save: SAVE, ctx: simCtx, persist, tab, onClose: () => { document.body.classList.remove('audit'); ui(); nextDecision(); } });
}
$('#b-mgmt').onclick = () => mgmt();
/* every half minute: run the hours that have passed */
setInterval(() => { if (!SAVE || !SAVE.sim || !PROG) return; if (hourOf(Date.now()) > SAVE.sim.t) { advance(SAVE, simCtx(), Date.now(), true); persist(); ui(); refreshMgmt(); nextDecision(); breachAlert(); } }, 30000);
function breachAlert() { const b = SAVE.sim && SAVE.sim.breach && SAVE.sim.breach.open; if (b && breachAlert.t !== b.t) { breachAlert.t = b.t; toast(`侵入警報 BREACH · ${b.rival}'s AI is attacking the memory. Defend it in 保安部 (Security) on the surface.`, 9000); } }
$('#b-wall').onclick = () => go('wall'); $('#b-base').onclick = () => go('base');

/* ---------------- demo deck: for previews before Anki is connected ---------------- */
function demoDeck() {
  const deck = [], seen = new Set(); let id = 1;
  for (const k of KD.list) {
    if (k.l < 3 && Math.random() > .25) continue;
    for (const f of k.fa) for (const e of f.ex.slice(0, k.l >= 4 ? 3 : 1)) if (!seen.has(e[0])) { seen.add(e[0]); deck.push({ id: id++, written: e[0], reading: e[1], meaning: e[2], expr: e[0] }); }
  }
  const words = {}, y = new Date(Date.now() - 864e5 - 4 * 3600e3).toISOString().slice(0, 10), t = new Date(Date.now() - 4 * 3600e3).toISOString().slice(0, 10);
  deck.forEach(w => { const r = Math.random(); if (r < .62) words[w.id] = { cert: Date.now() }; else if (r < .645) words[w.id] = { ev: { meaning: { d: [y], at: 'factory' }, recall: { d: [y, t], at: 'factory' }, reading: { d: [t], at: 'factory' } } }; });
  return { deck, words };
}

/* ---------------- frame ---------------- */
function resize() { const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
addEventListener('resize', resize);
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  if (document.body.classList.contains('audit')) { last = now; return; }      // the audit room covers the core: don't render under it
  const dt = Math.min(.05, (now - last) / 1000); last = now; UT.value += dt;
  /* camera */
  const P = poseNow();
  if (VIEW.t < 1) { VIEW.t = Math.min(1, VIEW.t + dt / 1.4); const w = sm5(VIEW.t); camera.position.copy(VIEW.from.E).lerp(P.E, w); camera.quaternion.copy(VIEW.from.q).slerp(P.q, w); camera.fov = VIEW.from.fov + (P.fov - VIEW.from.fov) * w; }
  else { camera.position.copy(P.E); camera.quaternion.copy(P.q); camera.fov += (P.fov - camera.fov) * Math.min(1, dt * 8); }
  if (VIEW.mode === 'base') { const a = UT.value * .05; camera.position.x += Math.sin(a) * 1.5; camera.position.y += Math.sin(a * 1.3) * .6; }
  camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  if (AI) { AI.rings.forEach((r, i) => { r.rotation.z += dt * (.08 + i * .05) * (i % 2 ? -1 : 1); }); AI.grp.position.y = Math.sin(UT.value * .6) * .4; AI.m.uniforms.uPulse.value *= Math.pow(.2, dt); }
  if (WALL) {
    /* hover and press */
    const h = pick();
    if (h !== hover) { const a = WALL.aS.array; if (hover >= 0) a[hover * 4 + 2] = 0; if (h >= 0) a[h * 4 + 2] = 1; hover = h; canvas.style.cursor = h >= 0 ? 'pointer' : VIEW.mode === 'wall' ? 'grab' : 'default'; WALL.aS.needsUpdate = true; }
    if (press.i >= 0) {
      press.t += dt; const t = press.t, p = t < .06 ? t / .06 : Math.max(0, Math.exp(-(t - .06) * 11) * Math.cos((t - .06) * 28));
      WALL.aS.array[press.i * 4 + 3] = p; WALL.aS.needsUpdate = true; if (t > .8) { WALL.aS.array[press.i * 4 + 3] = 0; press.i = -1; }
    }
    if (ripT >= 0) { ripT += dt; WALL.U.uRipT.value = ripT; if (ripT > 3) { ripT = -1; WALL.U.uRipT.value = -1; } }
    WALL.shutters.forEach(s => { s.open += (s.target - s.open) * Math.min(1, dt * 1.2); s.m.uniforms.uOpen.value = s.open; s.mesh.visible = s.open < .995; });
  }
  renderer.render(scene, camera);
}

/* ---------------- start ---------------- */
(async function start() {
  $('#emblem').innerHTML = leafSVG(44, { N: 23 }); leafFavicon();
  resize(); cavity(); theAI(); pipes(); gantry();
  requestAnimationFrame(frame);
  KD = await loadKanji('../data/karatto/kanji.json');
  const chars = KD.list.map(k => k.k).join('');
  if (document.fonts) await Promise.race([Promise.all([document.fonts.load('500 37px "M PLUS 1 Code"', chars), document.fonts.load('500 64px "M PLUS 1"', '町工場中小企業堅大財閥')]), new Promise(r => setTimeout(r, 6000))]);
  buildWall();
  const L0 = await store.load(); SAVE = L0.save; DECK = L0.deck; SRC = L0.source;
  if (DEMO) { const d = demoDeck(); DECK = d.deck; SAVE = { ...SAVE, words: d.words, corp: { ...SAVE.corp }, sim: undefined }; }
  updateFlags(SAVE); if (!DEMO && DECK) persist();
  ANKI_OK = await store.ankiAvailable();
  applyState();
  /* the hours since the last visit */
  if (DEMO) advance(SAVE, simCtx(), Date.now() - 30 * 3600e3);
  const sum = advance(SAVE, simCtx(), Date.now(), false); persist(); ui();
  if (sum.hours >= 2 && !QS.has('audit')) briefing(sum, nextDecision); else nextDecision();
  if (!DECK && !DEMO) toast(ANKI_OK ? 'Anki found: open Settings to read your deck.' : 'No deck yet: open Anki, then Settings → Read the deck.', 6000);
  if (EMBED) parent.postMessage('karatto:ready', location.origin);
  if (QS.has('audit')) audit();
  window.__k = { go, pressKey, audit, mgmt, save: () => SAVE, advance: h => { advance(SAVE, simCtx(), Date.now() + h * 3600e3, true); ui(); refreshMgmt(); }, view: VIEW, state: () => ({ tier: PROG.tier, deck: (DECK || []).length }), yaw: (y, p, f) => { VIEW.yaw = y; VIEW.pitch = p || 0; if (f) VIEW.fov = f; }, sec: i => { const s = WALL.L.sections[i]; return WALL.L.angle(s.c0 + 8, 0).t; } };
})();
