/* カラット: the knowledge model. Which facets of which kanji a word covers, each key's level, the divisions, the tier.
   Levels: 0 dark (no deck word has it), 1 dim (deck words, none certified), 2 acquired, 3 integrated, 4 mastered. */
import { align, parseFurigana } from './align.js?v=7';

export const LEVELS = [5, 4, 3, 2, 1];
export const TIERS = [
  { lv: 5, name: '町工場', en: 'Backstreet workshop' }, { lv: 4, name: '中小企業', en: 'Small enterprise' },
  { lv: 3, name: '中堅企業', en: 'Mid-size firm' }, { lv: 2, name: '大企業', en: 'Large corporation' }, { lv: 1, name: '財閥', en: 'Zaibatsu' }];

export async function loadKanji(url) {
  const d = await (await fetch(url)).json();
  const byK = new Map(); d.kanji.forEach((x, n) => { x.n = n; byK.set(x.k, x); });
  return { meta: d.meta, list: d.kanji, byK, K: c => { const x = byK.get(c); return x ? { on: x.on, kun: x.kun } : null; } };
}

/* a deck word → [{k, facet}] using the same rules as the build (kun grouped by stem, unaligned short words as their own facet) */
export function wordFacets(word, KD) {
  const { written, reading } = word.written ? word : parseFurigana(word.expr);
  const chars = [...new Set([...written].filter(c => KD.byK.has(c)))]; if (!chars.length) return [];
  const a = align(written, reading, KD.K);
  return chars.map(c => {
    const hit = a && a.find(x => x.k === c);
    if (hit) return { k: c, facet: hit.type === 'kun' ? 'kun:' + hit.facet.split('.')[0] : 'on:' + hit.facet };
    const juku = KD.byK.get(c).fa.find(f => f.id === 'juku:' + written);
    return { k: c, facet: juku ? juku.id : null };                    // null: an irregular reading; the word still counts, no facet
  });
}

/* every key's state from the deck, the certified set, and the kanji Jeff marked as acquired by hand
   (a hand mark puts a key at acquired, the minimum; words then take it further) */
export function keyStates(KD, deck, certified, manual = new Set()) {
  const S = KD.list.map(x => ({ lvl: 0, words: [], cert: [], cov: 0, covered: new Set() }));
  for (const w of deck) {
    const fs = w._facets || (w._facets = wordFacets(w, KD));
    for (const { k, facet } of fs) {
      const s = S[KD.byK.get(k).n]; s.words.push(w.id);
      if (certified.has(w.id)) { s.cert.push(w.id); if (facet) s.covered.add(facet); }
    }
  }
  KD.list.forEach((x, n) => {
    const s = S[n];
    s.cov = x.fa.reduce((t, f) => t + (s.covered.has(f.id) ? f.w : 0), 0);
    const main = x.fa[0] && s.covered.has(x.fa[0].id), nc = new Set(s.cert).size;
    s.lvl = !s.words.length ? 0 : !nc ? 1 : (s.cov >= .85 && nc >= Math.max(3, x.fa.length)) ? 4 : (main && nc >= 2) ? 3 : 2;
    s.manual = manual.has(x.k); if (s.manual && s.lvl < 2) s.lvl = 2;
  });
  return S;
}

/* divisions and tier: a division is complete at 80% acquired (rare name kanji with no common words don't count) */
export function progress(KD, S) {
  const div = {}, lev = {};
  KD.list.forEach((x, n) => {
    if (x.r) return;
    const key = x.l + ':' + x.d, a = S[n].lvl >= 2 ? 1 : 0;
    (div[key] = div[key] || { l: x.l, d: x.d, n: 0, a: 0 }).n++; div[key].a += a;
    (lev[x.l] = lev[x.l] || { n: 0, a: 0, m: 0 }).n++; lev[x.l].a += a; lev[x.l].m += S[n].lvl === 4 ? 1 : 0;
  });
  let tier = -1; for (let i = 0; i < LEVELS.length; i++) { const L = lev[LEVELS[i]]; if (L && L.a / L.n >= .8) tier = i; else break; }
  return { div, lev, tier };                                          // tier -1: not yet a workshop (founding)
}
