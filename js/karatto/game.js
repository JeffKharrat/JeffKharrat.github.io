/* カラット: the shell every building's game runs in. The stage (1280×720, scaled), the top bar, the briefing and the
   report, the deck and the word pool, evidence (first attempt per word and skill per shift), the typing bar, the keycaps,
   sound, saving, and the link to the planet's simulation. Each game supplies its scene and its rules:
   game({ id, code, jp, en, site, tier, skills, dur, lead, how, stats, init, start, tick, draw, key, end, shop }). */
import { loadKanji } from './model.js?v=11';
import * as store from './store.js?v=11';
import { deckWord, buildPool, traps, shuffle, overlap } from './words.js?v=11';
import { toKana, sameReading } from './kana.js?v=11';
import { record as rec0, updateFlags, SKILL_J, day, payRate } from './evidence.js?v=11';
import { addGame, advance, book } from './sim.js?v=11';
import './rivals.js?v=11';
import { once, visit, progress, govOf } from './gov.js?v=11';
import { leafSVG, leafFavicon } from './leaf.js?v=11';

export { shuffle, toKana, sameReading, SKILL_J, overlap };
export const $ = s => document.querySelector(s);
export const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const ease = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
export const Y = '#FFE600', RED = '#FF3B30', OK = '#5CFFA0';
const QS = new URLSearchParams(location.search), DEMO = QS.has('demo'), EMBED = QS.has('embed') && parent !== window;
export const W = 1280, H = 720;

/* ---------------- sound ---------------- */
let AC = null, MUTE = (() => { try { return localStorage.getItem('karatto.mute') === '1'; } catch (e) { return false; } })();
export function sfx(kind) {
  if (MUTE) return; try { AC = AC || new AudioContext(); } catch (e) { return; }
  const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain(); o.connect(g); g.connect(AC.destination);
  const P = { ok: ['triangle', 880, 1320, .12, .09], ng: ['sawtooth', 160, 90, .28, .07], tick: ['square', 620, 620, .03, .02], beep: ['square', 1240, 1240, .05, .03], card: ['sine', 660, 990, .08, .04],
    thud: ['sine', 140, 40, .22, .3], up: ['triangle', 420, 980, .25, .06], alarm: ['square', 880, 440, .3, .04], buzz: ['sawtooth', 300, 300, .12, .05], coin: ['triangle', 1200, 1800, .1, .06] }[kind];
  if (!P) return; o.type = P[0]; o.frequency.setValueAtTime(P[1], t); o.frequency.exponentialRampToValueAtTime(P[2], t + P[3]);
  g.gain.setValueAtTime(P[4], t); g.gain.exponentialRampToValueAtTime(.0001, t + P[3]); o.start(t); o.stop(t + P[3] + .02);
}
export const audio = () => { try { AC = AC || new AudioContext(); AC.resume(); } catch (e) {} return AC; };

/* ---------------- the stage ---------------- */
const stage = document.getElementById('stage'), cv = document.getElementById('cv'), cx = cv.getContext('2d');
let R = 1;
function fit() { const s = Math.min(innerWidth / W, innerHeight / H); stage.style.transform = `scale(${s})`; R = Math.min(2, Math.max(1, s * (devicePixelRatio || 1))); cv.width = W * R; cv.height = H * R; }
addEventListener('resize', fit);

/* ---------------- the shell ---------------- */
export async function game(cfg) {
  const G = { run: false, T: 0, T0: cfg.dur || 180, yen: 0, tried: new Set(), touched: new Map(), streak: 0, best: 0, right: 0, wrong: 0, rate: 1, prac: 0, rid: null };
  const api = { G, cfg, cx, W, H, sfx, esc, clamp, ease, $, DEMO, EMBED, get R() { return R; } };
  stage.insertAdjacentHTML('beforeend', `
    <div id="top"><div class="t"><span class="lf">${leafSVG(30)}</span><span class="tag" id="g-tag">${cfg.code}</span><b>${cfg.jp}</b><span class="lb">${cfg.en}</span></div>
      <span id="clock">00:00</span><div class="st" id="g-st"></div>
      <button class="tb" id="b-mute" type="button">SND ON</button><button class="tb" id="b-exit" type="button">地上 · EXIT</button></div>
    <div id="ui"></div><div id="toast"></div>
    <div class="ov" id="ov-brief"><div class="sheet" id="brief"></div></div><div class="ov" id="ov-report"><div class="sheet" id="report"></div></div>`);
  fit(); leafFavicon();
  const muteL = () => { $('#b-mute').textContent = MUTE ? 'SND OFF' : 'SND ON'; };
  $('#b-mute').onclick = () => { MUTE = !MUTE; try { localStorage.setItem('karatto.mute', MUTE ? '1' : '0'); } catch (e) {} muteL(); }; muteL();
  $('#b-exit').onclick = exit;

  /* data */
  const KD = await loadKanji('../../data/karatto/kanji.json');
  if (document.fonts) await Promise.race([Promise.all([document.fonts.load('500 20px "M PLUS 1"', '大工場物流発電所研究放送保安取引本社'), document.fonts.load('500 12px "M PLUS 1 Code"', 'あ'), document.fonts.load('700 20px Tektur', '0')]), new Promise(r => setTimeout(r, 5000))]);
  const L0 = await store.load(); let SAVE = L0.save, DECK = L0.deck || [];
  if (DEMO) { const d = demoDeck(KD); DECK = d.deck; SAVE = JSON.parse(JSON.stringify({ ...SAVE, words: d.words })); }
  if (DEMO) {                                                        // a demo planet: two days of simulation, and something on the table
    const mem = Object.values(SAVE.words).filter(w => w.cert).length, ctx = { mem, acq: 0, tier: 1, div: 3, up: 0, fame: mem * 10, tech: {} };
    SAVE.sim = undefined; advance(SAVE, ctx, Date.now() - 48 * 3600e3); advance(SAVE, ctx, Date.now());
    if (cfg.id === 'hq') SAVE.sim.ev.push({ id: 'demo:strike', k: 'strike', t: SAVE.sim.t }, { id: 'demo:order', k: 'order', t: SAVE.sim.t });
  }
  SAVE.corp[cfg.id] = SAVE.corp[cfg.id] || { shifts: 0 };
  const words = DECK.map(w => { const d = deckWord(w, KD); d.sent = (w.sentences || []).filter(s => s.jp && /⟦.+?⟧/.test(s.jp)); return d; }).filter(w => w.w && w.r && w.s && w.ks.length);
  const POOL = buildPool(KD, words);
  const isMem = w => SAVE.words[w.id] && SAVE.words[w.id].cert;
  let summary = {}; try { summary = JSON.parse(localStorage.getItem('karatto.summary') || '{}'); } catch (e) {}
  const tier = typeof summary.tier === 'number' ? summary.tier : -1;
  const preview = !DEMO && (QS.has('preview') || (cfg.tier != null && cfg.tier > tier + 1));
  Object.assign(api, { KD, SAVE, DECK, words, POOL, preview, tier, summary, U: SAVE.corp[cfg.id], tech: SAVE.corp.tech || {},
    get LEARN() { return words.filter(w => !isMem(w)); }, get MEM() { return words.filter(isMem); }, isMem });
  if (preview) { $('#g-tag').classList.add('pv'); $('#g-tag').textContent = cfg.code + ' · PREVIEW 見学'; }

  /* evidence: first attempt per word and skill per shift; a right, unhinted answer clears a compromised word.
     The pay for the answer follows it: full for the first clean answer of the day, a practice rate for repeats (api.pay) */
  api.record = (w, skill, ok, how = 'pick', hinted = false) => {
    const k = skill + w.id; if (G.tried.has(k)) return null; G.tried.add(k);
    const was = SAVE.words[w.id] && SAVE.words[w.id].comp, r = rec0(SAVE, w.id, skill, ok, how, cfg.id, hinted); G.rate = payRate(r); if (ok && r !== 'new') G.prac++;
    const T = G.touched.get(w.id) || { w, res: {} }; T.res[skill] = ok ? (r === 'new' ? 'new' : 'same') : 'miss'; G.touched.set(w.id, T);
    if (ok) { G.right++; G.streak++; G.best = Math.max(G.best, G.streak); if (was && !SAVE.words[w.id].comp) api.log(w.w, '復旧', 'restored', 'y'); }
    else { G.wrong++; G.streak = 0; }
    return r;
  };
  /* the next word to ask for a skill: in training, not yet tried this shift, some evidence already scores higher */
  api.pick = (skill, filter = () => true, from) => {
    const list = (from || api.LEARN).filter(w => !G.tried.has(skill + w.id) && filter(w)); if (!list.length) return null;
    const today = day(); let best = null, bs = -1e9;
    for (const w of list) {
      const ev = (SAVE.words[w.id] || {}).ev || {}, has = Object.values(ev).some(e => e.d && e.d.length), done = ev[skill] && ev[skill].d.includes(today);
      const sc = Math.random() + (has ? .7 : 0) - (done ? 1.2 : 0) + ((w.lvl || 3) - 3) * .12;
      if (sc > bs) { bs = sc; best = w; }
    }
    return best;
  };
  api.opts = (w, mode, by, n) => shuffle([w, ...traps(w, mode, by, n - 1, POOL)]).map(e => ({ w: e.w, r: e.r, s: e.s, right: e.w === w.w }));
  api.toast = (t, ms = 2200) => { const e = $('#toast'); e.textContent = t; e.classList.add('on'); clearTimeout(api.toast.h); api.toast.h = setTimeout(() => e.classList.remove('on'), ms); };
  api.log = (a, b, c, cls) => { const L = $('#g-log'); if (!L) return; const d = document.createElement('div'); d.className = 'e'; d.innerHTML = `<span><span class="kj">${esc(a)}</span> <span class="m">${esc(b)}</span></span><span class="${cls}">${esc(c)}</span>`; L.insertBefore(d, L.firstChild); while (L.children.length > 9) L.lastChild.remove(); };
  api.pay = base => Math.round(base * G.rate);
  api.persist = () => { if (!DEMO) store.store(SAVE, null); };
  api.end = () => endShift();
  api.brief = () => { if (!G.run) brief(); };

  /* the stats on the top bar */
  const stats = () => { $('#g-st').innerHTML = (cfg.stats || []).map(([j, e, f]) => `<span><em>${j} ${e}</em>${f(api)}</span>`).join(''); };

  /* ---------------- brief, start, end, report ---------------- */
  function brief() {
    const nL = api.LEARN.length;
    $('#brief').innerHTML = `<div class="bar"><span>${cfg.code} // ${cfg.jp} ${cfg.en.toUpperCase()}</span><span>${cfg.sub || ''}</span></div><h2>${cfg.title || cfg.jp}</h2>
      <div class="lead">${cfg.lead}</div>
      <div class="how">${cfg.how.map(([em, b, t]) => `<div><em>${em}</em><b>${b}</b>${t}</div>`).join('')}</div>
      <div class="row"><div class="stat"><span class="lb">training</span><b>${nL}</b></div><div class="stat"><span class="lb">in memory</span><b class="y">${api.MEM.length}</b></div><div class="stat"><span class="lb">skills</span><b class="kj" style="font-size:22px">${cfg.skills.map(s => SKILL_J[s]).join(' · ') || '読解'}</b></div><div class="stat"><span class="lb">shifts here</span><b>${api.U.shifts}</b></div></div>
      ${(cfg.notes ? cfg.notes(api) : '')}
      ${preview ? `<div class="note">PREVIEW 見学 · this building opens at a later tier. Evidence still counts; no yen and no effect on the planet.</div>` : ''}
      ${DEMO ? '<div class="note">Demo: a made-up deck, nothing is saved.</div>' : ''}
      ${!words.length ? `<div class="note r">No deck yet. Open the core, Settings → Read the deck. Or <a href="?demo${EMBED ? '&embed=1' : ''}" style="color:var(--y)">run a demo</a>.</div>` : ''}
      <div class="acts">${words.length && !(cfg.blocked && cfg.blocked(api)) ? `<button class="go" id="b-go" type="button">${cfg.goLabel || '始業 · Start'} <span class="key">Enter</span></button>` : ''}<button class="go2" id="b-out" type="button">Back to the surface</button></div>`;
    $('#ov-brief').classList.add('on'); if ($('#b-go')) $('#b-go').onclick = start; $('#b-out').onclick = exit;
  }
  function start() {
    audio(); $('#ov-brief').classList.remove('on'); $('#ov-report').classList.remove('on');
    Object.assign(G, { run: true, T0: (cfg.dur || 180) + (api.U.longer ? 60 : 0), yen: 0, tried: new Set(), touched: new Map(), streak: 0, best: 0, right: 0, wrong: 0, rate: 1, prac: 0, rid: cfg.id + ':' + Date.now().toString(36) + ':' + Math.random().toString(36).slice(2, 6) }); G.T = G.T0;
    cfg.start(api); stats();
  }
  function endShift() {
    if (!G.run) return; G.run = false;
    const res = cfg.end(api) || {}, flagged = updateFlags(SAVE);
    api.U.shifts++;
    /* the result applies once, whatever reloads or retries happen; a preview or a demo never touches the company */
    if (!preview && !DEMO) once(SAVE, 'game:' + G.rid, () => { addGame(SAVE, cfg.id, { ...(res.effect || {}), right: G.right, yen: G.yen }); cfg.settle && cfg.settle(api, res, G.rid); const ctx = summary.ctx; if (ctx) { visit(SAVE, ctx); progress(SAVE, ctx); } });
    else if (DEMO) { addGame(SAVE, cfg.id, { ...(res.effect || {}), right: G.right, yen: G.yen }); cfg.settle && cfg.settle(api, res, G.rid); }
    (SAVE.log = SAVE.log || []).push({ t: Date.now(), k: cfg.id, yen: G.yen, right: G.right, wrong: G.wrong, flagged: flagged.length }); if (SAVE.log.length > 200) SAVE.log.splice(0, SAVE.log.length - 200);
    api.persist(); setTimeout(() => report(res, flagged), 900);
  }
  function report(res, flagged) {
    const rows = [...G.touched.values()], byId = new Map(words.map(w => [w.id, w]));
    const cell = r => r === 'new' ? '<span class="y">✓ +1 day</span>' : r === 'same' ? '<span class="m">✓ today already</span>' : '<span class="r">✗ wiped</span>';
    $('#report').innerHTML = `<div class="bar"><span>${cfg.code} // 日報 REPORT // SHIFT ${String(api.U.shifts).padStart(3, '0')}</span><span class="bc" style="opacity:.8"></span></div><h2>${res.title || '業務終了'}</h2>
      <div class="row">${(res.rows || []).slice(0, 3).map(([l, v, c]) => `<div class="stat"><span class="lb">${l}</span><b class="${c || ''}">${v}</b></div>`).join('')}<div class="stat"><span class="lb">earned${preview ? ' · preview' : ''}</span><b class="y">${preview ? '—' : '¥' + G.yen.toLocaleString()}</b></div></div>
      ${res.extra || ''}
      <div class="lb">evidence · ${G.right} clean, ${G.wrong} wiped · best streak ${G.best}${G.prac ? ` · ${G.prac} repeat${G.prac > 1 ? 's' : ''} paid at the practice rate (${Math.round(payRate('same-day') * 100)}%)` : ''}</div>
      <div class="ev">${rows.slice(0, 16).map(x => `<div><span><span class="kj">${esc(x.w.w)}</span> <span class="m">${esc(x.w.r)}</span></span><span>${Object.entries(x.res).map(([k, v]) => SKILL_J[k] + ' ' + cell(v)).join(' · ')}</span></div>`).join('') || '<div class="m">No word answered.</div>'}</div>
      ${flagged.length ? `<div class="note"><b class="y">${flagged.length} file${flagged.length > 1 ? 's' : ''} sent to the audit</b> · <span class="kj">${flagged.slice(0, 6).map(id => esc((byId.get(id) || {}).w || '')).join('、')}${flagged.length > 6 ? '…' : ''}</span>. Commit them in the core (審査).</div>` : ''}
      ${cfg.shop ? `<div class="lb" style="margin-top:16px">設備投資 · upgrades · funds ¥${Math.round(SAVE.corp.funds || 0).toLocaleString()}</div><div class="shop">${cfg.shop.map(u => `<button type="button" data-u="${u.id}" ${api.U[u.id] || (SAVE.corp.funds || 0) < u.cost || preview ? 'disabled' : ''}><b>${u.name}</b>${u.en} · ${api.U[u.id] ? 'installed' : '¥' + u.cost}<br><span class="m">${u.d}</span></button>`).join('')}</div>` : ''}
      <div class="acts"><button class="go" id="b-again" type="button">${cfg.againLabel || '次 · Again'} <span class="key">Enter</span></button><button class="go2" id="b-out2" type="button">Back to the surface</button></div>`;
    $('#ov-report').classList.add('on'); $('#b-again').onclick = () => { if (cfg.blocked && cfg.blocked(api)) { $('#ov-report').classList.remove('on'); brief(); } else start(); }; $('#b-out2').onclick = exit;
    $('#report').querySelectorAll('[data-u]').forEach(b => b.onclick = () => { const u = cfg.shop.find(x => x.id === b.dataset.u); if (api.U[u.id] || SAVE.corp.funds < u.cost) return; if (SAVE.sim && SAVE.sim.v === 2) book(SAVE.sim, SAVE.corp, 'cap', -u.cost, `設備投資 ${u.name} ¥${u.cost.toLocaleString()}`); else SAVE.corp.funds -= u.cost; api.U[u.id] = 1; api.persist(); report(res, flagged); });
  }
  function exit() { if (EMBED) parent.postMessage('karatto:surface', location.origin); else location.href = '../' + (DEMO ? '?demo' : ''); }

  /* ---------------- input ---------------- */
  addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); return exit(); }
    if (!G.run) { if (e.key === 'Enter') { e.preventDefault(); if ($('#ov-brief').classList.contains('on') && $('#b-go')) start(); else if ($('#ov-report').classList.contains('on')) $('#b-again').click(); } return; }
    if (cfg.key && cfg.key(e, api)) e.preventDefault();
  });
  document.addEventListener('visibilitychange', () => { paused = document.hidden; LAST = performance.now(); });

  /* ---------------- the loop ---------------- */
  let LAST = performance.now(), paused = false, CLOCK = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(.05, (now - LAST) / 1000); LAST = now; if (paused) return; CLOCK += dt; api.t = CLOCK;
    if (G.run && cfg.dur !== 0) { const b = Math.ceil(G.T); G.T -= dt; if (G.T <= 10 && Math.ceil(G.T) !== b && G.T > 0) sfx('tick'); if (G.T <= 0) { G.T = 0; endShift(); } }
    cfg.tick && cfg.tick(dt, api);
    cx.setTransform(R, 0, 0, R, 0, 0); cfg.draw(cx, CLOCK, dt, api);
    const T = Math.ceil(G.T); $('#clock').textContent = cfg.dur === 0 ? (cfg.clock ? cfg.clock(api) : '') : `${String(T / 60 | 0).padStart(2, '0')}:${String(T % 60).padStart(2, '0')}`;
    $('#clock').style.color = G.run && G.T <= 10 && cfg.dur !== 0 ? RED : '';
    if (G.run) stats();
  }
  cfg.init && cfg.init(api);
  brief(); stats(); requestAnimationFrame(frame);
  if (EMBED) parent.postMessage('karatto:ready', location.origin);
  window.__g = api;
  return api;
}

/* ---------------- the typing bar ---------------- */
export function typer(box, onSubmit, onSkip) {
  const el = document.createElement('div'); el.className = 'typer'; Object.assign(el.style, { left: box.x + 'px', top: box.y + 'px', width: box.w + 'px', height: box.h + 'px' });
  el.innerHTML = `<div class="w kj"></div><span class="ar">→</span><div class="echo kj"></div><div class="hint">ROMAJI → かな<br><span class="key">Enter</span> SUBMIT · <span class="key">Tab</span> ${box.skip || 'SKIP'}</div><input autocomplete="off" spellcheck="false" autocapitalize="off">`;
  $('#ui').appendChild(el);
  const inp = el.querySelector('input'), echo = el.querySelector('.echo'), w = el.querySelector('.w');
  const draw = () => { const k = toKana(inp.value); echo.innerHTML = esc(k.kana) + '<i>' + esc(k.rest) + '</i>'; };
  inp.addEventListener('input', draw);
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (inp.value.trim()) onSubmit(inp.value); }
    else if (e.key === 'Tab') { e.preventDefault(); e.stopPropagation(); onSkip && onSkip(); }
  });
  const focus = () => { if (document.activeElement !== inp) inp.focus({ preventScroll: true }); };
  document.addEventListener('pointerdown', () => setTimeout(focus, 0));
  return { el, set(html) { w.innerHTML = html; }, clear() { inp.value = ''; draw(); }, focus, flash(ok) { el.classList.remove('ok', 'ng'); void el.offsetWidth; el.classList.add(ok ? 'ok' : 'ng'); setTimeout(() => el.classList.remove('ok', 'ng'), 500); }, value: () => inp.value };
}
/* ---------------- keycaps: n answers, keys 1..n (or a numpad layout) ---------------- */
export function keycaps(box, n, onPick, numpad = false) {
  const el = document.createElement('div'); el.className = 'keys';
  const cols = box.cols || (numpad ? 3 : n);
  Object.assign(el.style, { left: box.x + 'px', top: box.y + 'px', width: box.w + 'px', height: box.h + 'px', gridTemplateColumns: `repeat(${cols}, 1fr)` });
  const K = [];
  for (let i = 0; i < n; i++) {
    const b = document.createElement('div'); b.className = 'kc off'; b.innerHTML = `<span class="k"><b>${i + 1}</b><small>${numpad ? 'NUM' : 'KEY'}</small></span><div class="v"></div>`;
    if (numpad) { b.style.gridColumn = String(i % 3 + 1); b.style.gridRow = String(Math.ceil(n / 3) - Math.floor(i / 3)); }
    b.onclick = () => onPick(i); el.appendChild(b); K.push(b);
  }
  $('#ui').appendChild(el);
  return {
    el, K,
    set(list, kind) { K.forEach((b, i) => { const v = b.querySelector('.v'), o = list && list[i]; b.classList.remove('good', 'bad'); b.classList.toggle('off', !o); v.className = 'v ' + (kind === 'en' ? 'en' : 'jp'); v.textContent = o ? (kind === 'en' ? o.s : o.w) : ''; }); },
    mark(i, cls) { K[i] && K[i].classList.add(cls); },
    press(i) { const b = K[i]; if (!b) return; b.classList.add('press'); setTimeout(() => b.classList.remove('press'), 120); },
    off() { K.forEach(b => b.classList.add('off')); } };
}
export function panel(id, box, title, code) {
  const el = document.createElement('div'); el.className = 'pn'; el.id = id; Object.assign(el.style, { left: box.x + 'px', top: box.y + 'px', width: box.w + 'px', height: box.h ? box.h + 'px' : 'auto' });
  el.innerHTML = `<div class="hd"><span><b>${code}</b> ${title}</span><span class="bc"></span></div><div class="in"></div>`; $('#ui').appendChild(el); return el.querySelector('.in');
}
export const furi = s => String(s).replace(/\s?([^\s\[\]⟦⟧]+?)\[([^\]]+)\]/g, '$1');   // Anki furigana brackets out

/* ---------------- demo deck ---------------- */
const TEMPL = ['昨日、⟦X⟧について先生と話した。', '⟦X⟧はとても大切だと思う。', '駅の前で⟦X⟧を見つけた。', 'この町では⟦X⟧が有名です。', '会議で⟦X⟧の話が出た。', '友達に⟦X⟧のことを聞いた。'];
function demoDeck(KD) {
  const deck = [], seen = new Set(); let id = 1;
  for (const k of KD.list) {
    if (k.l < 3 && Math.random() > .2) continue;
    for (const f of k.fa) for (const e of f.ex.slice(0, k.l >= 4 ? 2 : 1)) if (!seen.has(e[0])) { seen.add(e[0]); deck.push({ id: id++, written: e[0], reading: e[1], meaning: e[2], expr: e[0], sentences: [{ jp: TEMPL[id % TEMPL.length].replace('X', e[0]), target: e[0], en: '' }] }); }
  }
  const words = {}, y = day(Date.now() - 864e5);
  deck.forEach(w => { const r = Math.random(); if (r < .5) words[w.id] = { cert: Date.now() - Math.random() * 40 * 864e5 }; else if (r < .7) words[w.id] = { ev: { meaning: { d: [y] }, recall: { d: [y] } } }; });
  return { deck, words };
}
