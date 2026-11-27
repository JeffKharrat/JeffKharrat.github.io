/* カラット: 物流センター, Logistics. The district on the dispatch table, seen from above: nine shops on a 3×3 grid
   (laid out like the numpad), their signs words from the deck. Order slips give a destination as a reading (skill
   reading) or a meaning (skill recall); pick the shop (click it or its numpad key) and a free truck drives the route.
   A wrong shop is a misdelivery: the truck goes there and back for nothing, and that skill's evidence is wiped. */
import { game, panel, esc, clamp, ease, Y, RED, OK, sfx, $, overlap } from './game.js?v=6';

const COLS = [400, 640, 880], ROWS = [150, 310, 470], VX = [520, 520, 760], DEP = { x: 640, y: 616 };
const shopPos = n => ({ c: n % 3, r: 2 - Math.floor(n / 3) });                       // numpad: 1 2 3 bottom row, 7 8 9 top
const center = n => { const { c, r } = shopPos(n); return { x: COLS[c], y: ROWS[r] }; };
let SH = [], ORD = [], TR = [], FX = [], PEDS = [], sel = 0, spawnT = 0, st = { del: 0, mis: 0, late: 0 };

function route(n) {
  const { c, r } = shopPos(n), x = COLS[c], y = ROWS[r] + 80, vx = VX[c];
  return [{ x: DEP.x, y: DEP.y }, { x: vx, y: DEP.y }, { x: vx, y }, { x, y }];
}
const plen = P => P.slice(1).reduce((s, p, i) => s + Math.hypot(p.x - P[i].x, p.y - P[i].y), 0);
function along(P, d) { for (let i = 1; i < P.length; i++) { const L = Math.hypot(P[i].x - P[i - 1].x, P[i].y - P[i - 1].y); if (d <= L) { const u = d / L; return { x: P[i - 1].x + (P[i].x - P[i - 1].x) * u, y: P[i - 1].y + (P[i].y - P[i - 1].y) * u, a: Math.atan2(P[i].y - P[i - 1].y, P[i].x - P[i - 1].x) }; } d -= L; } const l = P[P.length - 1]; return { ...l, a: 0 }; }

/* sign the district: nine deck words, no two that sound alike or mean the same */
function signAll(api) { SH = []; for (let n = 0; n < 9; n++) SH.push({ w: null, flip: 0 }); for (let n = 0; n < 9; n++) resign(api, n, true); }
function resign(api, n, quiet) {
  const used = new Set(SH.filter((s, i) => i !== n && s.w).map(s => s.w.w)), rd = new Set(SH.filter((s, i) => i !== n && s.w).map(s => s.w.r)), mn = new Set(SH.filter((s, i) => i !== n && s.w).map(s => s.w.s.toLowerCase()));
  const others = SH.filter((s, i) => i !== n && s.w).map(s => s.w), okw = w => !used.has(w.w) && !rd.has(w.r) && !mn.has(w.s.toLowerCase()) && w.w.length <= 4 && !others.some(o => overlap(o.m, w.m));
  const w = api.pick('reading', okw) || api.pick('recall', okw) || api.MEM.filter(okw)[Math.random() * 50 | 0] || api.words.filter(okw)[0];
  SH[n] = { w, flip: quiet ? 0 : 1 };
}
function newOrder(api) {
  const busy = new Set(ORD.map(o => o.n).concat(TR.filter(t => t.o).map(t => t.o.n)));
  const cand = SH.map((s, n) => ({ s, n })).filter(({ s, n }) => s.w && !busy.has(n) && !api.isMem(s.w) && (!api.G.tried.has('reading' + s.w.id) || !api.G.tried.has('recall' + s.w.id)));
  if (!cand.length) return;
  const { s, n } = cand[Math.random() * cand.length | 0], tr = api.G.tried;
  const skill = tr.has('reading' + s.w.id) ? 'recall' : tr.has('recall' + s.w.id) ? 'reading' : Math.random() < .5 ? 'reading' : 'recall';
  ORD.push({ n, w: s.w, skill, born: api.t, T: 34 * (api.tech.fleet ? 1.25 : 1), fee: 120 + (5 - (s.w.lvl || 3)) * 30 + Math.round(Math.random() * 6) * 10, id: Math.random() });
  sfx('card'); slips(api);
}
function slips(api) {
  const P = $('#p-ord'); sel = clamp(sel, 0, Math.max(0, ORD.length - 1));
  P.innerHTML = ORD.map((o, i) => { const left = Math.max(0, o.T - (api.t - o.born));
    return `<div class="slip${i === sel ? ' on' : ''}" data-i="${i}"><div class="sh"><span>伝票 #${String(Math.floor(o.id * 9000 + 1000))}</span><span>${o.skill === 'reading' ? '読み READING' : '意味 MEANING'}</span></div>
      <div class="dest ${o.skill === 'reading' ? 'kj' : 'en'}">${esc(o.skill === 'reading' ? o.w.r : o.w.s)}</div>
      <div class="sf"><span>¥${o.fee}</span><span class="tm"><s style="width:${left / o.T * 100}%"></s></span><span>${Math.ceil(left)}s</span></div></div>`; }).join('') || '<div class="m" style="padding:10px 4px">待機中 · waiting for orders</div>';
  P.querySelectorAll('.slip').forEach(d => d.onclick = () => { sel = +d.dataset.i; slips(api); });
}
function fleet(api) {
  $('#p-fleet').innerHTML = TR.map((t, i) => `<div class="tr"><b>${i + 1}</b><span>${t.st === 'idle' ? '<span class="m">待機 idle</span>' : t.st === 'out' ? `<span class="y">配送中 → ${esc(SH[t.o.n].w.w)}</span>` : t.st === 'back' ? '帰庫 returning' : '<span class="y">荷下ろし unloading</span>'}</span></div>`).join('');
}
function dispatch(api, n) {
  const o = ORD[sel]; if (!o) return api.toast('No order selected');
  const t = TR.find(t => t.st === 'idle'); if (!t) { sfx('buzz'); return api.toast('全車出動中 · every truck is out'); }
  const ok = SH[n].w && SH[n].w.w === o.w.w;
  api.record(o.w, o.skill, ok, 'pick');
  ORD.splice(sel, 1); o.dest = n; o.ok = ok; o.disp = api.t;
  Object.assign(t, { st: 'out', o, P: route(n), d: 0 }); t.L = plen(t.P);
  if (!ok) { api.log(o.w.w, o.skill === 'reading' ? '読み ✗' : '意味 ✗', 'misdelivery', 'r'); FX.push({ k: 'right', n: SH.findIndex(s => s.w && s.w.w === o.w.w), t: 0 }); sfx('ng'); api.toast(`誤配送 · it was ${o.w.w} (${o.w.r}, ${o.w.s})`, 3000); }
  else sfx('up');
  slips(api); fleet(api);
}

game({
  id: 'log', site: 'logistics', tier: 0, code: 'LOG-02', jp: '物流センター', en: 'Logistics', sub: 'DISPATCH ROOM ABOVE THE DEPOT', title: '配送指令室', dur: 180,
  skills: ['reading', 'recall'],
  lead: 'Order slips come in on the left: a destination given as a <b>reading</b> or a <b>meaning</b>, with a time window and a fee. Find the shop whose sign is that word and press its numpad key (or click it). A free truck takes the route. A wrong shop is a misdelivery: the trip is wasted and that skill\'s evidence for the word is wiped.',
  how: [['READING · 読み', '読み → 看板', 'The slip shows the reading: find the written word on the signs.'], ['MEANING · 意味', '意味 → 看板', 'The slip shows the meaning: find the word it names.'], ['FLEET · 車両', '三台の車', 'Three trucks. Tab switches slips; late deliveries pay half. The district is re-signed as you go.']],
  stats: [['配達', 'DEL', () => st.del], ['誤配', 'MIS', () => st.mis], ['¥', '', a => a.G.yen.toLocaleString()]],
  shop: [{ id: 'truck4', name: '四台目', en: 'A fourth truck', cost: 700, d: 'One more truck in the fleet.' }, { id: 'fast', name: '高速トラック', en: 'Faster trucks', cost: 600, d: 'Trucks drive a third faster.' }, { id: 'longer', name: 'シフト延長', en: 'Longer shift', cost: 500, d: 'Shifts run 4 minutes.' }],
  init(api) {
    const css = document.createElement('style'); css.textContent = `
      .slip { border:1px solid var(--line2); background:#0A0B0D; margin-bottom:8px; padding:7px 9px; cursor:pointer; animation:drop .35s both; }
      .slip.on { border-color:var(--y); box-shadow:inset 3px 0 0 var(--y); }
      .slip .sh { display:flex; justify-content:space-between; font:700 9px var(--mono); letter-spacing:.12em; color:var(--mute); }
      .slip .dest { margin:6px 0 4px; text-align:center; } .slip .dest.kj { font-size:27px; } .slip .dest.en { font:700 15px/1.3 var(--mono); }
      .slip .sf { display:flex; gap:8px; align-items:center; font:700 11px var(--num); } .slip .tm { flex:1; height:4px; background:#1A1C21; position:relative; } .slip .tm s { position:absolute; left:0; top:0; bottom:0; background:var(--y); }
      .tr { display:flex; gap:10px; padding:4px 0; border-bottom:1px solid #15171B; font-size:11.5px; } .tr b { font:700 13px var(--num); width:16px; } .tr .kj { font-size:13px; }`;
    document.head.appendChild(css);
    panel('pl', { x: 12, y: 62, w: 236, h: 520 }, '伝票 · ORDERS', 'ORD').id = 'p-ord';
    panel('pf', { x: 1032, y: 62, w: 236, h: 160 }, '車両 · FLEET', 'FLT').id = 'p-fleet';
    const lg = panel('pg', { x: 1032, y: 232, w: 236, h: 350 }, '記録 · LOG', 'LOG'); lg.id = 'g-log'; lg.classList.add('log');
    panel('ph', { x: 12, y: 592, w: 236, h: 116 }, '操作 · CONTROLS', 'KEY').innerHTML = '<span class="key">NUM 1–9</span> send to that shop<br><span class="key">Tab</span> next slip<br>click a slip, then a shop';
    for (let i = 0; i < 40; i++) PEDS.push({ s: Math.random() * 4000, v: 18 + Math.random() * 20, lane: i % 6 });
    signAll(api);
    api.cx.canvas.addEventListener('click', e => { if (!api.G.run) return; const r = api.cx.canvas.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * 1280, y = (e.clientY - r.top) / r.height * 720;
      for (let n = 0; n < 9; n++) { const c = center(n); if (Math.abs(x - c.x) < 95 && Math.abs(y - c.y) < 60) return dispatch(api, n); } });
  },
  start(api) {
    signAll(api); ORD = []; FX = []; sel = 0; spawnT = 1; st = { del: 0, mis: 0, late: 0 };
    TR = Array.from({ length: api.U.truck4 ? 4 : 3 }, (_, i) => ({ st: 'idle', i })); newOrder(api); fleet(api); $('#g-log').innerHTML = '';
  },
  tick(dt, api) {
    if (!api.G.run) return;
    spawnT -= dt; if (spawnT <= 0 && ORD.length < 3) { newOrder(api); spawnT = 6; }
    for (const o of ORD.slice()) if (api.t - o.born > o.T) { ORD.splice(ORD.indexOf(o), 1); st.late++; api.log(o.w.w, '期限切れ', 'expired', 'm'); slips(api); }
    if (Math.floor(api.t * 4) !== Math.floor((api.t - dt) * 4)) slips(api);
    const sp = api.U.fast ? 400 : 300;
    for (const t of TR) {
      if (t.st === 'out') { t.d += sp * dt; if (t.d >= t.L) { t.d = t.L; t.st = 'drop'; t.wait = .6; arrive(api, t); } }
      else if (t.st === 'drop') { t.wait -= dt; if (t.wait <= 0) { t.st = 'back'; t.d = 0; t.P = t.P.slice().reverse(); fleet(api); } }
      else if (t.st === 'back') { t.d += sp * dt; if (t.d >= t.L) { t.st = 'idle'; t.o = null; fleet(api); } }
    }
    for (const s of SH) if (s.flip > 0) s.flip = Math.max(0, s.flip - dt * 2);
    FX = FX.filter(f => (f.t += dt) < 1.6);
  },
  key(e, api) {
    if (/^[1-9]$/.test(e.key)) { dispatch(api, +e.key - 1); return true; }
    if (e.key === 'Tab') { sel = ORD.length ? (sel + 1) % ORD.length : 0; slips(api); return true; }
  },
  end(api) {
    return { title: st.del >= 10 ? '配送完了' : '業務終了', rows: [['delivered', st.del, 'y'], ['misdelivered', st.mis, st.mis ? 'r' : ''], ['expired', st.late]], effect: { delivered: st.del } };
  },
  draw(cx, t, dt, api) { scene(cx, t, api); }
});
function arrive(api, t) {
  const o = t.o, c = center(o.dest);
  if (o.ok) { const late = api.t - o.born > o.T, fee = late ? Math.round(o.fee / 2) : o.fee; api.G.yen += fee; st.del++; FX.push({ k: 'pay', n: o.dest, t: 0, txt: '+¥' + fee }); sfx('coin'); api.log(o.w.w, o.skill === 'reading' ? '読み ✓' : '意味 ✓', '+¥' + fee, 'y');
    if (Math.random() < .55) setTimeout(() => resign(api, o.dest), 700); }
  else { st.mis++; FX.push({ k: 'miss', n: o.dest, t: 0 }); }
  fleet(api);
}

/* ---------------- the table display ---------------- */
function scene(cx, t, api) {
  cx.fillStyle = '#060708'; cx.fillRect(0, 0, 1280, 720);
  /* the table: a dark glass top, a fine grid, the district */
  const g = cx.createRadialGradient(640, 360, 100, 640, 360, 640); g.addColorStop(0, '#0E1013'); g.addColorStop(1, '#050506'); cx.fillStyle = g; cx.fillRect(258, 56, 764, 660);
  cx.strokeStyle = 'rgba(255,230,0,.05)'; cx.lineWidth = 1; cx.beginPath(); for (let x = 260; x < 1022; x += 20) { cx.moveTo(x + .5, 58); cx.lineTo(x + .5, 714); } for (let y = 60; y < 716; y += 20) { cx.moveTo(260, y + .5); cx.lineTo(1020, y + .5); } cx.stroke();
  /* streets */
  cx.fillStyle = '#16181C';
  for (const y of [70, 230, 390, 550]) cx.fillRect(270, y - 9, 740, 18);
  for (const x of [280, 520, 760, 1000]) cx.fillRect(x - 9, 61, 18, 498);
  cx.fillRect(270, DEP.y - 9, 740, 18); cx.fillRect(511, 550, 18, 66); cx.fillRect(751, 550, 18, 66); cx.fillRect(631, 550, 18, 66);
  cx.strokeStyle = 'rgba(255,255,255,.12)'; cx.setLineDash([8, 10]); cx.beginPath();
  for (const y of [70, 230, 390, 550, DEP.y]) { cx.moveTo(270, y); cx.lineTo(1010, y); } for (const x of [280, 520, 760, 1000]) { cx.moveTo(x, 61); cx.lineTo(x, 559); } cx.stroke(); cx.setLineDash([]);
  /* people on the pavements */
  cx.fillStyle = 'rgba(236,238,242,.55)';
  for (const p of PEDS) { p.s += p.v * (1 / 60); const L = 740, y = [70, 230, 390, 550, 70, 390][p.lane] + (p.lane > 3 ? -12 : 12), x = 270 + (p.lane % 2 ? L - (p.s % L) : p.s % L); cx.fillRect(x, y, 2, 2); }
  /* the shops */
  const act = ORD[sel];
  for (let n = 0; n < 9; n++) {
    const c = center(n), s = SH[n], w = 180, h = 92, x0 = c.x - w / 2, y0 = c.y - h / 2 - 6;
    cx.fillStyle = 'rgba(0,0,0,.5)'; cx.fillRect(x0 + 6, y0 + 8, w, h);
    cx.fillStyle = '#1C1F25'; cx.fillRect(x0, y0, w, h); cx.fillStyle = '#23272E'; cx.fillRect(x0 + 6, y0 + 6, w - 12, h - 34);
    for (let k = 0; k < 4; k++) { cx.fillStyle = '#15171B'; cx.fillRect(x0 + 14 + k * 40, y0 + 12, 26, 14); }          // rooftop units
    /* the sign: a lit plate along the front */
    const flip = s.flip, sy = y0 + h - 30;
    cx.save(); cx.translate(c.x, sy + 13); cx.scale(1, Math.abs(Math.cos(flip * Math.PI)) || .02);
    cx.fillStyle = '#F2EEDF'; cx.fillRect(-w / 2 + 6, -13, w - 12, 26);
    cx.fillStyle = '#111'; cx.font = '500 22px "M PLUS 1"'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(s.w ? s.w.w : '—', 0, 1); cx.restore();
    cx.fillStyle = Y; cx.fillRect(x0, y0, 22, 18); cx.fillStyle = '#000'; cx.font = '700 12px Tektur'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(n + 1, x0 + 11, y0 + 10);
    cx.textAlign = 'left'; cx.textBaseline = 'alphabetic';
    if (act && api.G.run) { cx.strokeStyle = 'rgba(255,230,0,.18)'; cx.strokeRect(x0 - .5, y0 - .5, w + 1, h + 1); }
  }
  /* the depot */
  cx.fillStyle = '#121418'; cx.fillRect(560, 632, 160, 66); cx.strokeStyle = '#3A3F48'; cx.strokeRect(560.5, 632.5, 160, 66);
  for (let i = 0; i < 4; i++) { cx.fillStyle = i % 2 ? '#FFE600' : '#111'; cx.fillRect(560 + i * 40, 632, 40, 4); }
  cx.fillStyle = '#8A909C'; cx.font = '700 9px "M PLUS 1 Code"'; cx.fillText('DEPOT // 車庫', 566, 694);
  /* routes and trucks */
  for (const tr of TR) {
    if (tr.st === 'idle') { const x = 588 + tr.i * 34, y = 662; truck(cx, x, y, -Math.PI / 2, false); continue; }
    const out = tr.st === 'out' || tr.st === 'drop', P = tr.P, d = tr.st === 'drop' ? tr.L : tr.d;
    cx.strokeStyle = out ? (tr.o.ok ? 'rgba(255,230,0,.8)' : 'rgba(255,59,48,.8)') : 'rgba(236,238,242,.25)'; cx.lineWidth = 2; cx.setLineDash([6, 6]); cx.lineDashOffset = -t * 30;
    cx.beginPath(); let acc = 0; cx.moveTo(P[0].x, P[0].y); for (let i = 1; i < P.length; i++) { const L = Math.hypot(P[i].x - P[i - 1].x, P[i].y - P[i - 1].y); if (acc + L >= d) { const u = (d - acc) / L; cx.lineTo(P[i - 1].x + (P[i].x - P[i - 1].x) * u, P[i - 1].y + (P[i].y - P[i - 1].y) * u); break; } cx.lineTo(P[i].x, P[i].y); acc += L; } cx.stroke(); cx.setLineDash([]);
    const p = along(P, d); truck(cx, p.x, p.y, p.a, true);
  }
  /* effects */
  for (const f of FX) {
    const c = center(f.n < 0 ? 0 : f.n), u = f.t / 1.6;
    if (f.k === 'pay') { cx.globalAlpha = 1 - u; cx.fillStyle = Y; cx.font = '700 22px Tektur'; cx.textAlign = 'center'; cx.fillText(f.txt, c.x, c.y - 60 - u * 30); cx.textAlign = 'left'; cx.globalAlpha = 1; }
    if (f.k === 'miss') { cx.globalAlpha = 1 - u; cx.strokeStyle = RED; cx.lineWidth = 4; cx.beginPath(); cx.moveTo(c.x - 26, c.y - 26); cx.lineTo(c.x + 26, c.y + 26); cx.moveTo(c.x + 26, c.y - 26); cx.lineTo(c.x - 26, c.y + 26); cx.stroke(); cx.globalAlpha = 1; cx.lineWidth = 1; }
    if (f.k === 'right' && f.n >= 0) { cx.globalAlpha = (1 - u) * (.6 + .4 * Math.sin(t * 20)); cx.strokeStyle = Y; cx.lineWidth = 3; cx.strokeRect(c.x - 95, c.y - 58, 190, 104); cx.fillStyle = Y; cx.font = '700 10px "M PLUS 1 Code"'; cx.fillText('正解 // CORRECT', c.x - 92, c.y - 62); cx.globalAlpha = 1; cx.lineWidth = 1; }
  }
  /* vignette */
  const v = cx.createRadialGradient(640, 380, 300, 640, 380, 760); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.55)'); cx.fillStyle = v; cx.fillRect(0, 0, 1280, 720);
}
function truck(cx, x, y, a, lit) {
  cx.save(); cx.translate(x, y); cx.rotate(a);
  if (lit) { const g = cx.createRadialGradient(18, 0, 0, 18, 0, 40); g.addColorStop(0, 'rgba(255,240,180,.35)'); g.addColorStop(1, 'rgba(255,240,180,0)'); cx.fillStyle = g; cx.beginPath(); cx.moveTo(10, 0); cx.lineTo(50, -16); cx.lineTo(50, 16); cx.fill(); }
  cx.fillStyle = '#E8E3D2'; cx.fillRect(-14, -7, 20, 14); cx.fillStyle = Y; cx.fillRect(6, -7, 8, 14); cx.fillStyle = '#111'; cx.fillRect(9, -5, 3, 10);
  cx.restore();
}
