/* カラット: evidence and memory. Games record first attempts per skill; the AI flags a word it believes Jeff knows; the
   audit commits it. Rules (design doc, "Certification"):
   - a skill earns at most one clean day per word per day; a miss wipes that skill's clean days (wrong costs more);
   - flagged: clean days in 3 skills, over at least 2 different days, not in memory, not snoozed;
   - snoozed (Not yet): asked again in 3, then 7, then 14 days, on fresh evidence only (the old is cleared). */
export const SKILLS = ['meaning', 'reading', 'recall', 'context', 'listen'];
export const SKILL_J = { meaning: '意味', reading: '読み', recall: '想起', context: '文脈', listen: '聴解' };
export const day = (t = Date.now()) => new Date(t - 4 * 3600e3).toISOString().slice(0, 10);      // a day starts at 4 am
export const rec = (save, id) => save.words[id] || (save.words[id] = {});

export function record(save, id, skill, ok, how = 'pick', where = '') {
  const w = rec(save, id), e = ((w.ev = w.ev || {})[skill] = (w.ev[skill] || { d: [] })), d = day();
  w.seen = Date.now();
  if (ok) { if (e.d.includes(d)) return 'same-day'; e.d.push(d); if (e.d.length > 8) e.d.shift(); e.how = how; e.at = where; return 'new'; }
  e.d = []; e.miss = Date.now(); return 'miss';
}
export function skillsClean(w) { return SKILLS.filter(s => w.ev && w.ev[s] && w.ev[s].d.length); }
export function suspicious(w) {
  if (!w || w.cert || w.flag || (w.snooze && Date.now() < w.snooze.until)) return false;
  const sk = skillsClean(w), days = new Set(); sk.forEach(s => w.ev[s].d.forEach(x => days.add(x)));
  return sk.length >= 3 && days.size >= 2;
}
/* run after a game: flag every word that now qualifies; returns the ids newly flagged */
export function updateFlags(save) {
  const out = []; for (const [id, w] of Object.entries(save.words)) if (suspicious(w)) { w.flag = Date.now(); out.push(+id); }
  return out;
}
export const files = save => Object.entries(save.words).filter(([, w]) => w.flag && !w.cert).map(([id, w]) => ({ id: +id, ...w })).sort((a, b) => a.flag - b.flag);
export function commit(save, id, how = 'audit') { const w = rec(save, id); w.cert = Date.now(); w.how = how; delete w.flag; delete w.snooze; }
export function snooze(save, id) {
  const w = rec(save, id), n = (w.snooze ? w.snooze.n : 0) + 1;
  w.snooze = { n, until: Date.now() + [3, 7, 14][Math.min(2, n - 1)] * 864e5 }; delete w.flag;
  if (w.ev) for (const s of SKILLS) if (w.ev[s]) w.ev[s].d = [];                 // fresh evidence only
  return [3, 7, 14][Math.min(2, n - 1)];
}
/* claims after the founding: a daily allowance, so the wall still grows by work */
export const CLAIMS_PER_DAY = 40;
export function claimsLeft(save, founding) {
  if (founding) return Infinity; const c = save.corp.claims || {}; return c.day === day() ? Math.max(0, CLAIMS_PER_DAY - c.n) : CLAIMS_PER_DAY;
}
export function useClaim(save) { const c = save.corp.claims = save.corp.claims || {}; if (c.day !== day()) { c.day = day(); c.n = 0; } c.n++; }
