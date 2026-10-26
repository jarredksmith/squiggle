// Kindle Chat helper: a tiny message server for the chat pages on GitHub Pages.
// Runs as a Cloudflare Worker (free tier) with one D1 database bound as DB.
//
// Every conversation has a long random code. Anyone holding the code can read and post in that
// conversation, so the code is the invite: share it only with the people in the chat.
// Only someone with ADMIN_CODE (your own passcode) can start new conversations, so strangers
// can't use your helper to host their own chats.
//
// Requests are "simple" CORS requests on purpose (GET, or POST with a text/plain body, no custom
// headers) so the Kindle's older browser never has to make a preflight request.
//
// Settings (Workers > kindle-chat > Settings > Variables and Secrets, and Bindings):
//   DB               D1 database binding (create a D1 database named kindle-chat and bind it as DB)
//   ADMIN_CODE       Secret: a passcode you make up; the Kindle asks for it once, to start chats
//   ALLOWED_ORIGINS  Text: https://jarredksmith.github.io   (comma-separate more than one)

const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS rooms (code TEXT PRIMARY KEY, name TEXT NOT NULL, created INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, room TEXT NOT NULL, sender TEXT NOT NULL, name TEXT NOT NULL, text TEXT NOT NULL, ts INTEGER NOT NULL)',
  'CREATE INDEX IF NOT EXISTS messages_room ON messages (room, id)',
  'CREATE TABLE IF NOT EXISTS members (room TEXT NOT NULL, sender TEXT NOT NULL, name TEXT NOT NULL, last_read INTEGER NOT NULL DEFAULT 0, seen INTEGER NOT NULL, PRIMARY KEY (room, sender))',
];
let ready = false;
async function init(db) {
  if (ready) return;
  await db.batch(SCHEMA.map(s => db.prepare(s)));
  ready = true;
}

const CODE_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';
function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  let s = '';
  for (const b of bytes) s += CODE_CHARS[b % CODE_CHARS.length];
  return s;
}
const clean = (s, max) => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    const cors = {
      'Access-Control-Allow-Origin': allowed.length === 0 ? '*' : (allowed.includes(origin) ? origin : allowed[0]),
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
      'Cache-Control': 'no-store',
    };
    const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (!env.DB) return json({ error: 'The helper has no database yet. Bind a D1 database as DB.' }, 500);

    const url = new URL(req.url);
    const parts = url.pathname.split('/').filter(Boolean);
    let body = {};
    if (req.method === 'POST') { try { body = JSON.parse(await req.text() || '{}'); } catch (e) { return json({ error: 'Bad request' }, 400); } }

    try {
      await init(env.DB);
      const db = env.DB;

      if (parts[0] === 'ping') return json({ ok: true });

      // Start a conversation (needs your passcode)
      if (parts[0] === 'new' && req.method === 'POST') {
        if (!env.ADMIN_CODE || body.admin !== env.ADMIN_CODE) return json({ error: 'Wrong passcode' }, 403);
        const name = clean(body.name, 60) || 'Chat';
        const code = newCode();
        await db.prepare('INSERT INTO rooms (code, name, created) VALUES (?, ?, ?)').bind(code, name, Date.now()).run();
        return json({ code, name });
      }

      if (parts[0] === 'c' && parts[1]) {
        const code = clean(parts[1], 40);
        const room = await db.prepare('SELECT code, name FROM rooms WHERE code = ?').bind(code).first();
        if (!room) return json({ error: 'No conversation with that code' }, 404);

        // Read: messages after an id, plus who has read what. Also records that this device checked in.
        if (!parts[2] && req.method === 'GET') {
          const after = Math.max(0, parseInt(url.searchParams.get('after') || '0', 10) || 0);
          const me = clean(url.searchParams.get('me'), 40), myName = clean(url.searchParams.get('name'), 40);
          const read = Math.max(0, parseInt(url.searchParams.get('read') || '0', 10) || 0);
          let rows;
          if (after > 0) rows = (await db.prepare('SELECT id, sender, name, text, ts FROM messages WHERE room = ? AND id > ? ORDER BY id LIMIT 300').bind(code, after).all()).results;
          else rows = (await db.prepare('SELECT * FROM (SELECT id, sender, name, text, ts FROM messages WHERE room = ? ORDER BY id DESC LIMIT 200) ORDER BY id').bind(code).all()).results;
          if (me && myName) {
            await db.prepare('INSERT INTO members (room, sender, name, last_read, seen) VALUES (?, ?, ?, ?, ?) ON CONFLICT (room, sender) DO UPDATE SET name = excluded.name, last_read = MAX(members.last_read, excluded.last_read), seen = excluded.seen')
              .bind(code, me, myName, read, Date.now()).run();
          }
          const members = (await db.prepare('SELECT sender, name, last_read, seen FROM members WHERE room = ?').bind(code).all()).results;
          return json({ name: room.name, messages: rows, members });
        }

        // Send a message
        if (parts[2] === 'send' && req.method === 'POST') {
          const me = clean(body.me, 40), name = clean(body.name, 40) || 'Someone', text = clean(body.text, 2000);
          if (!me || !text) return json({ error: 'Empty message' }, 400);
          const recent = await db.prepare('SELECT COUNT(*) AS n FROM messages WHERE room = ? AND ts > ?').bind(code, Date.now() - 60000).first();
          if (recent && recent.n > 60) return json({ error: 'Slow down a little' }, 429);
          const ts = Date.now();
          const res = await db.prepare('INSERT INTO messages (room, sender, name, text, ts) VALUES (?, ?, ?, ?, ?)').bind(code, me, name, text, ts).run();
          const id = res.meta.last_row_id;
          await db.prepare('INSERT INTO members (room, sender, name, last_read, seen) VALUES (?, ?, ?, ?, ?) ON CONFLICT (room, sender) DO UPDATE SET name = excluded.name, last_read = MAX(members.last_read, excluded.last_read), seen = excluded.seen')
            .bind(code, me, name, id, ts).run();
          return json({ message: { id, sender: me, name, text, ts } });
        }

        // Rename the conversation (anyone in it)
        if (parts[2] === 'rename' && req.method === 'POST') {
          const name = clean(body.name, 60);
          if (!name) return json({ error: 'Empty name' }, 400);
          await db.prepare('UPDATE rooms SET name = ? WHERE code = ?').bind(name, code).run();
          return json({ name });
        }
      }
      return json({ error: 'Not found' }, 404);
    } catch (e) {
      return json({ error: 'Server error', detail: String(e && e.message || e) }, 500);
    }
  },
};
