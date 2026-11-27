/* カラット: the leaf, built by a cell sweep. Jeff's silhouette (karatto/leaf-mask.png) rasterised to cells; a PROPAGATE
   wipe crosses the screen: each cell turns in its own order, v = (x/cols*.84 + y/rows*.5 + rand*.22)/1.56. In the front
   band a cell flashes the yellow, then a 4x4 checker, then its new look: ink if it is in the leaf, dark if not. The band
   shears (rows slide sideways while they are in the front). A second sweep then takes the leaf down to the page. */
const MASK = new URL('../../karatto/leaf-mask.png', import.meta.url).href;
const Y = '#FFE600', INK = '#FFE600', BG = '#0B0C0E';
const rnd = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

function maskGrid(img, cols, rows) {                                          // the silhouette as a cols x rows grid of 0/1
  const c = document.createElement('canvas'); c.width = cols; c.height = rows;
  const x = c.getContext('2d'); x.drawImage(img, 0, 0, cols, rows);
  const d = x.getImageData(0, 0, cols, rows).data, g = new Uint8Array(cols * rows);
  for (let i = 0; i < g.length; i++) g[i] = d[i * 4 + 3] > 110 ? 1 : 0;
  return g;
}

/* play over a host element. opts: { cells: leaf height in cells, hold: seconds the leaf stays, out: sweep it away } */
export function leafSweep(host = document.body, { cells = 44, hold = .9, out = true, dur = 1.5, onDone } = {}) {
  const cv = document.createElement('canvas');
  cv.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:9999;pointer-events:none';
  host.appendChild(cv);
  const cx = cv.getContext('2d'), img = new Image(); img.src = MASK;
  let G, cols, rows, cs, lx, ly, lw, lh, M, ord, t0 = 0, done = false;
  const setup = () => {
    const dpr = Math.min(2, devicePixelRatio || 1), W = innerWidth, H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr; cx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lh = cells; lw = Math.round(cells * img.naturalWidth / img.naturalHeight);
    cs = Math.max(4, Math.floor(Math.min(H * .5, W * .6) / lh));             // a cell's size: the leaf about half the screen
    cols = Math.ceil(W / cs); rows = Math.ceil(H / cs);
    lx = Math.floor((cols - lw) / 2); ly = Math.floor((rows - lh) / 2);
    M = maskGrid(img, lw, lh);
    ord = new Float32Array(cols * rows);
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) ord[j * cols + i] = (i / cols * .84 + j / rows * .5 + rnd(i * 977 + j * 131) * .22) / 1.56;
  };
  const inLeaf = (i, j) => { const a = i - lx, b = j - ly; return a >= 0 && b >= 0 && a < lw && b < lh && M[b * lw + a] === 1; };
  const BAND = .16;                                                          // the front's width, in sweep units
  /* one cell at sweep progress p: before the front it shows `from`, after it `to`; in the front, yellow then checker */
  function cell(i, j, p, from, to, shear) {
    const k = j * cols + i, f = (p - ord[k]) / BAND;                         // f<0 not reached, 0..1 in the front, >1 done
    let x = i * cs, y = j * cs;
    if (f > 0 && f < 1) x += Math.sin(j * .9 + p * 9) * cs * shear * (1 - f);
    const look = f >= 1 ? to : f <= 0 ? from : null;
    if (look === 1) { cx.fillStyle = INK; cx.fillRect(x, y, cs - (cs > 6 ? 1 : 0), cs - (cs > 6 ? 1 : 0)); return; }
    if (look === 0) return;
    if (f < .45) { cx.fillStyle = Y; cx.globalAlpha = .55 + .45 * (1 - f / .45); cx.fillRect(x, y, cs, cs); cx.globalAlpha = 1; return; }
    const q = cs / 4, ph = (f * 6 | 0) & 1;                                  // the 4x4 checker, flipping as it settles
    cx.fillStyle = Y;
    for (let b = 0; b < 4; b++) for (let a = 0; a < 4; a++) if (((a + b + ph) & 1) === 0) cx.fillRect(x + a * q, y + b * q, q, q);
  }
  function frame(now) {
    if (done) return;
    if (!t0) t0 = now;
    const t = (now - t0) / 1000, T1 = dur, T2 = T1 + hold, T3 = T2 + (out ? dur : 0);
    const W = innerWidth, H = innerHeight;
    cx.clearRect(0, 0, W, H);
    const fade = out && t > T2 ? Math.max(0, 1 - (t - T2) / dur * 1.4) : 1;   // the backdrop lifts as the second sweep runs
    cx.fillStyle = BG; cx.globalAlpha = fade; cx.fillRect(0, 0, W, H); cx.globalAlpha = 1;
    if (t < T2) { const p = Math.min(1 + BAND, t / T1 * (1 + BAND));
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) cell(i, j, p, 0, inLeaf(i, j) ? 1 : 0, 1); }
    else { const p = Math.min(1 + BAND, (t - T2) / dur * (1 + BAND));
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) cell(i, j, p, inLeaf(i, j) ? 1 : 0, 0, .6); }
    if (t >= T3) { done = true; cv.remove(); onDone && onDone(); return; }
    requestAnimationFrame(frame);
  }
  const go = () => { setup(); requestAnimationFrame(frame); };
  if (img.complete && img.naturalWidth) go(); else { img.onload = go; img.onerror = () => { cv.remove(); onDone && onDone(); }; }
  addEventListener('resize', () => { if (!done && img.naturalWidth) setup(); });
  cv.style.pointerEvents = 'auto'; cv.onclick = () => { done = true; cv.remove(); onDone && onDone(); };   // click skips
  return () => { done = true; cv.remove(); };
}
