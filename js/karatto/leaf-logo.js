/* 紅葉重工: the logo. Jeff's pixel momiji (karatto/leaf-cells.json, his drawing sampled cell by cell, each cell 2x2) is built
   by a cell sweep from the stem to the top (yellow flash, 4x4 checker, then the cell), holds, and is swept away the
   same way. Coloured from the heart out: yellow, orange, red at the tips; the black ink stays black. Stepped at 12 fps, scanlines, a phosphor
   ghost of the last frame: a retro sci-fi read-out. The stem does not move. */
const DATA = new URL('../../karatto/leaf-cells.json', import.meta.url).href;
const PIV = [11.5, 14.8];                                                   // the heart, in cells (where the veins meet)
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const back = t => { const c = 1.6; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

export async function mountLeafLogo(cv, { label = true, cycle = 5.2 } = {}) {
  const D = await (await fetch(DATA)).json(), cx = cv.getContext('2d');
  const cells = D.cells.map(([i, j, ...s]) => { const dx = i + .5 - PIV[0], dy = PIV[1] - (j + .5), r = Math.hypot(dx, dy);
    let a = Math.atan2(dy, dx); const stem = dy < -1 && Math.abs(dx) < 2.6 && Math.abs(a + Math.PI / 2) < .55;
    if (a < -Math.PI / 2 - .3) a += Math.PI * 2;                               // keep the left lobes on the left (angles run -1.3..4.4)
    return { i, j, s, r, a, stem }; }).sort((p, q) => q.r - p.r);              // the far cells first, the heart drawn over them
  let W, H, cs, ox, oy, raf, t0 = performance.now(), last = -1;
  const size = () => { const dpr = Math.min(2, devicePixelRatio || 1); W = cv.clientWidth; H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cs = Math.max(4, Math.floor(Math.min(W / (D.cols + 4), (H * (label ? .78 : .95)) / (D.rows + 2))));
    ox = Math.round(W / 2 - (D.cols / 2) * cs); oy = Math.round((H * (label ? .44 : .5)) - (D.rows / 2) * cs); };
  size(); addEventListener('resize', size);
  /* colour: the heart yellow, orange between, the tips red; each cell keeps its own shade, the black ink stays black */
  const hex = h => [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16)), lum = c => .3 * c[0] + .59 * c[1] + .11 * c[2];
  const G = [[0, hex('#FFE600')], [.45, hex('#FF8A00')], [1, hex('#D83030')]], BASE = lum(hex('#D83030'));
  const grad = u => { for (let n = 1; n < G.length; n++) if (u <= G[n][0]) { const f = (u - G[n - 1][0]) / (G[n][0] - G[n - 1][0]); return G[n - 1][1].map((v, k) => v + (G[n][1][k] - v) * f); } return G[2][1]; };
  const RM = Math.max(...cells.filter(c => !c.stem).map(c => c.r));
  for (const c of cells) { const g = grad(Math.min(1, c.r / RM));
    c.col = c.s.map(p => { if (p < 0) return null; const o = hex(D.pal[p]), L = lum(o); if (L < 40) return D.pal[p];
      const k = Math.min(1.25, L / BASE); return `rgb(${g.map(v => Math.min(255, v * k) | 0).join(',')})`; });
    c.v = (Math.max(0, D.rows - 1 - c.j) / D.rows) * .84 + (((Math.sin(c.i * 127.1 + c.j * 311.7) * 43758.5453) % 1 + 1) % 1) * .16; }   // stem first, the top last
  const BAND = .18;
  /* the cycle: sweep in (stem to top), hold, sweep out (stem to top again) */
  function draw(t) {
    cx.fillStyle = 'rgba(14,12,10,.55)'; cx.fillRect(0, 0, W, H);
    const u = (t % cycle) / cycle, IN = u < .3 ? u / .3 * (1 + BAND) : 9, OUT = u > .62 && u < .9 ? (u - .62) / .28 * (1 + BAND) : u >= .9 ? 9 : -1;
    for (const c of cells) {
      const fi = (IN - c.v) / BAND, fo = (OUT - c.v) / BAND;
      if (fi <= 0 || fo >= 1) continue;                                          // not yet built / already gone
      const px = ox + c.i * cs, py = oy + c.j * cs, h = cs / 2;
      const f = fi < 1 ? fi : fo > 0 ? 1 - fo : 1;                                // 0..1 through a front, 1 settled
      if (f < 1 && f < .4) { cx.fillStyle = '#FFE600'; cx.globalAlpha = .5 + f; cx.fillRect(px, py, cs, cs); cx.globalAlpha = 1; continue; }
      if (f < 1) { const q = cs / 4, ph = (f * 6 | 0) & 1; cx.fillStyle = c.col.find(Boolean) || '#FFE600';
        for (let b = 0; b < 4; b++) for (let a2 = 0; a2 < 4; a2++) if (((a2 + b + ph) & 1) === 0) cx.fillRect(px + a2 * q, py + b * q, q, q); continue; }
      cx.fillStyle = '#120806'; cx.fillRect(px, py, cs, cs);
      c.col.forEach((col, n) => { if (!col) return; cx.fillStyle = col; cx.fillRect(px + (n & 1) * h + (n & 1 ? 0 : 1), py + (n >> 1) * h + (n >> 1 ? 0 : 1), h - 1, h - 1); });
    }
    const o = u > .3 && u < .62 ? 1 : u >= .62 && u < .7 ? 1 - (u - .62) / .08 : u > .22 && u <= .3 ? (u - .22) / .08 : 0;
    if (label) { const fs = Math.max(11, cs * .9) | 0, y = oy + (D.rows + 1.6) * cs, op = Math.max(0, Math.min(1, o));
      cx.textAlign = 'center'; cx.fillStyle = `rgba(242,226,200,${op})`; cx.font = `500 ${fs * 1.6 | 0}px "M PLUS 1 Code", monospace`;
      cx.fillText('紅葉重工', W / 2, y + fs * 1.2);
      cx.font = `500 ${fs * .7 | 0}px "M PLUS 1 Code", monospace`; cx.fillStyle = `rgba(216,48,48,${op})`;
      cx.fillText('M O M I J I   H E A V Y   I N D U S T R I E S', W / 2, y + fs * 2.4); }
    cx.fillStyle = 'rgba(0,0,0,.28)'; for (let yy = 0; yy < H; yy += 3) cx.fillRect(0, yy, W, 1);   // scanlines
  }
  const loop = now => { const t = (now - t0) / 1000, f = Math.floor(t * 12); if (f !== last) { last = f; draw(f / 12); } raf = requestAnimationFrame(loop); };
  raf = requestAnimationFrame(loop);
  return () => { cancelAnimationFrame(raf); removeEventListener('resize', size); };
}
