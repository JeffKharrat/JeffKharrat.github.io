/* カラット: 現場, the live diorama. The company town of Tau Jeffy VI drawn as an environment elevation: a plus-grid
   sky, flat grey structures with checker bands and stencils, callouts with leader lines, a metre ruler, the ground in
   section as cells down to the core, and the AI's yellow front stepping through it. Everything moves by the numbers:
   people (population, mood, idle), robots, smoke, trucks, the crane, the uplink, the service craft, and the events
   (strike, protest, brownout, smog, breach, accident, bulk order, surveillance, PR, construction, decisions, the
   quarter's close, night, weather, the season).
   createDiorama(canvas, get, view): get() → { S, corp, X (ctx), C (capacity) }; view = { x, y, w, h } in world px. */

import { drawLeaf } from './leaf.js?v=14';
const W = 1240, H = 634, GY = 372, CELL = 16, GC0 = 96, GC1 = 1224, ROWS = 14;
const Y = '#FFE600', RED = '#FF3B30', L1 = '#A3ABBA', L2 = '#7C8492', D1 = '#2A2E36', D2 = '#1D2026', D3 = '#14161A', INK = '#ECEEF2', MUTE = '#6E7582', BG = '#050608';
const GREY = ['#1A1D23', '#20232A', '#262A32', '#15171C', '#2C3038', '#101216', '#30343D'];
const sd = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
const F9 = '700 9px "M PLUS 1 Code", monospace', F8 = '700 8px "M PLUS 1 Code", monospace';

export function createDiorama(cv, get, view = { x: 0, y: 0, w: W, h: H }) {
  const cx = cv.getContext('2d'), P = 2; cv.width = view.w * P; cv.height = view.h * P;
  const st = {
    people: Array.from({ length: 120 }, (_, i) => ({ x: GC0 + sd(i) * (GC1 - GC0), d: sd(i + 1) < .5 ? -1 : 1, v: .5 + sd(i + 2), ph: sd(i + 3) * 6, lane: i % 3 })),
    bots: Array.from({ length: 40 }, (_, i) => ({ x: sd(i + 9) * 200, d: sd(i + 10) < .5 ? -1 : 1, ph: sd(i + 11) * 6 })),
    smoke: [], packets: [], trucks: [{ x: 300, d: 1, cargo: 1 }, { x: 900, d: -1, cargo: 0 }], drones: Array.from({ length: 6 }, (_, i) => ({ x: sd(i + 40) * W, y: 120 + sd(i + 41) * 90, d: sd(i + 42) < .5 ? -1 : 1 })),
    craft: { t: 0, ph: 'pad' }, crane: { x: 0, d: 1, lift: 0 }, sparks: [], rain: Array.from({ length: 140 }, (_, i) => ({ x: sd(i + 70) * W, y: sd(i + 71) * GY })), fire: [], T: 0, glitch: [] };
  let raf = 0, last = performance.now();
  const frame = now => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(.05, (now - last) / 1000); last = now; st.T += dt;
    const g = get(); if (!g || !g.S) return;
    cx.setTransform(P, 0, 0, P, -view.x * P, -view.y * P);
    draw(cx, g, st, dt);
  };
  raf = requestAnimationFrame(frame);
  return { stop() { cancelAnimationFrame(raf); } };
}

/* ---------------- primitives ---------------- */
function label(cx, x, y, t, col = INK, bg = BG) { cx.font = F9; const w = cx.measureText(t).width + 8; cx.fillStyle = bg; cx.fillRect(x - 2, y - 9, w, 12); cx.fillStyle = col; cx.fillText(t, x + 2, y); return w; }
let CQ = [];                                                           // callouts are drawn last, over everything
function callout(cx, ...a) { CQ.push(a); }
function drawCallout(cx, ax, ay, lx, ly, t, col = INK) { cx.strokeStyle = 'rgba(236,238,242,.55)'; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(ax + .5, ay + .5); cx.lineTo(lx + .5, ly + 3.5); cx.stroke(); cx.fillStyle = INK; cx.fillRect(ax - 1.5, ay - 1.5, 3, 3); const w = label(cx, lx, ly, t, col); cx.strokeStyle = '#3A3F48'; cx.strokeRect(lx - 2.5, ly - 9.5, w, 12); }
function checker(cx, x, y, w, h, s, a = L1, b = '#0B0C0F', off = 0) { for (let i = 0; i * s < w; i++) for (let j = 0; j * s < h; j++) { cx.fillStyle = (i + j + off) % 2 ? b : a; cx.fillRect(x + i * s, y + j * s, Math.min(s, w - i * s), Math.min(s, h - j * s)); } }
function lattice(cx, x, y0, y1, w, col) { cx.strokeStyle = col; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(x - w / 2, y0); cx.lineTo(x - 1, y1); cx.moveTo(x + w / 2, y0); cx.lineTo(x + 1, y1); for (let y = y0, k = 0; y > y1; y -= 8, k++) { const a = w / 2 * (y - y1) / (y0 - y1); cx.moveTo(x - a, y); cx.lineTo(x + a, y - 8); cx.moveTo(x + a, y); cx.lineTo(x - a, y - 8); } cx.stroke(); }
function person(cx, x, y, col, bob) { cx.fillStyle = col; cx.fillRect(x, y - 6 + bob, 2, 2); cx.fillRect(x, y - 4 + bob, 2, 4); }
function windows(cx, x, y, w, h, cols, lit, flick, T, seed) {
  const cw = (w - 6) / cols; for (let r = 0; r < Math.floor((h - 8) / 7); r++) for (let q = 0; q < cols; q++) { const s = sd(seed + r * 13 + q), on = s < lit && !(flick && Math.sin(T * 17 + s * 40) > .2); cx.fillStyle = on ? (s < lit * .12 ? Y : 'rgba(255,240,196,.82)') : '#0E1014'; cx.fillRect(x + 3 + q * cw + 1, y + 5 + r * 7, cw - 2, 3); }
}

/* ---------------- the scene ---------------- */
function draw(cx, g, st, dt) {
  const { S, corp, X, C } = g, T = st.T, L = S.last || {}; CQ = [];
  const pop = S.pop.w + S.pop.c + S.pop.e, hr = (new Date(S.t).getUTCHours() + 9) % 24, mo = new Date(S.t + 9 * 3600e3).getUTCMonth(), day = new Date(S.t + 9 * 3600e3).getUTCDate();
  const night = hr < 6 || hr >= 19, strike = S.strike > S.t, brown = S.power < 0, poll = S.poll / 100, happy = S.happy / 100, breach = S.breach && S.breach.open;
  const rainy = sd(Math.floor(S.t / 864e5) * 7.3) < .22, snowy = rainy && (mo === 11 || mo <= 1), qclose = S.reports.length && S.t - S.reports[S.reports.length - 1].to < 6 * 3600e3, matsuri = mo === 6 || mo === 7, nenmatsu = mo === 11 && day >= 20;
  const accident = S.log.some(l => l.k === 'accident' && S.t - l.t < 6 * 3600e3), order = S.log.some(l => l.k === 'order' && S.t - l.t < 6 * 3600e3) || S.ev.some(e => e.k === 'order');
  const building = pop > C.housing * .85, idle = L.idle || 0, prod = L.prod || 0, boost = S.boost && S.boost.until > S.t;
  const lit = night ? .22 + happy * .6 : .08;
  /* ground of the sky: black, plus-grid, a fine grid in the corner, stars */
  cx.fillStyle = BG; cx.fillRect(0, 0, W, H);
  if (!night) { const sk = cx.createLinearGradient(0, 0, 0, GY); sk.addColorStop(0, '#07090C'); sk.addColorStop(1, '#0E1116'); cx.fillStyle = sk; cx.fillRect(0, 0, W, GY); }
  cx.strokeStyle = 'rgba(160,168,182,.07)'; cx.beginPath(); for (let x = GC0; x < 640; x += 32) { cx.moveTo(x + .5, 56); cx.lineTo(x + .5, 280); } for (let y = 56; y <= 280; y += 32) { cx.moveTo(GC0, y + .5); cx.lineTo(640, y + .5); } cx.stroke();
  cx.fillStyle = 'rgba(160,168,182,.28)'; for (let x = GC0; x < GC1; x += 32) for (let y = 56; y < GY - 8; y += 32) { cx.fillRect(x - 2, y, 5, 1); cx.fillRect(x, y - 2, 1, 5); }
  for (let i = 0; i < 18; i++) { const b = sd(i + 200) < .5 ? 2 : 3; cx.fillStyle = `rgba(236,238,242,${.4 + .5 * sd(i + 201) * (.6 + .4 * Math.sin(T * 1.3 + i))})`; cx.fillRect(GC0 + sd(i + 202) * (GC1 - GC0), 60 + sd(i + 203) * 200, b, b); }
  /* a satellite crossing */
  const satx = (T * 18) % (W + 200) - 100; cx.fillStyle = INK; cx.fillRect(satx, 70, 3, 2); cx.fillStyle = 'rgba(236,238,242,.25)'; cx.fillRect(satx - 18, 70.5, 18, 1);
  /* smog: a dithered layer */
  if (poll > .25) { cx.fillStyle = `rgba(150,128,84,${.25 + (poll - .25) * .8})`; for (let y = 150; y < GY; y += 4) for (let x = (y / 4 % 2) * 2; x < W; x += 4) if (sd(x * 3 + y) < (poll - .2) * 1.2 * (y - 150) / (GY - 150)) cx.fillRect(x, y, 2, 2); }

  /* ======== the structures ======== */
  /* FAC-01: the great factory, its three stacks */
  const fx = 110, fw = 230, fh = 86, fy = GY - fh;
  for (let s = 0; s < 3; s++) {
    const sx = fx + 64 + s * 50, sy = GY - fh - 98;
    cx.fillStyle = L1; cx.fillRect(sx, sy, 34, 98); cx.fillStyle = L2; cx.fillRect(sx + 28, sy, 6, 98); checker(cx, sx, sy + 12, 34, 10, 5, '#0B0C0F', L1);
    cx.fillStyle = '#0B0C0F'; cx.font = F8; cx.fillText('CT-' + (s + 1), sx + 6, sy + 64);
    const scr = (S.proj || []).find(p => p.id === 'scrubber'); if (scr) { cx.fillStyle = scr.pollX < .5 ? Y : '#5A616D'; cx.fillRect(sx - 3, sy - 8, 40, 8); cx.fillStyle = '#0B0C0F'; for (let q = 0; q < 4; q++) cx.fillRect(sx + 1 + q * 10, sy - 6, 5, 4); }
    if (!strike && Math.random() < Math.min(.55, prod / 40) * (scr && scr.pollX < .5 ? .35 : 1) * dt * 60 / 3) st.smoke.push({ x: sx + 10 + Math.random() * 12, y: sy - 4, s: 4, a: .9, vx: 6 + Math.random() * 6 });
  }
  st.smoke.forEach(p => { p.y -= 14 * dt; p.x += p.vx * dt; p.s += 3 * dt; p.a -= .14 * dt; }); st.smoke = st.smoke.filter(p => p.a > 0);
  st.smoke.forEach(p => { const c = 150 - poll * 90 | 0, q = Math.round(p.s / 2) * 2; cx.fillStyle = `rgba(${c},${c},${c + 4},${p.a * .7})`; cx.fillRect(Math.round(p.x / 2) * 2, Math.round(p.y / 2) * 2, q, q); });
  cx.fillStyle = D1; cx.fillRect(fx + 40, fy - 16, fw - 20, 16); for (let i = 0; i < 8; i++) { cx.fillStyle = '#3A3F48'; cx.fillRect(fx + 48 + i * 26, fy - 12, 14, 2); cx.fillRect(fx + 48 + i * 26, fy - 7, 14, 2); }
  cx.fillStyle = D2; cx.fillRect(fx + fw, GY - 52, 22, 52); for (let k = 0; k < 6; k++) { cx.fillStyle = '#3A3F48'; cx.fillRect(fx + fw + 4, GY - 46 + k * 7, 14, 2); }
  cx.fillStyle = L1; cx.fillRect(fx, fy, fw, fh); cx.fillStyle = '#FFFFFF'; cx.fillRect(fx - 8, GY - 2, fw + 16, 2);
  checker(cx, fx, fy, fw, 12, 12, '#0B0C0F', '#E8ECF2');
  cx.fillStyle = '#0B0C0F'; cx.font = '800 46px Tektur, sans-serif'; cx.fillText('01', fx + 10, fy + 66);
  cx.font = F9; cx.fillText('FAC-01  大工場', fx + 92, fy + 28); cx.font = F8; cx.fillText(`OUTPUT ${prod.toFixed(0)}/H  ·  ROBOTS ${C.robots}`, fx + 92, fy + 78);
  /* the cut-away: the line inside, robots in yellow, workers in white */
  cx.fillStyle = strike ? '#0A0B0D' : '#0E1014'; cx.fillRect(fx + 92, fy + 36, 130, 30);
  if (!strike) {
    const nr = Math.min(40, Math.ceil(C.robots / 6)); for (let i = 0; i < nr; i++) { const b = st.bots[i]; b.x += b.d * 20 * dt; if (b.x > 124 || b.x < 0) b.d *= -1; cx.fillStyle = Y; cx.fillRect(fx + 94 + b.x, fy + 58 + Math.sin(T * 7 + b.ph) * 1, 4, 5); }
    for (let i = 0; i < Math.min(10, Math.ceil(L.empW / 15 || 0)); i++) person(cx, fx + 98 + ((T * 9 + i * 13) % 120), fy + 64, INK, 0);
    for (let k = 0; k < 13; k++) { cx.fillStyle = '#2A2E36'; cx.fillRect(fx + 94 + k * 10, fy + 40, 6, 3); }
  } else { cx.fillStyle = MUTE; cx.font = F8; cx.fillText('ライン停止 · LINE STOPPED', fx + 104, fy + 54); }
  for (let k = 0; k < 9; k++) { cx.fillStyle = '#0B0C0F'; cx.fillRect(fx + 96 + k * 14, fy + 18, 8, 4); }
  if (accident) { const on = Math.sin(T * 10) > 0; cx.fillStyle = on ? RED : '#3A1010'; cx.fillRect(fx + fw - 18, fy - 8, 8, 8); if (on) { cx.fillStyle = 'rgba(255,59,48,.18)'; cx.beginPath(); cx.arc(fx + fw - 14, fy - 4, 22, 0, 7); cx.fill(); } }
  callout(cx, fx + 64, GY - fh - 98, fx + 10, 116, `CT-1/2/3  STACKS 30 M  ·  POLLUTION ${S.poll.toFixed(0)}${(S.proj || []).some(p => p.id === 'scrubber') ? '  ·  集塵機 ' + ((S.proj.find(p => p.id === 'scrubber').pollX < .5) ? 'ON' : 'COMMISSIONING') : ''}${(S.proj || []).some(p => p.id === 'cap') ? '  ·  上限 −20%' : ''}`);
  callout(cx, fx + 20, fy + 6, fx - 6, fy - 40, 'FAC-01  GREAT FACTORY  80 × 26 M');

  /* PWR-02: the power plant, the lines to the town */
  const px = 362, ph = 58; cx.fillStyle = D1; cx.fillRect(px, GY - ph, 78, ph); for (let i = 0; i < 8; i++) { cx.fillStyle = '#3A3F48'; cx.fillRect(px + 8, GY - ph + 10 + i * 5, 62, 2); }
  cx.fillStyle = L2; cx.beginPath(); cx.moveTo(px + 50, GY - ph); cx.lineTo(px + 54, GY - ph - 44); cx.lineTo(px + 74, GY - ph - 44); cx.lineTo(px + 78, GY - ph); cx.fill();
  if (boost) { cx.fillStyle = `rgba(255,230,0,${.25 + .15 * Math.sin(T * 5)})`; cx.fillRect(px, GY - ph, 78, ph); }
  cx.fillStyle = INK; cx.font = F8; cx.fillText('PWR-02', px + 6, GY - 6);
  const poles = [px + 98, 452, 540]; poles.forEach(x => { lattice(cx, x, GY, GY - 70, 10, '#4A505C'); cx.fillStyle = '#4A505C'; cx.fillRect(x - 9, GY - 70, 18, 2); });
  cx.strokeStyle = brown ? 'rgba(255,59,48,.5)' : 'rgba(163,171,186,.55)'; cx.beginPath();
  for (let i = 0; i < poles.length - 1; i++) { const a = poles[i], b = poles[i + 1]; for (const o of [-8, 8]) { cx.moveTo(a + o, GY - 69); cx.quadraticCurveTo((a + b) / 2, GY - 52, b + o, GY - 69); } } cx.stroke();
  if (!brown) for (let i = 0; i < 3; i++) { const u = (T * .6 + i / 3) % 1, a = poles[0], b = poles[2], x = a + (b - a) * u, yy = GY - 69 + Math.sin(((u * 2) % 1) * Math.PI) * 15; cx.fillStyle = Y; cx.fillRect(x - 1, yy - 1, 3, 3); }
  else if (Math.random() < .3) st.sparks.push({ x: poles[1] + (Math.random() - .5) * 16, y: GY - 70, vx: (Math.random() - .5) * 60, vy: -40, a: 1 });
  callout(cx, px + 40, GY - ph, px + 4, GY - ph - 70, `PWR-02  ${S.power >= 0 ? '+' : ''}${S.power.toFixed(0)} MW${boost ? '  ·  BOOST' : ''}`, brown ? RED : INK);

  /* housing: one block per 90 places, the next one under construction when full */
  const nb = Math.max(2, Math.min(6, Math.round(C.housing / 120))), hx0 = 470;
  for (let i = 0; i < nb; i++) {
    const w = 34 + Math.round(sd(i + 50) * 8), h = 70 + Math.round(sd(i + 51) * 80), x = hx0 + i * 42;
    cx.fillStyle = i % 2 ? '#262A32' : '#30343D'; cx.fillRect(x, GY - h, w, h); cx.fillStyle = '#1A1D23'; cx.fillRect(x + w - 4, GY - h, 4, h);
    windows(cx, x, GY - h, w - 4, h, 3, lit, brown, T, i * 97);
    cx.fillStyle = L2; cx.fillRect(x + 6, GY - h - 6, 10, 6);
    if (S.pol.pr && i === 1) { cx.fillStyle = '#0B0C0F'; cx.fillRect(x - 4, GY - h + 8, w + 8, 18); cx.fillStyle = Y; cx.font = '700 9px "M PLUS 1", sans-serif'; cx.fillText('カラット', x, GY - h + 21); }
  }
  if (building) { const x = hx0 + nb * 42, hh = 30 + (T * 3) % 50; cx.strokeStyle = '#4A505C'; cx.strokeRect(x + .5, GY - hh + .5, 34, hh); for (let k = 0; k < hh; k += 8) { cx.beginPath(); cx.moveTo(x, GY - k); cx.lineTo(x + 34, GY - k - 8); cx.stroke(); }
    lattice(cx, x + 44, GY, GY - 140, 6, Y); cx.fillStyle = Y; cx.fillRect(x + 10, GY - 140, 50, 3); const hk = x + 14 + (Math.sin(T * .7) * .5 + .5) * 30; cx.fillRect(hk, GY - 137, 1, 40); cx.fillRect(hk - 4, GY - 97, 9, 6); }
  callout(cx, hx0 + 20, GY - 120, hx0 - 4, 196, `HOUSING  ${Math.round(pop)} / ${C.housing}${building ? '  ·  BUILDING' : ''}`);

  /* the core's head: two pylons, the crown and the halo, the shaft and the front below */
  const kx = 780;
  cx.fillStyle = D1; cx.fillRect(kx - 66, GY - 16, 40, 16); cx.fillRect(kx + 26, GY - 16, 40, 16); checker(cx, kx - 66, GY - 16, 40, 5, 5, '#0B0C0F', L1); checker(cx, kx + 26, GY - 16, 40, 5, 5, '#0B0C0F', L1);
  cx.fillStyle = L1; cx.fillRect(kx - 26, GY - 6, 8, 6); cx.fillRect(kx + 18, GY - 6, 8, 6);
  for (let k = 0; k < 4; k++) { cx.fillStyle = Math.sin(T * 3 + k) > 0 ? Y : '#3A3F48'; cx.fillRect(kx - 62 + k * 9, GY - 9, 4, 3); cx.fillRect(kx + 30 + k * 9, GY - 9, 4, 3); }
  for (const sgn of [-1, 1]) { cx.strokeStyle = L1; cx.lineWidth = 3; cx.beginPath(); cx.moveTo(kx + sgn * 40, GY); cx.lineTo(kx + sgn * 26, GY - 96); cx.stroke(); cx.lineWidth = 1; }
  cx.strokeStyle = L1; cx.lineWidth = 3; cx.beginPath(); cx.ellipse(kx, GY - 96, 34, 6, 0, 0, 7); cx.stroke(); cx.lineWidth = 2; cx.strokeStyle = INK; cx.beginPath(); cx.ellipse(kx, GY - 136, 18, 3.5, 0, 0, 7); cx.stroke(); cx.lineWidth = 1;
  cx.strokeStyle = '#4A505C'; cx.beginPath(); cx.moveTo(kx - 30, GY - 96); cx.lineTo(kx - 16, GY - 134); cx.moveTo(kx + 30, GY - 96); cx.lineTo(kx + 16, GY - 134); cx.stroke();
  cx.fillStyle = Y; for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2 + T * .5; cx.fillRect(kx + Math.cos(a) * 34 - 1, GY - 96 + Math.sin(a) * 6 - 1, 2, 2); }
  callout(cx, kx + 18, GY - 136, kx + 34, GY - 176, `中枢  CORE APERTURE  ·  MEMORY ${X.mem}`, Y);

  /* LOG-02: the depot and its crane */
  const dx = 862; cx.fillStyle = D1; cx.fillRect(dx, GY - 36, 104, 36); for (let k = 0; k < 6; k++) { cx.fillStyle = '#14161A'; cx.fillRect(dx + 6 + k * 16, GY - 26, 12, 26); }
  for (let k = 0; k < 5; k++) { cx.fillStyle = k === 2 ? Y : k % 2 ? '#5A616D' : '#3A3F48'; cx.fillRect(dx + 112 + (k % 3) * 18, GY - 12 - Math.floor(k / 3) * 12, 17, 11); }
  cx.strokeStyle = L1; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(dx + 4, GY); cx.lineTo(dx + 4, GY - 74); cx.lineTo(dx + 152, GY - 74); cx.lineTo(dx + 152, GY); cx.stroke(); cx.lineWidth = 1;
  const cr = st.crane; cr.x += cr.d * 22 * dt; if (cr.x > 130 || cr.x < 0) cr.d *= -1; const ly = 20 + (Math.sin(T * 1.1) * .5 + .5) * 26;
  cx.fillStyle = Y; cx.fillRect(dx + 10 + cr.x, GY - 78, 12, 6); cx.fillStyle = INK; cx.fillRect(dx + 15 + cr.x, GY - 72, 1, ly); cx.fillStyle = '#5A616D'; cx.fillRect(dx + 8 + cr.x, GY - 72 + ly, 16, 9);
  callout(cx, dx + 76, GY - 74, dx + 20, GY - 112, S.conc ? `LOG-02  ·  ${S.conc.by === 'kurogane' ? '黒鉄重工' : '白鷺HD'} CONCESSION  ·  25% OF SALES` : 'LOG-02  DEPOT  ·  GANTRY 22 M', S.conc ? RED : INK);
  if (S.conc) { cx.fillStyle = S.conc.by === 'kurogane' ? RED : '#DDE6F0'; cx.fillRect(dx + 4, GY - 82, 148, 6); }

  /* MAST A: the uplink, data climbing it */
  const mx = 1004; lattice(cx, mx, GY, GY - 168, 14, L1); cx.fillStyle = L1; cx.fillRect(mx - 14, GY - 150, 22, 26); cx.fillStyle = L2; cx.fillRect(mx + 4, GY - 150, 4, 26); cx.fillStyle = INK; cx.fillRect(mx - 3, GY - 174, 6, 6);
  if (Math.random() < .08 + S.pol.watch * .05) st.packets.push({ y: GY, v: 40 + Math.random() * 40 });
  st.packets.forEach(p => p.y -= p.v * dt); st.packets = st.packets.filter(p => p.y > GY - 168); st.packets.forEach(p => { cx.fillStyle = Y; cx.fillRect(mx - 1.5, p.y, 3, 3); });
  if (Math.sin(T * 4) > .6) { cx.fillStyle = Y; cx.fillRect(mx - 2, GY - 178, 4, 3); }
  callout(cx, mx + 3, GY - 174, mx + 16, GY - 196, `MAST A  52 M  ·  UPLINK  ·  DATA ${Math.floor(corp.data)}`);

  /* HQ: the tower, the sign, the pad and its craft */
  const qx = 1056, qh = 250, qy = GY - qh;
  cx.fillStyle = L1; cx.fillRect(qx, qy + 30, 74, qh - 30); cx.fillRect(qx + 12, qy, 50, 30); cx.fillStyle = L2; cx.fillRect(qx + 66, qy + 30, 8, qh - 30);
  windows(cx, qx + 4, qy + 40, 58, qh - 60, 4, night ? .35 + happy * .5 : .12, brown, T, 777);
  checker(cx, qx, qy + 30, 74, 8, 8, '#0B0C0F', '#E8ECF2');
  cx.fillStyle = '#0B0C0F'; cx.fillRect(qx + 12, qy + 2, 50, 26); drawLeaf(cx, qx + 14, qy + 3, 1.6, { N: 15, pulse: T * 3 }); cx.fillStyle = Y; cx.font = '700 9px "M PLUS 1", sans-serif'; cx.fillText('紅葉重工', qx + 30, qy + 19);
  if (S.ev.length && Math.sin(T * 5) > -.3) { cx.fillStyle = INK; cx.fillRect(qx + 60, qy - 26, 1, 26); cx.fillStyle = Y; cx.fillRect(qx + 61, qy - 26, 14, 9); }
  if (qclose) { cx.fillStyle = Y; cx.fillRect(qx - 4, qy + 70, 82, 16); cx.fillStyle = '#000'; cx.font = '700 10px "M PLUS 1", sans-serif'; cx.fillText('四半期決算  Q' + S.reports[S.reports.length - 1].n, qx, qy + 82); }
  if (S.pol.watch >= 2 && night) { cx.fillStyle = 'rgba(255,230,0,.07)'; const a = Math.sin(T * .6) * .6; cx.beginPath(); cx.moveTo(qx + 37, qy); cx.lineTo(qx + 37 + Math.sin(a - .12) * 400, qy - Math.cos(a - .12) * 400); cx.lineTo(qx + 37 + Math.sin(a + .12) * 400, qy - Math.cos(a + .12) * 400); cx.fill(); }
  const pdx = 1150; cx.fillStyle = D1; cx.fillRect(pdx, GY - 34, 66, 4); cx.fillRect(pdx + 8, GY - 30, 3, 30); cx.fillRect(pdx + 56, GY - 30, 3, 30); cx.fillStyle = INK; cx.font = F8; cx.fillText('PAD 03', pdx + 16, GY - 38);
  const c = st.craft; c.t += dt; let cyy = GY - 40; if (c.ph === 'pad' && c.t > 9) { c.ph = 'up'; c.t = 0; } else if (c.ph === 'up') { cyy -= c.t * c.t * 30; if (c.t > 3.2) { c.ph = 'away'; c.t = 0; } } else if (c.ph === 'away' && c.t > 6) { c.ph = 'down'; c.t = 0; } if (c.ph === 'down') { cyy -= Math.max(0, 3 - c.t) * Math.max(0, 3 - c.t) * 34; if (c.t > 3) { c.ph = 'pad'; c.t = 0; } }
  if (c.ph !== 'away') { cx.fillStyle = L1; cx.fillRect(pdx + 22, cyy, 24, 8); cx.fillStyle = '#0B0C0F'; cx.fillRect(pdx + 26, cyy + 2, 5, 3); cx.fillRect(pdx + 34, cyy + 2, 5, 3); if (c.ph !== 'pad') { cx.fillStyle = Y; cx.fillRect(pdx + 28, cyy + 8, 3, 4 + Math.random() * 6); cx.fillRect(pdx + 37, cyy + 8, 3, 4 + Math.random() * 6); } }
  callout(cx, qx + 37, qy, qx - 140, qy - 14, `HQ  本社 92 M  ·  ${yen(corp.funds)}  ·  SHARE ${yen(S.share)}`);
  callout(cx, pdx + 34, GY - 34, pdx - 6, GY - 64, 'PAD 03  SERVICE CRAFT');

  /* ======== the street ======== */
  cx.fillStyle = '#FFFFFF'; cx.fillRect(GC0, GY - 1, GC1 - GC0, 1);
  /* trucks between the factory and the depot; a convoy for a bulk order */
  const nt = order ? 5 : 2; while (st.trucks.length < nt) st.trucks.push({ x: GC0 + Math.random() * 800, d: Math.random() < .5 ? -1 : 1, cargo: 1 }); st.trucks.length = nt;
  st.trucks.forEach((tk, i) => { if (!strike || i) tk.x += tk.d * (order ? 46 : 30) * dt; if (tk.x > dx + 40) { tk.d = -1; tk.cargo = 0; } if (tk.x < fx + fw) { tk.d = 1; tk.cargo = 1; }
    cx.fillStyle = L1; cx.fillRect(tk.x, GY - 9, 16, 8); cx.fillStyle = tk.cargo ? Y : '#3A3F48'; cx.fillRect(tk.x + (tk.d > 0 ? -12 : 16), GY - 10, 12, 9); cx.fillStyle = '#0B0C0F'; cx.fillRect(tk.x + 2, GY - 2, 3, 2); cx.fillRect(tk.x + 11, GY - 2, 3, 2); });
  /* people: as many as the population, slower and greyer when unhappy; a crowd at shift change */
  const shift = hr === 8 || hr === 17, np = Math.min(120, Math.round(pop / 4) + (shift ? 20 : 0));
  for (let i = 0; i < np; i++) { const p = st.people[i], sad = sd(i + 500) > happy; let sp = p.v * (sad ? 7 : 18); if (shift) { p.d = hr === 8 ? -1 : 1; sp *= 1.6; }
    p.x += p.d * sp * dt; if (p.x > GC1) p.x = GC0; if (p.x < GC0) p.x = GC1;
    if ((p.x > qx - 6 && p.x < qx + 76) || (p.x > fx && p.x < fx + fw && p.lane === 0)) continue;
    person(cx, p.x, GY - 1 - p.lane * 2, sad ? '#7C8492' : INK, sad ? 0 : -Math.abs(Math.sin(T * 9 + p.ph)) * 1.2); }
  /* the idle, sitting by the factory */
  for (let i = 0; i < Math.min(14, Math.round(idle / 5)); i++) { cx.fillStyle = MUTE; cx.fillRect(fx + fw + 6 + i * 5, GY - 4, 2, 3); }
  /* a strike: pickets and a banner at the gate */
  if (strike) { cx.fillStyle = RED; cx.fillRect(fx + 6, fy + 16, 84, 14); cx.fillStyle = INK; cx.font = '700 9px "M PLUS 1", sans-serif'; cx.fillText('スト決行中  STRIKE', fx + 9, fy + 26);
    for (let i = 0; i < 14; i++) { const x = fx + 8 + i * 6, b = Math.sin(T * 5 + i) * 1.2; person(cx, x, GY - 1, INK, b); if (i % 2 === 0) { cx.fillStyle = RED; cx.fillRect(x - 3, GY - 15 + b, 8, 5); cx.fillStyle = INK; cx.fillRect(x, GY - 10 + b, 1, 4); } } }
  /* the politics on the street (gov.js): the unattended line, the training annex, a dispatch hold at the depot, an audit marker */
  const Gv = g.G || {}, sig = Gv.sig || {}, line = (S.proj || []).find(p => p.id === 'line'), hold = S.hold && S.hold.until > S.t, vis = (Gv.visit || {}).n || 0;
  if (line) { cx.fillStyle = Y; cx.fillRect(fx + fw - 70, fy + 4, 64, 11); cx.fillStyle = '#000'; cx.font = '700 8px "M PLUS 1", sans-serif'; cx.fillText(`夜間無人 +${Math.round(line.robot * 100)}%`, fx + fw - 67, fy + 12);
    if (night) for (let i = 0; i < 6; i++) { cx.fillStyle = Math.sin(T * 3 + i * 1.7) > .2 ? Y : '#3A3F48'; cx.fillRect(fx + 100 + i * 20, fy + 70, 3, 3); }
    callout(cx, fx + fw - 38, fy + 4, fx + fw + 8, fy - 64, `NIGHT LINE  ·  ${line.staged ? 'STAGE 1' : line.robot >= .2 ? 'FULL' : 'TRIAL'}  ·  ${line.mw} MW  ·  ¥${line.upkeep}/H`, Y); }
  if (sig.annex) { const ax = fx + 14, ay = fy - 22; cx.fillStyle = L1; cx.fillRect(ax, ay, 54, 22); cx.fillStyle = L2; cx.fillRect(ax + 48, ay, 6, 22);
    for (let i = 0; i < 5; i++) { cx.fillStyle = sig.annex === 'lit' ? (night || Math.sin(T + i) > 0 ? Y : '#C9A400') : '#14161A'; cx.fillRect(ax + 4 + i * 9, ay + 6, 6, 8); }
    if (sig.annex === 'building') { lattice(cx, ax + 27, ay + 22, ay - 10, 54, 'rgba(236,238,242,.35)'); }
    callout(cx, ax + 20, ay, ax - 4, ay - 30, sig.annex === 'lit' ? '研修棟  TRAINING ANNEX  ·  PLEDGE KEPT' : '研修棟  TRAINING ANNEX  ·  BUILDING', sig.annex === 'lit' ? Y : INK); }
  if (hold) { for (let i = 0; i < 9; i++) { const x = dx - 64 + (i % 5) * 12, y = GY - 9 - Math.floor(i / 5) * 9; cx.fillStyle = i % 3 ? '#C9A400' : Y; cx.fillRect(x, y, 11, 8); cx.fillStyle = RED; cx.fillRect(x + 7, y + 1, 3, 2); }
    for (let i = 0; i < 9; i++) { const x = dx + 6 + i * 6, b = Math.sin(T * 5 + i) * 1.2; person(cx, x, GY - 1, INK, b); if (i % 3 === 0) { cx.fillStyle = RED; cx.fillRect(x - 3, GY - 15 + b, 8, 5); } }
    cx.fillStyle = RED; cx.fillRect(dx + 4, GY - 52, 96, 13); cx.fillStyle = INK; cx.font = '700 9px "M PLUS 1", sans-serif'; cx.fillText(`出荷停止  HOLD ${Math.round(S.hold.pct * 100)}%`, dx + 8, GY - 42); }
  if (sig.audit >= vis && vis) { const ax = qx + 80, ay = qy + 44, on = Math.sin(T * 4) > -.2; cx.fillStyle = on ? Y : '#5A5320'; cx.beginPath(); cx.moveTo(ax, ay - 14); cx.lineTo(ax + 9, ay + 2); cx.lineTo(ax - 9, ay + 2); cx.fill(); cx.fillStyle = '#000'; cx.fillRect(ax - 1, ay - 9, 2, 6); cx.fillRect(ax - 1, ay - 2, 2, 2);
    callout(cx, ax, ay - 14, ax + 8, ay - 40, '監査  AUDIT  ·  A BROKEN PROMISE ON RECORD', RED); }
  /* a protest at HQ */
  if (S.fac.res < 35) { for (let i = 0; i < 22; i++) { const x = qx + 6 + (i % 11) * 6, b = Math.sin(T * 6 + i) * 1.4; person(cx, x, GY - 1 - Math.floor(i / 11) * 3, INK, b); if (i % 3 === 0) { cx.fillStyle = Y; cx.fillRect(x - 3, GY - 18 + b, 9, 6); } } cx.fillStyle = Y; cx.font = '700 9px "M PLUS 1", sans-serif'; cx.fillText('抗議', qx + 8, GY - 24); }
  /* surveillance drones and their cones */
  for (let i = 0; i < S.pol.watch * 3; i++) { const d = st.drones[i % 6]; d.x += d.d * 34 * dt; if (d.x > GC1 || d.x < GC0) d.d *= -1; cx.fillStyle = INK; cx.fillRect(d.x - 3, d.y, 6, 2); cx.fillStyle = 'rgba(255,230,0,.06)'; cx.beginPath(); cx.moveTo(d.x, d.y + 2); cx.lineTo(d.x - 20, GY); cx.lineTo(d.x + 20, GY); cx.fill(); }
  /* PR: an airship with a banner */
  if (S.pol.pr) { const ax = (T * 14) % (W + 300) - 150; cx.fillStyle = L1; cx.beginPath(); cx.ellipse(ax, 92, 34, 9, 0, 0, 7); cx.fill(); cx.fillStyle = '#0B0C0F'; cx.fillRect(ax - 8, 100, 16, 4); cx.fillStyle = Y; cx.fillRect(ax + 38, 86, 70, 12); cx.fillStyle = '#000'; cx.font = '700 8px "M PLUS 1", sans-serif'; cx.fillText('明日もカラット', ax + 41, 95); }
  /* seasons: lanterns in summer, lights at the year's end; weather */
  if (matsuri || nenmatsu) for (let i = 0; i < 26; i++) { const x = hx0 - 20 + i * 12, y = GY - 52 + Math.sin(i * .8) * 3; cx.fillStyle = matsuri ? (i % 2 ? RED : Y) : (Math.sin(T * 3 + i) > 0 ? Y : INK); cx.fillRect(x, y, matsuri ? 4 : 2, matsuri ? 5 : 2); }
  if (matsuri && night && Math.random() < .02) for (let k = 0; k < 24; k++) { const a = k / 24 * 6.283; st.fire.push({ x: 640, y: 120, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60, a: 1 }); }
  st.fire.forEach(f => { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 30 * dt; f.a -= .6 * dt; }); st.fire = st.fire.filter(f => f.a > 0); st.fire.forEach(f => { cx.fillStyle = `rgba(255,230,0,${f.a})`; cx.fillRect(f.x, f.y, 2, 2); });
  if (rainy) { cx.strokeStyle = snowy ? 'rgba(236,238,242,.6)' : 'rgba(163,171,186,.35)'; cx.beginPath(); st.rain.forEach(r => { r.y += (snowy ? 24 : 260) * dt; r.x += (snowy ? Math.sin(T + r.y * .05) * 10 : -40) * dt; if (r.y > GY) { r.y = 40; r.x = Math.random() * W; } if (snowy) { cx.rect(r.x, r.y, 1.5, 1.5); } else { cx.moveTo(r.x, r.y); cx.lineTo(r.x - 2, r.y + 7); } }); cx.stroke(); }
  st.sparks.forEach(s => { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 160 * dt; s.a -= 1.5 * dt; }); st.sparks = st.sparks.filter(s => s.a > 0); st.sparks.forEach(s => { cx.fillStyle = `rgba(255,230,0,${s.a})`; cx.fillRect(s.x, s.y, 2, 2); });
  if (brown && Math.sin(T * 9) > .75) { cx.fillStyle = 'rgba(0,0,0,.4)'; cx.fillRect(0, 0, W, GY); }

  /* ======== the ground in section: cells down to the core ======== */
  const cols = Math.floor((GC1 - GC0) / CELL), shaftC = Math.floor((kx - GC0) / CELL) - 1;
  const memFrac = Math.min(1, X.mem / 600 + .15), frontOff = Math.round(Math.sin(T * .35) * 1.5);
  for (let r = 0; r < ROWS; r++) for (let q = 0; q < cols; q++) {
    const x = GC0 + q * CELL, y = GY + r * CELL, s = sd(q * 31 + r * 7);
    if (q >= shaftC && q <= shaftC + 2 && r < ROWS - 3) continue;
    const fc = shaftC - 2 - Math.floor(r * 1.15) - frontOff - Math.round((1 - memFrac) * 3), fc2 = shaftC + 5 + Math.floor(r * 1.15) + frontOff + Math.round((1 - memFrac) * 3);
    const behind = (q > fc && q < shaftC) || (q > shaftC + 2 && q < fc2);
    let col = r === 1 ? ((q % 2) ? '#0B0C0F' : '#A3ABBA') : GREY[Math.floor(s * GREY.length)];
    if (r === 0) col = '#1A1D23';
    if (behind && r > 1) col = ['#3A3F48', '#444A55', '#343842', '#4C525E'][Math.floor(s * 4)];
    cx.fillStyle = col; cx.fillRect(x, y, CELL - 1, CELL - 1);
    if (r > 1 && s > .93) { cx.strokeStyle = 'rgba(163,171,186,.25)'; cx.strokeRect(x + 4.5, y + 4.5, 6, 6); }
    if (r > 1 && s < .04) { cx.strokeStyle = 'rgba(163,171,186,.2)'; cx.beginPath(); for (let k = 3; k < CELL - 2; k += 3) { cx.moveTo(x + k + .5, y + 2); cx.lineTo(x + k + .5, y + CELL - 3); cx.moveTo(x + 2, y + k + .5); cx.lineTo(x + CELL - 3, y + k + .5); } cx.stroke(); }
    if ((q === fc || q === fc - 1 || q === fc2 || q === fc2 + 1) && r > 0) { const fl = .75 + .25 * Math.sin(T * 6 + r); cx.fillStyle = `rgba(255,230,0,${fl})`; cx.fillRect(x, y, CELL - 1, CELL - 1); }
  }
  /* white terrace lines stepping down into the ground under the factory, a buried hall with ports */
  cx.strokeStyle = '#ECEEF2'; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(fx - 8, GY + 1); cx.lineTo(fx - 8, GY + 2 * CELL); cx.lineTo(GC0 + 2 * CELL, GY + 2 * CELL); cx.lineTo(GC0 + 2 * CELL, GY + 5 * CELL); cx.lineTo(GC0, GY + 5 * CELL);
  cx.moveTo(fx + fw + 22, GY + 1); cx.lineTo(fx + fw + 22, GY + 3 * CELL); cx.lineTo(fx + 120, GY + 3 * CELL); cx.stroke(); cx.lineWidth = 1;
  cx.fillStyle = '#0B0C0F'; cx.fillRect(GC0 + 50 * CELL, GY + 2 * CELL, 12 * CELL, 2 * CELL - 1); for (let k = 0; k < 11; k++) { cx.fillStyle = k % 3 === Math.floor(T) % 3 ? Y : '#2A2E36'; cx.fillRect(GC0 + 50 * CELL + 8 + k * 17, GY + 2 * CELL + 12, 8, 6); }
  cx.fillStyle = MUTE; cx.font = F8; cx.fillText('DC-01  記憶庫  ARCHIVE', GC0 + 50 * CELL + 6, GY + 2 * CELL + 9);
  /* the shaft and the core chamber */
  const sx0 = GC0 + shaftC * CELL; cx.fillStyle = '#07080A'; cx.fillRect(sx0, GY, CELL * 3 - 1, (ROWS - 3) * CELL);
  for (let y = GY + 8; y < GY + (ROWS - 3) * CELL; y += 16) { cx.fillStyle = 'rgba(255,230,0,.35)'; cx.fillRect(sx0 + 2, y, 3, 2); cx.fillRect(sx0 + CELL * 3 - 6, y, 3, 2); }
  for (let k = 0; k < 4; k++) { const y = GY + ((T * 40 + k * 44) % ((ROWS - 3) * CELL)); cx.fillStyle = Y; cx.fillRect(sx0 + CELL * 1.5 - 2, y, 3, 6); }
  const cyc = GY + (ROWS - 2) * CELL, ccx = sx0 + CELL * 1.5;
  cx.fillStyle = '#07080A'; cx.fillRect(ccx - 72, cyc - 26, 144, 46);
  drawLeaf(cx, ccx - 21, cyc - 24, 2.8, { N: 15, pulse: T * 3 });
  /* a breach: red blocks crawling down toward the core */
  if (breach) { if (Math.random() < .2) st.glitch.push({ y: GY, x: sx0 + Math.random() * 40, a: 1 }); st.glitch.forEach(gl => { gl.y += 30 * dt; gl.a -= .25 * dt; }); st.glitch = st.glitch.filter(gl => gl.a > 0 && gl.y < cyc);
    st.glitch.forEach(gl => { cx.fillStyle = `rgba(255,59,48,${gl.a})`; cx.fillRect(gl.x, gl.y, 8 + Math.random() * 10, 4); }); cx.strokeStyle = RED; cx.setLineDash([3, 3]); cx.strokeRect(ccx - 74.5, cyc - 28.5, 148, 50); cx.setLineDash([]); }
  /* service lines from the buildings to the shaft, data running along them */
  const lines = [[fx + 160, GY + 3 * CELL], [hx0 + 60, GY + 5 * CELL], [dx + 60, GY + 4 * CELL], [qx + 37, GY + 6 * CELL]];
  lines.forEach(([x, depth], i) => { const tx = x < ccx ? sx0 : sx0 + CELL * 3; cx.strokeStyle = 'rgba(236,238,242,.35)'; cx.beginPath(); cx.moveTo(x + .5, GY); cx.lineTo(x + .5, depth + .5); cx.lineTo(tx, depth + .5); cx.stroke();
    const L0 = depth - GY + Math.abs(tx - x), u = ((T * 50 + i * 37) % L0); const p = u < depth - GY ? [x, GY + u] : [x + Math.sign(tx - x) * (u - (depth - GY)), depth]; cx.fillStyle = Y; cx.fillRect(p[0] - 1, p[1] - 1, 3, 3); });
  callout(cx, GC0 + (shaftC - 4) * CELL, GY + 2 * CELL, GC0 + (shaftC - 16) * CELL, GY + 2 * CELL - 18, 'FRONT  ·  THE AI  ·  COMPUTING', Y);
  callout(cx, ccx - 40, cyc - 20, ccx + 110, cyc - 40, `カラット  CORE  ·  暴走度 ${S.bousou.toFixed(1)}`, Y);

  CQ.forEach(a => drawCallout(cx, ...a));
  /* ======== the frame: ruler, title, the vertical name, the scale, the ticker ======== */
  cx.strokeStyle = MUTE; cx.beginPath(); cx.moveTo(70.5, 40); cx.lineTo(70.5, GY + ROWS * CELL); cx.stroke(); cx.font = F8;
  for (let y = GY + ROWS * CELL; y >= 48; y -= CELL) { const m = Math.round((GY - y) / CELL * 5); cx.fillStyle = MUTE; cx.fillRect(66, y, m % 10 === 0 ? 8 : 4, 1); if (m % 20 === 0) { cx.fillText((m > 0 ? '+' : '') + m, 44, y + 3); } }
  cx.fillText('M', 66, 34);
  const nm = '社宅街'; [...nm].forEach((ch, i) => { cx.fillStyle = INK; cx.fillRect(18, 44 + i * 30, 26, 28); cx.fillStyle = '#000'; cx.font = '800 18px "M PLUS 1", sans-serif'; cx.fillText(ch, 22, 65 + i * 30); });
  drawLeaf(cx, GC0 - 2, 14, 1.4, { N: 15, pulse: T * 2 }); cx.fillStyle = INK; cx.font = '800 20px Tektur, sans-serif'; cx.fillText('TAU JEFFY VI', GC0 + 26, 34); cx.font = F9; cx.fillStyle = INK; cx.fillText('ENV-LIVE', GC0 + 196, 34);
  cx.fillStyle = MUTE; cx.textAlign = 'right'; cx.fillText(`紅葉重工  ·  MOMIJI CORP  ·  COMPANY TOWN  ·  LIVE  ·  Q${S.q.n}  ·  ${new Date(S.t).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}  ·  ${night ? 'NIGHT' : 'DAY'}${rainy ? (snowy ? '  ·  SNOW' : '  ·  RAIN') : ''}`, GC1, 34); cx.textAlign = 'left';
  const by = GY + ROWS * CELL + 10; for (let k = 0; k < 10; k++) { cx.fillStyle = k % 2 ? D1 : L1; cx.fillRect(GC0 + k * 32, by, 32, 4); } cx.fillStyle = MUTE; cx.font = F8; cx.fillText('0', GC0, by + 14); cx.fillText('50', GC0 + 150, by + 14); cx.fillText('100 M', GC0 + 300, by + 14); cx.fillText('1 CELL = 5 M', GC0 + 340, by + 7);
  cx.textAlign = 'right'; cx.fillText(`POP ${Math.round(pop)}  ·  ROBOTS ${C.robots}  ·  HAPPY ${S.happy.toFixed(0)}  ·  STAB ${S.stab.toFixed(0)}  ·  COORD 31°E / TAU VI`, GC1, by + 22); cx.textAlign = 'left';
  /* the ticker of what is happening */
  const ev = [strike && ['スト決行中', 'STRIKE AT FAC-01', RED], hold && ['出荷停止', 'DISPATCH HOLD AT LOG-02', RED], line && ['夜間無人', 'THE NIGHT LINE RUNS', Y], sig.annex === 'lit' && ['研修', 'TRAINING ANNEX OPEN', Y], S.fac.res < 35 && ['抗議', 'RESIDENTS PROTEST AT HQ', RED], brown && ['停電', 'BROWNOUT', RED], S.poll > 60 && ['公害警報', 'SMOG ALERT', RED], breach && ['侵入警報', 'BREACH · ' + breach.rival, RED], accident && ['労災', 'ACCIDENT ON THE LINE', RED],
    order && ['大口受注', 'BULK ORDER · CONVOY', Y], building && ['建設中', 'NEW HOUSING BLOCK', Y], boost && ['発電増強', 'POWER BOOST', Y], S.pol.watch && ['監視', S.pol.watch > 1 ? 'TOTAL SURVEILLANCE' : 'DRONE WATCH', Y], S.pol.pr && ['広報', 'PR CAMPAIGN', Y], S.ev.length && ['決裁待ち', S.ev.length + ' DECISIONS AT HQ', Y], qclose && ['決算', 'QUARTER CLOSED', Y], shift && ['交代', 'SHIFT CHANGE', INK], matsuri && ['夏祭り', 'SUMMER FESTIVAL', INK], nenmatsu && ['年末', "YEAR'S END", INK], idle > 10 && ['失業', Math.round(idle) + ' IDLE WORKERS', INK]].filter(Boolean);
  if (!ev.length) ev.push(['平常運転', 'NORMAL OPERATION', '#5CFFA0']);
  let tx = GC0 + 500; cx.font = '700 9px "M PLUS 1", sans-serif';
  ev.slice(0, 6).forEach(([j, en, col]) => { const t = j + ' · ' + en, w = cx.measureText(t).width + 12; if (tx + w > GC1) return; cx.fillStyle = col; cx.fillRect(tx, by - 4, w, 13); cx.fillStyle = col === INK ? '#000' : col === RED ? '#fff' : '#000'; cx.fillText(t, tx + 6, by + 6); tx += w + 6; });
}
const yen = v => (v < 0 ? '−¥' : '¥') + Math.abs(Math.round(v)).toLocaleString();
