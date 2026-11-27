/* カラット: 大工場, the Great Factory. A side-on assembly line drawn in 2D. Raw plates come in from the left and pass
   three stations; each one posts a kanban card and waits for the right part from the bins (keys 1–6):
     プレス press      reading → form   the card shows the reading, pick the written word     skill 'reading'
     溶接   weld       meaning → form   the card shows the meaning, pick the written word     skill 'recall'
     検査   inspection form → meaning   the card shows the word, pick its meaning (4 bins)    skill 'meaning'
   A right part flies to the product and the machine works it; a wrong one scraps the product and wipes that skill's
   evidence for the word; a late one scraps it with no change to the evidence. Words already in memory are handled by
   the AI's own robots (blue, 自動). First attempt per word and skill in a shift only. At the end of the shift: the daily
   report, the yen, and the files the evidence now supports, sent to the audit in the core. */
import { loadKanji } from './model.js?v=5';
import * as store from './store.js?v=5';
import { deckWord, buildPool, traps, shuffle } from './words.js?v=5';
import { record, updateFlags, SKILL_J, day } from './evidence.js?v=5';
import { addShift } from './sim.js?v=5';

const $ = s => document.querySelector(s);
const QS = new URLSearchParams(location.search), DEMO = QS.has('demo'), EMBED = QS.has('embed') && parent !== window;
const W = 1280, H = 720, BELT = 430, PH = 34;                                   // stage, belt top, product height
const Y = '#FFE600', RED = '#FF3B30', AI = '#4A5BFF';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3), easeIn = t => { t = clamp(t, 0, 1); return t * t * t; };
/* the bins are a numpad: keys 4 5 6 on the top row, 1 2 3 below. Centre of key i+1's bin, in stage space */
const BIN_X = i => 14 + ((1252 - 16) / 3 + 8) * (i % 3) + (1252 - 16) / 6, BIN_Y = i => i < 3 ? 650 : 582;

let KD, SAVE, DECK = [], POOL, LEARN = [], MEM = [], FC;                        // FC: the factory's own save (upgrades, shifts)

/* ---------------- the stations ---------------- */
const ST = [
  { x: 400, name: 'プレス', en: 'Press', skill: 'reading', mode: 'form', by: 'reading', n: 6, show: 'kana', rule: '読み → 字' },
  { x: 660, name: '溶接', en: 'Weld', skill: 'recall', mode: 'form', by: 'meaning', n: 6, show: 'en', rule: '意味 → 字' },
  { x: 920, name: '検査', en: 'Inspection', skill: 'meaning', mode: 'meaning', by: '', n: 6, show: 'kj', rule: '字 → 意味' }];
ST.forEach((s, i) => Object.assign(s, { i, prod: null, card: null, act: null, beacon: 0, ng: 0 }));

/* ---------------- shift state ---------------- */
const G = { run: false, T: 180, T0: 180, ship: 0, def: 0, yen: 0, target: 10, spawnT: 0, pace: [], D: 14, focus: null, lock: 0,
  tried: new Set(), touched: new Map(), log: [], forgive: 0, streak: 0, best: 0, auto: 0, shake: 0 };
let PRODS = [], PARTS = [], FX = [], pid = 0;

/* ---------------- sound: small synthesised blips, no files ---------------- */
let AC = null, MUTE = (() => { try { return localStorage.getItem('karatto.mute') === '1'; } catch (e) { return false; } })();
function sfx(kind) {
  if (MUTE) return; try { AC = AC || new AudioContext(); } catch (e) { return; }
  const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain(); o.connect(g); g.connect(AC.destination);
  const P = { ok: ['triangle', 880, 1320, .12, .09], ng: ['sawtooth', 160, 90, .28, .07], slam: ['sine', 140, 40, .22, .3], beep: ['square', 1240, 1240, .05, .03],
    tick: ['square', 620, 620, .03, .02], weld: ['sawtooth', 2400, 1800, .5, .012], ship: ['triangle', 520, 780, .16, .06], card: ['sine', 660, 990, .08, .04] }[kind];
  if (!P) return; o.type = P[0]; o.frequency.setValueAtTime(P[1], t); o.frequency.exponentialRampToValueAtTime(P[2], t + P[3]);
  g.gain.setValueAtTime(P[4], t); g.gain.exponentialRampToValueAtTime(.0001, t + P[3]); o.start(t); o.stop(t + P[3] + .02);
}

/* ---------------- stage scale, canvas ---------------- */
const cv = $('#cv'), cx = cv.getContext('2d'), stage = $('#stage');
let R = 1;
function fit() {
  const s = Math.min(innerWidth / W, innerHeight / H); stage.style.transform = `scale(${s})`;
  R = Math.min(2, Math.max(1, s * (devicePixelRatio || 1))); cv.width = W * R; cv.height = H * R;
}
addEventListener('resize', fit);

/* ---------------- the hall: drawn once ---------------- */
let BG = null;
function hall() {
  const c = document.createElement('canvas'); c.width = W * R; c.height = H * R; const g = c.getContext('2d'); g.scale(R, R);
  /* back wall */
  let gr = g.createLinearGradient(0, 120, 0, BELT); gr.addColorStop(0, '#0C0F14'); gr.addColorStop(1, '#141922'); g.fillStyle = gr; g.fillRect(0, 52, W, BELT - 52);
  g.strokeStyle = 'rgba(255,255,255,.035)'; g.lineWidth = 1;
  for (let x = 0; x < W; x += 80) { g.beginPath(); g.moveTo(x + .5, 128); g.lineTo(x + .5, BELT); g.stroke(); }
  for (let y = 200; y < BELT; y += 90) { g.beginPath(); g.moveTo(0, y + .5); g.lineTo(W, y + .5); g.stroke(); }
  g.fillStyle = '#0E1218'; g.fillRect(0, 384, W, 46);                                        // wainscot
  g.fillStyle = 'rgba(255,230,0,.5)'; g.fillRect(0, 384, W, 2);
  /* painted signage: the line number, the slogans (vertical, as banners) */
  g.save(); g.font = '400 150px "M PLUS 1"'; g.fillStyle = 'rgba(255,230,0,.045)'; g.textBaseline = 'alphabetic'; g.fillText('01', 1100, 384); g.restore();
  /* vertical LED signs, the slogans scrolling in light */
  const banner = (x, txt, col, code) => {
    g.fillStyle = '#050607'; g.fillRect(x - 19, 236, 38, 140); g.strokeStyle = '#2A2E36'; g.strokeRect(x - 18.5, 236.5, 37, 139);
    g.fillStyle = col; g.fillRect(x - 19, 236, 38, 12); g.fillStyle = '#000'; g.font = '700 7px "M PLUS 1 Code"'; g.textAlign = 'center'; g.fillText(code, x, 245);
    g.shadowColor = col; g.shadowBlur = 10; g.font = '600 21px "M PLUS 1"'; g.fillStyle = col; [...txt].forEach((ch, i) => g.fillText(ch, x, 276 + i * 25)); g.shadowBlur = 0;
    g.fillStyle = 'rgba(0,0,0,.35)'; for (let y = 250; y < 374; y += 3) g.fillRect(x - 17, y, 34, 1);
    g.textAlign = 'left';
  };
  banner(532, '安全第一', '#5CFFA0', 'SAFE-01'); banner(792, '品質第一', Y, 'QC-01');
  g.font = '400 17px "M PLUS 1"'; g.fillStyle = 'rgba(233,235,240,.18)'; g.fillText('第一ライン', 228, 300);
  g.font = '500 8px "M PLUS 1 Code"'; g.fillStyle = 'rgba(233,235,240,.24)'; g.fillText('KARATTO HEAVY IND.', 228, 314); g.fillText('LINE 01', 228, 325);
  /* pipes along the wall */
  for (const [y, w, c] of [[350, 8, '#1D232D'], [364, 5, '#262D39']]) { g.fillStyle = c; g.fillRect(0, y, W, w); g.fillStyle = 'rgba(255,255,255,.05)'; g.fillRect(0, y, W, 1); }
  for (let x = 60; x < W; x += 140) { g.fillStyle = '#0B0E12'; g.fillRect(x, 346, 6, 26); }
  /* the doors: in on the left, out on the right */
  const door = (x0, x1, txt) => {
    g.fillStyle = '#07090C'; g.fillRect(x0, 300, x1 - x0, BELT - 300); g.fillStyle = '#1B2029';
    for (let y = 300; y < 334; y += 6) g.fillRect(x0, y, x1 - x0, 3);                                // the shutter, half up
    g.fillStyle = Y; g.fillRect(x0 - 6, 292, x1 - x0 + 12, 4);
    for (let y = 300; y < BELT; y += 16) { g.fillStyle = y % 32 ? Y : '#111'; g.fillRect(x0 - 6, y, 6, 16); g.fillRect(x1, y, 6, 16); }
    g.font = '400 16px "M PLUS 1"'; g.fillStyle = 'rgba(233,235,240,.5)'; g.fillText(txt, x0 + 6, 286);
  };
  door(0, 150, '入荷'); door(1140, 1280, '出荷');
  /* pillars: H-beams */
  for (const x of [205, 1070]) {
    g.fillStyle = '#171C24'; g.fillRect(x, 120, 26, 456); g.fillStyle = '#20262F'; g.fillRect(x + 4, 120, 18, 456);
    g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(x, 120, 1, 456);
    for (let y = 520; y < 576; y += 14) { g.fillStyle = (y / 14) % 2 < 1 ? Y : '#0B0B0B'; g.fillRect(x, y, 26, 7); }
  }
  /* the sawtooth roof and its truss */
  g.fillStyle = '#090B0F'; g.fillRect(0, 52, W, 76);
  for (let x0 = -40; x0 < W; x0 += 170) {
    g.fillStyle = '#121620'; g.beginPath(); g.moveTo(x0, 64); g.lineTo(x0 + 170, 116); g.lineTo(x0 + 170, 128); g.lineTo(x0, 128); g.fill();
    gr = g.createLinearGradient(x0, 64, x0, 116); gr.addColorStop(0, 'rgba(215,228,255,.6)'); gr.addColorStop(1, 'rgba(160,185,255,.16)');
    g.fillStyle = gr; g.fillRect(x0 + 2, 64, 12, 52); g.fillStyle = '#090B0F'; for (let y = 76; y < 116; y += 13) g.fillRect(x0 + 2, y, 12, 2);
  }
  g.strokeStyle = '#1E242E'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 128); g.lineTo(W, 128); g.stroke();
  g.lineWidth = 1; g.beginPath(); for (let x = 0; x < W; x += 34) { g.moveTo(x, 128); g.lineTo(x + 17, 116); g.lineTo(x + 34, 128); } g.stroke();
  /* LED tubes under the truss, and the hall's stencils */
  for (let x = 30; x < W; x += 210) { g.fillStyle = '#1A1D22'; g.fillRect(x, 132, 120, 6); g.shadowColor = '#DDE6FF'; g.shadowBlur = 14; g.fillStyle = '#E8EEFF'; g.fillRect(x + 4, 134, 112, 2); g.shadowBlur = 0; }
  g.font = '700 9px "M PLUS 1 Code"'; g.fillStyle = 'rgba(233,235,240,.28)';
  g.fillText('SECTOR 01', 236, 402); g.fillText('組立 · ASSY', 236, 414);
  g.fillStyle = 'rgba(255,230,0,.55)'; for (let i = 0; i < 6; i++) g.fillRect(236 + i * 9, 420, 6, 3);
  /* the floor in front of the line */
  gr = g.createLinearGradient(0, 458, 0, H); gr.addColorStop(0, '#0B0D11'); gr.addColorStop(1, '#06070A'); g.fillStyle = gr; g.fillRect(0, 458, W, H - 458);
  g.fillStyle = 'rgba(255,230,0,.35)'; g.fillRect(0, 566, W, 3);
  for (let x = 0; x < W; x += 160) { g.fillStyle = '#12161D'; g.fillRect(x + 76, 458, 8, 108); g.strokeStyle = '#151A22'; g.beginPath(); g.moveTo(x + 84, 470); g.lineTo(x + 156, 552); g.moveTo(x + 156, 470); g.lineTo(x + 84, 552); g.stroke(); }
  BG = c;
}

/* ---------------- particles ---------------- */
const MOTES = Array.from({ length: 46 }, () => ({ x: Math.random() * W, y: 130 + Math.random() * 420, v: 3 + Math.random() * 6, p: Math.random() * 6 }));
function burst(x, y, n, kind) {
  for (let i = 0; i < n; i++) {
    const a = kind === 'spark' ? -Math.PI / 2 + (Math.random() - .5) * 2.6 : (Math.random() < .5 ? Math.PI : 0) + (Math.random() - .5) * .7;
    const v = kind === 'spark' ? 120 + Math.random() * 260 : 40 + Math.random() * 120;
    FX.push({ k: kind, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - (kind === 'dust' ? 20 : 0), t: 0, life: kind === 'spark' ? .4 + Math.random() * .5 : .7 + Math.random() * .6, r: kind === 'dust' ? 4 + Math.random() * 8 : 1.4 });
  }
}

/* ---------------- drawing ---------------- */
const lamp = (x, y, on, col) => {
  cx.fillStyle = '#0A0C10'; cx.fillRect(x - 6, y - 2, 12, 12);
  cx.fillStyle = on > .02 ? col : '#2A2E36'; cx.globalAlpha = .35 + .65 * on; cx.beginPath(); cx.arc(x, y, 5, Math.PI, 0); cx.fill();
  if (on > .02) { const gr = cx.createRadialGradient(x, y, 0, x, y, 46); gr.addColorStop(0, col + '66'); gr.addColorStop(1, col + '00'); cx.fillStyle = gr; cx.globalAlpha = on; cx.fillRect(x - 46, y - 46, 92, 92); }
  cx.globalAlpha = 1;
};
function stripes(x, y, w, h, a = 1) {
  cx.save(); cx.beginPath(); cx.rect(x, y, w, h); cx.clip(); cx.fillStyle = '#111'; cx.fillRect(x, y, w, h); cx.fillStyle = Y; cx.globalAlpha = a;
  for (let i = -h; i < w; i += 16) { cx.beginPath(); cx.moveTo(x + i, y + h); cx.lineTo(x + i + 8, y + h); cx.lineTo(x + i + 8 + h, y); cx.lineTo(x + i + h, y); cx.fill(); }
  cx.restore();
}
function shafts(t) {
  cx.save(); cx.globalCompositeOperation = 'lighter';
  for (let x0 = -40, i = 0; x0 < W; x0 += 170, i++) {
    const a = .05 + .015 * Math.sin(t * .7 + i * 1.7), gr = cx.createLinearGradient(x0, 70, x0 + 240, 560);
    gr.addColorStop(0, `rgba(205,220,255,${a * 1.5})`); gr.addColorStop(1, 'rgba(160,185,255,0)');
    cx.fillStyle = gr; cx.beginPath(); cx.moveTo(x0 + 2, 66); cx.lineTo(x0 + 14, 66); cx.lineTo(x0 + 300, 566); cx.lineTo(x0 + 200, 566); cx.fill();
  }
  cx.fillStyle = 'rgba(210,225,255,.5)';
  for (const m of MOTES) { const al = .25 + .25 * Math.sin(t * 1.3 + m.p); cx.globalAlpha = al; cx.fillRect(m.x, m.y, 1.6, 1.6); }
  cx.restore();
}
/* a station's machine; p = its working phase (0 idle) */
function press(s, t) {
  const x = s.x, a = s.act && s.act.k === 'press' ? s.act.t : -1;
  let d = 0; if (a >= 0) d = a < .14 ? easeIn(a / .14) : a < .3 ? 1 : 1 - ease((a - .3) / .55);
  cx.fillStyle = '#1A1F28'; cx.fillRect(x - 84, 254, 22, BELT - 254); cx.fillRect(x + 62, 254, 22, BELT - 254);
  cx.fillStyle = '#232A35'; cx.fillRect(x - 80, 254, 6, BELT - 254); cx.fillRect(x + 74, 254, 6, BELT - 254);
  cx.fillStyle = '#20262F'; cx.fillRect(x - 98, 236, 196, 46); cx.fillStyle = '#2A313D'; cx.fillRect(x - 98, 236, 196, 3);
  cx.font = '400 15px "M PLUS 1"'; cx.fillStyle = '#E9EBF0'; cx.fillText('プレス', x - 86, 265); cx.font = '500 10px "M PLUS 1 Code"'; cx.fillStyle = '#9AA1B0'; cx.fillText('200t · 01', x + 30, 264);
  const ry = 292 + d * 62;                                                                  // ram top
  cx.fillStyle = '#5C6370'; cx.fillRect(x - 9, 282, 18, ry - 282); cx.fillStyle = 'rgba(255,255,255,.25)'; cx.fillRect(x - 6, 282, 3, ry - 282);
  cx.fillStyle = '#2B323E'; cx.fillRect(x - 58, ry, 116, 40); stripes(x - 58, ry + 30, 116, 10);
  cx.fillStyle = '#3A4250'; cx.fillRect(x - 58, ry, 116, 3);
  lamp(x + 90, 228, s.beacon, s.ng > 0 ? RED : Y);
}
function weld(s, t) {
  const x = s.x, a = s.act && s.act.k === 'weld' ? s.act.t : -1;
  cx.fillStyle = '#1A1F28'; cx.beginPath(); cx.moveTo(x - 70, 248); cx.lineTo(x + 70, 248); cx.lineTo(x + 54, 282); cx.lineTo(x - 54, 282); cx.fill();
  cx.fillStyle = '#20262F'; cx.fillRect(x - 12, 128, 24, 120); cx.fillStyle = 'rgba(255,255,255,.05)'; cx.fillRect(x - 12, 128, 3, 120);
  cx.font = '400 15px "M PLUS 1"'; cx.fillStyle = '#E9EBF0'; cx.fillText('溶接', x - 40, 272); cx.font = '500 10px "M PLUS 1 Code"'; cx.fillStyle = '#9AA1B0'; cx.fillText('W-02', x + 8, 271);
  /* the arm: base behind the belt on the right, two links, IK to the torch tip */
  const bx = x + 86, by = 350; let tx = x + 30, ty = 330;
  if (a >= 0) { const u = clamp((a - .1) / .75, 0, 1); tx = x - 38 + 76 * u; ty = BELT - PH - 4; if (a < .1) { tx = x - 38; ty = 330 + (BELT - PH - 4 - 330) * ease(a / .1); } if (a > .85) { tx = x + 38; ty = BELT - PH - 4 - (BELT - PH - 4 - 330) * ease((a - .85) / .15); } }
  else { tx += Math.sin(t * .8) * 3; }
  const L1 = 70, L2 = 74, dx = tx - bx, dy = ty - (by - 40), dd = clamp(Math.hypot(dx, dy), 10, L1 + L2 - 1);
  const ang = Math.atan2(dy, dx), al = Math.acos((L1 * L1 + dd * dd - L2 * L2) / (2 * L1 * dd)), ex = bx + Math.cos(ang - al) * L1, ey = by - 40 + Math.sin(ang - al) * L1;
  cx.fillStyle = '#232A35'; cx.fillRect(bx - 18, by - 40, 36, BELT - by + 40); cx.fillStyle = '#1A1F28'; cx.fillRect(bx - 22, BELT - 10, 44, 10);
  cx.lineCap = 'round'; cx.strokeStyle = '#3B4352'; cx.lineWidth = 14; cx.beginPath(); cx.moveTo(bx, by - 40); cx.lineTo(ex, ey); cx.stroke();
  cx.strokeStyle = '#4A5262'; cx.lineWidth = 10; cx.beginPath(); cx.moveTo(ex, ey); cx.lineTo(tx, ty - 10); cx.stroke();
  cx.strokeStyle = '#8A919E'; cx.lineWidth = 4; cx.beginPath(); cx.moveTo(tx, ty - 10); cx.lineTo(tx - 4, ty); cx.stroke(); cx.lineCap = 'butt';
  cx.fillStyle = Y; cx.beginPath(); cx.arc(ex, ey, 5, 0, 7); cx.fill(); cx.beginPath(); cx.arc(bx, by - 40, 6, 0, 7); cx.fill();
  if (a > .1 && a < .85) {                                                                // the arc: flicker, light, sparks
    const f = .6 + Math.random() * .4; cx.save(); cx.globalCompositeOperation = 'lighter';
    let gr = cx.createRadialGradient(tx, ty, 0, tx, ty, 140 * f); gr.addColorStop(0, 'rgba(255,250,225,.75)'); gr.addColorStop(.25, 'rgba(255,230,0,.22)'); gr.addColorStop(1, 'rgba(255,230,0,0)');
    cx.fillStyle = gr; cx.fillRect(tx - 150, ty - 150, 300, 300); cx.fillStyle = '#FFFBEA'; cx.beginPath(); cx.arc(tx - 4, ty, 3.5 * f, 0, 7); cx.fill(); cx.restore();
    if (Math.random() < .9) burst(tx - 4, ty, 3, 'spark');
  }
  lamp(x + 64, 240, s.beacon, s.ng > 0 ? RED : Y);
}
function inspect(s, t) {
  const x = s.x, a = s.act && s.act.k === 'scan' ? s.act.t : -1;
  cx.fillStyle = '#1A1F28'; cx.fillRect(x - 78, 276, 16, BELT - 276); cx.fillRect(x + 62, 276, 16, BELT - 276); cx.fillRect(x - 86, 262, 172, 22);
  cx.font = '400 15px "M PLUS 1"'; cx.fillStyle = '#E9EBF0'; cx.fillText('検査', x - 76, 279); cx.font = '500 10px "M PLUS 1 Code"'; cx.fillStyle = '#9AA1B0'; cx.fillText('QC-03', x + 32, 278);
  for (let y = 292; y < BELT; y += 9) { cx.fillStyle = a >= 0 ? Y : '#2B313C'; cx.fillRect(x - 64, y, 2, 4); cx.fillRect(x + 62, y, 2, 4); }
  if (a >= 0) {                                                                           // the light curtain, sweeping
    const u = a < .5 ? a / .5 : 1 - (a - .5) / .4, yy = 296 + (BELT - 300) * ease(u);
    cx.save(); cx.globalCompositeOperation = 'lighter';
    for (let y = 296; y < BELT; y += 6) { cx.fillStyle = `rgba(255,230,0,${.06 + (Math.abs(y - yy) < 10 ? .5 : 0)})`; cx.fillRect(x - 62, y, 124, 1); }
    const gr = cx.createLinearGradient(0, yy - 30, 0, yy + 30); gr.addColorStop(0, 'rgba(255,230,0,0)'); gr.addColorStop(.5, 'rgba(255,210,80,.35)'); gr.addColorStop(1, 'rgba(255,230,0,0)');
    cx.fillStyle = gr; cx.fillRect(x - 62, yy - 30, 124, 60); cx.restore();
  }
  /* the monitor */
  const mx = x + 92, my = 296; cx.fillStyle = '#1A1F28'; cx.fillRect(mx + 22, my + 50, 6, BELT - my - 50); cx.fillStyle = '#0A0D11'; cx.fillRect(mx, my, 54, 48);
  cx.strokeStyle = '#2A303A'; cx.strokeRect(mx + .5, my + .5, 54, 48);
  cx.strokeStyle = s.ng > 0 ? RED : a >= 0 ? Y : '#3A4150'; cx.beginPath();
  for (let i = 0; i <= 46; i += 2) { const v = a >= 0 || s.ng > 0 ? Math.sin(i * .5 + t * 14) * (6 + Math.random() * 6) : Math.sin(i * .3 + t * 2) * 2; cx.lineTo(mx + 4 + i, my + 22 + v); } cx.stroke();
  cx.font = '700 9px "M PLUS 1 Code"'; cx.fillStyle = s.ng > 0 ? RED : '#9AA1B0'; cx.fillText(s.ng > 0 ? 'NG' : a >= 0 ? 'SCAN' : 'READY', mx + 4, my + 43);
  lamp(x + 74, 254, s.beacon, s.ng > 0 ? RED : Y);
}
/* a product on the belt: plate → stamped → welded → passed */
function product(p, t) {
  cx.save(); cx.translate(p.x, p.y); if (p.rot) cx.rotate(p.rot); cx.globalAlpha = p.alpha == null ? 1 : p.alpha;
  const w = 92, h = PH, x0 = -w / 2, y0 = -h;
  cx.fillStyle = 'rgba(0,0,0,.35)'; cx.fillRect(x0 + 4, -2, w - 8, 3);
  if (p.stage === 0) { cx.fillStyle = '#5E6672'; cx.fillRect(x0, -12, w, 12); cx.fillStyle = '#7A828F'; cx.fillRect(x0, -12, w, 2); cx.fillStyle = '#3F4651'; for (const hx of [-30, 0, 30]) { cx.beginPath(); cx.arc(hx, -6, 2.5, 0, 7); cx.fill(); } }
  else {
    cx.fillStyle = '#4C5461'; cx.beginPath(); cx.moveTo(x0, 0); cx.lineTo(x0, y0 + 10); cx.lineTo(x0 + 12, y0); cx.lineTo(-x0 - 12, y0); cx.lineTo(-x0, y0 + 10); cx.lineTo(-x0, 0); cx.fill();
    cx.fillStyle = '#69717E'; cx.fillRect(x0 + 12, y0, w - 24, 2); cx.fillStyle = '#3A414C'; for (const rx of [-26, 26]) cx.fillRect(rx - 8, y0 + 10, 16, 18);
    if (p.stage >= 2) { const heat = clamp(1 - (t - p.weldT) / 2.5, 0, 1); cx.strokeStyle = heat > 0 ? `rgb(${120 + 135 * heat},${80 + 110 * heat * heat},${50})` : '#2E343D'; cx.lineWidth = 2; cx.setLineDash([4, 3]); cx.beginPath(); cx.moveTo(x0 + 8, y0 + 8); cx.lineTo(-x0 - 8, y0 + 8); cx.stroke(); cx.setLineDash([]); }
    if (p.stage >= 3) { cx.fillStyle = Y; cx.fillRect(-x0 - 30, -16, 24, 12); cx.fillStyle = '#111'; cx.font = '700 8px "M PLUS 1 Code"'; cx.fillText('合格', -x0 - 28, -7); }
  }
  /* the parts it carries: chips with their words */
  p.parts.forEach((pt, i) => chip(-34 + i * 34, (p.stage === 0 ? -12 : y0) - 9, pt, 1));
  if (p.scrap) { cx.fillStyle = RED; cx.fillRect(-14, y0 - 4, 28, 14); cx.fillStyle = '#fff'; cx.font = '700 9px "M PLUS 1 Code"'; cx.fillText('不良', -10, y0 + 6); }
  cx.restore();
}
function chip(x, y, pt, a) {
  cx.save(); cx.translate(x, y); if (pt.rot) cx.rotate(pt.rot); cx.globalAlpha *= a;
  const s = pt.text, wpx = Math.max(30, Math.min(56, 12 * [...s].length + 8));
  cx.fillStyle = pt.auto ? '#1C2350' : '#2A2410'; cx.fillRect(-wpx / 2, -9, wpx, 18); cx.fillStyle = pt.auto ? AI : Y; cx.fillRect(-wpx / 2, -9, wpx, 2);
  cx.fillStyle = '#F2F0E8'; cx.font = '500 11px "M PLUS 1 Code"'; cx.textAlign = 'center'; cx.fillText(s.length > 4 ? s.slice(0, 4) : s, 0, 5); cx.textAlign = 'left';
  cx.restore();
}
let BOFF = 0;
function belt(t) {
  cx.fillStyle = '#1B1F26'; cx.fillRect(0, BELT, W, 7); cx.fillStyle = '#2B313B';
  for (let x = -(BOFF % 26); x < W; x += 26) cx.fillRect(x, BELT + 2, 12, 2);
  cx.fillStyle = '#12161C'; cx.fillRect(0, BELT + 7, W, 22); cx.fillStyle = 'rgba(255,230,0,.8)'; cx.fillRect(0, BELT + 7, W, 2);
  for (let x = 20; x < W; x += 40) {                                                      // the rollers' ends, turning
    cx.save(); cx.translate(x, BELT + 18); cx.rotate(BOFF / 7); cx.fillStyle = '#262C36'; cx.beginPath(); cx.arc(0, 0, 7, 0, 7); cx.fill();
    cx.strokeStyle = '#4A5160'; cx.lineWidth = 1.5; cx.beginPath(); cx.moveTo(-5, 0); cx.lineTo(5, 0); cx.moveTo(0, -5); cx.lineTo(0, 5); cx.stroke(); cx.restore();
  }
  ST.forEach(s => { cx.fillStyle = '#0B0D11'; cx.fillRect(s.x - 54, BELT + 31, 108, 18); cx.font = '500 10px "M PLUS 1 Code"'; cx.fillStyle = '#9AA1B0'; cx.fillText(`0${s.i + 1} ${s.en.toUpperCase()} · ${s.rule}`, s.x - 50, BELT + 44); });
}
function drawFX(dt) {
  cx.save(); cx.globalCompositeOperation = 'lighter';
  for (const f of FX) {
    const u = f.t / f.life;
    if (f.k === 'spark') { cx.strokeStyle = `rgba(255,${220 - 80 * u | 0},${120 - 100 * u | 0},${1 - u})`; cx.lineWidth = 1.4; cx.beginPath(); cx.moveTo(f.x, f.y); cx.lineTo(f.x - f.vx * .02, f.y - f.vy * .02); cx.stroke(); }
  }
  cx.globalCompositeOperation = 'source-over';
  for (const f of FX) if (f.k === 'dust') { const u = f.t / f.life; cx.fillStyle = `rgba(150,150,140,${.22 * (1 - u)})`; cx.beginPath(); cx.arc(f.x, f.y, f.r * (1 + u * 1.6), 0, 7); cx.fill(); }
  cx.restore();
}
function drawParts(t) {
  for (const p of PARTS) {
    const u = clamp(p.t / p.dur, 0, 1), e = ease(u);
    const x = p.x0 + (p.x1 - p.x0) * e, y = p.auto ? p.y0 + (p.y1 - p.y0) * easeIn(u) : p.y0 + (p.y1 - p.y0) * u - Math.sin(u * Math.PI) * 190;
    if (p.auto) { cx.save(); cx.globalCompositeOperation = 'lighter'; cx.strokeStyle = 'rgba(74,91,255,.55)'; cx.lineWidth = 3; cx.beginPath(); cx.moveTo(x, 128); cx.lineTo(x, y); cx.stroke(); cx.restore(); }
    for (let k = 3; k >= 0; k--) {                                                        // a short trail
      const uu = clamp(u - k * .035, 0, 1), xx = p.x0 + (p.x1 - p.x0) * ease(uu), yy = p.auto ? p.y0 + (p.y1 - p.y0) * easeIn(uu) : p.y0 + (p.y1 - p.y0) * uu - Math.sin(uu * Math.PI) * 190;
      cx.globalAlpha = k ? .16 / k : 1; chip(xx, yy, { text: p.text, auto: p.auto, rot: p.auto ? 0 : (1 - e) * 4 * p.spin - k * .2 * p.spin }, 1);
    }
    cx.globalAlpha = 1;
  }
}
function draw(t, dt) {
  cx.setTransform(R, 0, 0, R, 0, 0);
  const sk = G.shake > 0 ? G.shake * 6 : 0; if (sk) cx.translate((Math.random() - .5) * sk, (Math.random() - .5) * sk);
  cx.drawImage(BG, 0, 0, W, H);
  press(ST[0], t); weld(ST[1], t); inspect(ST[2], t);
  shafts(t);
  belt(t);
  PRODS.forEach(p => product(p, t));
  drawFX(dt); drawParts(t);
  /* shipping counter on the out door */
  cx.font = '800 30px Tektur'; cx.fillStyle = 'rgba(255,230,0,.85)'; cx.textAlign = 'right'; cx.fillText(String(G.ship).padStart(3, '0'), 1268, 386); cx.textAlign = 'left';
  cx.font = '500 10px "M PLUS 1 Code"'; cx.fillStyle = '#9AA1B0'; cx.fillText('SHIPPED', 1214, 400);
}

/* ---------------- words for the cards ---------------- */
const lvlOf = w => w.lvl || 3;
function pickWord(s) {
  const busy = new Set(ST.filter(x => x.card).map(x => x.card.word.w));
  const ok = LEARN.filter(w => !G.tried.has(s.skill + w.id) && !busy.has(w.w) && (s.skill !== 'reading' || w.r !== w.w));
  if (!ok.length) return null;
  const today = day(); let best = null, bs = -1e9;
  for (const w of ok) {
    const r = SAVE.words[w.id] || {}, ev = r.ev || {}, has = Object.values(ev).some(e => e.d && e.d.length), done = ev[s.skill] && ev[s.skill].d.includes(today);
    const sc = Math.random() + (has ? .7 : 0) - (done ? 1.2 : 0) + (lvlOf(w) - 3) * .12;
    if (sc > bs) { bs = sc; best = w; }
  }
  return best;
}
function options(s, w) {
  const tr = traps(w, s.mode, s.by, s.n - 1, POOL), all = shuffle([w, ...tr]);
  return all.map(e => ({ w: e.w, r: e.r, s: e.s, right: e.w === w.w }));
}

/* ---------------- cards (DOM) ---------------- */
const CARDS = $('#cards'), BINS = $('#bins');
function spawnCard(s) {
  let w = null, auto = false;
  if (MEM.length && (Math.random() < .17 || !LEARN.length)) auto = true;
  if (!auto) { w = pickWord(s); if (!w) auto = !!MEM.length; }
  if (auto) w = MEM[Math.random() * MEM.length | 0];
  if (!w) { s.prod.pass = true; return finishWork(s, 'pass'); }                            // nothing left to ask: the line runs itself
  const c = { s, word: w, auto, t: 0, D: auto ? 1.4 : G.D, done: false, opts: auto ? [] : options(s, w), born: performance.now() };
  const el = document.createElement('div'); el.className = 'card' + (auto ? ' auto' : ''); el.style.left = (s.x - 116) + 'px';
  const prompt = s.show === 'kana' ? `<div class="p kana">${esc(w.r)}</div>` : s.show === 'en' ? `<div class="p en">${esc(w.s)}</div>` : `<div class="p kj">${esc(w.w)}</div>`;
  el.innerHTML = `<span class="code">ST-0${s.i + 1} · ${auto ? 'AUTO 自動' : s.en.toUpperCase()}</span><div class="h"><span class="lb">${s.name} · ${SKILL_J[s.skill]}</span></div>
    ${prompt}<div class="f"><span>${auto ? 'IN MEMORY · THE AI HANDLES IT' : s.rule.replace('→', '→')}</span><span>${w.lvl ? 'JLPT N' + w.lvl : ''} <span class="bc"></span></span></div><div class="tm"><s></s></div>`;
  el.onclick = () => { if (!c.done && !c.auto) setFocus(c); };
  CARDS.appendChild(el); c.el = el; c.bar = el.querySelector('.tm s'); s.card = c; sfx('card');
  if (!auto && (!G.focus || G.focus.done)) setFocus(downstream());
}
function waiting() { return ST.map(s => s.card).filter(c => c && !c.done && !c.auto); }
function downstream() { const w = waiting(); return w.length ? w.reduce((a, b) => (b.s.i > a.s.i ? b : a)) : null; }
function setFocus(c) {
  if (G.focus === c) return; G.focus = c;
  ST.forEach(s => s.card && s.card.el.classList.toggle('on', s.card === c));
  ST.forEach(s => s.card && s.card.el.classList.toggle('wait', !!c && s.card !== c && !s.card.done && !s.card.auto));
  if (!G.lock) fillBins();
}
let BIN = [];                                                                        // BIN[i]: the bin of key i+1
function makeBins() {
  BINS.innerHTML = ''; BIN = [];
  for (let i = 0; i < 6; i++) {
    const b = document.createElement('div'); b.className = 'bin off'; b.innerHTML = `<span class="k"><b>${i + 1}</b><small>NUM</small></span><div class="v"></div>`;
    b.style.gridColumn = String(i % 3 + 1); b.style.gridRow = i < 3 ? '2' : '1';            // numpad: 4 5 6 over 1 2 3
    b.onclick = () => answer(i); BINS.appendChild(b); BIN[i] = b;
  }
}
function fillBins() {
  const c = G.focus;
  BIN.forEach((b, i) => {
    b.classList.remove('good', 'bad', 'show', 'press'); const o = c && c.opts[i], v = b.querySelector('.v');
    b.classList.add('flip'); setTimeout(() => {
      if (!o) { b.classList.add('off'); v.textContent = ''; } else {
        b.classList.remove('off'); const m = c.s.mode === 'meaning';
        v.className = 'v ' + (m ? 'en' : 'jp'); v.textContent = m ? o.s : o.w;
      }
      b.classList.remove('flip');
    }, 50 + [3, 4, 5, 0, 1, 2][i] * 35);
  });
}
function answer(i) {
  const c = G.focus; if (!G.run || G.lock || !c || c.done || c.auto) return;
  const o = c.opts[i]; if (!o) return;
  const b = BIN[i]; b.classList.add('press'); setTimeout(() => b.classList.remove('press'), 120);
  G.pace.push(c.t); if (G.pace.length > 8) G.pace.shift();
  resolve(c, o.right ? 'ok' : 'ng', i);
}
function resolve(c, kind, bi = -1) {
  c.done = true; const s = c.s, w = c.word, el = c.el;
  if (kind === 'ok' || kind === 'ng') {
    G.tried.add(s.skill + w.id);
    const r = record(SAVE, w.id, s.skill, kind === 'ok', 'factory', 'factory');
    const T = G.touched.get(w.id) || { w, res: {} }; T.res[s.skill] = kind === 'ok' ? (r === 'new' ? 'new' : 'same') : 'miss'; G.touched.set(w.id, T);
  }
  const ans = () => `<div class="ans"><b>${esc(w.w)}</b><span>${esc(w.r)} · ${esc(w.s)}</span></div>`;
  const stamp = document.createElement('div');
  if (kind === 'ok' || kind === 'auto') {
    stamp.className = 'ok'; stamp.innerHTML = `<div class="sx"><span>${kind === 'auto' ? 'AUTO // HANDLED BY THE AI' : 'PASS // PART FITTED'}</span><b>${kind === 'auto' ? '自動' : '良品'}</b></div>${ans('')}`;
    if (kind === 'ok') { G.streak++; G.best = Math.max(G.best, G.streak); const y = 15 + (5 - lvlOf(w)) * 5; G.yen += y; logL(w.w, SKILL_J[s.skill], '+¥' + y, 'y'); sfx('ok'); }
    else { G.yen += 10; G.auto++; logL(w.w, '自動', '+¥10', 'a'); }
    launch(s, c, bi);
  } else {
    stamp.className = 'ng'; stamp.innerHTML = `<div class="sx"><span>${kind === 'ng' ? 'FAULT // WRONG PART' : 'TIMEOUT // LATE'}</span><b>${kind === 'ng' ? '不良' : '遅延'}</b></div>${ans('')}`;
    el.classList.add('shake'); G.streak = 0; s.ng = 1.6; sfx('ng');
    logL(w.w, kind === 'ng' ? SKILL_J[s.skill] + ' ✗' : '遅延', kind === 'ng' ? 'evidence wiped' : 'late', 'r');
    scrap(s);
  }
  el.appendChild(stamp); el.classList.remove('on', 'wait');
  /* the bins show what was right, then move to the next card */
  if (!c.auto) {
    const bs = BIN; c.opts.forEach((o, i) => { if (o.right) bs[i].classList.add(kind === 'ok' ? 'good' : 'show'); });
    if (kind === 'ng' && bi >= 0) bs[bi].classList.add('bad');
    G.lock = kind === 'ok' ? .35 : 1.1;
  }
  setTimeout(() => { el.classList.add('leave'); setTimeout(() => el.remove(), 450); if (s.card === c) s.card = null; }, kind === 'ok' || kind === 'auto' ? 900 : 1900);
  if (G.focus === c) { G.focus = null; const n = downstream(); if (n) setFocus(n); }
  if (!c.auto && kind !== 'late') updatePace();
}
function updatePace() { if (G.pace.length < 3) return; const a = G.pace.slice().sort((x, y) => x - y)[G.pace.length >> 1]; G.D = clamp(a * 2.4 + 4, 8, 16); }
function logL(a, b, c, cls) {
  const d = document.createElement('div'); d.className = 'e'; d.innerHTML = `<span><span class="kj">${esc(a)}</span> <span class="m">${esc(b)}</span></span><span class="${cls}">${esc(c)}</span>`;
  const L = $('#log'); L.insertBefore(d, L.children[1] || null); while (L.children.length > 11) L.lastChild.remove();
}

/* ---------------- parts and machines ---------------- */
function launch(s, c, bi) {
  const p = s.prod; if (!p) return;
  const text = c.s.mode === 'meaning' ? c.word.w : c.word.w;
  const pt = c.auto ? { auto: true, x0: s.x, y0: 140, x1: s.x, y1: BELT - PH - 12, t: 0, dur: .45, text, s, spin: 0 }
    : { auto: false, x0: BIN_X(bi), y0: BIN_Y(bi), x1: s.x - 20 + p.parts.length * 6, y1: BELT - PH - 12, t: 0, dur: .55, text, s, spin: Math.random() < .5 ? -1 : 1 };
  PARTS.push(pt);
}
function landed(pt) {
  const s = pt.s, p = s.prod; if (!p) return;
  p.parts.push({ text: pt.text, auto: pt.auto }); if (p.parts.length > 3) p.parts.shift();
  s.act = { k: ['press', 'weld', 'scan'][s.i], t: 0, dur: [.9, 1.0, .9][s.i] };
}
function finishWork(s) {
  const p = s.prod; if (!p) return;
  p.stage = Math.max(p.stage, s.i + 1); if (s.i === 1) p.weldT = CLOCK;
  p.next = s.i + 1; p.state = 'move'; s.prod = null; s.act = null;
}
function scrap(s) {
  const p = s.prod; if (!p) return;
  p.scrap = true; p.state = 'scrap'; p.vy = -120; p.vx = 60 + Math.random() * 40; p.spin = (Math.random() < .5 ? -1 : 1) * (2 + Math.random() * 2);
  G.def++;
  if (FC.qc && !G.forgive) { G.forgive = 1; logL('品質管理', 'first defect', 'forgiven', 'a'); } else G.yen -= 10;
  setTimeout(() => { if (s.prod === p) s.prod = null; }, 500);
}

/* ---------------- the loop ---------------- */
let CLOCK = 0, LAST = performance.now(), paused = false;
function tick(now) {
  requestAnimationFrame(tick);
  const dt = Math.min(.05, (now - LAST) / 1000); LAST = now; if (paused) return; CLOCK += dt;
  const speed = FC.conv ? 150 : 115;
  /* the clock */
  if (G.run) {
    const before = Math.ceil(G.T); G.T -= dt; if (G.T <= 10 && Math.ceil(G.T) !== before) sfx('tick');
    if (G.T <= 0) { G.T = 0; endShift(); }
    G.spawnT -= dt;
    const inQ = PRODS.filter(p => p.next === 0 && p.state === 'move').length;
    if (G.spawnT <= 0 && inQ < 2) { PRODS.push({ id: ++pid, x: -70, y: BELT, stage: 0, next: 0, state: 'move', parts: [] }); G.spawnT = FC.conv ? 2.2 : 3; }
  }
  /* products: an accumulating conveyor */
  let moving = false;
  PRODS.sort((a, b) => b.x - a.x); let ahead = 1e9;
  for (const p of PRODS) {
    if (p.state === 'scrap') { p.vy += 900 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot = (p.rot || 0) + p.spin * dt; p.alpha = clamp(1 - (p.y - BELT) / 140, 0, 1); continue; }
    if (p.state === 'work') { ahead = p.x - 104; continue; }
    const st = p.next < 3 ? ST[p.next] : null, target = st ? st.x : W + 120;
    let nx = Math.min(p.x + speed * dt, target, ahead);
    if (st && st.prod && st.prod !== p) nx = Math.min(nx, st.x - 104);
    if (nx > p.x + .01) moving = true; p.x = Math.max(p.x, nx); ahead = p.x - 104;
    if (st && Math.abs(p.x - st.x) < .5 && !st.prod && G.run) { st.prod = p; p.state = 'work'; spawnCard(st); }
    if (!st && p.x > W + 60) { p.gone = true; G.ship++; G.yen += 30; sfx('ship'); logL('製品 #' + p.id, '出荷', '+¥30', 'y'); }
  }
  PRODS = PRODS.filter(p => !p.gone && !(p.state === 'scrap' && p.y > BELT + 160));
  if (moving) BOFF += speed * dt;
  /* cards */
  for (const s of ST) {
    const c = s.card; s.beacon = Math.max(0, s.beacon - dt * 2); s.ng = Math.max(0, s.ng - dt);
    if (c && !c.done) {
      if (G.run) c.t += dt * (c.auto || c === G.focus ? 1 : .4);
      c.bar.style.width = (100 * (1 - clamp(c.t / c.D, 0, 1))) + '%';
      if (!c.auto) { s.beacon = .5 + .5 * Math.sin(CLOCK * 6); if (c.t / c.D > .75) c.bar.classList.add('hot'); }
      if (c.t >= c.D) resolve(c, c.auto ? 'auto' : 'late');
    }
    if (s.ng > 0) s.beacon = .5 + .5 * Math.sin(CLOCK * 18);
    if (s.act) {
      const a = s.act; a.t += dt;
      if (a.k === 'press' && a.t >= .14 && !a.hit) { a.hit = 1; G.shake = .25; burst(s.x - 46, BELT - 4, 10, 'dust'); burst(s.x + 46, BELT - 4, 10, 'dust'); sfx('slam'); if (s.prod) s.prod.stage = 1; }
      if (a.k === 'weld' && a.t > .1 && !a.snd) { a.snd = 1; sfx('weld'); }
      if (a.k === 'scan' && a.t > .45 && !a.snd) { a.snd = 1; sfx('beep'); }
      if (a.t >= a.dur) finishWork(s);
    }
  }
  if (G.lock > 0) { G.lock -= dt; if (G.lock <= 0) { G.lock = 0; fillBins(); } }
  G.shake = Math.max(0, G.shake - dt * 1.6);
  for (const pt of PARTS) { pt.t += dt; if (pt.t >= pt.dur && !pt.done) { pt.done = 1; landed(pt); } } PARTS = PARTS.filter(p => !p.done);
  for (const f of FX) { f.t += dt; f.vy += (f.k === 'spark' ? 700 : -10) * dt; f.x += f.vx * dt; f.y += f.vy * dt; if (f.k === 'spark' && f.y > BELT && f.vy > 0) { f.y = BELT; f.vy *= -.35; f.vx *= .6; } if (f.k === 'dust') { f.vx *= .96; } }
  FX = FX.filter(f => f.t < f.life); if (FX.length > 600) FX.splice(0, FX.length - 600);
  for (const m of MOTES) { m.x += m.v * dt; m.y += Math.sin(CLOCK * .5 + m.p) * 4 * dt; if (m.x > W) m.x = 0; }
  hud();
  draw(CLOCK, dt);
}
function hud() {
  const T = Math.ceil(G.T); $('#clock').textContent = `${String(T / 60 | 0).padStart(2, '0')}:${String(T % 60).padStart(2, '0')}`;
  $('#clock').style.color = G.run && G.T <= 10 ? RED : '';
  const cap = G.target * 1.5; $('#prog i').style.width = (100 * Math.min(1, G.ship / cap)) + '%'; $('#prog b').style.left = (100 * G.target / cap) + '%';
  $('#s-ship').textContent = G.ship + ' / ' + G.target; $('#s-def').textContent = G.def; $('#s-yen').textContent = G.yen.toLocaleString();
}

/* ---------------- the shift: brief, start, end, report ---------------- */
const UPG = [
  { id: 'conv', name: '高速コンベア', en: 'Fast conveyor', cost: 600, d: 'Plates come in faster: more cards, more yen.' },
  { id: 'qc', name: '品質管理', en: 'Quality control', cost: 900, d: 'The first defect of a shift costs no yen. Evidence is still wiped.' },
  { id: 'ext', name: 'シフト延長', en: 'Longer shift', cost: 500, d: 'Shifts run 4 minutes instead of 3.' }];
function left() {
  const nW = LEARN.length, nM = MEM.length;
  $('#left').innerHTML = `<div class="hd"><span class="lb">LINE 01 · SHIFT ${String(FC.shifts + 1).padStart(3, '0')}</span><span class="bc"></span></div>
    <div><span class="m">training</span> ${nW} words</div><div><span class="m">in memory</span> <span class="a">${nM}</span></div>
    <div><span class="m">pace</span> ${G.D.toFixed(0)} s a card</div><div><span class="m">streak</span> ${G.streak} <span class="m">best ${G.best}</span></div>
    <div style="margin-top:8px" class="lb">CONTROLS</div><div><span class="key">NUM 1</span>–<span class="key">6</span> part</div><div><span class="key">Tab</span> next card</div><div><span class="key">Esc</span> exit</div>`;
}
function brief() {
  const nW = LEARN.length, today = day();
  const evT = Object.values(SAVE.words).reduce((n, w) => n + (w.ev ? Object.values(w.ev).filter(e => e.d && e.d.includes(today)).length : 0), 0);
  const none = !DECK.length, strike = SAVE.sim && SAVE.sim.strike > Date.now();
  $('#brief').innerHTML = `<div class="bar"><span>FAC-01 // 大工場 GREAT FACTORY // LINE 01</span><span>BRIEFING 始業前</span></div><h2>始業前ミーティング</h2>
    <div style="color:#C9CDD6;font-size:13px;max-width:640px">Plates come in from the left and stop at three stations. Each posts a kanban card; pick the right part from the bins below, laid out like the numpad (<span class="key">4 5 6</span> over <span class="key">1 2 3</span>) before its ring closes. The card you are on runs at full speed, the others at 0.4×. A wrong part scraps the product and wipes that skill's evidence for the word. Words already in memory are handled by the AI's robots.</div>
    <div class="how">${ST.map(s => `<div><em>ST-0${s.i + 1} // ${s.en.toUpperCase()}</em><b>${s.name} <span class="m" style="font:500 11px var(--mono)">${s.en}</span></b>${s.rule} · ${SKILL_J[s.skill]}<br><span class="m">${s.show === 'kana' ? 'a reading: pick the written word' : s.show === 'en' ? 'a meaning: pick the written word' : 'a written word: pick its meaning'}</span></div>`).join('')}</div>
    <div class="row"><div class="stat"><span class="lb">training</span><b>${nW}</b></div><div class="stat"><span class="lb">in memory</span><b style="color:#8C98FF">${MEM.length}</b></div><div class="stat"><span class="lb">evidence today</span><b>${evT}</b></div><div class="stat"><span class="lb">funds</span><b>¥${(SAVE.corp.funds || 0).toLocaleString()}</b></div></div>
    ${none ? `<div class="files" style="border-color:var(--red)">No deck yet. Open the core, Settings → Read the deck (Anki must be running). Or <a href="?demo${EMBED ? '&embed=1' : ''}" style="color:var(--y)">run a demo shift</a>.</div>` : ''}
    ${DEMO ? '<div class="files">Demo shift: a made-up deck, nothing is saved.</div>' : ''}
    ${strike ? `<div class="files" style="border-color:var(--red)">ストライキ中 STRIKE · the union has stopped the line for ${Math.ceil((SAVE.sim.strike - Date.now()) / 3600e3)} more hours. Settle it in the core (経営).</div>` : ''}
    <div class="acts">${none || strike ? '' : '<button class="go" id="b-go" type="button">始業 · Start the shift <span class="key" style="border-color:#111;color:#111">Enter</span></button>'}<button class="go2" id="b-out" type="button">Back to the surface</button></div>`;
  $('#ov-brief').classList.add('on'); left();
  if ($('#b-go')) $('#b-go').onclick = start; $('#b-out').onclick = exit;
}
function start() {
  try { AC = AC || new AudioContext(); AC.resume(); } catch (e) {}
  $('#ov-brief').classList.remove('on'); $('#ov-report').classList.remove('on');
  Object.assign(G, { run: true, T0: FC.ext ? 240 : 180, ship: 0, def: 0, yen: 0, spawnT: 0, focus: null, lock: 0, tried: new Set(), touched: new Map(), forgive: 0, streak: 0, auto: 0 });
  G.T = G.T0; G.target = Math.round((FC.ext ? 240 : 180) / (FC.conv ? 15 : 18));
  PRODS = []; PARTS = []; ST.forEach(s => { s.prod = null; s.card = null; s.act = null; }); CARDS.innerHTML = ''; $('#log').innerHTML = '<div class="hd"><span class="lb">LOG · 作業ログ</span><span class="bc"></span></div>';
  makeBins(); left();
}
function endShift() {
  G.run = false; G.focus = null;
  ST.forEach(s => { if (s.card && !s.card.done) { s.card.done = true; s.card.el.classList.add('leave'); } s.card = null; });
  setTimeout(() => { CARDS.innerHTML = ''; }, 500); BIN.forEach(b => b.classList.add('off'));
  const flagged = updateFlags(SAVE);
  const answers = [...G.touched.values()].reduce((n, x) => n + Object.values(x.res).filter(v => v !== 'miss').length, 0);
  addShift(SAVE, G.ship, answers);
  SAVE.corp.funds = (SAVE.corp.funds || 0) + G.yen; FC.shifts++; FC.best = Math.max(FC.best || 0, G.ship);
  (SAVE.log = SAVE.log || []).push({ t: Date.now(), k: 'factory', ship: G.ship, def: G.def, yen: G.yen, flagged: flagged.length }); if (SAVE.log.length > 200) SAVE.log.splice(0, SAVE.log.length - 200);
  persist();
  setTimeout(() => report(flagged), 1100);
}
function report(flagged) {
  const rows = [...G.touched.values()];
  const cell = r => r === 'new' ? '<span class="y">✓ +1 day</span>' : r === 'same' ? '<span class="m">✓ today already</span>' : '<span class="r">✗ wiped</span>';
  const ok = rows.reduce((n, x) => n + Object.values(x.res).filter(v => v !== 'miss').length, 0), ng = rows.reduce((n, x) => n + Object.values(x.res).filter(v => v === 'miss').length, 0);
  const byId = new Map(DECK.map(w => [w.id, w]));
  $('#report').innerHTML = `<div class="bar"><span>FAC-01 // 日報 DAILY REPORT // SHIFT ${String(FC.shifts).padStart(3, '0')}</span><span class="bc" style="opacity:.8"></span></div><h2>${G.ship >= G.target ? '目標達成' : '目標未達'}</h2>
    <div class="row"><div class="stat"><span class="lb">shipped</span><b>${G.ship}<span class="m" style="font-size:16px"> / ${G.target}</span></b></div><div class="stat"><span class="lb">defects</span><b style="color:${G.def ? RED : 'inherit'}">${G.def}</b></div><div class="stat"><span class="lb">earned</span><b style="color:${Y}">¥${G.yen.toLocaleString()}</b></div><div class="stat"><span class="lb">best streak</span><b>${G.best}</b></div></div>
    <div class="lb">evidence · ${ok} clean, ${ng} wiped${G.auto ? ` · ${G.auto} handled by the AI` : ''}</div>
    <div class="ev">${rows.slice(0, 16).map(x => `<div><span><span class="kj">${esc(x.w.w)}</span> <span class="m">${esc(x.w.r)}</span></span><span>${Object.entries(x.res).map(([k, v]) => SKILL_J[k] + ' ' + cell(v)).join(' · ')}</span></div>`).join('') || '<div class="m">No card answered.</div>'}</div>
    ${flagged.length ? `<div class="files"><b class="a">${flagged.length} file${flagged.length > 1 ? 's' : ''} sent to the audit</b> · the AI thinks you know <span class="kj">${flagged.slice(0, 6).map(id => esc((byId.get(id) && deckWord(byId.get(id), KD).w) || '')).join('、')}${flagged.length > 6 ? '…' : ''}</span>. Commit or reject them in the core (審査).</div>` : ''}
    <div class="lb" style="margin-top:16px">設備投資 · upgrades · funds ¥${(SAVE.corp.funds || 0).toLocaleString()}</div>
    <div class="shop">${UPG.map(u => `<button type="button" data-u="${u.id}" ${FC[u.id] || (SAVE.corp.funds || 0) < u.cost ? 'disabled' : ''}><b>${u.name}</b>${u.en} · ${FC[u.id] ? 'installed' : '¥' + u.cost}<br><span class="m">${u.d}</span></button>`).join('')}</div>
    <div class="acts"><button class="go" id="b-again" type="button">次のシフト · Next shift <span class="key" style="border-color:#111;color:#111">Enter</span></button><button class="go2" id="b-out2" type="button">Back to the surface</button></div>`;
  $('#ov-report').classList.add('on');
  $('#b-again').onclick = start; $('#b-out2').onclick = exit;
  $('#report').querySelectorAll('[data-u]').forEach(b => b.onclick = () => { const u = UPG.find(x => x.id === b.dataset.u); if (FC[u.id] || SAVE.corp.funds < u.cost) return; SAVE.corp.funds -= u.cost; FC[u.id] = 1; persist(); report(flagged); });
}
function persist() { if (!DEMO) store.store(SAVE, null); }
function exit() { if (EMBED) parent.postMessage('karatto:surface', location.origin); else location.href = '../' + (DEMO ? '?demo' : ''); }

/* ---------------- input ---------------- */
addEventListener('keydown', e => {
  if (e.key === 'Escape') { e.preventDefault(); return exit(); }
  if (e.key === 'Enter' && !G.run) { e.preventDefault(); if ($('#b-go') && $('#ov-brief').classList.contains('on')) start(); else if ($('#ov-report').classList.contains('on')) start(); return; }
  if (e.key === 'Tab' && G.run) { e.preventDefault(); const w = waiting(); if (w.length) setFocus(w[(w.indexOf(G.focus) + 1) % w.length]); return; }
  if (/^[1-6]$/.test(e.key)) answer(+e.key - 1);
});
document.addEventListener('visibilitychange', () => { paused = document.hidden; LAST = performance.now(); });
$('#b-exit').onclick = exit;
const muteL = () => { $('#b-mute').textContent = MUTE ? 'SND OFF' : 'SND ON'; };
$('#b-mute').onclick = () => { MUTE = !MUTE; try { localStorage.setItem('karatto.mute', MUTE ? '1' : '0'); } catch (e) {} muteL(); }; muteL();

/* ---------------- demo deck (same idea as the core's) ---------------- */
function demoDeck() {
  const deck = [], seen = new Set(); let id = 1;
  for (const k of KD.list) {
    if (k.l < 3 && Math.random() > .2) continue;
    for (const f of k.fa) for (const e of f.ex.slice(0, k.l >= 4 ? 2 : 1)) if (!seen.has(e[0])) { seen.add(e[0]); deck.push({ id: id++, written: e[0], reading: e[1], meaning: e[2], expr: e[0] }); }
  }
  const words = {}, y = day(Date.now() - 864e5);
  deck.forEach(w => { const r = Math.random(); if (r < .55) words[w.id] = { cert: Date.now() }; else if (r < .75) words[w.id] = { ev: { meaning: { d: [y] }, recall: { d: [y] } } }; });
  return { deck, words };
}

/* ---------------- start ---------------- */
(async function boot() {
  fit();
  KD = await loadKanji('../../data/karatto/kanji.json');
  if (document.fonts) await Promise.race([Promise.all([document.fonts.load('400 20px "M PLUS 1"', '第一ライン安全品質入荷出荷プレス溶接検査始業前日報'), document.fonts.load('500 12px "M PLUS 1 Code"', 'あ'), document.fonts.load('800 20px Tektur', '0')]), new Promise(r => setTimeout(r, 5000))]);
  hall();
  const L0 = await store.load(); SAVE = L0.save; DECK = L0.deck || [];
  if (DEMO) { const d = demoDeck(); DECK = d.deck; SAVE = { ...SAVE, words: d.words, corp: { ...SAVE.corp, factory: undefined } }; }
  FC = SAVE.corp.factory = SAVE.corp.factory || { shifts: 0 };
  const words = DECK.map(w => deckWord(w, KD)).filter(w => w.w && w.r && w.s && w.ks.length);
  POOL = buildPool(KD, words);
  MEM = words.filter(w => SAVE.words[w.id] && SAVE.words[w.id].cert); LEARN = words.filter(w => !(SAVE.words[w.id] && SAVE.words[w.id].cert));
  makeBins(); brief(); requestAnimationFrame(tick);
  if (EMBED) parent.postMessage('karatto:ready', location.origin);
  window.__f = { G, ST, start, endShift, answer, right: () => G.focus && G.focus.opts.findIndex(o => o.right), set: (k, v) => { G[k] = v; } };
})();
