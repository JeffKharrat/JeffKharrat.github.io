/* カラット: the emblem. A momiji (Japanese maple) leaf built from cells: seven pointed lobes, a stem, dark veins
   along the lobes, a few dark and checkered modules, and the AI's yellow artery climbing from the stem to the upper
   right lobe. Generated once per grid size, so the same leaf works at 16 px on a tab and at 400 px on a wall.
   Cell codes: 0 empty, 1 light, 2 dark, 3 checker, 4 artery (yellow). */
const LOBES = [[90, 1.12, .48], [46, 1, .45], [134, 1, .45], [4, .9, .38], [176, .9, .38], [-38, .56, .3], [218, .56, .3]];
const cache = {};
const sd = n => { const x = Math.sin(n * 91.3 + 17.7) * 43758.5453; return x - Math.floor(x); };
function inTri(px, py, ax, ay, bx, by, cx, cy) { const d = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax), u = ((bx - px) * (cy - py) - (by - py) * (cx - px)) / d, v = ((cx - px) * (ay - py) - (cy - py) * (ax - px)) / d; return u >= 0 && v >= 0 && u + v <= 1; }
function segDist(px, py, ax, ay, bx, by) { const dx = bx - ax, dy = by - ay, t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))); return Math.hypot(px - ax - t * dx, py - ay - t * dy); }

export function leafGrid(N = 31) {
  if (cache[N]) return cache[N];
  const g = [], cyo = -.2, cell = 2 / N;
  const tips = LOBES.map(([a, l]) => [Math.cos(a * Math.PI / 180) * l, Math.sin(a * Math.PI / 180) * l + cyo]);
  const art0 = [-.14, -.6], art1 = tips[1];                                     // the artery: from below the heart to the upper-right tip
  for (let j = 0; j < N; j++) { const row = []; for (let i = 0; i < N; i++) {
    const x = -1 + (i + .5) * cell, y = 1 - (j + .5) * cell;
    let inside = Math.hypot(x, y - cyo) < .34, vein = false;
    for (const [a, l, w] of LOBES) { const r = a * Math.PI / 180, tx = Math.cos(r) * l, ty = Math.sin(r) * l + cyo, nx = -Math.sin(r) * w, ny = Math.cos(r) * w;
      if (inTri(x, y, nx, ny + cyo, -nx, -ny + cyo, tx, ty)) inside = true;
      if (N >= 23 && segDist(x, y, 0, cyo, tx, ty) < cell * .4 && Math.hypot(x, y - cyo) > .18) vein = true; }
    const stem = Math.abs(x - .02) < cell * .6 && y < cyo - .25 && y > -.9;
    if (stem) { row.push(1); continue; }
    if (!inside) { row.push(0); continue; }
    const s = sd(i * 31 + j * 7 + N);
    let c = vein ? 2 : s < .08 ? 2 : s < .12 ? 3 : 1;
    if (segDist(x, y, art0[0], art0[1], art1[0], art1[1]) < cell * .75) c = 4;
    row.push(c); } g.push(row); }
  /* the artery as a staircase: keep it two cells wide at most per row */
  return cache[N] = g;
}
const COL = { 1: '#A3ABBA', 2: '#2A2E36', 4: '#FFE600' };
/* an SVG of the leaf. mono: every cell in currentColor, the artery still yellow (for small marks on dark UIs) */
export function leafSVG(size = 24, { N = size < 40 ? 15 : size < 120 ? 23 : 31, mono = false, artery = true } = {}) {
  const g = leafGrid(N); let r = '';
  g.forEach((row, j) => row.forEach((c, i) => { if (!c) return;
    if (c === 3) { r += `<rect x="${i}" y="${j}" width=".5" height=".5" fill="${mono ? 'currentColor' : COL[1]}"/><rect x="${i + .5}" y="${j + .5}" width=".5" height=".5" fill="${mono ? 'currentColor' : COL[1]}"/>`; return; }
    const f = c === 4 && artery ? COL[4] : mono ? (c === 2 ? 'currentColor" opacity=".45' : 'currentColor') : COL[c === 4 ? 1 : c];
    r += `<rect x="${i}" y="${j}" width="${mono ? 1 : .92}" height="${mono ? 1 : .92}" fill="${f}"/>`; }));
  return `<svg viewBox="0 0 ${N} ${N}" width="${size}" height="${size}" shape-rendering="crispEdges" aria-hidden="true">${r}</svg>`;
}
/* draw it on a canvas: (x, y) top-left, s = cell size in px */
export function drawLeaf(cx, x, y, s, { N = 31, alpha = 1, pulse = 0 } = {}) {
  const g = leafGrid(N); cx.save(); cx.globalAlpha = alpha;
  g.forEach((row, j) => row.forEach((c, i) => { if (!c) return; const px = x + i * s, py = y + j * s;
    if (c === 3) { cx.fillStyle = COL[1]; cx.fillRect(px, py, s / 2, s / 2); cx.fillRect(px + s / 2, py + s / 2, s / 2, s / 2); return; }
    cx.fillStyle = c === 4 ? `rgba(255,230,0,${.75 + .25 * Math.sin(pulse - j * .4)})` : COL[c]; cx.fillRect(px, py, s - Math.max(.5, s * .08), s - Math.max(.5, s * .08)); }));
  cx.restore();
}
/* a favicon for every カラット page */
export function leafFavicon() { try { const l = document.querySelector('link[rel=icon]') || document.head.appendChild(Object.assign(document.createElement('link'), { rel: 'icon' })); l.href = 'data:image/svg+xml,' + encodeURIComponent(leafSVG(64, { N: 15 }).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')); } catch (e) {} }
