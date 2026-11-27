/* カラット: where things come from and go to.
   - The deck: read-only from Anki through AnkiConnect (http://127.0.0.1:8765) when Anki is open; nothing is ever written to Anki.
   - The save: in the browser, and synced to a private GitHub Gist when a gist-only token has been given on this PC. */
const ANKI = 'http://127.0.0.1:8765', DECK = 'ジェフの日本語';
const LS = { save: 'karatto.save', deck: 'karatto.deck', token: 'karatto.gh', gist: 'karatto.gist' };

async function anki(action, params = {}) {
  const r = await fetch(ANKI, { method: 'POST', body: JSON.stringify({ action, version: 6, params }) });
  const j = await r.json(); if (j.error) throw new Error(j.error); return j.result;
}
export async function ankiAvailable() { try { await anki('version'); return true; } catch (e) { return false; } }

/* a note → a word: the expression (furigana kept), meaning, up to three example sentences with the target marked, audio names */
const strip = h => String(h || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
function toWord(n) {
  const f = k => (n.fields[k] || {}).value || '';
  const sent = f('Sentence').split(/<br\s*\/?>/i), tr = strip(f('SentenceMeaning')).split('\n');
  const sentences = sent.map((s, i) => {
    const audio = (s.match(/src="([^"]+\.(?:mp3|ogg|wav))"/) || [])[1] || null;
    const target = (s.match(/class="popup target"[^>]*>([^<]+)</) || [])[1] || null;
    const jp = strip(s.replace(/<span class="popup target"[^>]*>([^<]+)<\/span>/g, '⟦$1⟧')).replace(/\[sound:[^\]]+\]/g, '').trim();
    return jp ? { jp, target, en: (tr[i] || '').replace(/^🔊\s*/, ''), audio } : null;
  }).filter(Boolean);
  return { id: n.noteId, expr: strip(f('Expression')), meaning: strip(f('Meaning')), sentences, notes: strip(f('Notes')).slice(0, 600), mod: n.mod };
}
export async function loadDeckFromAnki(onProgress) {
  const ids = await anki('findNotes', { query: `"deck:${DECK}"` }), out = [];
  for (let i = 0; i < ids.length; i += 100) {
    const ns = await anki('notesInfo', { notes: ids.slice(i, i + 100) });
    ns.forEach(n => out.push(toWord(n))); onProgress && onProgress(out.length, ids.length);
  }
  return out;
}
export async function ankiAudio(name) { try { return 'data:audio/mpeg;base64,' + await anki('retrieveMediaFile', { filename: name }); } catch (e) { return null; } }

/* ---------- the save ---------- */
export const NEW_SAVE = () => ({ v: 1, created: Date.now(), updated: Date.now(), words: {}, corp: { funds: 1000, fame: 0, research: 0, data: 0, stability: 60 }, sim: { t: Date.now() }, log: [] });
const readLS = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
const writeLS = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
export const token = { get: () => { try { return localStorage.getItem(LS.token) || ''; } catch (e) { return ''; } }, set: t => { try { t ? localStorage.setItem(LS.token, t) : localStorage.removeItem(LS.token); } catch (e) {} } };

const GH = 'https://api.github.com', GIST_DESC = 'karatto-save (カラット: private game save)';
const gh = async (path, opt = {}) => {
  const r = await fetch(GH + path, { ...opt, headers: { Authorization: 'Bearer ' + token.get(), Accept: 'application/vnd.github+json', ...(opt.headers || {}) } });
  if (!r.ok) throw new Error('GitHub ' + r.status); return r.json();
};
async function findGist() {
  const id = readLS(LS.gist); if (id) { try { return await gh('/gists/' + id); } catch (e) {} }
  for (let p = 1; p <= 5; p++) {
    const list = await gh('/gists?per_page=100&page=' + p); const g = list.find(x => x.description === GIST_DESC);
    if (g) { writeLS(LS.gist, g.id); return gh('/gists/' + g.id); }
    if (list.length < 100) break;
  }
  return null;
}
async function gistFile(g, name) {
  const f = g.files[name]; if (!f) return null;
  if (!f.truncated) return JSON.parse(f.content);
  return (await fetch(f.raw_url)).json();
}

/* load: the newest of the browser copy and the gist. Each save carries a revision (rev) and the gist revision this
   browser last saw (base). If both sides moved since that base (two PCs played without syncing), the newer wins and
   the other is kept as a recoverable copy (Settings → Recover), instead of being lost to last-write-wins */
export const conflict = { get: () => readLS('karatto.conflict'), clear: () => { try { localStorage.removeItem('karatto.conflict'); } catch (e) {} } };
export async function load() {
  let save = readLS(LS.save), deck = readLS(LS.deck), source = save ? 'local' : 'new';
  if (token.get()) {
    try {
      const g = await findGist();
      if (g) {
        const rs = await gistFile(g, 'save.json');
        if (rs && save && (rs.rev || 0) > (save.base || 0) && (save.rev || 0) > (save.base || 0) && rs.dev !== save.dev) {
          const keep = rs.updated > save.updated ? rs : save, other = keep === rs ? save : rs;
          writeLS('karatto.conflict', { t: Date.now(), save: other }); source = 'conflict';
          if (keep === rs) { save = { ...rs, base: rs.rev }; writeLS(LS.save, save); }
        }
        else if (rs && (!save || rs.updated > save.updated)) { save = { ...rs, base: rs.rev || 0 }; source = 'gist'; writeLS(LS.save, save); }
        if (!deck || source === 'gist') { const rd = await gistFile(g, 'deck.json'); if (rd) { deck = rd; writeLS(LS.deck, deck); } }
      }
    } catch (e) { source += ' (gist unreachable)'; }
  }
  return { save: save || NEW_SAVE(), deck: deck || null, source };
}

/* save: always to the browser; to the gist a few seconds after the last change */
let pending = null, deckDirty = false;
const DEV = (() => { try { let d = localStorage.getItem('karatto.dev'); if (!d) { d = Math.random().toString(36).slice(2, 10); localStorage.setItem('karatto.dev', d); } return d; } catch (e) { return 'x'; } })();
export function store(save, deck) {
  /* another tab or frame of this browser wrote a newer save since this view loaded it: keep that copy recoverable */
  const cur = readLS(LS.save); if (cur && (cur.rev || 0) > (save.rev || 0)) { writeLS('karatto.conflict', { t: Date.now(), save: cur, tab: true }); save.rev = cur.rev; }
  save.updated = Date.now(); save.rev = (save.rev || 0) + 1; save.dev = DEV; writeLS(LS.save, save); if (deck) { writeLS(LS.deck, deck); deckDirty = true; }
  if (!token.get()) return;
  clearTimeout(pending); pending = setTimeout(() => push(save, deckDirty ? deck : null).catch(() => {}), 4000);
}
export async function push(save, deck) {
  const files = { 'save.json': { content: JSON.stringify(save) } };
  if (deck) files['deck.json'] = { content: JSON.stringify(deck) };
  const g = await findGist();
  if (g) await gh('/gists/' + g.id, { method: 'PATCH', body: JSON.stringify({ files }) });
  else { const n = await gh('/gists', { method: 'POST', body: JSON.stringify({ description: GIST_DESC, public: false, files: { ...files, 'deck.json': files['deck.json'] || { content: JSON.stringify(deck || []) } } }) }); writeLS(LS.gist, n.id); }
  save.base = save.rev || 0; writeLS(LS.save, save);
  deckDirty = false;
}
export function exportSave(save) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(save)], { type: 'application/json' }));
  a.download = 'karatto-save-' + new Date().toISOString().slice(0, 10) + '.json'; a.click();
}
