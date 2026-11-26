/* カラット: split a word's reading across its kanji (学生 → 学:がく 生:せい), the same way for the open dictionary at build
   time and for Jeff's deck in the browser. Each kanji's facets are its readings (on: katakana in KANJIDIC, here hiragana;
   kun: the stem before the okurigana dot). Handles rendaku (voicing), sokuon (がく → がっ), 々 and okurigana. Words that
   don't align (jukujikun: 今日, 大人) return null, and the caller treats them as their own facet. */
const kata2hira = s => s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
const isKanji = c => /[㐀-鿿豈-﫿々〆ヶ]/.test(c);
const VOICE = { か: 'が', き: 'ぎ', く: 'ぐ', け: 'げ', こ: 'ご', さ: 'ざ', し: 'じ', す: 'ず', せ: 'ぜ', そ: 'ぞ', た: 'だ', ち: 'ぢ', つ: 'づ', て: 'で', と: 'ど',
  は: 'ば', ひ: 'び', ふ: 'ぶ', へ: 'べ', ほ: 'ぼ' };
const HALF = { は: 'ぱ', ひ: 'ぴ', ふ: 'ぷ', へ: 'ぺ', ほ: 'ぽ' };
const RENYOU = { う: 'い', く: 'き', ぐ: 'ぎ', す: 'し', つ: 'ち', ぬ: 'に', ぶ: 'び', む: 'み', る: 'り' };
const norm = s => kata2hira(s).replace(/[ーｰ]/g, 'ー');

/* the forms a reading takes inside a word, each tagged with the facet it belongs to */
export function variants(kanji, info) {
  const out = [];
  const add = (form, facet, type, ok = '') => { if (form && !out.some(o => o.form === form && o.facet === facet)) out.push({ form, facet, type, ok }); };
  const withSound = (r, facet, type, ok = '') => {
    add(r, facet, type, ok);
    const f = r[0]; if (VOICE[f]) add(VOICE[f] + r.slice(1), facet, type, ok); if (HALF[f]) add(HALF[f] + r.slice(1), facet, type, ok);
    if (/[つくちき]$/.test(r) && r.length > 1) { const g = r.slice(0, -1) + 'っ'; add(g, facet, type); if (VOICE[g[0]]) add(VOICE[g[0]] + g.slice(1), facet, type); if (HALF[g[0]]) add(HALF[g[0]] + g.slice(1), facet, type); }
  };
  for (const o of info.on || []) { const r = norm(o).replace(/[-.]/g, ''); if (r) withSound(r, r, 'on'); }
  for (const k of info.kun || []) {
    const s = norm(k).replace(/^-|-$/g, ''); if (!s) continue;
    const [stem, ok = ''] = s.split('.'), facet = ok ? stem + '.' + ok : stem;
    withSound(stem, facet, 'kun', ok);
    if (ok) {
      withSound(stem + ok, facet, 'kun');                                            // written without okurigana (話 はなし is handled below)
      const last = ok.slice(-1), ren = ok.slice(0, -1) + (RENYOU[last] || '');
      if (RENYOU[last]) withSound(stem + ren, facet, 'kun');                         // the noun form: 話 はなし (はな.す), 答 こたえ (こた.える)
      if (/[えけげせぜてでねへべぺめれいきぎしじちぢにひびぴみり]る$/.test(ok)) withSound(stem + ok.slice(0, -1), facet, 'kun');   // ichidan: the stem form (答え, 晴れ)
    }
  }
  return out.sort((a, b) => b.form.length - a.form.length);
}

/* align: written (kanji + kana) against its reading. KANJI(c) returns {on, kun} or null. Returns [{k, facet, type, form}] for
   each kanji in order, or null if it can't be aligned. */
export function align(written, reading, KANJI) {
  const W = [...written], R = norm(reading), memo = new Map(), cache = {};
  const vars = c => cache[c] || (cache[c] = KANJI(c) ? variants(c, KANJI(c)) : []);
  function go(i, j, prev) {
    if (i === W.length) return j === R.length ? [] : null;
    const key = i + ':' + j + ':' + (prev ? prev.facet : ''); if (memo.has(key)) return memo.get(key);
    const c = W[i]; let res = null;
    if (!isKanji(c)) {
      const h = norm(c);
      if (R.startsWith(h, j)) res = go(i + 1, j + h.length, null);
    } else {
      let cand = vars(c);
      if (c === '々' && prev) cand = variants(prev.k, KANJI(prev.k) || {}).map(v => ({ ...v, k: prev.k }));
      const nx = W[i + 1] && !isKanji(W[i + 1]) ? norm(W.slice(i + 1).join('')) : '';
      if (nx) cand = cand.filter(v => v.ok && nx.startsWith(v.ok[0])).concat(cand.filter(v => !(v.ok && nx.startsWith(v.ok[0]))));   // okurigana follows: the kun reading it belongs to first
      for (const v of cand) {
        if (!R.startsWith(v.form, j)) continue;
        const rest = go(i + 1, j + v.form.length, { k: v.k || c, facet: v.facet });
        if (rest) { res = [{ k: v.k || c, facet: v.facet, type: v.type, form: v.form, self: c }].concat(rest); break; }
      }
    }
    memo.set(key, res); return res;
  }
  const r = go(0, 0, null);
  return r ? r.filter(x => x.self !== '々') : null;
}

/* Anki furigana "試合[しあい]", " 死[し]ぬ" → { written, reading } */
export function parseFurigana(s) {
  s = String(s || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
  let written = '', reading = '';
  const re = /\s?([^\s\[\]]+?)\[([^\]]+)\]|([^\[\]\s])/g; let m;
  while ((m = re.exec(s))) { if (m[3] !== undefined) { written += m[3]; reading += m[3]; } else { written += m[1]; reading += m[2]; } }
  return { written, reading: norm(reading) };
}
export { kata2hira, isKanji, norm };
