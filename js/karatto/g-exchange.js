/* カラット: 取引所, the exchange. News flashes come off the wire: your deck's example sentences with the card's word
   blanked. Fill the blank (1–4) before the rival AI trades on the same news: first takes the whole move, second only
   half; a wrong fill is a bad trade. H shows the English, at half the move. Skill: context. */
import { game, panel, keycaps, esc, clamp, Y, RED, OK, sfx, $ } from './game.js?v=11';

const RIV = [{ n: '黒鉄重工', en: 'Kurogane Heavy', c: '#8A909C', p: 960 }, { n: '白鷺HD', en: 'Shirasagi', c: '#5CFFA0', p: 1200 }];
let cur = null, phase = 'idle', K, gap = 0, hint = false, me = 1000, P0 = 1000, HIST = [], won = 0, lost = 0, late = 0, wire = [], tick0 = 0;
const ruby = s => esc(s).replace(/ ?([^ \[\]⟦⟧&;]+)\[([^\]]+)\]/g, '<ruby>$1<rt>$2</rt></ruby>');
function load(api) {
  const w = api.pick('context', x => x.sent && x.sent.length); if (!w) { cur = null; phase = 'idle'; $('#p-news').innerHTML = '<span class="m">No more sentences in the deck for now.</span>'; return; }
  const s = w.sent[Math.random() * w.sent.length | 0];
  cur = { w, s, opts: api.opts(w, 'form', 'meaning', 4), born: api.t, rT: 6 + Math.random() * 6, rival: RIV[Math.random() * 2 | 0], rDone: false }; hint = false; phase = 'answer';
  const html = ruby(s.jp.replace(/⟦(.+?)⟧/, (_, t) => '§§')).replace('§§', '<span class="blank">？</span>');
  $('#p-news').innerHTML = `<div class="nh"><span>ニュース速報 · BREAKING</span><span id="n-clk"></span></div><div class="sent kj">${html}</div><div class="en" id="n-en">${hint ? esc(s.en) : '<span class="m">H · English hint (halves the move)</span>'}</div>`;
  K.set(cur.opts, 'jp'); sfx('card');
}
function answer(api, i) {
  if (phase !== 'answer' || !cur) return; const o = cur.opts[i]; if (!o) return; K.press(i);
  const ok = o.right; api.record(cur.w, 'context', ok, 'pick');
  cur.opts.forEach((x, k) => x.right && K.mark(k, 'good')); if (!ok) K.mark(i, 'bad');
  let mv;
  if (ok) { mv = (cur.rDone ? .6 : 1.2) * (hint ? .5 : 1); if (cur.rDone) late++; else won++; sfx('coin'); api.log(cur.w.w, cur.rDone ? '文脈 ✓ after ' + cur.rival.n : '文脈 ✓ first', '+' + mv.toFixed(1) + '%', 'y'); }
  else { mv = -1; lost++; sfx('ng'); api.log(cur.w.w, '✗ ' + o.w, '−1.0%', 'r'); }
  me *= 1 + mv / 100; api.G.yen += Math.max(0, Math.round(mv * 60));
  $('.sent .blank').outerHTML = `<span class="blank ${ok ? 'ok' : 'ng'}">${esc(cur.w.w)}</span>`; $('#n-en').innerHTML = esc(cur.s.en || cur.w.s);
  wire.unshift(cur.s.en || cur.w.s); wire = wire.slice(0, 6); $('#p-wire').innerHTML = wire.map(x => `<div class="e"><span>${esc(x)}</span></div>`).join('');
  phase = 'shown'; gap = ok ? 1.8 : 3;
}

game({
  id: 'exchange', site: 'exchange', tier: 3, code: 'EXC-07', jp: '取引所', en: 'Exchange', sub: 'THE TRADING FLOOR · NEWS AGAINST THE RIVALS', title: '立会場', dur: 180,
  skills: ['context'],
  lead: 'News flashes come off the wire: your deck\'s example sentences, the card\'s word blanked. Fill the blank (<span class="key">1</span>–<span class="key">4</span>). Right: the trade goes through and 紅葉重工\'s share moves. The rival AIs trade on the same news on their own clock: answer before them for the whole move, after them for half. Wrong: a bad trade. <span class="key">H</span> shows the English, at half the move.',
  how: [['CONTEXT · 文脈', '文が決める', 'The four choices share a kanji or a field: only the sentence decides.'], ['RIVALS · 競合', '黒鉄重工 · 白鷺HD', 'The rival AIs trade on the news too. Beat their clock.'], ['SHARE · 株価', 'カラット', 'The session\'s move feeds the corporation\'s fame.']],
  stats: [['紅葉重工', 'SHARE', () => `${me.toFixed(0)} ${me >= P0 ? '▲' : '▼'}${Math.abs((me / P0 - 1) * 100).toFixed(1)}%`], ['先行', 'FIRST', () => won], ['¥', '', a => a.G.yen.toLocaleString()]],
  init(api) {
    const css = document.createElement('style'); css.textContent = `
      #p-news { padding:14px 18px; } #p-news .nh { display:flex; justify-content:space-between; font:700 10px var(--mono); letter-spacing:.16em; color:var(--y); margin-bottom:12px; }
      #p-news .sent { font-size:30px; line-height:1.9; } #p-news ruby rt { font-size:11px; }
      #p-news .blank { display:inline-block; min-width:110px; text-align:center; border-bottom:3px solid var(--y); color:var(--y); padding:0 8px; }
      #p-news .blank.ok { color:#000; background:var(--y); } #p-news .blank.ng { color:#fff; background:var(--red); border-color:var(--red); }
      #p-news .en { margin-top:12px; font:500 13px var(--mono); color:#C9CDD6; }`;
    document.head.appendChild(css);
    panel('pn', { x: 300, y: 280, w: 680, h: 262 }, '速報 · THE WIRE · FILL THE BLANK', 'NEWS').id = 'p-news';
    panel('pw', { x: 12, y: 280, w: 276, h: 262 }, '配信 · PAST FLASHES', 'WIRE').id = 'p-wire';
    const lg = panel('pg', { x: 992, y: 280, w: 276, h: 262 }, '取引 · TRADES', 'LOG'); lg.id = 'g-log'; lg.classList.add('log');
    K = keycaps({ x: 240, y: 560, w: 800, h: 140, cols: 2 }, 4, i => answer(api, i));
  },
  start(api) {
    P0 = me = Math.round((api.SAVE.sim && api.SAVE.sim.share) || 1000); RIV.forEach(r => r.p0 = r.p = r.p || 1000); HIST = []; won = lost = late = 0; wire = []; $('#g-log').innerHTML = ''; $('#p-wire').innerHTML = ''; load(api);
  },
  tick(dt, api) {
    if (!api.G.run) return;
    RIV.forEach(r => r.p *= 1 + (Math.random() - .49) * .002);
    if (cur && phase === 'answer') {
      const left = cur.rT - (api.t - cur.born); const ck = $('#n-clk'); if (ck) ck.textContent = left > 0 ? `${cur.rival.n} TRADES IN ${left.toFixed(1)}s` : `${cur.rival.n} HAS TRADED`;
      if (left <= 0 && !cur.rDone) { cur.rDone = true; cur.rival.p *= 1.006; sfx('buzz'); }
    }
    if (phase === 'shown') { gap -= dt; if (gap <= 0) load(api); }
    tick0 += dt; if (tick0 > .25) { tick0 = 0; HIST.push({ me, r: RIV.map(r => r.p) }); if (HIST.length > 400) HIST.shift(); }
  },
  key(e, api) {
    if (/^[1-4]$/.test(e.key)) { answer(api, +e.key - 1); return true; }
    if ((e.key === 'h' || e.key === 'H') && cur && phase === 'answer' && !hint) { hint = true; $('#n-en').innerHTML = esc(cur.s.en || cur.w.s) || '<span class="m">(no translation in the deck)</span>'; return true; }
  },
  end(api) { phase = 'idle'; K.off(); const move = (me / P0 - 1) * 100;
    return { title: move >= 0 ? '大引け · 上昇' : '大引け · 下落', rows: [['紅葉重工', (move >= 0 ? '+' : '') + move.toFixed(1) + '%', move >= 0 ? 'y' : 'r'], ['first to trade', won, 'y'], ['bad trades', lost, lost ? 'r' : '']], effect: { move } }; },
  draw(cx, t, dt, api) {
    cx.fillStyle = '#050607'; cx.fillRect(0, 0, 1280, 720);
    /* the ticker band */
    cx.fillStyle = '#0B0C0E'; cx.fillRect(0, 50, 1280, 26); cx.font = '700 12px "M PLUS 1 Code"';
    const items = [`紅葉重工 ${me.toFixed(0)} ${me >= P0 ? '▲' : '▼'}${Math.abs((me / P0 - 1) * 100).toFixed(1)}%`, ...RIV.map(r => `${r.n} ${r.p.toFixed(0)} ${r.p >= r.p0 ? '▲' : '▼'}${Math.abs((r.p / r.p0 - 1) * 100).toFixed(1)}%`), '為替 151.2', '原油 ▲', '半導体 ▲', '物流指数 ▼', '日経 ▲0.4%'];
    const str = items.join('   ·   ') + '   ·   ', w = cx.measureText(str).width, off = (t * 60) % w;
    for (let x = -off; x < 1280; x += w) { let xx = x; items.forEach((s, i) => { cx.fillStyle = i === 0 ? Y : '#C9CDD6'; cx.fillText(s, xx, 68); xx += cx.measureText(s + '   ·   ').width; }); }
    /* the wall chart */
    const X0 = 40, X1 = 1240, Y0 = 96, Y1 = 262; cx.fillStyle = '#0A0B0D'; cx.fillRect(X0 - 12, Y0 - 8, X1 - X0 + 24, Y1 - Y0 + 16); cx.strokeStyle = '#2A2E36'; cx.strokeRect(X0 - 11.5, Y0 - 7.5, X1 - X0 + 23, Y1 - Y0 + 15);
    if (HIST.length > 1) {
      const norm = (v, base) => v / base - 1, all = HIST.flatMap(h => [norm(h.me, P0), ...h.r.map((v, k) => norm(v, RIV[k].p0))]), lo = Math.min(-.02, ...all), hi = Math.max(.02, ...all);
      const yv = v => Y1 - (v - lo) / (hi - lo) * (Y1 - Y0), xu = i => X0 + i / 399 * (X1 - X0);
      cx.strokeStyle = 'rgba(255,255,255,.08)'; cx.beginPath(); cx.moveTo(X0, yv(0)); cx.lineTo(X1, yv(0)); cx.stroke();
      RIV.forEach((r, k) => { cx.strokeStyle = r.c; cx.globalAlpha = .7; cx.lineWidth = 1.5; cx.beginPath(); HIST.forEach((h, i) => cx.lineTo(xu(i), yv(norm(h.r[k], r.p0)))); cx.stroke(); cx.globalAlpha = 1; });
      cx.strokeStyle = Y; cx.lineWidth = 2.5; cx.shadowColor = Y; cx.shadowBlur = 8; cx.beginPath(); HIST.forEach((h, i) => cx.lineTo(xu(i), yv(norm(h.me, P0)))); cx.stroke(); cx.shadowBlur = 0; cx.lineWidth = 1;
    }
    cx.font = '700 10px "M PLUS 1 Code"'; cx.fillStyle = Y; cx.fillText('■ 紅葉重工', X0, Y0 + 8); RIV.forEach((r, k) => { cx.fillStyle = r.c; cx.fillText(`■ ${r.n} (rival AI)`, X0 + 100 + k * 190, Y0 + 8); });
    cx.fillStyle = '#8A909C'; cx.fillText('株価 · SHARE PRICE · THIS SESSION', X1 - 230, Y0 + 8);
  }
});
window.__cur = () => cur && cur.opts.findIndex(o => o.right);
