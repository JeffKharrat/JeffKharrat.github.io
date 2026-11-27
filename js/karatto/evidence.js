/* カラット: evidence and memory. Games record first attempts per skill; the AI flags a word it believes Jeff knows; the
   audit commits it. Rules (design doc, "Certification"; politics brief, "one authoritative gate"):
   - a day runs from 4:00 to 4:00 Japan time; a skill earns at most one clean day per word per day;
   - only clean days inside a rolling 8-day window count; a miss wipes that skill's clean days (wrong costs more);
   - flagged: clean days in 3 skills, over at least 2 different days, not in memory, not snoozed. A flag is checked
     again at every update and before a commit: a miss after the flag sends the file back to training. The window is
     measured from the flag's date, so a file waiting in the queue doesn't rot;
   - snoozed (Not yet): asked again in 3, then 7, then 14 days, on fresh evidence only (the old is cleared);
   - every attempt is logged (exposure), and successes by modality (picked a written form / typed a reading) and
     without a hint, so the displayed ability can match the question later. Eligibility still uses clean skills only;
   - repeats on the same day still count as practice but pay a reduced rate (payRate);
   - a compromised word (a lost breach) keeps its certification; it is restored by a correct unhinted answer, in any
     game or through Reverify in the audit room. A failed reverification keeps the word certified and compromised. */
export const SKILLS = ['meaning', 'reading', 'recall', 'context', 'listen'];
export const SKILL_J = { meaning: '意味', reading: '読み', recall: '想起', context: '文脈', listen: '聴解' };
const DAY = 864e5, JST = 9 * 3600e3, ROLL = 4 * 3600e3;
export const WINDOW = 8;
export const day = (t = Date.now()) => new Date(t + JST - ROLL).toISOString().slice(0, 10);      // a day starts at 4:00 JST
export const rec = (save, id) => save.words[id] || (save.words[id] = {});
const since = (t, n = WINDOW) => day(t - (n - 1) * DAY);                                         // the oldest day inside the window
export const freshDays = (e, at = Date.now()) => (e && e.d ? e.d.filter(x => x >= since(at)) : []);

export function record(save, id, skill, ok, how = 'pick', where = '', hinted = false) {
  const w = rec(save, id), e = ((w.ev = w.ev || {})[skill] = (w.ev[skill] || { d: [] })), d = day();
  w.seen = Date.now(); e.x = (e.x || 0) + 1;                                                     // exposure: every first attempt
  if (ok) {
    if (!hinted && w.comp) { delete w.comp; w.rv = Date.now(); }
    const m = (e.m = e.m || {}); m[how] = (m[how] || 0) + 1; if (!hinted) e.u = (e.u || 0) + 1;
    if (e.d.includes(d)) return 'same-day';
    e.d.push(d); if (e.d.length > WINDOW) e.d.shift(); e.how = how; e.at = where; return 'new';
  }
  e.d = []; e.miss = Date.now(); return 'miss';
}
/* full pay for the first clean answer of the day per word and skill; repeats are practice */
export const PRACTICE = .3;
export const payRate = r => (r === 'new' ? 1 : PRACTICE);
export function skillsClean(w, at = Date.now()) { return SKILLS.filter(s => w.ev && w.ev[s] && freshDays(w.ev[s], at).length); }
function qualifies(w, at) {
  const sk = skillsClean(w, at), days = new Set(); sk.forEach(s => freshDays(w.ev[s], at).forEach(x => days.add(x)));
  return sk.length >= 3 && days.size >= 2;
}
export function suspicious(w) {
  if (!w || w.cert || w.flag || (w.snooze && Date.now() < w.snooze.until)) return false;
  return qualifies(w, Date.now());
}
/* still worth committing: no miss since the flag, the evidence as it stood at the flag */
export function eligible(w) { return !!w && !w.cert && !!w.flag && qualifies(w, w.flag) && !SKILLS.some(s => w.ev[s] && w.ev[s].miss > w.flag); }
/* run after a game: flag every word that now qualifies, unflag the stale ones; returns the ids newly flagged */
export function updateFlags(save) {
  const out = [];
  for (const [id, w] of Object.entries(save.words)) {
    if (w.flag && !w.cert && !eligible(w)) { delete w.flag; w.unflag = Date.now(); continue; }
    if (suspicious(w)) { w.flag = Date.now(); out.push(+id); }
  }
  return out;
}
export const files = save => Object.entries(save.words).filter(([, w]) => w.flag && !w.cert && eligible(w)).map(([id, w]) => ({ id: +id, ...w })).sort((a, b) => a.flag - b.flag);
/* commit: an audit commit rechecks the file first; claims and the founding are spot-checked instead. Returns false if refused */
export function commit(save, id, how = 'audit') {
  const w = rec(save, id);
  if (how === 'audit' && w.flag && !eligible(w)) { delete w.flag; w.unflag = Date.now(); return false; }
  w.cert = Date.now(); w.how = how; delete w.flag; delete w.snooze; return true;
}
export function snooze(save, id) {
  const w = rec(save, id), n = (w.snooze ? w.snooze.n : 0) + 1;
  w.snooze = { n, until: Date.now() + [3, 7, 14][Math.min(2, n - 1)] * DAY }; delete w.flag;
  if (w.ev) for (const s of SKILLS) if (w.ev[s]) w.ev[s].d = [];                 // fresh evidence only
  return [3, 7, 14][Math.min(2, n - 1)];
}
/* compromised words: the list, and the result of a reverification (an unhinted typed reading, then the meaning) */
export const compromised = save => Object.entries(save.words).filter(([, w]) => w.cert && w.comp).map(([id, w]) => ({ id: +id, ...w })).sort((a, b) => a.comp - b.comp);
export function reverify(save, id, pass) {
  const w = rec(save, id); if (!w.cert) return false;
  if (pass) { delete w.comp; w.rv = Date.now(); } else w.rvMiss = Date.now();                     // the certification is never lost here
  return pass;
}
/* claims after the founding: a daily allowance, so the wall still grows by work */
export const CLAIMS_PER_DAY = 40;
export function claimsLeft(save, founding) {
  if (founding) return Infinity; const c = save.corp.claims || {}; return c.day === day() ? Math.max(0, CLAIMS_PER_DAY - c.n) : CLAIMS_PER_DAY;
}
export function useClaim(save) { const c = save.corp.claims = save.corp.claims || {}; if (c.day !== day()) { c.day = day(); c.n = 0; } c.n++; }
