/* カラット: 発電所, the power plant. The control room: the planet's demand curve over a whole day on the wall, the
   boilers and the turbine below, fuel rods rolling in on the conveyor, each one a word. Type the front rod's reading
   (romaji turns into kana) and Enter: it burns and adds power for a few seconds. Keep the output inside the band
   round the demand. A wrong reading misfires and the rod goes to the back of the line. Skill: reading, typed. */
import { game, panel, typer, sameReading, esc, clamp, Y, RED, OK, sfx, $ } from './game.js?v=21';

const BASE = 300, BURN = 9;
let RODS = [], LIT = [], WAIT = [], HIST = [], SMOKE = [], inBand = 0, total = 0, burned = 0, misfire = 0, T, rot = 0;
const demand = u => 400 + 85 * Math.sin(2 * Math.PI * (u - .32)) + 22 * Math.sin(6 * Math.PI * u + 1.3) + 9 * Math.sin(23 * u);
const mwOf = w => 40 + (5 - (w.lvl || 4)) * 15;
const output = () => BASE + LIT.reduce((s, r) => s + r.mw * Math.min(1, r.t / .8) * Math.min(1, (BURN - r.t) / 1.2), 0);

function feed(api) {
  while (RODS.length < 6) {
    const on = new Set(RODS.map(r => r.w.w).concat(WAIT.map(r => r.w.w), LIT.map(r => r.w.w)));
    const w = api.pick('reading', x => !on.has(x.w)) || api.MEM.filter(x => !on.has(x.w))[Math.random() * 40 | 0];
    if (!w) break; RODS.push({ w, mw: mwOf(w), x: 1300 + RODS.length * 150 });
  }
  T.set(RODS[0] ? `<span class="kj">${esc(RODS[0].w.w)}</span>` : '—');
}
function submit(api, v) {
  const r = RODS[0]; if (!r || !api.G.run) return;
  const ok = sameReading(v, [r.w.r]); api.record(r.w, 'reading', ok, 'typed');
  T.clear(); T.flash(ok);
  if (ok) { RODS.shift(); WAIT.push(r); burned++; api.G.yen += api.pay(10 + Math.round(r.mw / 4)); sfx('up'); api.log(r.w.w, r.w.r, '+' + r.mw + ' MW', 'y'); }
  else { misfire++; RODS.push(RODS.shift()); SMOKE.push({ t: 0 }); sfx('ng'); api.log(r.w.w, '✗ ' + r.w.r, 'misfire', 'r'); api.toast(`不発 misfire · ${r.w.w} reads ${r.w.r}`, 2400); }
  feed(api);
}
function skip(api) { if (RODS.length > 1) { RODS.push(RODS.shift()); feed(api); sfx('tick'); } }

game({
  id: 'power', site: 'power', tier: 1, code: 'PWR-04', jp: '発電所', en: 'Power plant', sub: 'THE CONTROL ROOM · THE DEMAND WALL', title: '中央制御室', dur: 180,
  skills: ['reading'],
  lead: 'Words roll in on the conveyor as fuel rods. Type the front rod\'s <b>reading</b> in romaji (it turns into kana as you type) and press Enter: it burns and adds power for nine seconds. Keep the output inside the band round the planet\'s demand as its day passes. A wrong reading misfires: no power, the rod goes to the back. Tab skips a rod.',
  how: [['TYPE · 入力', '読みを打つ', 'Romaji → kana, no IME. Every rod is a word from the deck.'], ['BURN · 燃焼', '難しいほど強い', 'Harder words burn hotter: N5 40 MW, N3 70 MW, N1 100 MW.'], ['GRID · 送電', '帯の中に', 'Time inside the ±8% band is the score; it powers the planet for a day.']],
  stats: [['送電', 'GRID', () => (total ? Math.round(inBand / total * 100) : 100) + '%'], ['燃焼', 'BURNED', () => burned], ['¥', '', a => Math.round(a.G.yen).toLocaleString()]],
  shop: [{ id: 'boiler3', name: '三号ボイラー', en: 'Boiler 3', cost: 800, d: 'Three rods can burn at once.' }, { id: 'fuel', name: '高品位燃料', en: 'Fuel mix', cost: 600, d: 'Every rod burns 20% hotter.' }, { id: 'longer', name: 'シフト延長', en: 'Longer shift', cost: 500, d: 'Shifts run 4 minutes.' }],
  init(api) {
    const lg = panel('pg', { x: 1006, y: 316, w: 262, h: 150 }, '記録 · LOG', 'LOG'); lg.id = 'g-log'; lg.classList.add('log');
    T = typer({ x: 12, y: 560, w: 1256, h: 148, skip: 'NEXT ROD' }, v => submit(api, v), () => skip(api));
  },
  start(api) {
    RODS = []; LIT = []; WAIT = []; HIST = []; SMOKE = []; inBand = 0; total = 0; burned = 0; misfire = 0; feed(api); T.clear(); T.focus(); $('#g-log').innerHTML = '';
  },
  tick(dt, api) {
    rot += dt * (output() / 120);
    if (!api.G.run) return;
    const boilers = api.U.boiler3 ? 3 : 2, hot = api.U.fuel ? 1.2 : 1;
    while (WAIT.length && LIT.length < boilers) { const r = WAIT.shift(); r.t = 0; r.mw = Math.round(r.mw * hot); LIT.push(r); }
    LIT.forEach(r => r.t += dt); LIT = LIT.filter(r => r.t < BURN);
    RODS.forEach((r, i) => { const tx = 420 + i * 150; r.x += (tx - r.x) * Math.min(1, dt * 6); });
    const u = 1 - api.G.T / api.G.T0, D = demand(u), O = output();
    total += dt; if (Math.abs(O - D) <= D * .08) { inBand += dt; api.G.yen += dt * 1.5; }
    if (!HIST.length || u - HIST[HIST.length - 1].u > .002) HIST.push({ u, o: O });
    SMOKE = SMOKE.filter(s => (s.t += dt) < 1.5);
  },
  end(api) {
    const grid = total ? Math.round(inBand / total * 100) : 0; api.G.yen = Math.round(api.G.yen);
    return { title: grid >= 70 ? '送電安定' : grid >= 40 ? '業務終了' : '電力不足', rows: [['grid in band', grid + '%', grid >= 70 ? 'y' : grid < 40 ? 'r' : ''], ['rods burned', burned, 'y'], ['misfires', misfire, misfire ? 'r' : '']], effect: { grid },
      extra: `<div class="note">The grid ran ${grid}% of the day inside the band: +${Math.round(grid * .8)} MW of supply on the planet for the next 24 hours.</div>` };
  },
  draw(cx, t, dt, api) { scene(cx, t, api); }
});

function scene(cx, t, api) {
  cx.fillStyle = '#060708'; cx.fillRect(0, 0, 1280, 720);
  /* the demand wall */
  const X0 = 40, X1 = 1240, Y0 = 70, Y1 = 290, lo = 250, hi = 560, yv = v => Y1 - (v - lo) / (hi - lo) * (Y1 - Y0), xu = u => X0 + u * (X1 - X0);
  cx.fillStyle = '#0A0B0D'; cx.fillRect(X0 - 16, Y0 - 12, X1 - X0 + 32, Y1 - Y0 + 40); cx.strokeStyle = '#2A2E36'; cx.strokeRect(X0 - 15.5, Y0 - 11.5, X1 - X0 + 31, Y1 - Y0 + 39);
  cx.strokeStyle = 'rgba(255,255,255,.05)'; cx.beginPath(); for (let h = 0; h <= 24; h += 2) { cx.moveTo(xu(h / 24), Y0); cx.lineTo(xu(h / 24), Y1); } for (let v = 300; v <= 550; v += 50) { cx.moveTo(X0, yv(v)); cx.lineTo(X1, yv(v)); } cx.stroke();
  cx.fillStyle = '#5A606C'; cx.font = '700 9px "M PLUS 1 Code"'; for (let h = 0; h <= 24; h += 4) cx.fillText(String(h).padStart(2, '0') + ':00', xu(h / 24) - 14, Y1 + 18); for (let v = 300; v <= 550; v += 100) cx.fillText(v + ' MW', X0 + 4, yv(v) - 4);
  /* the band */
  cx.beginPath(); for (let i = 0; i <= 120; i++) { const u = i / 120; cx.lineTo(xu(u), yv(demand(u) * 1.08)); } for (let i = 120; i >= 0; i--) { const u = i / 120; cx.lineTo(xu(u), yv(demand(u) * .92)); } cx.fillStyle = 'rgba(255,255,255,.05)'; cx.fill();
  cx.setLineDash([6, 6]); cx.strokeStyle = 'rgba(236,238,242,.7)'; cx.beginPath(); for (let i = 0; i <= 160; i++) { const u = i / 160; cx.lineTo(xu(u), yv(demand(u))); } cx.stroke(); cx.setLineDash([]);
  /* the output so far */
  cx.strokeStyle = Y; cx.lineWidth = 2.5; cx.shadowColor = Y; cx.shadowBlur = 8; cx.beginPath(); HIST.forEach(p => cx.lineTo(xu(p.u), yv(p.o))); cx.stroke(); cx.shadowBlur = 0; cx.lineWidth = 1;
  const u = api.G.run || HIST.length ? 1 - api.G.T / api.G.T0 : 0, D = demand(u), O = output(), ok = Math.abs(O - D) <= D * .08;
  cx.strokeStyle = 'rgba(255,230,0,.4)'; cx.beginPath(); cx.moveTo(xu(u), Y0); cx.lineTo(xu(u), Y1); cx.stroke();
  const hh = Math.floor(u * 24), mm = Math.floor((u * 24 % 1) * 60);
  cx.fillStyle = ok ? Y : RED; cx.font = '700 15px Tektur'; cx.fillText(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} · ${Math.round(O)} / ${Math.round(D)} MW`, Math.min(xu(u) + 8, X1 - 210), Y0 + 16);
  cx.fillStyle = '#8A909C'; cx.font = '700 9px "M PLUS 1 Code"'; cx.fillText('需要 DEMAND (DASHED) · 出力 OUTPUT · BAND ±8%', X0, Y0 - 1);
  /* boilers */
  const boilers = api.U.boiler3 ? 3 : 2;
  for (let b = 0; b < 3; b++) {
    const x = 60 + b * 108, y = 314, r = LIT[b], on = b < boilers;
    cx.fillStyle = '#14161A'; cx.fillRect(x, y, 90, 150); cx.strokeStyle = '#2E333C'; cx.strokeRect(x + .5, y + .5, 90, 150);
    cx.fillStyle = '#0A0B0D'; cx.fillRect(x + 15, y + 76, 60, 52);
    if (r) { const f = .6 + .4 * Math.sin(t * 30 + b) * Math.random(); const g = cx.createRadialGradient(x + 45, y + 104, 2, x + 45, y + 104, 46); g.addColorStop(0, `rgba(255,250,210,${f})`); g.addColorStop(.4, `rgba(255,190,40,${.7 * f})`); g.addColorStop(1, 'rgba(255,120,0,0)'); cx.fillStyle = g; cx.fillRect(x + 15, y + 76, 60, 52);
      cx.fillStyle = Y; cx.fillRect(x + 10, y + 138, 70 * (1 - r.t / BURN), 4); cx.fillStyle = '#ECEEF2'; cx.font = '500 16px "M PLUS 1"'; cx.textAlign = 'center'; cx.fillText(r.w.w, x + 45, y + 64); cx.textAlign = 'left'; }
    cx.fillStyle = on ? '#8A909C' : '#3A3F48'; cx.font = '700 9px "M PLUS 1 Code"'; cx.fillText(on ? `BOILER ${b + 1}` : 'LOCKED', x + 8, y + 16);
    for (let k = 0; k < 5; k++) { cx.fillStyle = r && k < Math.ceil(r.mw / 20) ? Y : '#22252B'; cx.fillRect(x + 8 + k * 15, y + 24, 11, 6); }
  }
  /* the turbine */
  const tx = 520, ty = 384; cx.strokeStyle = '#2E333C'; cx.lineWidth = 1; cx.beginPath(); cx.arc(tx, ty, 72, 0, 7); cx.stroke(); cx.beginPath(); cx.arc(tx, ty, 56, 0, 7); cx.stroke();
  cx.save(); cx.translate(tx, ty); cx.rotate(rot); for (let k = 0; k < 12; k++) { cx.rotate(Math.PI / 6); cx.fillStyle = k % 3 ? '#3A3F48' : Y; cx.fillRect(14, -3, 40, 6); } cx.restore();
  cx.fillStyle = '#0A0B0D'; cx.beginPath(); cx.arc(tx, ty, 14, 0, 7); cx.fill(); cx.fillStyle = '#8A909C'; cx.font = '700 9px "M PLUS 1 Code"'; cx.fillText('TURBINE · ' + Math.round(O) + ' MW', tx + 84, ty + 4);
  /* the grid gauge and the districts */
  const gx = 700, gy = 318, grid = total ? inBand / total : 1;
  cx.fillStyle = '#8A909C'; cx.fillText('送電 GRID IN BAND', gx, gy + 10); cx.fillStyle = grid > .6 ? Y : RED; cx.font = '700 64px Tektur'; cx.fillText(Math.round(grid * 100) + '%', gx, gy + 76);
  cx.font = '700 9px "M PLUS 1 Code"'; cx.fillStyle = '#8A909C'; cx.fillText('DISTRICTS ON THE GRID', gx, gy + 104);
  const on = O >= D * .92 ? 24 : Math.floor(24 * O / D * .9);
  for (let k = 0; k < 24; k++) { cx.fillStyle = k < on ? (k % 5 ? '#ECEEF2' : Y) : '#1C1F25'; cx.fillRect(gx + (k % 12) * 24, gy + 114 + Math.floor(k / 12) * 22, 18, 16); }
  /* the conveyor and its rods */
  cx.fillStyle = '#121418'; cx.fillRect(370, 508, 900, 34); for (let x = 370 - (t * 60 % 30); x < 1270; x += 30) { cx.fillStyle = '#1C1F25'; cx.fillRect(x, 512, 14, 4); }
  RODS.forEach((r, i) => {
    const x = r.x, y = 480, w = 130, front = i === 0;
    cx.fillStyle = front ? '#1A190A' : '#0E0F12'; cx.fillRect(x, y, w, 56); cx.strokeStyle = front ? Y : '#3A3F48'; cx.lineWidth = front ? 2 : 1; cx.strokeRect(x + .5, y + .5, w, 56); cx.lineWidth = 1;
    cx.fillStyle = '#ECEEF2'; cx.font = '500 24px "M PLUS 1"'; cx.textAlign = 'center'; cx.fillText(r.w.w, x + w / 2, y + 32); cx.textAlign = 'left';
    for (let k = 0; k < 5; k++) { cx.fillStyle = k < Math.ceil(r.mw / 20) ? Y : '#22252B'; cx.fillRect(x + 8 + k * 9, y + 42, 6, 6); }
    cx.fillStyle = '#8A909C'; cx.font = '700 9px Tektur'; cx.fillText(r.mw + ' MW', x + w - 44, y + 48);
  });
  for (const s of SMOKE) { cx.globalAlpha = 1 - s.t / 1.5; cx.fillStyle = '#5A5F68'; for (let k = 0; k < 6; k++) { cx.beginPath(); cx.arc(430 + k * 14, 460 - s.t * 60 - k * 6, 10 + s.t * 20, 0, 7); cx.fill(); } cx.globalAlpha = 1; }
  cx.fillStyle = '#8A909C'; cx.font = '700 9px "M PLUS 1 Code"'; cx.fillText('燃料 FUEL · THE FRONT ROD IS IN THE TYPING BAR', 420, 552);
}
window.__front = () => RODS[0] && RODS[0].w.r;
