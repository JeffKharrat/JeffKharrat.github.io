/* Node graph panel that slides in over a clip on the project page: only the graph, drawn like the Maya Node Editor.
   Graphs come from js/graphs-*.js (window.NODE_GRAPHS), generated from the Maya file:
     { tab, setup, title{en,ja}, intro{en,ja},
       nodes: [{ id, t: nodeType, x, y, w, h, rows: [{ a, n: niceName, dt, io }], d?{en,ja}, note? }],
       edges: [[srcNode, srcAttr, dstNode, dstAttr]] }
   Navigation: left or middle drag pans, wheel / pinch / right drag zooms, click a node to read it,
   A or double-click frames everything, F frames the selected node, Esc closes.
   All colours are in MAYA so they can be matched to a Node Editor screenshot. */
(function () {
  'use strict';
  const MAYA = {
    graph: '#2B2B2B', grid: '#323232', gridMajor: '#393939',
    head: '#5D5D5D', body: '#474747', line: '#202020', sel: '#FFFFA0', text: '#DADADA',
    nodeType: { joint: '#4B7A4F' },
    port: { m: '#B79AD7', d: '#5ECCDB', d3: '#E2C04F', e: '#E3954B', g: '#6FC16A', i: '#7FC35E', b: '#DE5959' }
  };
  const HEAD = 24, ROW = 18, PADB = 6;
  const T = { en: { close: 'Close node graph', notes: 'Notes' }, ja: { close: 'ノードグラフを閉じる', notes: 'ノート' } };
  const lang = () => (document.documentElement.lang === 'ja' ? 'ja' : 'en');
  const L = v => (v && typeof v === 'object' ? v[lang()] ?? v.en : v ?? '');
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const NS = 'http://www.w3.org/2000/svg';
  const h = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };
  const sv = (tag, at) => { const n = document.createElementNS(NS, tag); for (const k in at) n.setAttribute(k, at[k]); return n; };

  const ICON = t => {
    const c = '#D6D6D6';
    if (/Matrix$|^multMatrix$/.test(t)) return `<svg viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="12" fill="none" stroke="${c}"/><path d="M2 6h12M2 10h12M6 2v12M10 2v12" stroke="${c}" stroke-width=".8"/></svg>`;
    if (t === 'joint') return `<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="4.5" fill="none" stroke="#9BE29B" stroke-width="1.4"/><circle cx="8" cy="8" r="1.4" fill="#9BE29B"/></svg>`;
    if (t === 'transform') return `<svg viewBox="0 0 16 16"><path d="M8 2v12M2 8h12" stroke="${c}" stroke-width="1.3"/><path d="M8 1l2 3H6zM15 8l-3 2V6z" fill="${c}"/></svg>`;
    if (/^nurbs|^mesh|Surface|Curve|Iso|proximityPin|uvPin|blendShape|skinCluster/.test(t)) return `<svg viewBox="0 0 16 16"><path d="M2 12C5 3 11 3 14 12" fill="none" stroke="#8FB8FF" stroke-width="1.4"/><path d="M2 12h12" stroke="#8FB8FF" stroke-width=".8"/></svg>`;
    if (/^ik/.test(t)) return `<svg viewBox="0 0 16 16"><path d="M3 13L8 4l5 9" fill="none" stroke="#E7D17A" stroke-width="1.3"/><circle cx="8" cy="4" r="1.6" fill="#E7D17A"/></svg>`;
    return `<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.5" fill="none" stroke="${c}"/><path d="M5 8h6M8 5v6" stroke="${c}"/></svg>`;
  };

  let open_ = null;

  function css() {
    if (document.getElementById('ne-css')) return;
    const s = h('style'); s.id = 'ne-css';
    s.textContent = `
.ne-host{z-index:6}
.ne-clip{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:3}
.ne{position:absolute;inset:0;pointer-events:auto;overflow:hidden;touch-action:none;overscroll-behavior:contain;cursor:default;outline:none;
  user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;
  background-color:${MAYA.graph};
  background-image:linear-gradient(${MAYA.gridMajor} 1px,transparent 1px),linear-gradient(90deg,${MAYA.gridMajor} 1px,transparent 1px),
    linear-gradient(${MAYA.grid} 1px,transparent 1px),linear-gradient(90deg,${MAYA.grid} 1px,transparent 1px);
  font:11px/1.25 "Segoe UI",Tahoma,"Lucida Grande","Helvetica Neue",Arial,sans-serif;letter-spacing:0;text-transform:none;color:${MAYA.text};
  transform:translateX(102%);transition:transform .32s cubic-bezier(.2,.8,.2,1)}
.ne.is-on{transform:none}
.ne.is-pan{cursor:grabbing}
.ne *{box-sizing:border-box;-webkit-user-drag:none}
.ne-world{position:absolute;left:0;top:0;transform-origin:0 0}
.ne-wires{position:absolute;left:0;top:0;overflow:visible;pointer-events:none}
.ne-w{fill:none;stroke-width:1.6}
.ne-w.is-hot{stroke-width:2.6;filter:brightness(1.35)}
.ne-n{position:absolute;border-radius:5px;background:${MAYA.body};box-shadow:0 0 0 1px ${MAYA.line},0 3px 8px rgba(0,0,0,.35)}
.ne-n:focus-visible{outline:none;box-shadow:0 0 0 1px ${MAYA.line},0 0 0 3px #5285A6}
.ne-n.is-sel{box-shadow:0 0 0 2px ${MAYA.sel},0 3px 10px rgba(0,0,0,.45)}
.ne-nh{display:flex;align-items:center;gap:5px;height:${HEAD}px;padding:0 8px 0 6px;border-radius:5px 5px 0 0;background:linear-gradient(#6A6A6A,var(--nh,${MAYA.head}));
  color:#fff;font-weight:600;white-space:nowrap;overflow:hidden}
.ne-nh svg{width:15px;height:15px;flex:none}
.ne-nh span{overflow:hidden;text-overflow:ellipsis}
.ne-rs{padding-bottom:${PADB}px}
.ne-r{position:relative;height:${ROW}px;display:flex;align-items:center;padding:0 12px;white-space:nowrap}
.ne-r.is-out{justify-content:flex-end}
.ne-p{position:absolute;top:50%;width:9px;height:9px;margin-top:-4.5px;border-radius:50%;background:var(--pc);box-shadow:0 0 0 1px #1C1C1C}
.ne-p--i{left:-4.5px}.ne-p--o{right:-4.5px}
.ne-x{position:absolute;top:8px;right:8px;z-index:2;width:28px;height:28px;display:grid;place-items:center;border:0;border-radius:50%;cursor:pointer;
  background:rgba(20,20,20,.7);color:#EEE;font:14px/1 sans-serif}
.ne-x:hover,.ne-x:focus-visible{background:#C42B1C;color:#fff;outline:none}
.ne-info{position:absolute;left:8px;bottom:8px;z-index:2;width:min(320px,calc(100% - 16px));max-height:45%;overflow:auto;padding:8px 10px 9px;
  background:rgba(30,30,30,.92);border:1px solid #1A1A1A;border-radius:4px;box-shadow:0 4px 14px rgba(0,0,0,.4);cursor:auto;user-select:text;-webkit-user-select:text}
.ne-info[hidden]{display:none}
.ne-info b{display:block;color:#fff;font-weight:600;overflow-wrap:anywhere}
.ne-info small{display:block;color:#9A9A9A;margin:1px 0 5px}
.ne-info p{margin:0 0 5px;color:#D2D2D2;line-height:1.45}
.ne-info .ne-note{color:#BEBEBE;font-style:italic}
@media (max-width:63.99rem){
  .ne-host .ne-tab{display:none}
  .ne-clip{bottom:auto;height:min(70vh,560px);height:min(70svh,560px)}
}
@media (prefers-reduced-motion:reduce){.ne{transition:none}}`;
    document.head.append(s);
  }

  /* ---------- build ---------- */
  function build(fig, g, tab) {
    css();
    const clip = h('div', 'ne-clip'), el = h('div', 'ne');
    el.setAttribute('role', 'region'); el.setAttribute('aria-label', g.setup); el.tabIndex = -1;
    el.innerHTML = `<div class="ne-world"><svg class="ne-wires"></svg></div><button class="ne-x" type="button">✕</button><div class="ne-info" hidden></div>`;
    clip.append(el); fig.append(clip);
    const st = { g, fig, el, clip, tab, video: fig.querySelector('video'), tx: 0, ty: 0, s: 1, sel: null, nodes: {}, wires: [] };
    const world = el.querySelector('.ne-world');
    g.nodes.forEach(n => {
      const node = st.nodes[n.id] = Object.assign({}, n);
      const d = h('div', 'ne-n'); d.tabIndex = 0; d.setAttribute('role', 'button'); d.dataset.id = n.id;
      Object.assign(d.style, { left: n.x + 'px', top: n.y + 'px', width: n.w + 'px' });
      if (MAYA.nodeType[n.t]) d.style.setProperty('--nh', MAYA.nodeType[n.t]);
      const hd = h('div', 'ne-nh'); hd.innerHTML = ICON(n.t); hd.append(h('span', '', n.id)); d.append(hd);
      const rs = h('div', 'ne-rs');
      n.rows.forEach(r => {
        const row = h('div', 'ne-r' + (r.io === 'o' ? ' is-out' : ''), r.n), c = MAYA.port[r.dt] || '#AAA';
        if (r.io.includes('i')) { const p = h('span', 'ne-p ne-p--i'); p.style.setProperty('--pc', c); row.append(p); }
        if (r.io.includes('o')) { const p = h('span', 'ne-p ne-p--o'); p.style.setProperty('--pc', c); row.append(p); }
        rs.append(row);
      });
      d.append(rs);
      d.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(st, n.id, true); } });
      world.append(d); node.el = d;
    });
    const x = el.querySelector('.ne-x');
    x.setAttribute('aria-label', T[lang()].close);
    x.addEventListener('click', () => close());
    x.addEventListener('pointerdown', e => e.stopPropagation());
    el.querySelector('.ne-info').addEventListener('pointerdown', e => e.stopPropagation());
    el.addEventListener('pointerdown', e => down(st, e));
    el.addEventListener('mousedown', e => { if (!e.target.closest('.ne-x,.ne-info')) e.preventDefault(); });   // middle-click autoscroll, text selection
    el.addEventListener('wheel', e => wheel(st, e), { passive: false });
    el.addEventListener('dblclick', e => { if (!e.target.closest('.ne-n,.ne-info,.ne-x')) frameAll(st, true); });
    el.addEventListener('contextmenu', e => e.preventDefault());
    el.addEventListener('auxclick', e => e.preventDefault());
    el.addEventListener('dragstart', e => e.preventDefault());
    el.addEventListener('selectstart', e => { if (!e.target.closest || !e.target.closest('.ne-info')) e.preventDefault(); });
    el.addEventListener('keydown', e => key(st, e));
    return st;
  }

  /* ---------- wires ---------- */
  function anchor(st, id, attr, out) {
    const n = st.nodes[id], i = n.rows.findIndex(r => r.a === attr);
    return [out ? n.x + n.w : n.x, n.y + (i < 0 ? HEAD / 2 : HEAD + i * ROW + ROW / 2)];
  }
  function wires(st) {
    const svg = st.el.querySelector('.ne-wires'); svg.textContent = '';
    st.wires = st.g.edges.map(([a, aa, b, ba]) => {
      const [x1, y1] = anchor(st, a, aa, true), [x2, y2] = anchor(st, b, ba, false);
      const dx = x2 >= x1 ? Math.max(40, (x2 - x1) * .5) : Math.min(220, 80 + (x1 - x2) * .15);
      const row = st.nodes[a].rows.find(r => r.a === aa);
      const p = sv('path', { d: `M${x1} ${y1}C${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2} ${y2}`, class: 'ne-w', stroke: MAYA.port[row ? row.dt : 'd'] || '#AAA' });
      svg.append(p);
      return { a, b, p };
    });
    hot(st);
  }
  function hot(st) {
    Object.values(st.nodes).forEach(n => n.el.classList.toggle('is-sel', n.id === st.sel));
    st.wires.forEach(w => w.p.classList.toggle('is-hot', !!st.sel && (w.a === st.sel || w.b === st.sel)));
  }

  /* ---------- view ---------- */
  function apply(st) {
    st.el.querySelector('.ne-world').style.transform = `translate(${st.tx}px,${st.ty}px) scale(${st.s})`;
    const g1 = 20 * st.s, g5 = 100 * st.s;
    st.el.style.backgroundSize = `${g5}px ${g5}px,${g5}px ${g5}px,${g1}px ${g1}px,${g1}px ${g1}px`;
    st.el.style.backgroundPosition = `${st.tx}px ${st.ty}px`;
  }
  function bounds(st, ids) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    (ids || Object.keys(st.nodes)).forEach(id => { const n = st.nodes[id]; x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x + n.w); y1 = Math.max(y1, n.y + n.h); });
    return { x0, y0, x1, y1 };
  }
  function glide(st, tx, ty, s, anim) {
    st.anim = (st.anim || 0) + 1;
    if (!anim || still.matches) { Object.assign(st, { tx, ty, s }); apply(st); return; }
    const id = st.anim, a = { tx: st.tx, ty: st.ty, s: st.s }, t0 = performance.now(), D = 280;
    (function step(now) {
      if (st.anim !== id || open_ !== st) return;   // a drag or zoom took over
      const p = Math.min(1, (now - t0) / D), k = 1 - Math.pow(1 - p, 3);
      st.tx = a.tx + (tx - a.tx) * k; st.ty = a.ty + (ty - a.ty) * k; st.s = a.s + (s - a.s) * k; apply(st);
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }
  function frameBox(st, b, maxS, anim) {
    const W = st.el.clientWidth, H = st.el.clientHeight, pad = 28;
    const s = Math.max(.06, Math.min(maxS, (W - pad * 2) / (b.x1 - b.x0), (H - pad * 2) / (b.y1 - b.y0)));
    glide(st, W / 2 - (b.x0 + b.x1) / 2 * s, H / 2 - (b.y0 + b.y1) / 2 * s, s, anim);
  }
  const frameAll = (st, anim) => frameBox(st, bounds(st), 1, anim);
  function frameNode(st, id) {
    const ids = [id]; st.g.edges.forEach(([a, , b]) => { if (a === id) ids.push(b); if (b === id) ids.push(a); });
    frameBox(st, bounds(st, ids), 1, true);
  }
  function zoomAt(st, f, cx, cy) {
    st.anim = (st.anim || 0) + 1;
    if (cx == null) { cx = st.el.clientWidth / 2; cy = st.el.clientHeight / 2; }
    const s = Math.max(.06, Math.min(3, st.s * f)); f = s / st.s;
    st.tx = cx - (cx - st.tx) * f; st.ty = cy - (cy - st.ty) * f; st.s = s; apply(st);
  }
  function first(st) {   // opening view: the whole graph if legible, otherwise its start at a legible zoom
    const b = bounds(st), W = st.el.clientWidth, H = st.el.clientHeight, pad = 28;
    const s = Math.min(1, (W - pad * 2) / (b.x1 - b.x0), (H - pad * 2) / (b.y1 - b.y0)), min = .5;
    if (s >= min) return frameAll(st, false);
    glide(st, pad - b.x0 * min, pad - b.y0 * min, min, false);
  }

  /* ---------- pointer: left / middle drag pans, right drag zooms, pinch zooms ---------- */
  function down(st, e) {
    if (e.target.closest('.ne-x,.ne-info')) return;
    e.preventDefault();                        // no text selection, no middle-click autoscroll, no native drag
    e.stopPropagation();
    st.el.focus({ preventScroll: true });
    const pts = st.pts || (st.pts = new Map());
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { st.el.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }
    st.anim = (st.anim || 0) + 1;
    if (pts.size === 2) { const [a, b] = [...pts.values()]; st.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: st.s }; st.drag = null; return; }
    const nd = e.target.closest('.ne-n');
    st.drag = { mode: e.button === 2 ? 'zoom' : 'pan', node: nd && e.button === 0 ? nd.dataset.id : null, x: e.clientX, y: e.clientY, lx: e.clientX, ox: st.tx, oy: st.ty, moved: false };
    if (st.listening) return;
    st.listening = true;
    const move = ev => {
      if (!pts.has(ev.pointerId)) return;
      ev.preventDefault();
      pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (st.pinch && pts.size === 2) {
        const [a, b] = [...pts.values()], r = st.el.getBoundingClientRect();
        zoomAt(st, st.pinch.s * Math.hypot(a.x - b.x, a.y - b.y) / st.pinch.d / st.s, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top);
        return;
      }
      const d = st.drag; if (!d) return;
      const dx = ev.clientX - d.x, dy = ev.clientY - d.y;
      if (!d.moved && Math.abs(dx) + Math.abs(dy) > 3) { d.moved = true; st.el.classList.add('is-pan'); }
      if (!d.moved) return;
      if (d.mode === 'pan') { st.tx = d.ox + dx; st.ty = d.oy + dy; apply(st); }
      else { const r = st.el.getBoundingClientRect(); zoomAt(st, Math.exp((ev.clientX - d.lx) * .006), d.x - r.left, d.y - r.top); d.lx = ev.clientX; }
    };
    const up = ev => {
      if (!pts.has(ev.pointerId)) return;
      pts.delete(ev.pointerId);
      if (pts.size < 2) st.pinch = null;
      if (pts.size) return;
      removeEventListener('pointermove', move, true); removeEventListener('pointerup', up, true); removeEventListener('pointercancel', up, true);
      st.listening = false; st.el.classList.remove('is-pan');
      const d = st.drag; st.drag = null;
      if (d && !d.moved && d.mode === 'pan' && ev.type === 'pointerup' && ev.button === 0) select(st, d.node);
    };
    addEventListener('pointermove', move, true); addEventListener('pointerup', up, true); addEventListener('pointercancel', up, true);
  }
  function wheel(st, e) {
    e.preventDefault(); e.stopPropagation();
    const r = st.el.getBoundingClientRect();
    zoomAt(st, Math.exp(-e.deltaY * (e.ctrlKey ? .01 : .0016)), e.clientX - r.left, e.clientY - r.top);
  }
  function key(st, e) {
    if (e.key === 'Escape') { e.stopPropagation(); if (st.sel) select(st, null); else close(); }
    else if (e.key === 'f' || e.key === 'F') { st.sel ? frameNode(st, st.sel) : frameAll(st, true); }
    else if (e.key === 'a' || e.key === 'A') frameAll(st, true);
    else if (e.key === '+' || e.key === '=') zoomAt(st, 1.2);
    else if (e.key === '-') zoomAt(st, 1 / 1.2);
  }

  /* ---------- selection: a small card with what the node does ---------- */
  function select(st, id, frame) { st.sel = id; hot(st); info(st); if (id && frame) frameNode(st, id); }
  function info(st) {
    const box = st.el.querySelector('.ne-info'), n = st.sel ? st.nodes[st.sel] : null;
    box.textContent = ''; box.hidden = !n || (!n.d && !n.note);
    if (box.hidden) return;
    box.append(h('b', '', n.id), h('small', '', n.t));
    if (n.d) box.append(h('p', '', L(n.d)));
    if (n.note) box.append(h('p', 'ne-note', T[lang()].notes + ': ' + n.note));
  }

  /* ---------- open / close ---------- */
  function open(id, opts) {
    const g = (window.NODE_GRAPHS || {})[id]; if (!g || !opts || !opts.host) return;
    if (open_ && open_.fig === opts.host) return close();
    if (open_) close(true);
    const st = build(opts.host, g, opts.tab);
    open_ = st; opts.host.classList.add('ne-host');
    if (st.video && !st.video.paused) { st.wasPlaying = true; st.video.pause(); }
    if (st.tab) st.tab.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => {
      wires(st); first(st);
      requestAnimationFrame(() => st.el.classList.add('is-on'));
      st.el.focus({ preventScroll: true });
    });
  }
  function close(quick) {
    const st = open_; if (!st) return; open_ = null;
    st.el.classList.remove('is-on');
    if (st.tab) { st.tab.setAttribute('aria-expanded', 'false'); if (!quick) st.tab.focus({ preventScroll: true }); }
    if (st.wasPlaying && st.video) st.video.play().catch(() => {});
    setTimeout(() => { st.clip.remove(); if (!(open_ && open_.fig === st.fig)) st.fig.classList.remove('ne-host'); }, quick || still.matches ? 0 : 340);
  }
  document.addEventListener('click', e => { if (open_ && e.target.closest('[data-lang]')) setTimeout(() => { if (open_) { info(open_); open_.el.querySelector('.ne-x').setAttribute('aria-label', T[lang()].close); } }, 0); });
  addEventListener('resize', () => { if (open_) apply(open_); });

  window.NodeEditor = { open, close, isOpen: () => !!open_ };
})();
