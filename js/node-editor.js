/* Node graph panel that slides in over a clip on the project page.
   The nodes are drawn like the Maya Node Editor (colours sampled from Maya screenshots); the graph is split into
   stages that read left to right, with a guided walk-through that frames one stage at a time and shows the data
   travelling along its wires.
   Graphs come from js/graphs-*.js (window.NODE_GRAPHS), generated from the Maya file:
     { setup, overview{en,ja}, stages: [{ title{en,ja}, text{en,ja} }],
       nodes: [{ id, t: nodeType, s: stage, x, y, w, h, rows: [{ a, n: niceName, dt, io }], d?{en,ja}, note? }],
       edges: [[srcNode, srcAttr, dstNode, dstAttr]] }
   Navigation: left or middle drag pans, wheel / pinch / right drag zooms, click a node to read it,
   ← → change step, A or double-click frames everything, F frames the selected node, Esc closes. */
(function () {
  'use strict';
  /* Sampled from Maya Node Editor screenshots */
  const MAYA = {
    graph: '#2F2F2F', grid: '#1A1A1A', outline: '#000000', name: '#EEEEEE', label: '#EEEEEE', sel: '#6EBE99', hamb: '#BDBDBD',
    body: {                                     // [row, alternate row, filter field]
      matrix: ['#1B6783', '#2D738D', '#205264'],
      math: ['#555555', '#636363', '#464646'],
      joint: ['#1C5748', '#256453', '#17463A'],
      dag: ['#5F5F5F', '#6A6A6A', '#4E4E4E']
    },
    master: { on: '#FFA500', off: '#FFFFFF' },
    port: { m: '#507D8C', d: '#7A996B', d3: '#7A996B', i: '#7A996B', e: '#000000', b: '#B69D89', g: '#C9C9C9', msg: '#0A28C3' }
  };
  const HEAD = 34, FIELD = 26, ROW = 22, PADB = 8, NAME = 20, GRID = 42;
  const T = {
    en: { close: 'Close node graph', notes: 'Notes', overview: 'Overview', prev: 'Previous step', next: 'Next step', step: 'Step' },
    ja: { close: 'ノードグラフを閉じる', notes: 'ノート', overview: '概要', prev: '前のステップ', next: '次のステップ', step: 'ステップ' }
  };
  const lang = () => (document.documentElement.lang === 'ja' ? 'ja' : 'en');
  const L = v => (v && typeof v === 'object' ? v[lang()] ?? v.en : v ?? '');
  const t = k => T[lang()][k];
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const NS = 'http://www.w3.org/2000/svg';
  const h = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };
  const sv = (tag, at) => { const n = document.createElementNS(NS, tag); for (const k in at) n.setAttribute(k, at[k]); return n; };

  const family = ty => /Matrix|^uvPin$|^proximityPin$/.test(ty) ? 'matrix' : ty === 'joint' ? 'joint' : /^(transform|ikHandle|ikEffector|nurbsCurve|nurbsSurface|mesh)$/.test(ty) ? 'dag' : 'math';

  /* Header icons in the spirit of Maya's node icons */
  function ICON(ty) {
    if (/^decomposeMatrix$|^composeMatrix$|^multMatrix$|^inverseMatrix$|^pickMatrix$|^pointMatrixMult/.test(ty))
      return `<svg viewBox="0 0 28 28"><g font-family="Segoe UI,Arial,sans-serif" font-weight="700" font-size="9" fill="#C9E7EF" stroke="#0B2E3B" stroke-width="2" paint-order="stroke">
        <text x="2" y="10">0</text><text x="16" y="9">0</text><text x="1" y="19">1</text><text x="10" y="16">0</text><text x="19" y="18">2</text><text x="9" y="26">3</text></g></svg>`;
    if (/^blendMatrix$|^aimMatrix$/.test(ty))
      return `<svg viewBox="0 0 28 28"><g fill="#D9E9EE" stroke="#0B2E3B" stroke-width="1.2"><rect x="9" y="4" width="13" height="16" rx="1"/><rect x="6" y="7" width="13" height="16" rx="1"/><rect x="3" y="10" width="13" height="16" rx="1"/></g></svg>`;
    if (/^uvPin$|^proximityPin$/.test(ty))
      return `<svg viewBox="0 0 28 28"><path d="M3 20C8 10 18 10 25 18" fill="none" stroke="#D9E9EE" stroke-width="2"/><circle cx="14" cy="13" r="3.4" fill="#FFA500" stroke="#000" stroke-width="1"/><path d="M14 16v8" stroke="#D9E9EE" stroke-width="1.6"/></svg>`;
    if (ty === 'joint')
      return `<svg viewBox="0 0 28 28"><g stroke="#E8E8E8" stroke-width="2.2" fill="none"><path d="M5 8l9 6 9-8M14 14v9"/></g><g fill="#E8E8E8"><circle cx="5" cy="8" r="2.6"/><circle cx="14" cy="14" r="2.6"/><circle cx="23" cy="6" r="2.6"/><circle cx="14" cy="23" r="2.6"/></g></svg>`;
    if (ty === 'transform')
      return `<svg viewBox="0 0 28 28"><path d="M6 21l5-14h12l-5 14z" fill="#B7B7B7" stroke="#222" stroke-width="1"/><path d="M8 14h11" stroke="#D63A2B" stroke-width="2.4"/><path d="M19 10.5l4 3.5-4 3.5z" fill="#D63A2B"/></svg>`;
    if (/^nurbs|^mesh|^curveFrom|Surface$/.test(ty))
      return `<svg viewBox="0 0 28 28"><path d="M3 21C8 6 20 6 25 21" fill="none" stroke="#E0E0E0" stroke-width="2"/><g fill="#E0E0E0"><circle cx="3" cy="21" r="2"/><circle cx="14" cy="9.5" r="2"/><circle cx="25" cy="21" r="2"/></g></svg>`;
    if (/^ik/.test(ty))
      return `<svg viewBox="0 0 28 28"><path d="M4 23L14 6l10 17" fill="none" stroke="#E7D17A" stroke-width="2"/><circle cx="14" cy="6" r="3" fill="#E7D17A"/></svg>`;
    if (/^blendShape$|^skinCluster$/.test(ty))
      return `<svg viewBox="0 0 28 28"><path d="M4 18c3-9 7-9 10 0s7 9 10 0" fill="none" stroke="#E0E0E0" stroke-width="2"/></svg>`;
    return `<svg viewBox="0 0 28 28"><rect x="1.5" y="1.5" width="25" height="25" fill="#45B7C4" stroke="#000" stroke-width="1.4"/><path d="M1.5 26.5L26.5 1.5V26.5Z" fill="#C8C8C8"/>
      <path d="M1.5 26.5L26.5 1.5" stroke="#000" stroke-width="1.2"/><g stroke="#000" stroke-width="2"><path d="M5 5l6 6M11 5l-6 6"/><path d="M16 20h7"/></g><g fill="#000"><circle cx="19.5" cy="16.5" r="1.3"/><circle cx="19.5" cy="23.5" r="1.3"/></g></svg>`;
  }

  let open_ = null;

  function css() {
    if (document.getElementById('ne-css')) return;
    const s = h('style'); s.id = 'ne-css';
    s.textContent = `
.ne-host{z-index:6}
.ne-clip{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:3}
.ne{position:absolute;inset:0;pointer-events:auto;overflow:hidden;touch-action:none;overscroll-behavior:contain;cursor:default;outline:none;
  user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;background-color:${MAYA.graph};
  background-image:linear-gradient(${MAYA.grid} 1px,transparent 1px),linear-gradient(90deg,${MAYA.grid} 1px,transparent 1px);
  font:13px/1.2 "Segoe UI",Tahoma,"Lucida Grande","Helvetica Neue",Arial,sans-serif;letter-spacing:0;text-transform:none;color:${MAYA.label};
  transform:translateX(102%);transition:transform .32s cubic-bezier(.2,.8,.2,1)}
.ne.is-on{transform:none}
.ne.is-pan{cursor:grabbing}
.ne *{box-sizing:border-box;-webkit-user-drag:none}
.ne-world{position:absolute;left:0;top:0;transform-origin:0 0}
.ne-frames,.ne-wires{position:absolute;left:0;top:0;overflow:visible;pointer-events:none}
.ne-fr{fill:rgba(255,255,255,.035);stroke:rgba(255,255,255,.13);stroke-width:2;transition:opacity .3s}
.ne-fr.is-cur{fill:rgba(110,190,153,.06);stroke:rgba(110,190,153,.55)}
.ne-w{fill:none;stroke-width:2;transition:opacity .3s}
.ne-f{fill:none;stroke-width:5;stroke-linecap:round;stroke-dasharray:0 90;opacity:0;transition:opacity .3s}
.ne-f.is-run{opacity:1;animation:ne-flow 2.6s linear infinite}
@keyframes ne-flow{to{stroke-dashoffset:-90}}
.ne-dim{opacity:.16}
.ne-n{position:absolute;transition:opacity .3s}
.ne-nm{position:absolute;left:3px;bottom:100%;margin-bottom:3px;font-size:14px;color:${MAYA.name};white-space:nowrap;pointer-events:none}
.ne-b{position:relative;border:2px solid ${MAYA.outline};border-radius:7px;background:var(--r0);overflow:visible}
.ne-n.is-sel .ne-b{border-color:${MAYA.sel};box-shadow:0 0 0 2px ${MAYA.sel}}
.ne-n.is-sel .ne-nm{color:${MAYA.sel}}
.ne-n:focus-visible{outline:none}.ne-n:focus-visible .ne-b{box-shadow:0 0 0 3px #5285A6}
.ne-hd{position:relative;height:${HEAD - 2}px;display:flex;align-items:center;padding:0 16px}
.ne-hd svg{width:28px;height:28px;flex:none}
.ne-hm{margin-left:auto;display:grid;gap:3px}
.ne-hm i{display:block;width:22px;height:5px;border-radius:3px;background:${MAYA.hamb}}
.ne-mp{position:absolute;top:50%;width:19px;height:19px;margin-top:-9.5px;border-radius:50%;border:2px solid #000}
.ne-mp--i{left:-11px}.ne-mp--o{right:-11px}
.ne-fd{height:18px;margin:0 9px 8px;background:var(--r2);border:1px solid rgba(0,0,0,.35);border-radius:2px}
.ne-r{position:relative;height:${ROW}px;display:flex;align-items:center;padding:0 22px;white-space:nowrap;font-size:13px}
.ne-r:nth-child(even){background:var(--r1)}
.ne-r.is-out{justify-content:flex-end}
.ne-r u{display:inline-block;width:10px;height:10px;border:1px solid rgba(255,255,255,.45);margin:0 2px 0 4px;position:relative;text-decoration:none}
.ne-r u::before,.ne-r u::after{content:"";position:absolute;background:rgba(255,255,255,.55)}
.ne-r u::before{left:2px;right:2px;top:3.5px;height:1px}.ne-r u::after{top:2px;bottom:2px;left:3.5px;width:1px}
.ne-r.is-in u{margin:0 4px 0 -4px}
.ne-rs{padding-bottom:${PADB - 2}px;border-radius:0 0 5px 5px}
.ne-p{position:absolute;top:50%;width:15px;height:15px;margin-top:-7.5px;border-radius:50%;background:var(--pc);border:2px solid #000}
.ne-p--i{left:-9px}.ne-p--o{right:-9px}
.ne-labels{position:absolute;inset:0;pointer-events:none}
.ne-sl{position:absolute;display:flex;align-items:center;gap:7px;white-space:nowrap;font-size:13px;font-weight:600;color:#EDEDED;transition:opacity .3s;
  padding:3px 9px 3px 3px;border-radius:14px;background:rgba(20,20,20,.72)}
.ne-sl span{overflow:hidden;text-overflow:ellipsis}
.ne-sl.is-num{padding-right:3px}.ne-sl.is-num span{display:none}
.ne-sl b{flex:none;display:grid;place-items:center;width:21px;height:21px;border-radius:50%;background:#EDEDED;color:#1A1A1A;font-size:12px}
.ne-sl.is-cur b{background:${MAYA.sel}}
.ne-x{position:absolute;top:8px;right:8px;z-index:3;width:28px;height:28px;display:grid;place-items:center;border:0;border-radius:50%;cursor:pointer;
  background:rgba(20,20,20,.75);color:#EEE;font:14px/1 sans-serif}
.ne-x:hover,.ne-x:focus-visible{background:#C42B1C;color:#fff;outline:none}
.ne-tour{position:absolute;left:0;right:0;bottom:0;z-index:2;padding:10px 12px 10px;background:linear-gradient(transparent,rgba(18,18,18,.94) 22px);cursor:auto}
.ne-tt{display:flex;align-items:baseline;gap:8px;margin:12px 0 3px;color:#fff;font-weight:600;font-size:14px}
.ne-tt span{color:${MAYA.sel};font-size:12px;font-weight:600}
.ne-tx{margin:0 0 9px;color:#D6D6D6;font-size:13px;line-height:1.45;max-width:62em;min-height:2.9em}
.ne-steps{display:flex;align-items:center;gap:5px;overflow-x:auto;scrollbar-width:none}
.ne-steps::-webkit-scrollbar{display:none}
.ne-steps button{flex:none;border:1px solid #4A4A4A;background:#2A2A2A;color:#CFCFCF;font:12px/1 "Segoe UI",Tahoma,sans-serif;border-radius:12px;padding:5px 9px;cursor:pointer;white-space:nowrap}
.ne-steps button:hover,.ne-steps button:focus-visible{border-color:#8A8A8A;color:#fff;outline:none}
.ne-steps button[aria-current="step"]{background:${MAYA.sel};border-color:${MAYA.sel};color:#0F2A1F;font-weight:600}
.ne-steps .ne-ar{width:26px;height:24px;padding:0;display:grid;place-items:center;font-size:14px}
.ne-card{position:absolute;left:10px;top:10px;z-index:3;width:min(330px,calc(100% - 60px));max-height:52%;overflow:auto;padding:9px 11px 10px;
  background:rgba(24,24,24,.94);border:1px solid #111;border-left:3px solid ${MAYA.sel};border-radius:4px;box-shadow:0 4px 14px rgba(0,0,0,.4);cursor:auto;
  user-select:text;-webkit-user-select:text;font-size:12.5px}
.ne-card[hidden]{display:none}
.ne-card b{display:block;color:#fff;font-weight:600;overflow-wrap:anywhere}
.ne-card small{display:block;color:#9A9A9A;margin:1px 0 6px}
.ne-card p{margin:0 0 5px;color:#D4D4D4;line-height:1.45}
.ne-card .ne-note{color:#BEBEBE;font-style:italic}
@media (max-width:63.99rem){
  .ne-host .ne-tab{display:none}
  .ne-clip{bottom:auto;height:min(78vh,620px);height:min(78svh,620px)}
  .ne-tx{font-size:12.5px;min-height:0}
}
@media (prefers-reduced-motion:reduce){.ne{transition:none}.ne-f.is-run{animation:none;opacity:0}}`;
    document.head.append(s);
  }

  /* ---------- build ---------- */
  function build(fig, g, tab) {
    css();
    const clip = h('div', 'ne-clip'), el = h('div', 'ne');
    el.setAttribute('role', 'region'); el.setAttribute('aria-label', g.setup); el.tabIndex = -1;
    el.innerHTML = `<div class="ne-world"><svg class="ne-frames"></svg><svg class="ne-wires"></svg></div><div class="ne-labels"></div>
      <button class="ne-x" type="button">✕</button><div class="ne-card" hidden></div>
      <div class="ne-tour"><p class="ne-tt"></p><p class="ne-tx"></p><div class="ne-steps"></div></div>`;
    clip.append(el); fig.append(clip);
    const st = { g, fig, el, clip, tab, video: fig.querySelector('video'), tx: 0, ty: 0, s: 1, sel: null, step: -1, nodes: {}, wires: [] };
    const world = el.querySelector('.ne-world');
    const hasIn = new Set(g.edges.map(e => e[2]));
    g.nodes.forEach(n => {
      const node = st.nodes[n.id] = Object.assign({}, n);
      const fam = family(n.t), [r0, r1, r2] = MAYA.body[fam];
      const d = h('div', 'ne-n'); d.tabIndex = 0; d.setAttribute('role', 'button'); d.dataset.id = n.id;
      Object.assign(d.style, { left: n.x + 'px', top: n.y + 'px', width: n.w + 'px' });
      d.style.setProperty('--r0', r0); d.style.setProperty('--r1', r1); d.style.setProperty('--r2', r2);
      const b = h('div', 'ne-b');
      const hd = h('div', 'ne-hd'); hd.innerHTML = ICON(n.t) + '<span class="ne-hm"><i></i><i></i><i></i></span>';
      const mi = h('span', 'ne-mp ne-mp--i'), mo = h('span', 'ne-mp ne-mp--o');
      mi.style.background = hasIn.has(n.id) ? MAYA.master.on : MAYA.master.off; mo.style.background = MAYA.master.on;
      hd.append(mi, mo); b.append(hd, h('div', 'ne-fd'));
      const rs = h('div', 'ne-rs');
      n.rows.forEach(r => {
        const out = r.io === 'o', row = h('div', 'ne-r ' + (out ? 'is-out' : 'is-in')), c = MAYA.port[r.dt] || '#888';
        const comp = r.dt === 'd3' ? h('u') : null;
        if (out) { row.append(r.n); if (comp) row.append(comp); } else { if (comp) row.append(comp); row.append(r.n); }
        if (r.io.includes('i')) { const p = h('span', 'ne-p ne-p--i'); p.style.setProperty('--pc', c); row.append(p); }
        if (r.io.includes('o')) { const p = h('span', 'ne-p ne-p--o'); p.style.setProperty('--pc', c); row.append(p); }
        rs.append(row);
      });
      b.append(rs); d.append(h('span', 'ne-nm', n.id), b);
      d.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(st, n.id, true); } });
      world.append(d); node.el = d;
    });
    // stage labels (screen space, so they stay readable at any zoom)
    st.labels = (g.stages || []).map((s, k) => { const l = h('div', 'ne-sl'); l.append(h('b', '', String(k + 1)), h('span', '', '')); el.querySelector('.ne-labels').append(l); return l; });
    // steps bar
    const steps = el.querySelector('.ne-steps');
    const prev = h('button', 'ne-ar', '‹'); prev.type = 'button'; prev.addEventListener('click', () => go(st, Math.max(-1, st.step - 1)));
    steps.append(prev);
    st.stepBtns = [-1, ...(g.stages || []).map((_, k) => k)].map(k => { const b = h('button'); b.type = 'button'; b.addEventListener('click', () => go(st, k)); steps.append(b); return b; });
    const next = h('button', 'ne-ar', '›'); next.type = 'button'; next.addEventListener('click', () => go(st, Math.min(g.stages.length - 1, st.step + 1)));
    steps.append(next); st.prev = prev; st.next = next;
    // events
    const x = el.querySelector('.ne-x');
    x.addEventListener('click', () => close());
    ['.ne-x', '.ne-card', '.ne-tour'].forEach(q => el.querySelector(q).addEventListener('pointerdown', e => e.stopPropagation()));
    el.addEventListener('pointerdown', e => down(st, e));
    el.addEventListener('mousedown', e => { if (!e.target.closest('.ne-x,.ne-card,.ne-tour')) e.preventDefault(); });
    el.addEventListener('wheel', e => wheel(st, e), { passive: false });
    el.addEventListener('dblclick', e => { if (!e.target.closest('.ne-n,.ne-card,.ne-x,.ne-tour')) frameAll(st, true); });
    el.addEventListener('contextmenu', e => e.preventDefault());
    el.addEventListener('auxclick', e => e.preventDefault());
    el.addEventListener('dragstart', e => e.preventDefault());
    el.addEventListener('selectstart', e => { if (!(e.target.closest && e.target.closest('.ne-card,.ne-tour'))) e.preventDefault(); });
    el.addEventListener('keydown', e => key(st, e));
    texts(st);
    return st;
  }

  /* ---------- drawing ---------- */
  function anchor(st, id, attr, out) {
    const n = st.nodes[id], i = n.rows.findIndex(r => r.a === attr);
    return [out ? n.x + n.w + 1 : n.x - 1, n.y + (i < 0 ? HEAD / 2 : HEAD + FIELD + i * ROW + ROW / 2)];
  }
  function draw(st) {
    const svg = st.el.querySelector('.ne-wires'); svg.textContent = '';
    st.wires = st.g.edges.map(([a, aa, b, ba], i) => {
      const [x1, y1] = anchor(st, a, aa, true), [x2, y2] = anchor(st, b, ba, false);
      const dx = x2 >= x1 ? Math.max(50, (x2 - x1) * .45) : Math.min(260, 90 + (x1 - x2) * .15);
      const row = st.nodes[a].rows.find(r => r.a === aa), col = MAYA.port[row ? row.dt : 'd'] || '#888';
      const d = `M${x1} ${y1}C${x1 + dx} ${y1} ${x2 - dx} ${y2} ${x2} ${y2}`;
      const p = sv('path', { d, class: 'ne-w', stroke: col === '#000000' ? '#111' : col });
      const f = sv('path', { d, class: 'ne-f', stroke: col === '#000000' ? '#9A9A9A' : lighten(col), style: `animation-delay:${-(i * .53) % 2.6}s` });
      svg.append(p, f);
      return { a, b, p, f, sa: st.nodes[a].s, sb: st.nodes[b].s };
    });
    // stage frames
    const fr = st.el.querySelector('.ne-frames'); fr.textContent = '';
    st.frames = (st.g.stages || []).map((_, k) => {
      const b = bounds(st, Object.keys(st.nodes).filter(id => st.nodes[id].s === k), true), P = 46;
      const box = { x0: b.x0 - P, y0: b.y0 - P - 34, x1: b.x1 + P, y1: b.y1 + P };
      const r = sv('rect', { x: box.x0, y: box.y0, width: box.x1 - box.x0, height: box.y1 - box.y0, rx: 22, class: 'ne-fr' });
      fr.append(r); return { r, box };
    });
    state(st);
  }
  function lighten(hex) {
    const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(v + (255 - v) * .55));
    return '#' + c.map(v => v.toString(16).padStart(2, '0')).join('');
  }
  /* what is lit, dimmed and flowing for the current step and selection */
  function state(st) {
    const k = st.step;
    Object.values(st.nodes).forEach(n => {
      n.el.classList.toggle('ne-dim', k >= 0 && n.s !== k);
      n.el.classList.toggle('is-sel', n.id === st.sel);
    });
    st.wires.forEach(w => {
      const inStep = k < 0 || w.sb === k || w.sa === k, sel = st.sel && (w.a === st.sel || w.b === st.sel);
      w.p.classList.toggle('ne-dim', !inStep && !sel);
      w.f.classList.toggle('is-run', !!sel || (k >= 0 && w.sb === k) || (k < 0 && !st.sel));
    });
    (st.frames || []).forEach((f, i) => { f.r.classList.toggle('is-cur', i === k); f.r.classList.toggle('ne-dim', k >= 0 && i !== k); });
    st.labels.forEach((l, i) => { l.classList.toggle('is-cur', i === k); l.style.opacity = k >= 0 && i !== k ? .35 : 1; });
    st.stepBtns.forEach((b, i) => { if (i - 1 === k) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current'); });
    st.prev.disabled = k < 0; st.next.disabled = k >= st.g.stages.length - 1;
    const cur = st.stepBtns[k + 1]; if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  function texts(st) {
    const k = st.step, g = st.g;
    st.el.querySelector('.ne-x').setAttribute('aria-label', t('close'));
    st.prev.setAttribute('aria-label', t('prev')); st.next.setAttribute('aria-label', t('next'));
    st.stepBtns.forEach((b, i) => { b.textContent = i === 0 ? t('overview') : i + ' · ' + L(g.stages[i - 1].title); });
    st.labels.forEach((l, i) => { l.lastChild.textContent = L(g.stages[i].title); });
    const tt = st.el.querySelector('.ne-tt'); tt.textContent = '';
    if (k < 0) tt.append(t('overview'));
    else { tt.append(h('span', '', t('step') + ' ' + (k + 1) + '/' + g.stages.length), L(g.stages[k].title)); }
    st.el.querySelector('.ne-tx').textContent = k < 0 ? L(g.overview) : L(g.stages[k].text);
    card(st);
  }

  /* ---------- view ---------- */
  function apply(st) {
    st.el.querySelector('.ne-world').style.transform = `translate(${st.tx}px,${st.ty}px) scale(${st.s})`;
    let g = GRID * st.s; while (g < 14) g *= 4;            // like Maya, the grid coarsens as you zoom out
    st.el.style.backgroundSize = `${g}px ${g}px,${g}px ${g}px`;
    st.el.style.backgroundPosition = `${st.tx}px ${st.ty}px`;
    (st.frames || []).forEach((f, i) => {
      const l = st.labels[i]; if (!l) return;
      l.style.left = (st.tx + (f.box.x0 + 14) * st.s) + 'px'; l.style.top = (st.ty + (f.box.y0 + 12) * st.s) + 'px';
      const room = (f.box.x1 - f.box.x0 - 28) * st.s;          // the title shortens to fit its frame, down to just the number
      l.style.maxWidth = Math.max(27, room) + 'px'; l.classList.toggle('is-num', room < 70);
    });
  }
  function bounds(st, ids, withName) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    (ids || Object.keys(st.nodes)).forEach(id => { const n = st.nodes[id]; x0 = Math.min(x0, n.x - 12); y0 = Math.min(y0, n.y - (withName ? NAME + 4 : NAME)); x1 = Math.max(x1, n.x + n.w + 12); y1 = Math.max(y1, n.y + n.h); });
    return { x0, y0, x1, y1 };
  }
  const area = st => { const tour = st.el.querySelector('.ne-tour'); return { W: st.el.clientWidth, H: st.el.clientHeight - (tour ? tour.offsetHeight : 0) }; };
  function glide(st, tx, ty, s, anim) {
    st.anim = (st.anim || 0) + 1;
    if (!anim || still.matches) { Object.assign(st, { tx, ty, s }); apply(st); return; }
    const id = st.anim, a = { tx: st.tx, ty: st.ty, s: st.s }, t0 = performance.now(), D = 520;
    (function step(now) {
      if (st.anim !== id || open_ !== st) return;
      const p = Math.min(1, (now - t0) / D), k = p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2;
      st.tx = a.tx + (tx - a.tx) * k; st.ty = a.ty + (ty - a.ty) * k; st.s = a.s + (s - a.s) * k; apply(st);
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }
  function frameBox(st, b, maxS, anim) {
    const { W, H } = area(st), pad = 18;
    const s = Math.max(.05, Math.min(maxS, (W - pad * 2) / (b.x1 - b.x0), (H - pad * 2 - 30) / (b.y1 - b.y0)));
    glide(st, W / 2 - (b.x0 + b.x1) / 2 * s, 30 + pad + (H - pad * 2 - 30) / 2 - (b.y0 + b.y1) / 2 * s, s, anim);
  }
  function frameAll(st, anim) {
    const fs = st.frames || []; if (!fs.length) return frameBox(st, bounds(st), 1, anim);
    frameBox(st, { x0: Math.min(...fs.map(f => f.box.x0)), y0: Math.min(...fs.map(f => f.box.y0)), x1: Math.max(...fs.map(f => f.box.x1)), y1: Math.max(...fs.map(f => f.box.y1)) }, 1, anim);
  }
  function frameNode(st, id) {
    const ids = [id]; st.g.edges.forEach(([a, , b]) => { if (a === id) ids.push(b); if (b === id) ids.push(a); });
    frameBox(st, bounds(st, ids, true), 1, true);
  }
  function zoomAt(st, f, cx, cy) {
    st.anim = (st.anim || 0) + 1;
    if (cx == null) { cx = st.el.clientWidth / 2; cy = area(st).H / 2; }
    const s = Math.max(.05, Math.min(2.5, st.s * f)); f = s / st.s;
    st.tx = cx - (cx - st.tx) * f; st.ty = cy - (cy - st.ty) * f; st.s = s; apply(st);
  }

  /* ---------- steps ---------- */
  function go(st, k) {
    st.step = k; st.sel = null; state(st); texts(st);
    if (k < 0) frameAll(st, true); else frameBox(st, st.frames[k].box, 1, true);
  }

  /* ---------- pointer: left / middle drag pans, right drag zooms, pinch zooms ---------- */
  function down(st, e) {
    if (e.target.closest('.ne-x,.ne-card,.ne-tour')) return;
    e.preventDefault(); e.stopPropagation();
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
    if (e.target.closest('.ne-card,.ne-tour')) return;
    e.preventDefault(); e.stopPropagation();
    const r = st.el.getBoundingClientRect();
    zoomAt(st, Math.exp(-e.deltaY * (e.ctrlKey ? .01 : .0016)), e.clientX - r.left, e.clientY - r.top);
  }
  function key(st, e) {
    if (e.key === 'Escape') { e.stopPropagation(); if (st.sel) select(st, null); else close(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(st, Math.min(st.g.stages.length - 1, st.step + 1)); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); go(st, Math.max(-1, st.step - 1)); }
    else if (e.key === 'f' || e.key === 'F') { st.sel ? frameNode(st, st.sel) : frameAll(st, true); }
    else if (e.key === 'a' || e.key === 'A') frameAll(st, true);
    else if (e.key === '+' || e.key === '=') zoomAt(st, 1.2);
    else if (e.key === '-') zoomAt(st, 1 / 1.2);
  }

  /* ---------- selection: a card with what the node does ---------- */
  function select(st, id, frame) { st.sel = id; state(st); card(st); if (id && frame) frameNode(st, id); }
  function card(st) {
    const box = st.el.querySelector('.ne-card'), n = st.sel ? st.nodes[st.sel] : null;
    box.textContent = ''; box.hidden = !n;
    if (!n) return;
    box.append(h('b', '', n.id), h('small', '', n.t + (st.g.stages ? ' · ' + (n.s + 1) + ' ' + L(st.g.stages[n.s].title) : '')));
    if (n.d) box.append(h('p', '', L(n.d)));
    if (n.note) box.append(h('p', 'ne-note', t('notes') + ': ' + n.note));
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
    fitPhone(st);
    requestAnimationFrame(() => {
      draw(st); frameAll(st, false);
      requestAnimationFrame(() => st.el.classList.add('is-on'));
      st.el.focus({ preventScroll: true });
    });
  }
  /* phones: the panel is taller than the clip, so size it to the space between the site's bars and bring it into view */
  function fitPhone(st) {
    if (!matchMedia('(max-width:63.99rem)').matches) return;
    const bars = [...document.querySelectorAll('header, nav, .tabbar, .topbar')].filter(b => { const cs = getComputedStyle(b); return (cs.position === 'fixed' || cs.position === 'sticky') && b.offsetHeight; });
    let top = 0, bottom = 0;
    bars.forEach(b => { const r = b.getBoundingClientRect(); if (r.top < innerHeight / 2) top = Math.max(top, r.bottom); else bottom = Math.max(bottom, innerHeight - r.top); });
    const H = Math.max(320, Math.min(640, innerHeight - top - bottom - 16));
    st.clip.style.height = H + 'px';
    st.pad = document.body.style.paddingBottom; document.body.style.paddingBottom = H + 'px';   // room to scroll the last clips up
    const go = () => scrollTo({ top: st.fig.getBoundingClientRect().top + scrollY - top - 8, behavior: 'instant' });
    go(); requestAnimationFrame(go);
  }
  function close(quick) {
    const st = open_; if (!st) return; open_ = null;
    st.el.classList.remove('is-on');
    if (st.tab) { st.tab.setAttribute('aria-expanded', 'false'); if (!quick) st.tab.focus({ preventScroll: true }); }
    if (st.wasPlaying && st.video) st.video.play().catch(() => {});
    if (st.pad !== undefined) document.body.style.paddingBottom = st.pad;
    setTimeout(() => { st.clip.remove(); if (!(open_ && open_.fig === st.fig)) st.fig.classList.remove('ne-host'); }, quick || still.matches ? 0 : 340);
  }
  document.addEventListener('click', e => { if (open_ && e.target.closest('[data-lang]')) setTimeout(() => { if (open_) texts(open_); }, 0); });
  addEventListener('resize', () => { if (open_) apply(open_); });

  window.NodeEditor = { open, close, isOpen: () => !!open_ };
})();
