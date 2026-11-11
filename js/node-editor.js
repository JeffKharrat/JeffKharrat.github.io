/* Node editor overlay: opens a rig setup's node graph next to its clip.
   Graphs live in window.NODE_GRAPHS (js/graphs-*.js). Node format:
     { id, x, y, w?, k: 'dag'|'mat'|'math'|'geo'|'ctl'|'block', t: type, n: name,
       r: rows ('·' first = stored value, no port; text after two spaces is shown dim),
       d: { en, ja } }
   Edge format: { f: [nodeId, row], t: [nodeId, row], c?: 'g'|'b'|'r', l?: label, dash? } */
(function () {
  'use strict';
  const KIND = {
    ctl:   { col: '#F2491B', en: 'Animator control', ja: 'アニメーター用コントローラー' },
    dag:   { col: '#F3F3EE', en: 'DAG node (transform, joint)', ja: 'DAGノード（トランスフォーム・ジョイント）' },
    mat:   { col: '#C6FF1A', en: 'Matrix node', ja: 'マトリクスノード' },
    math:  { col: '#A4A4A0', en: 'Math node', ja: '演算ノード' },
    geo:   { col: '#7F9BFF', en: 'Geometry / deformer', ja: 'ジオメトリ・デフォーマー' },
    block: { col: '#A4A4A0', en: 'Group of nodes, merged', ja: '複数ノードをまとめた表示' }
  };
  const WIRE = { l: '#C6FF1A', g: '#8A8A86', b: '#7F9BFF', r: '#F2491B' };
  const WIRE_T = {
    l: { en: 'matrix', ja: 'マトリクス' }, g: { en: 'number / vector', ja: '数値・ベクトル' },
    b: { en: 'geometry', ja: 'ジオメトリ' }, r: { en: 'the cancel', ja: '打ち消し' }
  };
  const UI = {
    en: { tag: 'Node editor', fit: 'Fit', flow: 'Flow', close: 'Close', hint: 'Drag nodes · drag the grid to pan · scroll or pinch to zoom · click a node to read it',
      pick: 'Select a node to see what it does.', ins: 'Inputs', outs: 'Outputs', none: 'none', legend: 'Legend', clip: 'The clip',
      note: 'Names, attributes and connections come from the Maya file. Repeated per-joint copies are drawn once; "…" stands for the part of a name that repeats.', back: 'Overview' },
    ja: { tag: 'ノードエディター', fit: '全体表示', flow: 'フロー', close: '閉じる', hint: 'ノードをドラッグ・背景をドラッグで移動・スクロールまたはピンチでズーム・ノードをクリックで説明',
      pick: 'ノードを選択すると役割が表示されます。', ins: '入力', outs: '出力', none: 'なし', legend: '凡例', clip: '動画',
      note: 'ノード名・アトリビュート・接続はMayaファイルから取得しています。ジョイントごとに繰り返されるノードは1つにまとめ、名前の繰り返し部分は「…」で表しています。', back: '概要' }
  };
  const lang = () => (document.documentElement.lang === 'ja' ? 'ja' : 'en');
  const L = v => (v && typeof v === 'object' ? v[lang()] ?? v.en : v ?? '');
  const ui = k => UI[lang()][k];
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const key = s => s.replace(/^·/, '').split('  ')[0];

  let el = null, st = null;   // overlay element, state of the open graph

  function css() {
    const s = document.createElement('style');
    s.textContent = `
.ne{position:fixed;inset:0;z-index:200;display:grid;grid-template-rows:auto 1fr;background:#0B0C0F;color:#E9EBF0;font-family:var(--mono,ui-monospace,monospace);
  opacity:0;transform:scale(.985);transition:opacity .18s ease,transform .18s ease}
.ne.is-on{opacity:1;transform:none}
.ne[hidden]{display:none}
.ne-bar{display:flex;align-items:center;gap:.75rem;padding:.6rem .9rem;border-bottom:1px solid #262A33;background:#0E1014;min-width:0}
.ne-tag{font-size:.7rem;letter-spacing:.12em;text-transform:uppercase;color:#0B0C0F;background:#C6FF1A;padding:.25rem .5rem;white-space:nowrap}
.ne-title{font-family:var(--display,inherit);font-weight:700;font-size:1.05rem;text-transform:uppercase;letter-spacing:.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;min-width:0}
.ne-btn{font:inherit;font-size:.75rem;letter-spacing:.08em;text-transform:uppercase;color:#E9EBF0;background:none;border:1px solid #3A3F4B;padding:.4rem .7rem;cursor:pointer;white-space:nowrap}
.ne-btn:hover,.ne-btn:focus-visible{border-color:#C6FF1A;color:#C6FF1A;outline:none}
.ne-btn[aria-pressed="true"]{border-color:#C6FF1A;color:#C6FF1A}
.ne-btn--x{border-color:#F2491B;color:#F2491B}
.ne-main{display:grid;grid-template-columns:minmax(0,1fr) 22rem;min-height:0}
.ne-view{position:relative;overflow:hidden;touch-action:none;cursor:grab;
  background-color:#121419;background-image:linear-gradient(#1B1E25 1px,transparent 1px),linear-gradient(90deg,#1B1E25 1px,transparent 1px);background-size:24px 24px}
.ne-view.is-pan{cursor:grabbing}
.ne-world{position:absolute;left:0;top:0;transform-origin:0 0}
.ne-wires{position:absolute;left:0;top:0;overflow:visible;pointer-events:none}
.ne-w{fill:none;stroke-width:1.6;opacity:.75;transition:opacity .15s}
.ne-wf{fill:none;stroke-width:2.2;stroke-dasharray:3 13;opacity:0;stroke-linecap:round}
.ne.is-flow .ne-wf{opacity:.95;animation:ne-flow 1.1s linear infinite}
@keyframes ne-flow{to{stroke-dashoffset:-16}}
.ne-wl{font-size:10px;paint-order:stroke;stroke:#121419;stroke-width:4px}
.ne-sel .ne-w{opacity:.14}.ne-sel .ne-wf{opacity:0!important}.ne-sel .ne-wl{opacity:.2}
.ne-sel .ne-w.is-hot{opacity:1;stroke-width:2.4}.ne-sel .ne-wf.is-hot{opacity:1!important}.ne-sel .ne-wl.is-hot{opacity:1}
.ne-n{position:absolute;background:#16181E;border:1.5px solid var(--c);color:#D8D8D2;font-size:11.5px;line-height:1;cursor:move;user-select:none;-webkit-user-select:none;
  box-shadow:0 6px 18px rgba(0,0,0,.35);transition:opacity .15s,box-shadow .15s;border-radius:3px}
.ne-n:focus-visible{outline:2px solid #fff;outline-offset:3px}
.ne-n.is-sel{box-shadow:0 0 0 2px var(--c),0 8px 26px rgba(0,0,0,.5)}
.ne-sel .ne-n:not(.is-sel):not(.is-near){opacity:.38}
.ne-h{padding:6px 9px 7px;background:color-mix(in srgb,var(--c) 14%,transparent);border-bottom:1px solid color-mix(in srgb,var(--c) 40%,transparent)}
.ne-t{display:block;font-size:9.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--c);margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ne-nm{display:block;font-weight:700;color:#F3F3EE;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ne-rs{padding:4px 0 6px}
.ne-r{position:relative;height:20px;display:flex;align-items:center;padding:0 12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ne-r i{font-style:normal;color:#8A8A86;margin-left:.6em}
.ne-r.is-st{color:#8A8A86}
.ne-p{position:absolute;top:50%;width:9px;height:9px;margin-top:-4.5px;border-radius:50%;background:#16181E;border:1.5px solid var(--pc)}
.ne-p--i{left:-5.5px}.ne-p--o{right:-5.5px}
.ne-side{border-left:1px solid #262A33;background:#0E1014;overflow-y:auto;padding:1rem 1.1rem 1.4rem;font-size:.82rem;line-height:1.6}
.ne-side h3{margin:0 0 .3rem;font-family:var(--display,inherit);font-size:1rem;text-transform:uppercase;letter-spacing:.02em;color:#F3F3EE;overflow-wrap:anywhere}
.ne-side h4{margin:1.1rem 0 .4rem;font-size:.68rem;letter-spacing:.12em;text-transform:uppercase;color:#8A8A86;font-weight:400}
.ne-side p{margin:.35rem 0;color:#C9CCD3}
.ne-k{font-size:.68rem;letter-spacing:.1em;text-transform:uppercase}
.ne-vid{display:block;width:100%;aspect-ratio:16/9;background:#000;border:1px solid #262A33;margin:.2rem 0 .6rem}
.ne-lg{display:grid;gap:.3rem;margin:0;padding:0;list-style:none;font-size:.75rem;color:#A4A8B2}
.ne-lg li{display:flex;align-items:center;gap:.55rem}
.ne-lg b{width:14px;height:10px;border:1.5px solid;flex:none;border-radius:2px}
.ne-lg s{width:18px;height:0;border-top:2px solid;flex:none;text-decoration:none}
.ne-ls{margin:0;padding:0;list-style:none;display:grid;gap:.25rem}
.ne-ls button{all:unset;cursor:pointer;display:block;font-size:.75rem;color:#C9CCD3;border-left:2px solid var(--c);padding:.15rem .5rem;overflow-wrap:anywhere}
.ne-ls button:hover,.ne-ls button:focus-visible{color:#fff;background:#1A1D24}
.ne-ls em{font-style:normal;color:#8A8A86}
.ne-hint{position:absolute;left:.8rem;bottom:.7rem;font-size:.7rem;color:#7B8190;pointer-events:none;max-width:calc(100% - 1.6rem)}
.ne-note{font-size:.72rem!important;color:#7B8190!important}
.ne-up{all:unset;cursor:pointer;font-size:.7rem;letter-spacing:.1em;text-transform:uppercase;color:#C6FF1A;margin-bottom:.6rem;display:inline-block}
@media (max-width:52rem){
  .ne-main{grid-template-columns:1fr;grid-template-rows:minmax(0,1fr) minmax(0,42%)}
  .ne-side{border-left:0;border-top:1px solid #262A33}
  .ne-hint{display:none}
  .ne-btn--fl{display:none}
}
@media (prefers-reduced-motion:reduce){.ne{transition:none}.ne.is-flow .ne-wf{animation:none;opacity:0}}`;
    document.head.append(s);
  }

  const h = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };
  const NS = 'http://www.w3.org/2000/svg';
  const sv = (tag, at) => { const n = document.createElementNS(NS, tag); for (const k in at) n.setAttribute(k, at[k]); return n; };

  function build() {
    css();
    el = h('div', 'ne'); el.hidden = true;
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
    el.innerHTML = `<div class="ne-bar"><span class="ne-tag"></span><span class="ne-title" id="ne-title"></span>
      <button class="ne-btn ne-btn--fl" type="button" data-a="flow" aria-pressed="true"></button>
      <button class="ne-btn" type="button" data-a="fit"></button>
      <button class="ne-btn ne-btn--x" type="button" data-a="close"></button></div>
      <div class="ne-main"><div class="ne-view"><div class="ne-world"><svg class="ne-wires"></svg></div><p class="ne-hint"></p></div>
      <aside class="ne-side" aria-live="polite"></aside></div>`;
    el.setAttribute('aria-labelledby', 'ne-title');
    document.body.append(el);
    el.addEventListener('click', e => {
      const a = e.target.closest('[data-a]'); if (!a) return;
      if (a.dataset.a === 'close') close();
      else if (a.dataset.a === 'fit') fit(true);
      else if (a.dataset.a === 'flow') { const on = a.getAttribute('aria-pressed') !== 'true'; a.setAttribute('aria-pressed', String(on)); el.classList.toggle('is-flow', on && !still.matches); }
    });
    addEventListener('keydown', e => {
      if (!st || el.hidden) return;
      if (e.key === 'Escape') { if (st.sel) select(null); else close(); }
      else if (e.target.closest && e.target.closest('input,textarea')) return;
      else if (e.key === 'f' || e.key === 'F') fit(true);
      else if (e.key === '+' || e.key === '=') zoomAt(1.2);
      else if (e.key === '-') zoomAt(1 / 1.2);
      else if (e.key === 'Tab') trap(e);
    });
    addEventListener('resize', () => { if (st && !el.hidden) fit(false); });
    // language buttons elsewhere on the page re-render the text
    document.addEventListener('click', e => { if (st && !el.hidden && e.target.closest('[data-lang]')) setTimeout(texts, 0); });
    view().addEventListener('pointerdown', down);
    view().addEventListener('wheel', wheel, { passive: false });
  }
  const view = () => el.querySelector('.ne-view'), world = () => el.querySelector('.ne-world'), wires = () => el.querySelector('.ne-wires'), side = () => el.querySelector('.ne-side');

  function trap(e) {
    const f = [...el.querySelectorAll('button,[tabindex="0"],video[controls]')].filter(n => n.offsetParent !== null);
    if (!f.length) return;
    const i = f.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
  }

  /* ---------- open / close ---------- */
  function open(id, opts) {
    const g = (window.NODE_GRAPHS || {})[id]; if (!g) return;
    if (!el) build();
    opts = opts || {};
    st = { g, id, opts, nodes: {}, edges: [], tx: 0, ty: 0, s: 1, sel: null, ret: document.activeElement };
    g.nodes.forEach(n => { st.nodes[n.id] = Object.assign({}, n, { w: n.w || 220 }); });
    world().querySelectorAll('.ne-n').forEach(n => n.remove());
    const flowBtn = el.querySelector('[data-a="flow"]');
    el.classList.toggle('is-flow', flowBtn.getAttribute('aria-pressed') === 'true' && !still.matches);
    el.classList.remove('ne-sel');
    drawNodes(); el.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    requestAnimationFrame(() => { drawWires(); start(); el.classList.add('is-on'); });
    texts();
    el.querySelector('[data-a="close"]').focus({ preventScroll: true });
    try { history.pushState({ ne: id }, '', location.hash); } catch (e) { /* sandboxed */ }
    addEventListener('popstate', pop);
  }
  function pop() { if (st && !el.hidden) close(true); }
  function close(fromPop) {
    if (!st) return;
    removeEventListener('popstate', pop);
    el.classList.remove('is-on');
    const v = side().querySelector('video'); if (v) v.pause();
    const done = () => { el.hidden = true; document.documentElement.style.overflow = ''; };
    if (still.matches) done(); else setTimeout(done, 180);
    const ret = st.ret; st = null;
    if (ret && ret.focus) ret.focus({ preventScroll: true });
    if (!fromPop) { try { if (history.state && history.state.ne) history.back(); } catch (e) { /* sandboxed */ } }
  }

  /* ---------- drawing ---------- */
  function ports() {   // which rows have an input / output wire
    const io = {};
    st.g.edges.forEach(e => {
      (io[e.f[0] + '>' + e.f[1]] = io[e.f[0] + '>' + e.f[1]] || []).push(e.c || 'l');
      (io[e.t[0] + '<' + e.t[1]] = io[e.t[0] + '<' + e.t[1]] || []).push(e.c || 'l');
    });
    return io;
  }
  function drawNodes() {
    const io = ports();
    Object.values(st.nodes).forEach(n => {
      const c = KIND[n.k].col;
      const d = h('div', 'ne-n'); d.style.setProperty('--c', c);
      d.style.left = n.x + 'px'; d.style.top = n.y + 'px'; d.style.width = n.w + 'px';
      d.tabIndex = 0; d.setAttribute('role', 'button'); d.dataset.id = n.id;
      const hd = h('div', 'ne-h'); hd.append(h('span', 'ne-t', n.t), h('span', 'ne-nm', n.n)); d.append(hd);
      const rs = h('div', 'ne-rs');
      n.r.forEach(r => {
        const stored = r.startsWith('·'), raw = stored ? r.slice(1) : r, [a, ...b] = raw.split('  ');
        const row = h('div', 'ne-r' + (stored ? ' is-st' : ''), a); row.dataset.k = key(r);
        if (b.length) row.append(h('i', '', b.join('  ')));
        const ki = io[n.id + '<' + key(r)], ko = io[n.id + '>' + key(r)];
        if (ki) { const p = h('span', 'ne-p ne-p--i'); p.style.setProperty('--pc', WIRE[ki[0]]); row.append(p); }
        if (ko) { const p = h('span', 'ne-p ne-p--o'); p.style.setProperty('--pc', WIRE[ko[0]]); row.append(p); }
        rs.append(row);
      });
      d.append(rs);
      d.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(n.id, true); } });
      n.el = d; world().append(d);
    });
  }
  function anchor(ref, out) {   // world position of a row's port
    const n = st.nodes[ref[0]]; if (!n) return [0, 0];
    const row = [...n.el.querySelectorAll('.ne-r')].find(r => r.dataset.k === ref[1]);
    const y = row ? n.y + row.offsetTop + row.offsetHeight / 2 + 1.5 : n.y + 18;
    return [out ? n.x + n.el.offsetWidth : n.x, y];
  }
  function drawWires() {
    const s = wires(); s.textContent = '';
    st.edges = st.g.edges.map((e, i) => {
      const [x1, y1] = anchor(e.f, true), [x2, y2] = anchor(e.t, false);
      const dx = x2 >= x1 ? Math.max(50, (x2 - x1) * .5) : Math.min(160, 60 + (x1 - x2) * .12);
      const d = `M${x1} ${y1}C${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2} ${y2}`, col = WIRE[e.c || 'l'];
      const p = sv('path', { d, class: 'ne-w', stroke: col }); if (e.dash) p.setAttribute('stroke-dasharray', '6 5');
      const f = sv('path', { d, class: 'ne-wf', stroke: e.c === 'r' ? '#FFB199' : e.c === 'b' ? '#C9D4FF' : e.c === 'g' ? '#E3E3DE' : '#F1FFC2', style: 'animation-delay:' + (-(i * 0.17) % 1.1) + 's' });
      s.append(p, f);
      let t = null;
      if (e.l) { t = sv('text', { x: (x1 + x2) / 2, y: (y1 + y2) / 2 - 6, fill: col, 'text-anchor': 'middle', class: 'ne-wl' }); t.textContent = L(e.l); s.append(t); }
      return { e, p, f, t };
    });
    hot();
  }
  function hot() {
    el.classList.toggle('ne-sel', !!st.sel);
    Object.values(st.nodes).forEach(n => n.el.classList.remove('is-sel', 'is-near'));
    st.edges.forEach(({ e, p, f, t }) => {
      const on = st.sel && (e.f[0] === st.sel || e.t[0] === st.sel);
      [p, f, t].forEach(x => x && x.classList.toggle('is-hot', !!on));
      if (on) { st.nodes[e.f[0]].el.classList.add('is-near'); st.nodes[e.t[0]].el.classList.add('is-near'); }
    });
    if (st.sel) st.nodes[st.sel].el.classList.add('is-sel');
  }
  function apply() { world().style.transform = `translate(${st.tx}px,${st.ty}px) scale(${st.s})`; const v = view(); v.style.backgroundPosition = `${st.tx}px ${st.ty}px`; v.style.backgroundSize = `${24 * st.s}px ${24 * st.s}px`; }
  function bounds(ids) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    (ids || Object.keys(st.nodes)).forEach(id => { const n = st.nodes[id]; x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x + n.el.offsetWidth); y1 = Math.max(y1, n.y + n.el.offsetHeight); });
    return { x0, y0, x1, y1 };
  }
  function frameTo(b, maxS, anim) {
    const v = view(), W = v.clientWidth, H = v.clientHeight, pad = 40;
    const s = Math.max(.22, Math.min(maxS, (W - pad * 2) / (b.x1 - b.x0), (H - pad * 2) / (b.y1 - b.y0)));
    const tx = W / 2 - (b.x0 + b.x1) / 2 * s, ty = H / 2 - (b.y0 + b.y1) / 2 * s;
    glide(tx, ty, s, anim);
  }
  function glide(tx, ty, s, anim) {
    if (!anim || still.matches) { Object.assign(st, { tx, ty, s }); apply(); return; }
    const a = { tx: st.tx, ty: st.ty, s: st.s }, t0 = performance.now(), D = 320;
    (function step(now) {
      if (!st) return;
      const p = Math.min(1, (now - t0) / D), k = 1 - Math.pow(1 - p, 3);
      st.tx = a.tx + (tx - a.tx) * k; st.ty = a.ty + (ty - a.ty) * k; st.s = a.s + (s - a.s) * k; apply();
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }
  function fit(anim) { frameTo(bounds(), 1, anim); }
  function start() {   // first view: the whole graph if it stays readable, otherwise its start at a readable zoom
    const v = view(), b = bounds(), W = v.clientWidth, H = v.clientHeight, pad = 40;
    const s = Math.min(1, (W - pad * 2) / (b.x1 - b.x0), (H - pad * 2) / (b.y1 - b.y0)), min = W < 700 ? .5 : .62;
    if (s >= min) return frameTo(b, 1, false);
    const ty = (b.y1 - b.y0) * min < H - pad * 2 ? H / 2 - (b.y0 + b.y1) / 2 * min : pad - b.y0 * min;
    glide(pad - b.x0 * min, ty, min, false);
  }
  function zoomAt(f, cx, cy) {
    const v = view(); if (cx == null) { cx = v.clientWidth / 2; cy = v.clientHeight / 2; }
    const s = Math.max(.2, Math.min(2.5, st.s * f)); f = s / st.s;
    st.tx = cx - (cx - st.tx) * f; st.ty = cy - (cy - st.ty) * f; st.s = s; apply();
  }

  /* ---------- pointer: drag nodes, pan, pinch ---------- */
  const pts = new Map(); let drag = null, pinch = null;
  function down(e) {
    if (e.button > 0) return;
    const v = view(); v.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: st.s }; drag = null; return; }
    const nd = e.target.closest('.ne-n');
    drag = nd ? { node: st.nodes[nd.dataset.id], x: e.clientX, y: e.clientY, ox: st.nodes[nd.dataset.id].x, oy: st.nodes[nd.dataset.id].y, moved: false }
              : { pan: true, x: e.clientX, y: e.clientY, ox: st.tx, oy: st.ty, moved: false };
    if (drag.pan) v.classList.add('is-pan');
    v.addEventListener('pointermove', move); v.addEventListener('pointerup', up); v.addEventListener('pointercancel', up);
  }
  function move(e) {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pts.size === 2) {
      const [a, b] = [...pts.values()], r = view().getBoundingClientRect();
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      zoomAt((pinch.s * d / pinch.d) / st.s, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
      return;
    }
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
    if (drag.pan) { st.tx = drag.ox + dx; st.ty = drag.oy + dy; apply(); }
    else { const n = drag.node; n.x = drag.ox + dx / st.s; n.y = drag.oy + dy / st.s; n.el.style.left = n.x + 'px'; n.el.style.top = n.y + 'px'; drawWires(); }
  }
  function up(e) {
    pts.delete(e.pointerId);
    const v = view();
    if (pts.size < 2) pinch = null;
    if (pts.size) return;
    v.classList.remove('is-pan');
    v.removeEventListener('pointermove', move); v.removeEventListener('pointerup', up); v.removeEventListener('pointercancel', up);
    if (drag && !drag.moved) select(drag.node ? drag.node.id : null);
    drag = null;
  }
  function wheel(e) {
    e.preventDefault();
    const r = view().getBoundingClientRect();
    if (e.ctrlKey || Math.abs(e.deltaY) >= Math.abs(e.deltaX)) zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? .01 : .0015)), e.clientX - r.left, e.clientY - r.top);
    else { st.tx -= e.deltaX; apply(); }
  }

  /* ---------- selection and the side panel ---------- */
  function select(id, focusView) {
    st.sel = id; hot(); panel();
    if (id && focusView) {
      const n = st.nodes[id], v = view(), cx = n.x + n.el.offsetWidth / 2, cy = n.y + n.el.offsetHeight / 2;
      const s = Math.max(st.s, .8);
      glide(v.clientWidth / 2 - cx * s, v.clientHeight / 2 - cy * s, s, true);
    }
  }
  function texts() {
    if (!st) return;
    el.querySelector('.ne-tag').textContent = ui('tag');
    el.querySelector('.ne-title').textContent = L(st.g.title);
    el.querySelector('[data-a="fit"]').textContent = ui('fit');
    el.querySelector('[data-a="flow"]').textContent = ui('flow');
    el.querySelector('[data-a="close"]').textContent = ui('close') + ' ✕';
    el.querySelector('.ne-hint').textContent = ui('hint');
    st.edges.forEach(({ e, t }) => { if (t) t.textContent = L(e.l); });
    panel();
  }
  function panel() {
    const s = side(), keepVid = s.querySelector('video');
    if (keepVid) keepVid.remove();
    s.textContent = '';
    if (!st.sel) {
      s.append(h('h3', '', L(st.g.title)));
      L(st.g.intro).split('\n').forEach(p => s.append(h('p', '', p)));
      if (st.opts.video) {
        s.append(h('h4', '', ui('clip')));
        const v = keepVid || h('video', 'ne-vid');
        if (!keepVid) { v.src = st.opts.video; v.muted = true; v.loop = true; v.playsInline = true; v.autoplay = !still.matches; v.controls = true; v.preload = 'metadata'; }
        s.append(v); if (!still.matches) v.play().catch(() => {});
      }
      s.append(h('h4', '', ui('legend')));
      const lg = h('ul', 'ne-lg');
      ['ctl', 'dag', 'mat', 'math', 'geo'].forEach(k => { const li = h('li'); const b = h('b'); b.style.borderColor = KIND[k].col; li.append(b, L(KIND[k])); lg.append(li); });
      const used = new Set(st.g.edges.map(e => e.c || 'l'));
      ['l', 'g', 'b', 'r'].filter(c => used.has(c)).forEach(c => { const li = h('li'); const b = h('s'); b.style.borderColor = WIRE[c]; li.append(b, L(WIRE_T[c])); lg.append(li); });
      s.append(lg, h('p', 'ne-note', ui('note')));
      return;
    }
    const n = st.nodes[st.sel];
    const upB = h('button', 'ne-up', '← ' + ui('back')); upB.type = 'button'; upB.addEventListener('click', () => { select(null); fit(true); });
    const k = h('span', 'ne-k', n.t); k.style.color = KIND[n.k].col;
    s.append(upB, h('br'), k, h('h3', '', n.n));
    L(n.d).split('\n').forEach(p => p && s.append(h('p', '', p)));
    const list = (title, arr, side) => {
      s.append(h('h4', '', title));
      if (!arr.length) { s.append(h('p', 'ne-note', ui('none'))); return; }
      const ul = h('ul', 'ne-ls');
      arr.forEach(e => {
        const other = st.nodes[side === 'in' ? e.f[0] : e.t[0]];
        const li = h('li'), b = h('button'); b.type = 'button'; b.style.setProperty('--c', WIRE[e.c || 'l']);
        if (side === 'in') b.append(other.n + '.' + e.f[1], h('em', '', '  →  ' + e.t[1]));
        else b.append(e.f[1] + '  →  ', h('em', '', other.n + '.' + e.t[1]));
        b.addEventListener('click', () => select(other.id, true));
        li.append(b); ul.append(li);
      });
      s.append(ul);
    };
    list(ui('ins'), st.g.edges.filter(e => e.t[0] === n.id), 'in');
    list(ui('outs'), st.g.edges.filter(e => e.f[0] === n.id), 'out');
  }

  window.NodeEditor = { open, close };
})();
