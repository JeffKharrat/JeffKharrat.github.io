/* カラット: the words the games are played with. Deck words (from ジェフの日本語, read-only) normalised, and a pool of
   common words from the kanji data to draw traps from: same kanji, same sound, close in look, never a second right answer. */
import { parseFurigana } from './align.js?v=12';
import { kata2hira } from './kana.js?v=12';

const isKanji = c => /[一-鿿々]/.test(c);
export const clean = m => (m || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
/* a short meaning for a card or a bin: the first sense, at most ~30 characters */
export function short(m) {
  const t = clean(m).replace(/^\(?\d+\)?\s*/, '').split(/\s*(?:;|；|\/|／|\(\d+\)|\d\.)\s*/)[0];
  const parts = t.split(/\s*,\s*/); let s = parts[0];
  for (let i = 1; i < parts.length && (s + ', ' + parts[i]).length <= 30; i++) s += ', ' + parts[i];
  return s.length > 34 ? s.slice(0, 32) + '…' : s;
}
const STOP = new Set(['to', 'a', 'an', 'the', 'of', 'be', 'in', 'on', 'one', "one's", 'something', 'someone', 'for', 'and', 'or', 'with', 'by', 'at', 'as', 'is', 'up', 'out', 'get', 'do', 'make']);
const toks = m => new Set(clean(m).toLowerCase().replace(/[^a-z\s'-]/g, ' ').split(/\s+/).filter(w => w.length > 2 && !STOP.has(w)));
export const overlap = (a, b) => { const A = toks(a); for (const w of toks(b)) if (A.has(w)) return true; return false; };

/* a deck word as the games use it: written form, reading (hiragana), meaning, its kanji, its level (its hardest kanji) */
export function deckWord(w, KD) {
  let written = w.written, reading = w.reading;
  if (!written) { const f = parseFurigana(w.expr || ''); written = f.written; reading = f.reading; }
  written = (written || '').replace(/\s/g, ''); reading = kata2hira((reading || '').replace(/\s/g, ''));
  const ks = [...written].filter(isKanji), lv = ks.map(k => (KD.byK.get(k) || { l: 0 }).l).filter(Boolean);
  return { id: w.id, w: written, r: reading, m: clean(w.meaning), s: short(w.meaning), ks, lvl: lv.length ? Math.min(...lv) : 0, src: w };
}
/* the pool: every common word the kanji data knows, plus the deck */
export function buildPool(KD, deck) {
  const seen = new Map();
  for (const k of KD.list) for (const f of k.fa) for (const [w, r, g] of f.ex) if (!seen.has(w) && [...w].some(isKanji)) seen.set(w, { w, r: kata2hira(r), m: g, s: short(g), ks: [...w].filter(isKanji) });
  for (const d of deck) if (d.w && !seen.has(d.w)) seen.set(d.w, { w: d.w, r: d.r, m: d.m, s: d.s, ks: d.ks });
  const all = [...seen.values()], byK = new Map();
  for (const e of all) for (const k of new Set(e.ks)) { if (!byK.has(k)) byK.set(k, []); byK.get(k).push(e); }
  return { all, byK };
}
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
/* traps for a card. mode 'form' (pick the written word: the card shows a reading or a meaning) or 'meaning' (pick the
   meaning of a written word). by: 'reading' | 'meaning' (what the card shows, for 'form'). Never a second right answer. */
export function traps(t, mode, by, n, pool) {
  const out = [], used = new Set([t.w]), usedM = new Set([t.s.toLowerCase()]);
  const ok = e => {
    if (used.has(e.w)) return false;
    if (mode === 'form') {
      if (by === 'reading' && e.r === t.r) return false;               // a homophone would be right too
      if (by === 'meaning' && overlap(e.m, t.m)) return false;          // so would a synonym
    } else { if (usedM.has(e.s.toLowerCase()) || overlap(e.m, t.m) || !e.s) return false; }
    return true;
  };
  const take = list => { for (const e of shuffle(list.slice())) { if (out.length >= n) return; if (ok(e)) { out.push(e); used.add(e.w); usedM.add(e.s.toLowerCase()); } } };
  /* 1. sharing a kanji (the look-alike trap)  2. the same first sound and length  3. anything of a like size */
  take(t.ks.flatMap(k => pool.byK.get(k) || []).filter(e => e.w.length <= t.w.length + 1));
  if (out.length < n && mode === 'form') take(pool.all.filter(e => e.r[0] === t.r[0] && Math.abs(e.r.length - t.r.length) <= 1).slice(0, 400));
  if (out.length < n) take(pool.all.filter(e => Math.abs(e.w.length - t.w.length) <= 1).slice(0, 1200));
  return out;
}
export { shuffle };
