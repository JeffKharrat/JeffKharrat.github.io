/* カラット: 研究所, the R&D lab. An intercepted word resolves cell by cell on the holo table. Buzz (Space) the
   moment you recognise it, then pick its meaning (1–4): the earlier the buzz, the more research. A wrong buzz costs
   more than waiting. Research buys techs that change the other buildings. Skill: meaning (form recognition). */
import { game, panel, keycaps, esc, clamp, Y, RED, OK, sfx, $ } from './game.js?v=17';

const CW = 9, GW = 72, GH = 38, REVEAL = 8;
let cur = null, cells = [], order = [], phase = 'idle', tt = 0, res = 0, hits = 0, miss = 0, K, RAIN = [], gap = 0;
const TECH = [
  { id: 'auto1', j: '自動化 I', en: 'Automation I', cost: 300, d: 'Robots work 15% more (the planet).' },
  { id: 'fire', j: '防壁', en: 'Firewall', cost: 250, d: 'Breach encryption runs 30% slower (保安部).' },
  { id: 'fleet', j: '配車計画', en: 'Fleet planning', cost: 200, d: 'Order windows last 25% longer (物流).' }];
const off = document.createElement('canvas'); off.width = GW * CW; off.height = GH * CW; const oc = off.getContext('2d', { willReadFrequently: true });

function load(api) {
  const w = api.pick('meaning') || api.pick('meaning', () => true, api.MEM); if (!w) { phase = 'idle'; cur = null; return; }
  cur = { w, opts: api.opts(w, 'meaning', '', 4) };
  oc.clearRect(0, 0, off.width, off.height); oc.fillStyle = '#fff'; oc.textAlign = 'center'; oc.textBaseline = 'middle';
  const fs = Math.min(300, (off.width - 40) / Math.max(1, [...w.w].length)); oc.font = `500 ${fs}px "M PLUS 1"`; oc.fillText(w.w, off.width / 2, off.height / 2 + 6);
  const img = oc.getImageData(0, 0, off.width, off.height).data; cells = [];
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) { let s = 0; for (let y = 0; y < CW; y += 3) for (let x = 0; x < CW; x += 3) s += img[((j * CW + y) * off.width + i * CW + x) * 4 + 3]; if (s / (9 * 255) > .28) cells.push({ i, j, on: 0 }); }
  order = cells.map((_, n) => n).sort(() => Math.random() - .5); tt = 0; phase = 'reveal'; K.off(); sfx('card');
}
const frac = () => clamp(tt / REVEAL, 0, 1), mult = () => Math.max(.5, 3 - 2.5 * frac());
function buzz(api) { if (phase !== 'reveal' || !cur) return; phase = 'answer'; K.set(cur.opts, 'en'); sfx('beep'); }
function answer(api, i) {
  if (phase !== 'answer' || !cur) return; const o = cur.opts[i]; if (!o) return; K.press(i);
  const ok = o.right, m = mult(); api.record(cur.w, 'meaning', ok, 'pick');
  cur.opts.forEach((x, n) => x.right && K.mark(n, 'good')); if (!ok) K.mark(i, 'bad');
  if (ok) { const g = api.pay(40 * m); res += g; hits++; api.G.yen += Math.round(g / 2); sfx('ok'); api.log(cur.w.w, `${Math.round(frac() * 100)}% ×${m.toFixed(1)}`, '+' + g, 'y'); }
  else { res = Math.max(0, res - 30); miss++; sfx('ng'); api.log(cur.w.w, '✗ ' + cur.w.s, '−30', 'r'); }
  phase = 'shown'; tt = REVEAL; gap = ok ? 1.1 : 2.2; order.forEach(n => cells[n].on = 1); side(api);
}
function side(api) {
  const R0 = (api.SAVE.corp.research || 0);
  $('#p-res').innerHTML = `<div class="lb">THIS SHIFT</div><div style="font:700 40px Tektur;color:var(--y)">+${res}</div><div class="lb" style="margin-top:6px">STOCK · ${Math.floor(R0)} 研究</div><div class="lb" style="margin-top:4px">HITS ${hits} · MISSES ${miss}</div>`;
  const T = api.SAVE.corp.tech = api.SAVE.corp.tech || {};
  $('#p-tech').innerHTML = TECH.map(t => `<button type="button" class="tech${T[t.id] ? ' own' : ''}" data-t="${t.id}" ${T[t.id] || R0 < t.cost || api.preview ? 'disabled' : ''}><b class="kj">${t.j}</b><span>${t.en}</span><em>${T[t.id] ? 'OWNED' : t.cost + ' 研究'}</em><small>${t.d}</small></button>`).join('');
  $('#p-tech').querySelectorAll('[data-t]').forEach(b => b.onclick = () => { const t = TECH.find(x => x.id === b.dataset.t); if (T[t.id] || api.SAVE.corp.research < t.cost) return; api.SAVE.corp.research -= t.cost; T[t.id] = 1; api.persist(); sfx('coin'); side(api); });
}

game({
  id: 'lab', site: 'lab', tier: 2, code: 'LAB-05', jp: '研究所', en: 'R&D lab', sub: 'THE DECRYPTION TABLE · THE TECH TREE', title: '復号室', dur: 120,
  skills: ['meaning'],
  lead: 'An intercepted word resolves on the table, cell by cell, over eight seconds. Buzz (<span class="key">Space</span>) as soon as you recognise its shape, then pick its meaning (<span class="key">1</span>–<span class="key">4</span>). The earlier the buzz, the bigger the multiplier. A wrong buzz costs more than a late one, so buzz when you\'re sure. Research buys techs (right).',
  how: [['BUZZ · 解答', 'Space で止める', 'The multiplier falls from ×3 to ×0.5 as the word resolves.'], ['MEANING · 意味', '四択', 'Four meanings, none of them a synonym of the right one.'], ['TECH · 技術', '研究を使う', 'Automation, firewalls, fleet planning: research changes the other buildings.']],
  stats: [['研究', 'RESEARCH', () => '+' + res], ['命中', 'HITS', () => hits], ['¥', '', a => a.G.yen.toLocaleString()]],
  init(api) {
    const css = document.createElement('style'); css.textContent = `
      .tech { display:block; width:100%; text-align:left; background:#0B0C0E; border:1px solid var(--line2); color:var(--ink); padding:9px 10px; margin-bottom:8px; cursor:pointer; font:500 11px var(--mono); }
      .tech b { font-size:16px; display:block; } .tech span { color:var(--mute); } .tech em { float:right; font-style:normal; font:700 11px Tektur; color:var(--y); margin-top:-18px; } .tech small { display:block; color:#B8BCC6; margin-top:4px; }
      .tech.own { border-color:var(--y); } .tech:disabled:not(.own) { opacity:.45; cursor:default; } .tech:hover:not(:disabled) { border-color:var(--y); }`;
    document.head.appendChild(css);
    panel('pr', { x: 12, y: 62, w: 210, h: 150 }, '研究 · RESEARCH', 'RES').id = 'p-res';
    const lg = panel('pg', { x: 12, y: 222, w: 210, h: 300 }, '記録 · LOG', 'LOG'); lg.id = 'g-log'; lg.classList.add('log');
    panel('pt', { x: 1058, y: 62, w: 210, h: 460 }, '技術系統 · TECH TREE', 'TEC').id = 'p-tech';
    K = keycaps({ x: 240, y: 560, w: 800, h: 140, cols: 2 }, 4, i => answer(api, i));
    for (let i = 0; i < 70; i++) RAIN.push({ x: Math.random() < .5 ? 240 + Math.random() * 60 : 980 + Math.random() * 60, y: Math.random() * 720, v: 40 + Math.random() * 120, c: String.fromCharCode(0x30A0 + Math.random() * 96 | 0) });
    side(api);
  },
  start(api) { res = 0; hits = 0; miss = 0; $('#g-log').innerHTML = ''; side(api); load(api); },
  tick(dt, api) {
    RAIN.forEach(r => { r.y += r.v * dt; if (r.y > 720) { r.y = -10; r.c = String.fromCharCode(0x30A0 + Math.random() * 96 | 0); } });
    if (!api.G.run || !cur) return;
    if (phase === 'reveal') { tt += dt; const n = Math.floor(frac() * order.length); for (let k = 0; k < n; k++) cells[order[k]].on = Math.min(1, cells[order[k]].on + dt * 5); if (tt > REVEAL + 3) { phase = 'shown'; gap = 1.6; api.log(cur.w.w, 'timeout', '—', 'm'); K.set(cur.opts, 'en'); cur.opts.forEach((x, k) => x.right && K.mark(k, 'good')); } }
    else if (phase === 'shown') { gap -= dt; if (gap <= 0) load(api); }
  },
  key(e, api) {
    if (e.key === ' ') { buzz(api); return true; }
    if (/^[1-4]$/.test(e.key)) { answer(api, +e.key - 1); return true; }
  },
  end(api) {
    phase = 'idle'; K.off();
    if (!api.preview && !(api.SAVE.sim && api.SAVE.sim.v === 2)) api.SAVE.corp.research = (api.SAVE.corp.research || 0) + res;
    return { title: '解析完了', rows: [['research', '+' + res, 'y'], ['hits', hits, 'y'], ['wrong buzzes', miss, miss ? 'r' : '']], effect: { research: res } };
  },
  draw(cx, t, dt, api) {
    cx.fillStyle = '#050607'; cx.fillRect(0, 0, 1280, 720);
    cx.font = '500 12px "M PLUS 1 Code"'; RAIN.forEach(r => { cx.fillStyle = `rgba(255,230,0,${.06 + .1 * (r.v / 160)})`; cx.fillText(r.c, r.x, r.y); });
    /* the holo table: a trapezoid, cells projected on it */
    const P = (u, v) => { const y = 120 + v * 380, s = .72 + .28 * v; return { x: 640 + (u - .5) * 720 * s, y }; };
    cx.beginPath(); const a = P(0, 0), b = P(1, 0), c = P(1, 1), d = P(0, 1); cx.moveTo(a.x, a.y); cx.lineTo(b.x, b.y); cx.lineTo(c.x, c.y); cx.lineTo(d.x, d.y); cx.closePath();
    cx.fillStyle = 'rgba(255,230,0,.03)'; cx.fill(); cx.strokeStyle = 'rgba(255,230,0,.35)'; cx.stroke();
    cx.strokeStyle = 'rgba(255,230,0,.06)'; cx.beginPath(); for (let i = 0; i <= GW; i += 4) { const p = P(i / GW, 0), q = P(i / GW, 1); cx.moveTo(p.x, p.y); cx.lineTo(q.x, q.y); } for (let j = 0; j <= GH; j += 2) { const p = P(0, j / GH), q = P(1, j / GH); cx.moveTo(p.x, p.y); cx.lineTo(q.x, q.y); } cx.stroke();
    if (cur) {
      const shown = phase === 'shown' || phase === 'answer';
      for (const ce of cells) { if (ce.on <= 0) continue; const p = P(ce.i / GW, ce.j / GH), q = P((ce.i + 1) / GW, (ce.j + 1) / GH); cx.fillStyle = `rgba(255,${230 + 25 * ce.on | 0},${120 * ce.on | 0},${.3 + .7 * ce.on})`; cx.fillRect(p.x + .5, p.y + .5, q.x - p.x - 1, q.y - p.y - 1); }
      if (phase === 'reveal') for (let k = 0; k < 40; k++) { const i = Math.random() * GW | 0, j = Math.random() * GH | 0, p = P(i / GW, j / GH), q = P((i + 1) / GW, (j + 1) / GH); cx.fillStyle = `rgba(255,230,0,${.12 * (1 - frac())})`; cx.fillRect(p.x, p.y, q.x - p.x - 1, q.y - p.y - 1); }
      /* scan line */
      const sv = (t * .45) % 1, s0 = P(0, sv), s1 = P(1, sv); cx.strokeStyle = 'rgba(255,240,150,.5)'; cx.beginPath(); cx.moveTo(s0.x, s0.y); cx.lineTo(s1.x, s1.y); cx.stroke();
      /* the multiplier */
      const m = phase === 'reveal' ? mult() : 0; cx.fillStyle = '#16181C'; cx.fillRect(340, 516, 600, 8); cx.fillStyle = phase === 'reveal' ? Y : '#3A3F48'; cx.fillRect(340, 516, 600 * (1 - frac()), 8);
      cx.fillStyle = '#8A909C'; cx.font = '700 10px "M PLUS 1 Code"'; cx.fillText(`復号 DECRYPT ${Math.round(frac() * 100)}%`, 340, 545);
      cx.textAlign = 'right'; cx.fillStyle = phase === 'reveal' ? Y : '#8A909C'; cx.font = '700 22px Tektur'; cx.fillText(phase === 'reveal' ? `×${m.toFixed(1)} RESEARCH IF YOU BUZZ NOW` : phase === 'answer' ? 'BUZZED · PICK ITS MEANING 1–4' : '', 940, 548); cx.textAlign = 'left';
      if (phase === 'shown') { cx.fillStyle = '#ECEEF2'; cx.font = '500 16px "M PLUS 1 Code"'; cx.textAlign = 'center'; cx.fillText(`${cur.w.w} · ${cur.w.r} · ${cur.w.s}`, 640, 100); cx.textAlign = 'left'; }
      if (phase === 'reveal') { cx.fillStyle = '#ECEEF2'; cx.font = '700 11px "M PLUS 1 Code"'; cx.textAlign = 'center'; cx.fillText('BUZZ  [ SPACE ]', 640, 100); cx.textAlign = 'left'; }
    }
    cx.fillStyle = '#8A909C'; cx.font = '700 9px "M PLUS 1 Code"'; cx.fillText('INTERCEPT // 傍受信号 // HOLO TABLE 02', 260, 80);
  }
});
window.__cur = () => cur && cur.opts.findIndex(o => o.right);
