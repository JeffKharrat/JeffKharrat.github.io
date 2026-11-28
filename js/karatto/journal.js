/* the journal: an id is applied at most once (a shift's result survives reloads and retries) */
export function once(save, id, fn) {
  const J = save.jr || (save.jr = []);
  if (J.includes(id)) return { dup: true };
  const r = fn(); J.push(id); if (J.length > 500) J.splice(0, J.length - 500); return r === undefined ? { ok: true } : r;
}
