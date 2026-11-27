/* 紅葉重工: 侵入, the intrusion. カラット breaks into a rival megacorporation's network in real time. Their structure is a
   map of nodes (gateways, firewalls, data vaults, ICE, their core); every node is locked by a word: type its reading
   for walls and gates, pick its meaning for vaults and ICE. Meanwhile their AI traces you, patches nodes behind your
   back and sends hunters down your path. Money buys the entry and proxies, Data buys zero-days and decoys. Reach the
   core and breach it: their money and data are yours, and they will remember. Traced at 100%: disconnected.
   Skills: reading (typed), meaning. */
import { game, panel, typer, keycaps, sameReading, esc, clamp, Y, RED, OK, sfx, $ } from './game.js?v=10';
import { RIVALS, IDS, rivOf, costs, canStart, pay, settleRaid, lootOf, defOf, TOOLS } from './rivals.js?v=10';
import { spendable } from './gov.js?v=10';
import { drawLeaf } from './leaf.js?v=10';

const QS = new URLSearchParams(location.search);
let TGT = IDS.includes(QS.get('target')) ? QS.get('target') : 'kurogane', KIT = { proxy: 1, zero: 0, decoy: 0 };
let N = [], E = [], SEL = 0, cur = null, trace = 0, HUNT = [], FX = [], phase = 'idle', iceT = 0, huntT = 0, patchT = 0, said = {}, outcome = null, T, K, D = 3, run = { nodes: 0, vaults: 0 };
const rb = s => esc(s).replace(/\[([^|\]]+)\|([^\]]+)\]/g, '<ruby>$1<rt>$2</rt></ruby>');
const L = (jp, en) => ({ jp, en });
const LINES = {
  kurogane: { start: L('[侵入者|しんにゅうしゃ]を[確認|かくにん]。[紅葉|もみじ]の[犬|いぬ]か。', 'Intruder confirmed. Momiji\'s dog, is it?'), breach: L('[一枚|いちまい][破|やぶ]った[程度|ていど]で[喜|よろこ]ぶな。', 'Don\'t celebrate one broken wall.'),
    wrong: L('[遅|おそ]い。[鉄|てつ]は[待|ま]たぬ。', 'Slow. Iron does not wait.'), patch: L('[壁|かべ]を[厚|あつ]くした。[掘|ほ]り[直|なお]せ。', 'I thickened the wall. Dig again.'), hunt: L('[猟犬|りょうけん]を[放|はな]つ。', 'Releasing the hounds.'),
    t50: L('[位置|いち]が[見|み]えてきたぞ。', 'I\'m starting to see where you are.'), t80: L('もうすぐだ。[逃|に]げ[道|みち]はない。', 'Almost. There is no way out.'), core: L('[中枢|ちゅうすう]に[触|ふ]れるな!', 'Don\'t touch the core!'),
    win: L('…[記録|きろく]しておく。この[借|か]りは[返|かえ]す。', '…I\'ll remember this. I will repay the debt.'), lose: L('[捕|つか]まえた。[次|つぎ]はお[前|まえ]の[記憶|きおく]だ。', 'Caught you. Next, your memory.'), out: L('[逃|に]げたか。[臆病|おくびょう]な[葉|は]だ。', 'Running? A cowardly leaf.') },
  shirasagi: { start: L('ようこそ。[招待|しょうたい]した[覚|おぼ]えはありませんが。', 'Welcome. I don\'t recall inviting you.'), breach: L('その[扉|とびら]は[飾|かざ]りです。', 'That door was decoration.'),
    wrong: L('[読|よ]み[間違|まちが]い。[記録|きろく]しました。', 'Misread. Logged.'), patch: L('[後|うし]ろの[扉|とびら]、[閉|し]めておきましたよ。', 'I locked the door ahead of you.'), hunt: L('[掃除|そうじ]を[始|はじ]めます。', 'Beginning the cleanup.'),
    t50: L('[半分|はんぶん]まで[来|き]ました。あなたの[場所|ばしょ]まで。', 'Halfway there. Halfway to you.'), t80: L('さようならの[準備|じゅんび]を。', 'Prepare your goodbyes.'), core: L('…[想定外|そうていがい]です。', '…Unexpected.'),
    win: L('[美|うつく]しくない[手口|てぐち]ですね。[覚|おぼ]えておきます。', 'Not an elegant method. I will remember it.'), lose: L('[見|み]つけました。[白鷺|しらさぎ]は[忘|わす]れません。', 'Found you. The heron does not forget.'), out: L('[賢明|けんめい]な[判断|はんだん]です。', 'A wise decision.') } };
const KIND = { gate: ['GW', '関門', 'GATEWAY', 'reading'], fw: ['FW', '防壁', 'FIREWALL', 'reading'], vault: ['VLT', '金庫', 'DATA VAULT', 'meaning'], ice: ['ICE', '迎撃', 'ICE · TIMED', 'meaning'], core: ['CORE', '中枢', 'THE CORE', 'core'] };

/* ---------------- the rival's structure ---------------- */
function build(api) {
  const cols = [2, 3, 3, 2], X0 = 340, DX = 140; N = []; E = [];
  const kinds = [['gate', 'gate'], ['fw', 'vault', 'fw'], ['ice', 'vault', D >= 4 ? 'ice' : 'fw'], ['fw', 'vault']];
  cols.forEach((n, c) => { const ks = kinds[c].slice().sort(() => Math.random() - .5); for (let i = 0; i < n; i++) N.push({ id: N.length, c, kind: ks[i], x: X0 + c * DX, y: 300 + (i - (n - 1) / 2) * 120 + (c % 2 ? 26 : -10), st: 'locked', need: ks[i] === 'fw' && D >= 5 ? 2 : 1, pulse: 0 }); });
  N.push({ id: N.length, c: 4, kind: 'core', x: X0 + 4 * DX + 50, y: 300, st: 'locked', need: 3, step: 0, pulse: 0 });
  for (let c = 0; c < 4; c++) {
    const A = N.filter(n => n.c === c), Bn = N.filter(n => n.c === c + 1);
    A.forEach(a => { const s = Bn.slice().sort((p, q) => Math.abs(p.y - a.y) - Math.abs(q.y - a.y)); E.push([a.id, s[0].id]); if (s[1] && Math.random() < .55) E.push([a.id, s[1].id]); });
    Bn.forEach(b => { if (!E.some(e => e[1] === b.id)) { const a = A.slice().sort((p, q) => Math.abs(p.y - b.y) - Math.abs(q.y - b.y))[0]; E.push([a.id, b.id]); } });
  }
}
const frontier = () => N.filter(n => n.st !== 'open' && (n.c === 0 || E.some(([a, b]) => b === n.id && N[a].st === 'open')));
const lastOpen = () => N.filter(n => n.st === 'open').sort((a, b) => b.at - a.at)[0];
/* the challenge for the selected node: a word, and how to answer it */
function arm(api) {
  const F = frontier(); SEL = clamp(SEL, 0, Math.max(0, F.length - 1)); const n = F[SEL];
  if (!n) { cur = null; T.el.style.display = 'none'; K.off(); return; }
  if (cur && cur.n === n) return;
  let mode = KIND[n.kind][3]; if (mode === 'core') mode = ['reading', 'meaning', 'reading'][n.step];
  const from = n.kind === 'core' ? api.MEM : null, w = api.pick(mode, () => true, from || undefined) || api.pick(mode, () => true, api.MEM) || api.words[Math.random() * api.words.length | 0];
  cur = { n, w, mode, opts: mode === 'meaning' ? api.opts(w, 'meaning', '', 4) : null };
  iceT = n.kind === 'ice' ? Math.max(4, 8 - D * .4) : 0;
  if (mode === 'reading') { T.el.style.display = ''; T.set(`<span class="kj">${esc(w.w)}</span>`); T.clear(); T.focus(); K.off(); K.el.style.display = 'none'; }
  else { T.el.style.display = 'none'; K.el.style.display = ''; K.set(cur.opts, 'en'); $('#hk-q').innerHTML = `<span class="kj" style="font-size:40px">${esc(w.w)}</span> <span class="lb">${n.kind === 'ice' ? 'ICE · ANSWER BEFORE IT FIRES' : 'VAULT · PICK THE MEANING'}</span>`; }
  if (mode === 'reading') $('#hk-q').innerHTML = `<span class="lb">${KIND[n.kind][1]} ${KIND[n.kind][2]}${n.need > 1 ? ` · ${n.need} LAYERS` : ''} · TYPE THE READING</span>`;
}
function answer(api, ok) {
  const c = cur; if (!c || phase !== 'run') return; const n = c.n;
  api.record(c.w, c.mode, ok, c.mode === 'reading' ? 'typed' : 'pick');
  if (!ok) { trace = Math.min(100, trace + 8); sfx('ng'); FX.push({ k: 'bad', n, t: 0 }); api.log(c.w.w, (c.mode === 'reading' ? '読み ✗ ' : '意味 ✗ ') + c.w.r, 'trace +8%', 'r'); talk('wrong', .5); cur = null; arm(api); return; }
  sfx('ok'); n.need--; if (n.kind === 'core') n.step++;
  api.log(c.w.w, c.w.r, n.need > 0 ? 'layer down' : KIND[n.kind][1] + ' open', 'y');
  if (n.need <= 0) { open(api, n); } else { cur = null; arm(api); if (n.kind === 'core') talk('core'); }
}
function open(api, n) {
  n.st = 'open'; n.at = performance.now(); FX.push({ k: 'open', n, t: 0 }); run.nodes += n.kind !== 'core' ? 1 : 0;
  if (n.kind === 'vault') { run.vaults++; sfx('coin'); }
  if (n.kind === 'core') { phase = 'done'; outcome = 'core'; talk('win', 1, true); sfx('coin'); setTimeout(() => api.end(), 1600); return; }
  talk('breach', .35); cur = null; SEL = 0; arm(api);
}
/* the rival AI talks: a Japanese line with furigana, the English under it */
function talk(k, p = 1, force) {
  if (!force && (said[k] || Math.random() > p)) return; said[k] = (said[k] || 0) + 1;
  const l = LINES[TGT][k], el = $('#hk-ai'); if (!el || !l) return;
  el.insertAdjacentHTML('afterbegin', `<div class="ln"><div class="kj">${rb(l.jp)}</div><div class="m">${esc(l.en)}</div></div>`);
  while (el.children.length > 6) el.lastChild.remove();
}
function tool(api, k) {
  if (phase !== 'run' || !KIT[k]) return; KIT[k]--; sfx('up');
  if (k === 'proxy') { trace = Math.max(0, trace - 25); api.log('代理経路', 'proxy', 'trace −25%', 'y'); }
  if (k === 'zero' && cur) { const n = cur.n; api.log('ゼロデイ', KIND[n.kind][2], 'breached', 'y'); if (n.kind === 'core') { n.need = 0; } else n.need = 0; open(api, n); }
  if (k === 'decoy') { HUNT = []; api.log('囮', 'decoy', 'hunters recalled', 'y'); }
  side(api);
}
function side(api) {
  const R = RIVALS[TGT], r = rivOf(api.SAVE).r[TGT];
  $('#hk-tg').innerHTML = `<div class="kj" style="font-size:22px;color:${R.col}">${R.corp}</div><div class="lb">${R.en}</div>
    <div style="margin-top:8px"><span class="lb">AI</span> <span class="kj" style="font-size:16px"><ruby>${R.ai}<rt>${R.air}</rt></ruby></span> <span class="lb">${R.aien}</span></div>
    <div class="m" style="margin:6px 0">${esc(R.style)}</div>
    <div class="lb">DEFENSE ${'■'.repeat(D)}${'□'.repeat(9 - D)} · GRUDGE ${Math.round(r.grudge)} · INTEL ${Math.round(r.intel)}</div>
    <div class="lb" style="margin-top:10px">TOOLS</div>${['zero', 'proxy', 'decoy'].map((k, i) => `<button type="button" class="hk-t" data-k="${k}" ${KIT[k] ? '' : 'disabled'}><span class="key">F${i + 1}</span> <b class="kj">${TOOLS[k][0]}</b> ${TOOLS[k][1]} ×${KIT[k]}</button>`).join('')}
    <div class="lb" style="margin-top:10px">F4 · JACK OUT WITH WHAT YOU HAVE · ↑↓ CHOOSE A NODE</div>`;
  document.querySelectorAll('.hk-t').forEach(b => b.onclick = () => tool(api, b.dataset.k));
}
function ctxOf(api) { return (api.summary && api.summary.ctx) || { mem: api.MEM.length, tier: Math.max(0, api.tier), div: 3, fame: 0 }; }

game({
  id: 'hack', site: 'hack', tier: 1, code: 'INT-10', jp: '侵入', en: 'Intrusion', sub: 'カラット AGAINST THE RIVAL AIs', title: '侵入作戦', dur: 0,
  skills: ['reading', 'meaning'],
  lead: 'カラット breaks into a rival megacorporation. Their network is a map of nodes, each locked by a word: <b>type the reading</b> for gateways and firewalls, <b>pick the meaning</b> (<span class="key">1</span>–<span class="key">4</span>) for vaults and ICE. Their AI traces you the whole time, patches nodes and sends hunters down your path. Reach the core and breach it (three words, from your own memory) to take their money and data. At 100% trace you are disconnected, and they will answer.',
  how: [['WALLS · 読み', '関門と防壁', 'Gateways and firewalls: type the reading. A thick firewall has two layers.'], ['VAULTS · 意味', '金庫と迎撃', 'Vaults pay out; ICE fires if you are slow. Pick the meaning.'], ['THE CORE · 中枢', '三語の鍵', 'Reading, meaning, reading: three words from your memory. Their money and data are yours.']],
  stats: [['逆探知', 'TRACE', () => Math.round(trace) + '%'], ['突破', 'NODES', () => run.nodes], ['金庫', 'VAULTS', () => run.vaults]],
  goLabel: '侵入開始 · Jack in', againLabel: '再侵入 · Again', clock: () => phase === 'run' ? '侵入中' : '待機',
  notes(api) {
    const ctx = ctxOf(api), S = api.SAVE.sim; window.__hk = { pick: k => { TGT = k; side(api); api.brief(); }, kit: (k, d) => { KIT[k] = clamp(KIT[k] + d, 0, 3); side(api); api.brief(); } };
    const kitHTML = () => { if (!S || S.v !== 2) return '<div class="note r" id="hk-kit">The planet\'s simulation hasn\'t started: open the core once.</div>'; D = defOf(api.SAVE, TGT, ctx); const c = costs(api.SAVE, TGT, ctx), ok = api.preview ? { ok: true, yen: 0, data: 0 } : canStart(api.SAVE, TGT, ctx, KIT, spendable(api.SAVE));
      return `<div class="note" id="hk-kit"><div style="display:flex;gap:6px;margin-bottom:8px">${IDS.map(k => `<button type="button" class="go2" style="${k === TGT ? 'border-color:var(--y);color:var(--y)' : ''}" onclick="__hk.pick('${k}')">${RIVALS[k].corp} · ${RIVALS[k].aien}</button>`).join('')}</div>
        TARGET <b class="kj" style="color:${RIVALS[TGT].col}">${RIVALS[TGT].corp}</b> · defense ${D}/9 · entry <b>¥${c.entry.toLocaleString()}</b><br>
        ${['proxy', 'zero', 'decoy'].map(k => `<span style="display:inline-block;margin:4px 12px 0 0"><button type="button" class="go2" style="padding:2px 8px" onclick="__hk.kit('${k}',-1)">−</button> ${TOOLS[k][1]} ×${KIT[k]} <button type="button" class="go2" style="padding:2px 8px" onclick="__hk.kit('${k}',1)">+</button> <span class="m">${k === 'proxy' ? '¥' + c.proxy.toLocaleString() : (k === 'zero' ? c.zero : c.decoy) + ' DATA'}</span></span>`).join('')}<br>
        ${api.preview ? 'PREVIEW: nothing is paid, nothing is taken; evidence still counts.' : `This run costs <b>¥${ok.yen.toLocaleString()}</b> and <b>${ok.data} Data</b> (you have ${Math.floor(api.SAVE.corp.data)}).`} ${ok.ok ? '' : `<b class="r">${esc(ok.why)}</b>`}</div>`; };
    return kitHTML();
  },
  blocked(api) { const S = api.SAVE.sim; if (!S || S.v !== 2) return true; if (api.preview) return false; return !canStart(api.SAVE, TGT, ctxOf(api), KIT, spendable(api.SAVE)).ok; },
  init(api) {
    const css = document.createElement('style'); css.textContent = `
      #hk-ai .ln { padding:6px 0 7px; border-bottom:1px solid #15171B; } #hk-ai .kj { font-size:15px; line-height:1.9; } #hk-ai ruby rt { font-size:8.5px; } #hk-ai .m { font-size:10.5px; color:#9AA0AB; }
      #hk-tg ruby rt { font-size:8px; } .hk-t { display:block; width:100%; text-align:left; margin-top:5px; background:#0B0C0E; border:1px solid var(--line2); color:var(--ink); padding:5px 8px; cursor:pointer; font:500 11px var(--mono); }
      .hk-t:disabled { opacity:.35; cursor:not-allowed; } .hk-t:hover:not(:disabled) { border-color:var(--y); }
      #hk-q { position:absolute; left:270px; top:500px; width:740px; text-align:center; z-index:6; color:var(--ink); }`;
    document.head.appendChild(css);
    panel('pt', { x: 12, y: 64, w: 246, h: 430 }, '標的 · THE TARGET', 'TGT').id = 'hk-tg';
    panel('pa', { x: 1022, y: 64, w: 246, h: 250 }, '敵AI · THEIR CHANNEL', 'AI').id = 'hk-ai';
    const lg = panel('pg', { x: 1022, y: 324, w: 246, h: 170 }, '記録 · LOG', 'LOG'); lg.id = 'g-log'; lg.classList.add('log');
    const q = document.createElement('div'); q.id = 'hk-q'; $('#ui').appendChild(q);
    T = typer({ x: 12, y: 560, w: 1256, h: 148, skip: 'NEXT NODE' }, v => { if (cur && cur.mode === 'reading') answer(api, sameReading(v, [cur.w.r])); }, () => { const F = frontier(); if (F.length) { SEL = (SEL + 1) % F.length; cur = null; arm(api); } });
    K = keycaps({ x: 12, y: 560, w: 1256, h: 148, cols: 4 }, 4, i => { if (cur && cur.mode === 'meaning' && cur.opts[i]) { K.press(i); answer(api, cur.opts[i].right); } });
    T.el.style.display = 'none'; K.el.style.display = 'none';
    side(api);
  },
  start(api) {
    const ctx = ctxOf(api); D = defOf(api.SAVE, TGT, ctx);
    if (!api.preview) { pay(api.SAVE, TGT, ctx, KIT); api.persist(); }
    build(api); trace = 0; HUNT = []; FX = []; said = {}; outcome = null; run = { nodes: 0, vaults: 0 }; huntT = 6; patchT = 10; SEL = 0; cur = null; phase = 'run';
    $('#g-log').innerHTML = ''; $('#hk-ai').innerHTML = ''; talk('start', 1, true); side(api); arm(api);
  },
  tick(dt, api) {
    for (const n of N) n.pulse = Math.max(0, n.pulse - dt);
    FX = FX.filter(f => (f.t += dt) < 1.2);
    if (phase !== 'run') return;
    const R = RIVALS[TGT];
    trace += dt * (.55 + D * .11) * R.trace;
    if (cur && cur.n.kind === 'ice') { iceT -= dt; if (iceT <= 0) { trace += 12; FX.push({ k: 'bad', n: cur.n, t: 0 }); sfx('buzz'); api.log('迎撃', 'ICE fired', 'trace +12%', 'r'); cur = null; arm(api); } }
    /* their AI: hunters along your path, patches ahead of you */
    huntT -= dt * R.hunt * (.6 + D * .1); if (huntT <= 0) { huntT = 14; const tgt = lastOpen(); if (tgt) { HUNT.push({ x: N[N.length - 1].x, y: N[N.length - 1].y, tgt }); talk('hunt', .6); sfx('alarm'); } }
    for (const h of HUNT) { const dx = h.tgt.x - h.x, dy = h.tgt.y - h.y, d = Math.hypot(dx, dy), v = 70 + D * 8; if (d < v * dt) { h.hit = true; trace += 15; FX.push({ k: 'bad', n: h.tgt, t: 0 }); api.log('猟犬', 'hunter', 'trace +15%', 'r'); } else { h.x += dx / d * v * dt; h.y += dy / d * v * dt; } }
    HUNT = HUNT.filter(h => !h.hit);
    patchT -= dt * R.patch * (.6 + D * .1); if (patchT <= 0) { patchT = 18; const L0 = N.filter(n => n.st === 'locked' && n.kind !== 'core' && (!cur || cur.n !== n)); const n = L0[Math.random() * L0.length | 0]; if (n) { if (n.kind === 'gate' || n.kind === 'vault') n.kind = n.kind === 'gate' ? 'fw' : 'ice'; else n.need++; n.pulse = 1.5; talk('patch', .6); api.log('修復', KIND[n.kind][2], 'patched', 'r'); } }
    if (trace >= 50) talk('t50', 1); if (trace >= 80) talk('t80', 1);
    if (trace >= 100) { trace = 100; phase = 'done'; outcome = 'traced'; talk('lose', 1, true); sfx('ng'); T.el.style.display = 'none'; K.el.style.display = 'none'; setTimeout(() => api.end(), 1400); }
  },
  key(e, api) {
    if (phase !== 'run') return;
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { const F = frontier(); if (F.length) { SEL = (SEL + (e.key === 'ArrowDown' ? 1 : F.length - 1)) % F.length; cur = null; arm(api); } return true; }
    if (e.key === 'F1') { tool(api, 'zero'); return true; } if (e.key === 'F2') { tool(api, 'proxy'); return true; } if (e.key === 'F3') { tool(api, 'decoy'); return true; }
    if (e.key === 'F4') { phase = 'done'; outcome = 'out'; talk('out', 1, true); setTimeout(() => api.end(), 900); return true; }
    if (cur && cur.mode === 'meaning' && /^[1-4]$/.test(e.key)) { K.press(+e.key - 1); answer(api, cur.opts[+e.key - 1].right); return true; }
  },
  end(api) {
    phase = 'idle'; T.el.style.display = 'none'; K.el.style.display = 'none'; $('#hk-q').innerHTML = '';
    const res = { nodes: run.nodes, vaults: run.vaults, core: outcome === 'core', traced: outcome === 'traced', out: outcome !== 'core' && outcome !== 'traced' };
    const L1 = api.preview ? { yen: 0, data: 0 } : lootOf(api.SAVE, TGT, ctxOf(api), res), R = RIVALS[TGT]; api.G.yen = L1.yen;    // their money, booked with the run's result, l = LINES[TGT][res.core ? 'win' : res.traced ? 'lose' : 'out'];
    return { title: res.core ? '中枢侵害 · CORE BREACHED' : res.traced ? '逆探知 · TRACED' : '離脱 · JACKED OUT', rows: [['nodes broken', res.nodes, 'y'], ['vaults', res.vaults], ['data taken', api.preview ? '—' : L1.data, res.core ? 'y' : '']],
      effect: { target: TGT, ...res }, extra: `<div class="note"><b class="kj" style="color:${R.col}">${R.ai}</b> <span class="kj">${rb(l.jp)}</span><br><span class="m">${esc(l.en)}</span>${res.traced ? '<br><b class="r">They traced you: expect an answer at your next visit (a breach, sabotage or a price war).</b>' : ''}</div>` };
  },
  settle(api, res) { settleRaid(api.SAVE, TGT, ctxOf(api), res.effect, false); },
  draw(cx, t, dt, api) {
    const R = RIVALS[TGT], col = R.col;
    cx.fillStyle = '#050506'; cx.fillRect(0, 0, 1280, 720);
    cx.strokeStyle = 'rgba(160,168,182,.06)'; cx.beginPath(); for (let x = 270; x <= 1010; x += 20) { cx.moveTo(x + .5, 64); cx.lineTo(x + .5, 540); } for (let y = 64; y <= 540; y += 20) { cx.moveTo(270, y + .5); cx.lineTo(1010, y + .5); } cx.stroke();
    cx.strokeStyle = '#24282F'; cx.strokeRect(270.5, 64.5, 740, 476);
    cx.font = '700 9px "M PLUS 1 Code"'; cx.fillStyle = '#8A909C'; cx.fillText(`NETWORK // ${R.en} // DEFENSE ${D}`, 280, 80);
    /* you: the leaf, at the entry */
    cx.fillStyle = '#0B0C0F'; cx.fillRect(282, 280, 40, 40); drawLeaf(cx, 284, 282, 36 / 31); cx.fillStyle = Y; cx.fillText('カラット', 280, 334);
    if (!N.length) { cx.fillStyle = '#8A909C'; cx.font = '700 11px "M PLUS 1 Code"'; cx.fillText('待機 · NO LINK. CHOOSE A TARGET, BUY THE KIT, JACK IN.', 380, 300); return; }
    /* edges */
    const F = frontier(), sel = F[SEL];
    for (const [a, b] of E) { const A = N[a], B = N[b], o = A.st === 'open', ob = B.st === 'open'; cx.strokeStyle = o && ob ? Y : o ? 'rgba(255,230,0,.45)' : '#2A2E36'; cx.lineWidth = o && ob ? 2 : 1; cx.setLineDash(o && !ob ? [5, 5] : []); cx.lineDashOffset = -t * 20; cx.beginPath(); cx.moveTo(A.x, A.y); cx.lineTo(B.x, B.y); cx.stroke(); }
    cx.setLineDash([]); cx.lineWidth = 1;
    for (const n of N.filter(n => n.c === 0)) { cx.strokeStyle = n.st === 'open' ? Y : 'rgba(255,230,0,.3)'; cx.beginPath(); cx.moveTo(322, 300); cx.lineTo(n.x, n.y); cx.stroke(); }
    /* nodes */
    for (const n of N) {
      const s = n.kind === 'core' ? 34 : 22, open = n.st === 'open', isSel = n === sel, isF = F.includes(n);
      if (n.kind === 'core') {
        cx.save(); cx.translate(n.x, n.y); const r = 34 + Math.sin(t * 2) * 2;
        cx.strokeStyle = open ? Y : col; cx.lineWidth = 2; cx.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + (TGT === 'kurogane' ? Math.PI / 6 : 0); cx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } cx.closePath(); cx.stroke();
        if (TGT === 'kurogane') { cx.beginPath(); cx.arc(0, 0, 13, 0, 7); cx.stroke(); } else { cx.beginPath(); cx.moveTo(-18, 6); cx.lineTo(0, -10); cx.lineTo(18, 6); cx.moveTo(-10, 12); cx.lineTo(0, 2); cx.lineTo(10, 12); cx.stroke(); }
        cx.restore(); cx.lineWidth = 1;
        for (let i = 0; i < 3; i++) { cx.fillStyle = i < n.step ? Y : '#2A2E36'; cx.fillRect(n.x - 16 + i * 12, n.y + 44, 9, 5); }
      } else {
        cx.fillStyle = open ? '#1A190A' : n.pulse > 0 ? `rgba(255,59,48,${.3 * n.pulse})` : '#0E0F12'; cx.fillRect(n.x - s, n.y - s, s * 2, s * 2);
        cx.strokeStyle = open ? Y : isSel ? Y : n.kind === 'ice' ? RED : isF ? '#8A909C' : '#3A3F48'; cx.lineWidth = isSel ? 2 : 1; cx.strokeRect(n.x - s + .5, n.y - s + .5, s * 2 - 1, s * 2 - 1); cx.lineWidth = 1;
        for (let i = 1; i < n.need; i++) cx.strokeRect(n.x - s - i * 4 + .5, n.y - s - i * 4 + .5, s * 2 + i * 8 - 1, s * 2 + i * 8 - 1);
        cx.fillStyle = open ? Y : n.kind === 'ice' ? RED : '#ECEEF2'; cx.font = '700 10px Tektur'; cx.textAlign = 'center'; cx.fillText(KIND[n.kind][0] + '-' + String(n.id).padStart(2, '0'), n.x, n.y + 4);
        cx.font = '500 9px "M PLUS 1"'; cx.fillStyle = '#8A909C'; cx.fillText(open ? '突破' : KIND[n.kind][1], n.x, n.y + s + 12); cx.textAlign = 'left';
      }
      if (isSel && !open) { const w = s + 10 + Math.sin(t * 6) * 2; cx.strokeStyle = Y; cx.beginPath(); for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { cx.moveTo(n.x + dx * w, n.y + dy * (w - 8)); cx.lineTo(n.x + dx * w, n.y + dy * w); cx.lineTo(n.x + dx * (w - 8), n.y + dy * w); } cx.stroke();
        if (cur && cur.n === n && n.kind === 'ice') { cx.fillStyle = RED; cx.fillRect(n.x - s, n.y + s + 18, s * 2 * clamp(iceT / Math.max(4, 8 - D * .4), 0, 1), 3); } }
    }
    /* hunters */
    for (const h of HUNT) { cx.save(); cx.translate(h.x, h.y); cx.rotate(t * 4); cx.fillStyle = RED; cx.fillRect(-6, -6, 12, 12); cx.restore(); cx.strokeStyle = 'rgba(255,59,48,.4)'; cx.beginPath(); cx.moveTo(h.x, h.y); cx.lineTo(h.tgt.x, h.tgt.y); cx.stroke(); }
    for (const f of FX) { const u = f.t / 1.2; cx.globalAlpha = 1 - u; cx.strokeStyle = f.k === 'open' ? Y : RED; cx.lineWidth = 2; cx.strokeRect(f.n.x - 30 - u * 20, f.n.y - 30 - u * 20, 60 + u * 40, 60 + u * 40); cx.globalAlpha = 1; cx.lineWidth = 1; }
    /* the trace: a bar across the top of the map, and their scan ring */
    const tr = trace / 100; cx.fillStyle = '#16181C'; cx.fillRect(280, 88, 720, 8); cx.fillStyle = tr > .8 ? RED : tr > .5 ? '#FF8A00' : Y; cx.fillRect(280, 88, 720 * tr, 8);
    cx.fillStyle = tr > .8 && Math.sin(t * 10) > 0 ? RED : '#ECEEF2'; cx.font = '700 11px Tektur'; cx.textAlign = 'right'; cx.fillText(`逆探知 TRACE ${Math.round(trace)}%`, 1000, 80); cx.textAlign = 'left';
    const C = N[N.length - 1]; cx.strokeStyle = `rgba(255,59,48,${.25 + .2 * Math.sin(t * 3)})`; cx.beginPath(); cx.arc(C.x, C.y, 40 + tr * 520, -Math.PI * .75, Math.PI * .75, true); cx.stroke();
    if (phase === 'done') { cx.fillStyle = 'rgba(0,0,0,.55)'; cx.fillRect(270, 64, 740, 476); cx.font = '600 44px "M PLUS 1"'; cx.textAlign = 'center'; cx.fillStyle = outcome === 'core' ? Y : outcome === 'traced' ? RED : '#ECEEF2'; cx.fillText(outcome === 'core' ? '中枢侵害' : outcome === 'traced' ? '逆探知' : '離脱', 640, 300); cx.textAlign = 'left'; }
  }
});
window.__hx = () => ({ phase, trace: Math.round(trace), nodes: run.nodes, vaults: run.vaults, outcome, cur: cur && { mode: cur.mode, kind: cur.n.kind, r: cur.w.r, right: cur.opts ? cur.opts.findIndex(o => o.right) : -1 } });
