/* 紅葉重工: the logo. Jeff's pixel momiji (karatto/leaf-cells.json, his drawing sampled cell by cell, each cell 2x2) opens
   and closes like a fan: every cell turns about the heart of the leaf, its angle pulled toward the midrib when closed,
   and lands snapped to the cell grid, so it stays squares the whole way. Stepped at 12 fps, scanlines, a phosphor
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
  /* open: 0 closed (folded to the midrib, drawn in), 1 open */
  function openAt(t) { const u = (t % cycle) / cycle;
    if (u < .14) return 0; if (u < .42) return (u - .14) / .28 + 2;            // 2..3: opening
    if (u < .7) return 1; if (u < .9) return (u - .7) / .2 + 4; return 0; }     // 4..5: closing
  function draw(t) {
    cx.globalCompositeOperation = 'source-over';
    cx.fillStyle = 'rgba(14,12,10,.55)'; cx.fillRect(0, 0, W, H);               // the phosphor: last frame fades, not cleared
    const o = openAt(t);
    for (const c of cells) {
      let k;                                                                    // this cell's own progress (the tips trail the heart)
      const lag = Math.min(.35, c.r / 40);
      if (o === 0 || o === 1) k = o;
      else if (o < 3) k = back(Math.max(0, Math.min(1, (o - 2 - lag * .6) / (1 - lag * .6))));
      else k = 1 - ease(Math.max(0, Math.min(1, (o - 4 - (.35 - lag) * .6) / (1 - .21))));
      let x = c.i, y = c.j;
      if (!c.stem) { const a = Math.PI / 2 + (c.a - Math.PI / 2) * (.2 + .8 * k), r = c.r * (.7 + .3 * k);
        x = PIV[0] + Math.cos(a) * r - .5; y = PIV[1] - Math.sin(a) * r - .5; }
      x = Math.round(x); y = Math.round(y);                                     // snapped: squares, never rotated
      const px = ox + x * cs, py = oy + y * cs, h = cs / 2;
      cx.fillStyle = '#120806'; cx.fillRect(px, py, cs, cs);                     // the cell's ink outline
      c.s.forEach((p, n) => { if (p < 0) return; cx.fillStyle = D.pal[p]; cx.fillRect(px + (n & 1) * h + (n & 1 ? 0 : 1), py + (n >> 1) * h + (n >> 1 ? 0 : 1), h - 1 + (n & 1 ? 0 : 0), h - 1); });
    }
    if (label) { const fs = Math.max(11, cs * .9) | 0, y = oy + (D.rows + 1.6) * cs, op = Math.max(0, Math.min(1, o === 1 ? 1 : o >= 2 && o < 3 ? (o - 2.5) * 2 : o >= 4 ? 1 - (o - 4) * 3 : 0));
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
