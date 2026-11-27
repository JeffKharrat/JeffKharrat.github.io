/* カラット: typing Japanese without an IME. Romaji turns into hiragana as it is typed (Hepburn and kunrei both),
   the unfinished tail stays as romaji. toKana('shia') → { kana: 'しあ', rest: '' }, toKana('kyo') → { kana: 'きょ' }. */
const T = {};
const add = (r, k) => { T[r] = k; };
const V = { a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お' };
Object.entries(V).forEach(([r, k]) => add(r, k));
const ROWS = {
  k: 'かきくけこ', g: 'がぎぐげご', s: 'さしすせそ', z: 'ざじずぜぞ', t: 'たちつてと', d: 'だぢづでど', n: 'なにぬねの', h: 'はひふへほ',
  b: 'ばびぶべぼ', p: 'ぱぴぷぺぽ', m: 'まみむめも', r: 'らりるれろ', y: 'や\u0000ゆ\u0000よ', w: 'わゐ\u0000ゑを' };
Object.entries(ROWS).forEach(([c, ks]) => ['a', 'i', 'u', 'e', 'o'].forEach((v, n) => { if (ks[n] !== '\u0000') add(c + v, ks[n]); }));
[['shi', 'し'], ['chi', 'ち'], ['tsu', 'つ'], ['fu', 'ふ'], ['ji', 'じ'], ['si', 'し'], ['ti', 'ち'], ['tu', 'つ'], ['hu', 'ふ'], ['zi', 'じ'], ['di', 'ぢ'], ['du', 'づ'],
 ['wo', 'を'], ['wi', 'うぃ'], ['we', 'うぇ'], ['ye', 'いぇ'], ['va', 'ゔぁ'], ['vi', 'ゔぃ'], ['vu', 'ゔ'], ['ve', 'ゔぇ'], ['vo', 'ゔぉ'],
 ['fa', 'ふぁ'], ['fi', 'ふぃ'], ['fe', 'ふぇ'], ['fo', 'ふぉ'], ['she', 'しぇ'], ['je', 'じぇ'], ['che', 'ちぇ'], ['ti', 'ち'], ['thi', 'てぃ'], ['dhi', 'でぃ'], ['twu', 'とぅ'], ['dwu', 'どぅ'],
 ['xa', 'ぁ'], ['xi', 'ぃ'], ['xu', 'ぅ'], ['xe', 'ぇ'], ['xo', 'ぉ'], ['la', 'ぁ'], ['li', 'ぃ'], ['lu', 'ぅ'], ['le', 'ぇ'], ['lo', 'ぉ'],
 ['xtu', 'っ'], ['ltu', 'っ'], ['xya', 'ゃ'], ['xyu', 'ゅ'], ['xyo', 'ょ'], ['lya', 'ゃ'], ['lyu', 'ゅ'], ['lyo', 'ょ'], ['nn', 'ん'], ["n'", 'ん'], ['-', 'ー']
].forEach(([r, k]) => add(r, k));
/* the y-sounds: kya, sha, cha, ja... */
const Y = { k: 'き', g: 'ぎ', n: 'に', h: 'ひ', b: 'び', p: 'ぴ', m: 'み', r: 'り', s: 'し', z: 'じ', t: 'ち', d: 'ぢ', c: 'ち', j: 'じ' };
Object.entries(Y).forEach(([c, k]) => [['a', 'ゃ'], ['u', 'ゅ'], ['o', 'ょ'], ['e', 'ぇ']].forEach(([v, s]) => { add(c + 'y' + v, k + s); }));
[['sh', 'し'], ['ch', 'ち'], ['j', 'じ']].forEach(([c, k]) => [['a', 'ゃ'], ['u', 'ゅ'], ['o', 'ょ']].forEach(([v, s]) => add(c + v, k + s)));
const KEYS = Object.keys(T).sort((a, b) => b.length - a.length);
const isCons = c => /[bcdfghjklmpqrstvwxyz]/.test(c);

export function toKana(input, final = false) {
  const s = input.toLowerCase(); let out = '', i = 0;
  while (i < s.length) {
    const c = s[i], nx = s[i + 1];
    if (!/[a-z'\-]/.test(c)) { out += c; i++; continue; }                  // kana or anything else passes through
    if (c === 'n' && nx && nx !== 'n' && nx !== 'y' && nx !== "'" && !V[nx]) { out += 'ん'; i++; continue; }
    if (c === 'n' && nx === 'n' && s[i + 2] && V[s[i + 2]]) { out += 'ん'; i++; continue; }   // konnichiha: ん then に (kinnyou: ん then よ)
    if (isCons(c) && c !== 'n' && nx === c) { out += 'っ'; i++; continue; }  // a doubled consonant: the small tsu
    if (c === 't' && nx === 'c') { out += 'っ'; i++; continue; }            // matcha
    const k = KEYS.find(r => s.startsWith(r, i));
    if (k) { out += T[k]; i += k.length; continue; }
    if (final && c === 'n') { out += 'ん'; i++; continue; }
    return { kana: out, rest: s.slice(i) };                                // unfinished: kept as typed
  }
  return { kana: out, rest: '' };
}
export const kata2hira = s => s.replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));
/* is the typed reading one of the word's readings (katakana and hiragana alike) */
export function sameReading(typed, readings) {
  const t = kata2hira(toKana(typed, true).kana).replace(/\s/g, '');
  return [].concat(readings).some(r => kata2hira(r || '').replace(/[\s・.]/g, '') === t);
}
