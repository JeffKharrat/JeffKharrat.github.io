/* カラット: build data/karatto/kanji.json, the wall's data.
   Sources (open): Jonathan Waller's JLPT levels and KANJIDIC2 readings/meanings/frequency via davidluzgouveia/kanji-data;
   JMdict's common words (with frequency bands) via @johnmorrisdotca/jisho. Usage:
   node tools/karatto/build-kanji.mjs <kanji-data/kanji.json> <jisho/dist/data/words/common.data.js> */
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { align, norm } from '../../js/karatto/align.js';

const [kanjiPath, commonPath] = process.argv.slice(2);
const KD = JSON.parse(fs.readFileSync(kanjiPath, 'utf8'));
const { COMMON_WORDS } = await import(pathToFileURL(commonPath).href);
const K = c => KD[c] ? { on: KD[c].readings_on || [], kun: KD[c].readings_kun || [] } : null;

/* the words: first written form, reading, a weight from JMdict's frequency band (nf01 = most frequent), a short gloss */
const words = [], seen = new Set();
for (const row of COMMON_WORDS.rows) {
  const [reading, forms, flags, ...senses] = row.split('\t');
  const id = flags.split('#')[1]; if (id && seen.has(id)) continue; if (id) seen.add(id);   // one row per entry: its primary reading (化学 かがく, not ばけがく)
  const written = (forms || '').split('|')[0]; if (!written || !/[㐀-鿿]/.test(written)) continue;
  const fl = flags.split('#')[0], nf = +(fl.match(/(\d+)/) || [])[1] || 40, uk = fl.includes('U');
  const gloss = (senses[0] || '').split('¦').slice(1, 3).join('; ');
  words.push({ written, reading: norm(reading), w: (1 / Math.sqrt(nf)) * (uk ? .3 : 1), gloss });
}

const LEVELS = [5, 4, 3, 2, 1], DIVS = { 5: 2, 4: 3, 3: 5, 2: 5, 1: 12 };
const byKanji = new Map();
for (const [k, v] of Object.entries(KD)) if (v.jlpt_new) byKanji.set(k, { k, lv: v.jlpt_new, words: [] });
let aligned = 0, juku = 0;
for (const wd of words) {
  const chars = [...new Set([...wd.written].filter(c => byKanji.has(c)))]; if (!chars.length) continue;
  const a = align(wd.written, wd.reading, K);
  if (a) aligned++; else juku++;
  for (const c of chars) {
    let facet, type;
    const hit = a && a.find(x => x.k === c);
    if (hit) { type = hit.type; facet = type === 'kun' ? 'kun:' + hit.facet.split('.')[0] : 'on:' + hit.facet; }
    else if ([...wd.written].length <= 3) { type = 'juku'; facet = 'juku:' + wd.written; }   // jukujikun and irregular words: their own facet
    else continue;                                                                    // long unaligned compounds (proper nouns): left out
    byKanji.get(c).words.push({ ...wd, facet, type, kunFull: hit && hit.type === 'kun' ? hit.facet : null });
  }
}

const out = [];
for (const lv of LEVELS) {
  const list = [...byKanji.values()].filter(x => x.lv === lv)
    .sort((a, b) => (KD[a.k].freq || 9999) - (KD[b.k].freq || 9999) || KD[a.k].strokes - KD[b.k].strokes);
  const nd = DIVS[lv], per = Math.ceil(list.length / nd);
  list.forEach((x, i) => {
    const F = new Map(); let tot = 0;
    for (const w of x.words) { tot += w.w; const f = F.get(w.facet) || { id: w.facet, t: w.type, w: 0, n: 0, ok: new Set(), ex: [] }; f.w += w.w; f.n++; if (w.kunFull) f.ok.add(w.kunFull); f.ex.push(w); F.set(w.facet, f); }
    /* a facet's weight: the square root of its words' summed weight, so a reading used in hundreds of compounds doesn't drown one used in a handful of everyday words (生まれる next to the せい compounds) */
    const T = [...F.values()].reduce((s, f) => s + Math.sqrt(f.w), 0);
    let fa = [...F.values()].map(f => ({ ...f, share: T ? Math.sqrt(f.w) / T : 0 })).sort((a, b) => b.share - a.share);
    const keep = fa.filter(f => f.share >= .05); fa = keep.length ? keep : fa.slice(0, 1);
    const sum = fa.reduce((s, f) => s + f.share, 0) || 1;
    const facets = fa.map(f => {
      const oks = [...f.ok].map(s => s.split('.')[1]).filter(Boolean).slice(0, 3), label = f.t === 'on' ? f.id.slice(3) : f.t === 'kun' ? f.id.slice(4) + (oks.length ? '(' + oks.join('/') + ')' : '') : f.id.slice(5);
      return { id: f.id, t: f.t, lab: label, w: +(f.share / sum).toFixed(3), n: f.n,
        ex: f.ex.sort((a, b) => b.w - a.w).slice(0, 4).map(w => [w.written, w.reading, w.gloss.slice(0, 48)]) };
    });
    const d = KD[x.k];
    out.push({ k: x.k, l: lv, d: Math.floor(i / per), i, r: x.words.length ? 0 : 1, f: d.freq || 0, s: d.strokes, m: (d.meanings || []).slice(0, 3), on: d.readings_on || [], kun: d.readings_kun || [], fa: facets, nw: x.words.length });
  });
}
const meta = {
  built: new Date().toISOString().slice(0, 10),
  levels: Object.fromEntries(LEVELS.map(l => [l, { n: out.filter(x => x.l === l).length, divs: DIVS[l] }])),
  credits: [
    'JLPT levels: Jonathan Waller (tanos.co.uk), CC BY, via davidluzgouveia/kanji-data',
    'KANJIDIC2: EDRDG, CC BY-SA 4.0 (readings, meanings, frequency)',
    'JMdict: EDRDG, CC BY-SA 4.0 (common words), via @johnmorrisdotca/jisho'],
};
fs.writeFileSync(new URL('../../data/karatto/kanji.json', import.meta.url), JSON.stringify({ meta, kanji: out }));
console.log('kanji', out.length, 'words', words.length, 'aligned', aligned, 'juku', juku);
for (const c of ['生', '日', '上', '発', '今', '試', '行', '下', '合', '学']) { const x = out.find(o => o.k === c); console.log(c, 'N' + x.l, 'div', x.d, x.fa.map(f => f.lab + ' ' + Math.round(f.w * 100) + '%').join(' · ')); }
const nof = out.filter(x => !x.nw).map(x => x.k); console.log('no common words:', nof.length, nof.slice(0, 30).join(''));
