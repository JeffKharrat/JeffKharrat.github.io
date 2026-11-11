/* A Maya-style Node Editor that slides in over a clip on the project page.
   Graphs come from js/graphs-*.js (window.NODE_GRAPHS), generated from the Maya file:
     { tab, setup, title{en,ja}, intro{en,ja},
       nodes: [{ id, t: nodeType, x, y, w, h, rows: [{ a, n: niceName, dt, io }], d?{en,ja}, note? }],
       edges: [[srcNode, srcAttr, dstNode, dstAttr]] }
   Colours are gathered in MAYA below so they can be tuned against a screenshot. */
(function () {
  'use strict';
  const MAYA = {
    ui: '#444444', uiDark: '#3A3A3A', uiLine: '#2B2B2B', text: '#EEEEEE', textDim: '#BDBDBD', hi: '#5285A6',
    graph: '#2B2B2B', grid: '#323232', gridMajor: '#393939',
    node: '#5D5D5D', nodeBody: '#474747', nodeLine: '#202020', sel: '#FFFFA0',
    nodeType: { joint: '#4B7A4F' },
    port: { m: '#B79AD7', d: '#5ECCDB', d3: '#E2C04F', e: '#E3954B', g: '#6FC16A', i: '#7FC35E', b: '#DE5959' }
  };
  const HEAD = 24, ROW = 18, PADB = 6;
  const UI = {
    en: { menus: ['Edit', 'View', 'Graph', 'Window', 'Options', 'Help'], search: 'Search…', ae: 'Attribute Editor', notes: 'Notes:', about: 'What it does',
      ins: 'Input connections', outs: 'Output connections', none: 'None', close: 'Close', window: 'Node Editor', file: 'From the scene file',
      hint: 'Drag the grid to pan · scroll to zoom · F frame selected · A frame all', simple: 'Simple mode', conn: 'Connected attributes', all: 'Frame all', selF: 'Frame selected', grid: 'Toggle grid' },
    ja: { menus: ['編集', '表示', 'グラフ', 'ウィンドウ', 'オプション', 'ヘルプ'], search: '検索…', ae: 'アトリビュート エディタ', notes: 'ノート:', about: 'このノードの役割',
      ins: '入力接続', outs: '出力接続', none: 'なし', close: '閉じる', window: 'ノード エディタ', file: 'シーンファイルより',
      hint: 'グリッドをドラッグで移動・スクロールでズーム・F 選択をフレーム・A すべてをフレーム', simple: 'シンプルモード', conn: '接続されたアトリビュート', all: 'すべてをフレーム', selF: '選択をフレーム', grid: 'グリッドの切り替え' }
  };
  const lang = () => (document.documentElement.lang === 'ja' ? 'ja' : 'en');
  const L = v => (v && typeof v === 'object' ? v[lang()] ?? v.en : v ?? '');
  const ui = k => UI[lang()][k];
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const NS = 'http://www.w3.org/2000/svg';
  const h = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };
  const sv = (tag, at) => { const n = document.createElementNS(NS, tag); for (const k in at) n.setAttribute(k, at[k]); return n; };

  /* Node-type icons, drawn small like the Node Editor's header icons */
  const ICON = t => {
    const c = '#D6D6D6';
    if (/Matrix$|^multMatrix$/.test(t)) return `<svg viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="12" fill="none" stroke="${c}"/><path d="M2 6h12M2 10h12M6 2v12M10 2v12" stroke="${c}" stroke-width=".8"/></svg>`;
    if (t === 'joint') return `<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="4.5" fill="none" stroke="#9BE29B" stroke-width="1.4"/><circle cx="8" cy="8" r="1.4" fill="#9BE29B"/></svg>`;
    if (t === 'transform') return `<svg viewBox="0 0 16 16"><path d="M8 2v12M2 8h12" stroke="${c}" stroke-width="1.3"/><path d="M8 1l2 3H6zM15 8l-3 2V6z" fill="${c}"/></svg>`;
    if (/^nurbs|^mesh|Surface|Curve|Iso|proximityPin|uvPin|blendShape|skinCluster/.test(t)) return `<svg viewBox="0 0 16 16"><path d="M2 12C5 3 11 3 14 12" fill="none" stroke="#8FB8FF" stroke-width="1.4"/><path d="M2 12h12" stroke="#8FB8FF" stroke-width=".8"/></svg>`;
    if (/^ik/.test(t)) return `<svg viewBox="0 0 16 16"><path d="M3 13L8 4l5 9" fill="none" stroke="#E7D17A" stroke-width="1.3"/><circle cx="8" cy="4" r="1.6" fill="#E7D17A"/></svg>`;
    return `<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.5" fill="none" stroke="${c}"/><path d="M5 8h6M8 5v6" stroke="${c}"/></svg>`;
  };
  const TB = {   // toolbar icons
    in: '<path d="M2 8h7M6 5l3 3-3 3" /><rect x="10" y="4" width="5" height="8"/>',
    io: '<rect x="5.5" y="4" width="5" height="8"/><path d="M1 8h4M11 8h4"/>',
    out: '<rect x="1" y="4" width="5" height="8"/><path d="M6 8h7M10 5l3 3-3 3"/>',
    clr: '<path d="M3 3l10 10M13 3L3 13"/>',
    all: '<rect x="2" y="2" width="12" height="12"/><rect x="5" y="5" width="6" height="6"/>',
    sel: '<path d="M2 5V2h3M11 2h3v3M14 11v3h-3M5 14H2v-3"/><rect x="6" y="6" width="4" height="4"/>',
    simple: '<rect x="2" y="5" width="12" height="6" rx="1.5"/>',
    conn: '<rect x="2" y="2" width="12" height="12" rx="1.5"/><path d="M2 6h12M5 9h6M5 11.5h6"/>',
    grid: '<path d="M1 5h14M1 11h14M5 1v14M11 1v14"/>'
  };

  let open_ = null;   // { g, fig, el, … } of the panel that is open

  function css() {
    if (document.getElementById('ne-css')) return;
    const s = h('style'); s.id = 'ne-css';
    s.textContent = `
.ne-clip{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:3}
.ne-host{z-index:6}
.ne{position:absolute;inset:0;display:grid;grid-template-rows:auto auto auto auto 1fr;background:${MAYA.ui};color:${MAYA.text};pointer-events:auto;
  font:11px/1.25 "Segoe UI",Tahoma,"Lucida Grande","Helvetica Neue",Arial,sans-serif;letter-spacing:0;text-transform:none;
  transform:translateX(102%);transition:transform .32s cubic-bezier(.2,.8,.2,1);box-shadow:-10px 0 24px rgba(0,0,0,.35);border:1px solid #1E1E1E}
.ne.is-on{transform:none}
.ne *{box-sizing:border-box}
.ne button{font:inherit;color:inherit}
.ne-win{display:flex;align-items:center;height:22px;padding:0 4px 0 8px;background:#373737;border-bottom:1px solid ${MAYA.uiLine};color:${MAYA.textDim}}
.ne-win b{font-weight:400;flex:1}
.ne-x{all:unset;cursor:pointer;width:26px;height:20px;display:grid;place-items:center;color:${MAYA.textDim}}
.ne-x:hover,.ne-x:focus-visible{background:#C42B1C;color:#fff}
.ne-menu{display:flex;gap:2px;height:21px;align-items:center;padding:0 3px;border-bottom:1px solid ${MAYA.uiLine}}
.ne-menu span{padding:2px 6px;border-radius:1px;cursor:default}
.ne-menu span:hover{background:${MAYA.hi};color:#fff}
.ne-tb{display:flex;align-items:center;gap:1px;height:28px;padding:0 4px;border-bottom:1px solid ${MAYA.uiLine};overflow:hidden}
.ne-tb button{all:unset;cursor:pointer;width:24px;height:22px;display:grid;place-items:center;border-radius:2px}
.ne-tb button svg{width:16px;height:16px;fill:none;stroke:#D0D0D0;stroke-width:1.1}
.ne-tb button:hover,.ne-tb button:focus-visible{background:#575757}
.ne-tb button[aria-pressed="true"]{background:#2E2E2E;box-shadow:inset 0 0 0 1px #626262}
.ne-tb i{width:1px;height:18px;background:#2E2E2E;margin:0 4px;box-shadow:1px 0 0 #555}
.ne-tb input{margin-left:auto;width:min(170px,30%);height:20px;border:1px solid #2A2A2A;background:#2B2B2B;color:${MAYA.text};font:inherit;padding:0 6px;border-radius:2px}
.ne-tb input:focus{outline:1px solid ${MAYA.hi}}
.ne-tabs{display:flex;align-items:flex-end;height:24px;padding:0 4px;background:${MAYA.uiDark};border-bottom:1px solid #5D5D5D}
.ne-tt{height:21px;padding:3px 12px 0;background:#5D5D5D;color:#fff;border-radius:3px 3px 0 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:60%}
.ne-tabp{height:19px;width:22px;margin-left:3px;display:grid;place-items:center;background:#4A4A4A;color:${MAYA.textDim};border-radius:3px 3px 0 0}
.ne-main{display:grid;grid-template-columns:minmax(0,1fr) 15.5rem;min-height:0}
.ne-view{position:relative;overflow:hidden;touch-action:none;cursor:default;background-color:${MAYA.graph}}
.ne-view.is-grid{background-image:linear-gradient(${MAYA.gridMajor} 1px,transparent 1px),linear-gradient(90deg,${MAYA.gridMajor} 1px,transparent 1px),
  linear-gradient(${MAYA.grid} 1px,transparent 1px),linear-gradient(90deg,${MAYA.grid} 1px,transparent 1px)}
.ne-view.is-pan{cursor:move}
.ne-world{position:absolute;left:0;top:0;transform-origin:0 0}
.ne-wires{position:absolute;left:0;top:0;overflow:visible;pointer-events:none}
.ne-w{fill:none;stroke-width:1.6}
.ne-w.is-hot{stroke-width:2.6;filter:brightness(1.35)}
.ne-n{position:absolute;border-radius:5px;background:${MAYA.nodeBody};box-shadow:0 0 0 1px ${MAYA.nodeLine},0 3px 8px rgba(0,0,0,.35);cursor:pointer;user-select:none;-webkit-user-select:none;overflow:visible}
.ne-n:focus-visible{outline:none;box-shadow:0 0 0 1px ${MAYA.nodeLine},0 0 0 3px ${MAYA.hi}}
.ne-n.is-sel{box-shadow:0 0 0 2px ${MAYA.sel},0 3px 10px rgba(0,0,0,.45)}
.ne-n.is-find{box-shadow:0 0 0 2px ${MAYA.hi},0 3px 10px rgba(0,0,0,.45)}
.ne-nh{display:flex;align-items:center;gap:5px;height:${HEAD}px;padding:0 8px 0 6px;border-radius:5px 5px 0 0;background:linear-gradient(#6A6A6A,var(--nh,${MAYA.node}));
  color:#fff;font-weight:600;white-space:nowrap;overflow:hidden}
.ne-nh svg{width:15px;height:15px;flex:none}
.ne-nh span{overflow:hidden;text-overflow:ellipsis}
.ne-simple .ne-nh{border-radius:5px}
.ne-r{position:relative;height:${ROW}px;display:flex;align-items:center;padding:0 12px;color:#DADADA;white-space:nowrap}
.ne-r.is-out{justify-content:flex-end}
.ne-n .ne-rs{padding-bottom:${PADB}px}
.ne-simple .ne-rs{display:none}
.ne-p{position:absolute;top:50%;width:9px;height:9px;margin-top:-4.5px;border-radius:50%;background:var(--pc);box-shadow:0 0 0 1px #1C1C1C}
.ne-p--i{left:-4.5px}.ne-p--o{right:-4.5px}
.ne-ae{background:${MAYA.ui};border-left:1px solid ${MAYA.uiLine};overflow-y:auto;min-width:0}
.ne-ae-t{display:flex;align-items:flex-end;height:22px;padding:0 4px;background:${MAYA.uiDark};border-bottom:1px solid #5D5D5D}
.ne-ae-t span{height:19px;padding:2px 9px 0;background:#5D5D5D;border-radius:3px 3px 0 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.ne-ae-h{display:grid;grid-template-columns:auto 1fr;gap:6px;align-items:center;padding:8px 8px 6px}
.ne-ae-h label{color:${MAYA.textDim};text-align:right}
.ne-ae-h output{display:block;height:20px;line-height:18px;padding:0 5px;background:#2B2B2B;border:1px solid #262626;border-radius:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#fff}
.ne-fr{margin:0 4px 4px}
.ne-fr>summary{list-style:none;display:flex;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;align-items:center;gap:5px;height:20px;padding:0 6px;background:#5D5D5D;border-radius:2px;cursor:pointer;font-weight:600}
.ne-fr>summary::-webkit-details-marker{display:none}
.ne-fr>summary::before{content:"";border:4px solid transparent;border-left-color:#DDD;border-right:0;margin-right:2px}
.ne-fr[open]>summary::before{border:4px solid transparent;border-top-color:#DDD;border-bottom:0;margin:2px 1px 0 0}
.ne-fr>div{padding:6px 4px 4px 10px;color:#DCDCDC;overflow-wrap:anywhere}
.ne-fr p{margin:0 0 6px}
.ne-note{overflow-wrap:anywhere;background:#2B2B2B;border:1px solid #262626;padding:5px 6px;border-radius:2px;color:#EEE;white-space:pre-wrap}
.ne-cl{margin:0;padding:0;list-style:none;display:grid;gap:1px}
.ne-cl button{all:unset;cursor:pointer;display:block;padding:2px 4px;border-radius:2px;color:#DADADA;overflow-wrap:anywhere}
.ne-cl button:hover,.ne-cl button:focus-visible{background:${MAYA.hi};color:#fff}
.ne-cl i{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:5px;vertical-align:1px}
.ne-hint{position:absolute;left:8px;bottom:6px;color:#8C8C8C;pointer-events:none;font-size:10.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:calc(100% - 16px)}
@media (max-width:63.99rem){
  .ne-host .ne-tab{display:none}
  .ne-clip{bottom:auto;height:min(78vh,600px);height:min(78svh,600px)}
  .ne-main{grid-template-columns:1fr;grid-template-rows:minmax(0,1fr) minmax(0,38%)}
  .ne-ae{border-left:0;border-top:1px solid ${MAYA.uiLine}}
  .ne-menu span:nth-child(n+5),.ne-hint{display:none}
  .ne-tb button.ne-o{display:none}
}
@media (prefers-reduced-motion:reduce){.ne{transition:none}}`;
    document.head.append(s);
  }

  /* ---------- build one panel ---------- */
  function build(fig, g, video, tab) {
    css();
    const clip = h('div', 'ne-clip'), el = h('div', 'ne');
    el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', ui('window') + ' — ' + g.tab);
    el.innerHTML = `<div class="ne-win"><b></b><button class="ne-x" type="button" data-a="close">✕</button></div>
      <div class="ne-menu" aria-hidden="true"></div>
      <div class="ne-tb">
        <button type="button" class="ne-o" tabindex="-1" aria-hidden="true">${tbi('in')}</button><button type="button" class="ne-o" tabindex="-1" aria-hidden="true">${tbi('io')}</button>
        <button type="button" class="ne-o" tabindex="-1" aria-hidden="true">${tbi('out')}</button><button type="button" class="ne-o" tabindex="-1" aria-hidden="true">${tbi('clr')}</button><i></i>
        <button type="button" data-a="all">${tbi('all')}</button><button type="button" data-a="sel">${tbi('sel')}</button><i></i>
        <button type="button" data-a="simple" aria-pressed="false">${tbi('simple')}</button><button type="button" data-a="conn" aria-pressed="true">${tbi('conn')}</button><i></i>
        <button type="button" data-a="grid" aria-pressed="true">${tbi('grid')}</button>
        <input type="search" spellcheck="false" autocomplete="off">
      </div>
      <div class="ne-tabs"><span class="ne-tt"></span><span class="ne-tabp" aria-hidden="true">+</span></div>
      <div class="ne-main"><div class="ne-view is-grid"><div class="ne-world"><svg class="ne-wires"></svg></div><p class="ne-hint"></p></div><aside class="ne-ae" aria-live="polite"></aside></div>`;
    clip.append(el); fig.append(clip);
    const st = { g, fig, el, clip, video, tab, tx: 0, ty: 0, s: 1, sel: null, simple: false, nodes: {}, wires: [] };
    g.nodes.forEach(n => { st.nodes[n.id] = Object.assign({}, n); });
    const world = el.querySelector('.ne-world');
    g.nodes.forEach(n => {
      const d = h('div', 'ne-n'); d.tabIndex = 0; d.setAttribute('role', 'button'); d.dataset.id = n.id;
      Object.assign(d.style, { left: n.x + 'px', top: n.y + 'px', width: n.w + 'px' });
      if (MAYA.nodeType[n.t]) d.style.setProperty('--nh', MAYA.nodeType[n.t]);
      const hd = h('div', 'ne-nh'); hd.innerHTML = ICON(n.t); hd.append(h('span', '', n.id)); d.append(hd);
      const rs = h('div', 'ne-rs');
      n.rows.forEach(r => {
        const row = h('div', 'ne-r' + (r.io === 'o' ? ' is-out' : ''), r.n);
        const c = MAYA.port[r.dt] || '#AAA';
        if (r.io.includes('i')) { const p = h('span', 'ne-p ne-p--i'); p.style.setProperty('--pc', c); row.append(p); }
        if (r.io.includes('o')) { const p = h('span', 'ne-p ne-p--o'); p.style.setProperty('--pc', c); row.append(p); }
        rs.append(row);
      });
      d.append(rs);
      d.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(st, n.id, true); } });
      world.append(d); st.nodes[n.id].el = d;
    });
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      const a = b.dataset.a;
      if (a === 'close') close();
      else if (a === 'all') frameAll(st, true);
      else if (a === 'sel') st.sel ? frameNode(st, st.sel) : frameAll(st, true);
      else if (a === 'simple' || a === 'conn') { st.simple = a === 'simple'; el.querySelector('[data-a="simple"]').setAttribute('aria-pressed', String(st.simple)); el.querySelector('[data-a="conn"]').setAttribute('aria-pressed', String(!st.simple)); el.classList.toggle('ne-simple', st.simple); wires(st); }
      else if (a === 'grid') { const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(on)); view(st).classList.toggle('is-grid', on); }
    });
    const q = el.querySelector('input');
    q.addEventListener('input', () => find(st, q.value));
    q.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); const m = find(st, q.value); if (m) { select(st, m, true); } } });
    view(st).addEventListener('pointerdown', e => down(st, e));
    view(st).addEventListener('wheel', e => wheel(st, e), { passive: false });
    el.addEventListener('keydown', e => key(st, e));
    texts(st);
    return st;
  }
  const tbi = k => `<svg viewBox="0 0 16 16" aria-hidden="true">${TB[k]}</svg>`;
  const view = st => st.el.querySelector('.ne-view');

  function texts(st) {
    const el = st.el;
    el.querySelector('.ne-win b').textContent = ui('window');
    el.querySelector('.ne-x').setAttribute('aria-label', ui('close'));
    el.querySelector('.ne-menu').innerHTML = ui('menus').map(m => `<span>${m}</span>`).join('');
    el.querySelector('.ne-tt').textContent = st.g.tab;
    el.querySelector('input').placeholder = ui('search');
    el.querySelector('input').setAttribute('aria-label', ui('search'));
    el.querySelector('.ne-hint').textContent = ui('hint');
    [['all', 'all'], ['sel', 'selF'], ['simple', 'simple'], ['conn', 'conn'], ['grid', 'grid']].forEach(([a, k]) => { const b = el.querySelector(`[data-a="${a}"]`); b.title = ui(k); b.setAttribute('aria-label', ui(k)); });
    ae(st);
  }

  /* ---------- wires ---------- */
  function anchor(st, id, attr, out) {
    const n = st.nodes[id];
    if (st.simple) return [out ? n.x + n.w : n.x, n.y + HEAD / 2];
    const i = n.rows.findIndex(r => r.a === attr);
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
    const v = view(st), g1 = 20 * st.s, g5 = 100 * st.s;
    v.style.backgroundSize = `${g5}px ${g5}px,${g5}px ${g5}px,${g1}px ${g1}px,${g1}px ${g1}px`;
    v.style.backgroundPosition = `${st.tx}px ${st.ty}px`;
  }
  function bounds(st, ids) {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    (ids || Object.keys(st.nodes)).forEach(id => { const n = st.nodes[id], hh = st.simple ? HEAD : n.h; x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x + n.w); y1 = Math.max(y1, n.y + hh); });
    return { x0, y0, x1, y1 };
  }
  function glide(st, tx, ty, s, anim) {
    if (!anim || still.matches) { Object.assign(st, { tx, ty, s }); apply(st); return; }
    const a = { tx: st.tx, ty: st.ty, s: st.s }, t0 = performance.now(), D = 280;
    (function step(now) {
      const p = Math.min(1, (now - t0) / D), k = 1 - Math.pow(1 - p, 3);
      st.tx = a.tx + (tx - a.tx) * k; st.ty = a.ty + (ty - a.ty) * k; st.s = a.s + (s - a.s) * k; apply(st);
      if (p < 1 && open_ === st) requestAnimationFrame(step);
    })(t0);
  }
  function frameBox(st, b, maxS, anim) {
    const v = view(st), W = v.clientWidth, H = v.clientHeight, pad = 24;
    const s = Math.max(.08, Math.min(maxS, (W - pad * 2) / (b.x1 - b.x0), (H - pad * 2) / (b.y1 - b.y0)));
    glide(st, W / 2 - (b.x0 + b.x1) / 2 * s, H / 2 - (b.y0 + b.y1) / 2 * s, s, anim);
  }
  const frameAll = (st, anim) => frameBox(st, bounds(st), 1, anim);
  function frameNode(st, id) {
    const ids = [id]; st.g.edges.forEach(([a, , b]) => { if (a === id) ids.push(b); if (b === id) ids.push(a); });
    frameBox(st, bounds(st, ids), 1, true);
  }
  function zoomAt(st, f, cx, cy) {
    const v = view(st); if (cx == null) { cx = v.clientWidth / 2; cy = v.clientHeight / 2; }
    const s = Math.max(.06, Math.min(3, st.s * f)); f = s / st.s;
    st.tx = cx - (cx - st.tx) * f; st.ty = cy - (cy - st.ty) * f; st.s = s; apply(st);
  }
  function first(st) {   // the opening view: the whole tab if it stays legible, otherwise its first row at a legible zoom
    const v = view(st), b = bounds(st), W = v.clientWidth, H = v.clientHeight, pad = 24;
    const s = Math.min(1, (W - pad * 2) / (b.x1 - b.x0), (H - pad * 2) / (b.y1 - b.y0)), min = .5;
    if (s >= min) return frameAll(st, false);
    glide(st, pad - b.x0 * min, pad - b.y0 * min, min, false);
  }

  /* ---------- pointer ---------- */
  function down(st, e) {
    if (e.button === 2) return;
    const v = view(st), nd = e.target.closest('.ne-n');
    v.setPointerCapture(e.pointerId);
    const pts = st.pts || (st.pts = new Map()); pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 2) { const [a, b] = [...pts.values()]; st.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), s: st.s }; st.drag = null; }
    else st.drag = nd && e.button === 0
      ? { node: st.nodes[nd.dataset.id], x: e.clientX, y: e.clientY, ox: st.nodes[nd.dataset.id].x, oy: st.nodes[nd.dataset.id].y, moved: false }
      : { pan: true, x: e.clientX, y: e.clientY, ox: st.tx, oy: st.ty, moved: false };
    const move = ev => {
      if (!pts.has(ev.pointerId)) return;
      pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (st.pinch && pts.size === 2) { const [a, b] = [...pts.values()], r = v.getBoundingClientRect(); zoomAt(st, st.pinch.s * Math.hypot(a.x - b.x, a.y - b.y) / st.pinch.d / st.s, (a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top); return; }
      const d = st.drag; if (!d) return;
      const dx = ev.clientX - d.x, dy = ev.clientY - d.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) { d.moved = true; if (d.pan) v.classList.add('is-pan'); }
      if (!d.moved) return;
      if (d.pan) { st.tx = d.ox + dx; st.ty = d.oy + dy; apply(st); }
      else { const n = d.node; n.x = d.ox + dx / st.s; n.y = d.oy + dy / st.s; n.el.style.left = n.x + 'px'; n.el.style.top = n.y + 'px'; wires(st); }
    };
    const up = ev => {
      pts.delete(ev.pointerId); if (pts.size < 2) st.pinch = null;
      if (pts.size) return;
      v.classList.remove('is-pan');
      v.removeEventListener('pointermove', move); v.removeEventListener('pointerup', up); v.removeEventListener('pointercancel', up);
      const d = st.drag; st.drag = null;
      if (d && !d.moved) select(st, d.node ? d.node.id : null);
    };
    v.addEventListener('pointermove', move); v.addEventListener('pointerup', up); v.addEventListener('pointercancel', up);
  }
  function wheel(st, e) {
    e.preventDefault();
    const r = view(st).getBoundingClientRect();
    zoomAt(st, Math.exp(-e.deltaY * (e.ctrlKey ? .01 : .0016)), e.clientX - r.left, e.clientY - r.top);
  }
  function key(st, e) {
    if (e.target.matches('input')) { if (e.key === 'Escape') { e.target.value = ''; find(st, ''); e.target.blur(); } return; }
    if (e.key === 'Escape') { e.stopPropagation(); if (st.sel) select(st, null); else close(); }
    else if (e.key === 'f' || e.key === 'F') { st.sel ? frameNode(st, st.sel) : frameAll(st, true); }
    else if (e.key === 'a' || e.key === 'A') frameAll(st, true);
    else if (e.key === '+' || e.key === '=') zoomAt(st, 1.2);
    else if (e.key === '-') zoomAt(st, 1 / 1.2);
  }
  function find(st, q) {
    q = q.trim().toLowerCase(); let m = null;
    Object.values(st.nodes).forEach(n => { const hit = !!q && n.id.toLowerCase().includes(q); n.el.classList.toggle('is-find', hit); if (hit && !m) m = n.id; });
    return m;
  }

  /* ---------- selection and the Attribute Editor ---------- */
  function select(st, id, frame) { st.sel = id; hot(st); ae(st); if (id && frame) frameNode(st, id); }
  function ae(st) {
    const box = st.el.querySelector('.ne-ae'); box.textContent = '';
    const n = st.sel ? st.nodes[st.sel] : null;
    const name = n ? n.id : st.g.setup, type = n ? n.t : 'network';
    const t = h('div', 'ne-ae-t'); t.append(h('span', '', name)); box.append(t);
    const hd = h('div', 'ne-ae-h'); hd.append(h('label', '', type + ':'), h('output', '', name)); box.append(hd);
    const frame = (title, body, openIt = true) => { const d = h('details', 'ne-fr'); d.open = openIt; d.append(h('summary', '', title)); const c = h('div'); body(c); d.append(c); box.append(d); };
    if (!n) {
      frame(ui('notes') + ' ' + st.g.setup, c => { c.append(h('p', '', L(st.g.title))); const p = h('div', 'ne-note', L(st.g.intro)); c.append(p); });
      return;
    }
    if (n.note) frame(ui('notes') + ' ' + n.id, c => c.append(h('div', 'ne-note', n.note)));
    if (n.d) frame(ui('about'), c => c.append(h('p', '', L(n.d))));
    const list = (title, arr, side) => frame(title, c => {
      if (!arr.length) { c.append(h('p', '', ui('none'))); return; }
      const ul = h('ul', 'ne-cl');
      arr.forEach(([a, aa, b, ba]) => {
        const other = side === 'in' ? a : b, li = h('li'), btn = h('button'); btn.type = 'button';
        const row = st.nodes[a].rows.find(r => r.a === aa), dot = h('i'); dot.style.background = MAYA.port[row ? row.dt : 'd'];
        btn.append(dot, side === 'in' ? `${a}.${aa} → ${ba}` : `${aa} → ${b}.${ba}`);
        btn.addEventListener('click', () => select(st, other, true));
        li.append(btn); ul.append(li);
      });
      c.append(ul);
    }, arr.length <= 8);
    list(ui('ins'), st.g.edges.filter(e => e[2] === n.id), 'in');
    list(ui('outs'), st.g.edges.filter(e => e[0] === n.id), 'out');
  }

  /* ---------- open / close ---------- */
  function open(id, opts) {
    const g = (window.NODE_GRAPHS || {})[id]; if (!g || !opts || !opts.host) return;
    if (open_ && open_.fig === opts.host) return close();
    if (open_) close(true);
    const st = build(opts.host, g, opts.host.querySelector('video'), opts.tab);
    open_ = st; opts.host.classList.add('ne-host');
    if (st.video && !st.video.paused) { st.wasPlaying = true; st.video.pause(); }
    if (st.tab) st.tab.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => {
      wires(st); first(st);
      requestAnimationFrame(() => st.el.classList.add('is-on'));
      st.el.querySelector('.ne-x').focus({ preventScroll: true });
    });
  }
  function close(quick) {
    const st = open_; if (!st) return; open_ = null;
    st.el.classList.remove('is-on');
    if (st.tab) { st.tab.setAttribute('aria-expanded', 'false'); if (!quick) st.tab.focus({ preventScroll: true }); }
    if (st.wasPlaying && st.video) st.video.play().catch(() => {});
    setTimeout(() => { st.clip.remove(); if (open_ && open_.fig === st.fig) return; st.fig.classList.remove('ne-host'); }, quick || still.matches ? 0 : 340);
  }
  // language buttons elsewhere on the page re-render the panel text
  document.addEventListener('click', e => { if (open_ && e.target.closest('[data-lang]')) setTimeout(() => open_ && texts(open_), 0); });
  addEventListener('resize', () => { if (open_) apply(open_); });

  window.NodeEditor = { open, close, isOpen: () => !!open_ };
})();
