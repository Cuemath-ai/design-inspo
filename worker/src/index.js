// Inspo Worker — runs 24/7 on Cloudflare, independent of any Mac.
//
// Two jobs:
//  1. fetch()     — Slack pings this the moment someone posts. If a post looks
//                   like an inspiration (link or file) but has no description,
//                   the Inspo bot nudges in-thread within a second.
//  2. scheduled() — Monday 5 PM IST safety-net for the weekly digest. The Mac
//                   sweep normally posts it earlier (10 AM–5 PM, freshly written).
//                   Whoever posts first drops a 🧲; the other sees it and skips,
//                   so the digest goes out exactly once.

const SLACK = 'https://slack.com/api';

async function slack(method, token, body) {
  const r = await fetch(`${SLACK}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json; charset=utf-8', authorization: `Bearer ${token}` },
    body: JSON.stringify(body)
  });
  return r.json();
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    // CORS so the gallery (a different origin) can call these like endpoints.
    const cors = {
      'access-control-allow-origin': 'https://cuemath-ai.github.io',
      'access-control-allow-methods': 'GET, POST, OPTIONS',
      'access-control-allow-headers': 'content-type'
    };
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors });

    // GET /loves → { entryId: galleryLikeCount } for the whole library.
    if (url.pathname === '/loves' && req.method === 'GET') {
      const counts = JSON.parse((await env.LOVES.get('counts')) || '{}');
      return Response.json(counts, { headers: cors });
    }
    // POST /love {id, delta:+1|-1} → toggle one gallery like, returns new count.
    if (url.pathname === '/love' && req.method === 'POST') {
      const { id, delta } = await req.json().catch(() => ({}));
      if (!id || (delta !== 1 && delta !== -1)) {
        return new Response('bad request', { status: 400, headers: cors });
      }
      const counts = JSON.parse((await env.LOVES.get('counts')) || '{}');
      counts[id] = Math.max(0, (counts[id] || 0) + delta);
      await env.LOVES.put('counts', JSON.stringify(counts));
      return Response.json({ id, count: counts[id] }, { headers: cors });
    }

    if (req.method !== 'POST') return new Response('Inspo worker');

    const body = await req.text();
    let payload;
    try { payload = JSON.parse(body); } catch { return new Response('bad request', { status: 400 }); }

    if (payload.type === 'url_verification') {
      return new Response(payload.challenge, { headers: { 'content-type': 'text/plain' } });
    }

    const ts = req.headers.get('x-slack-request-timestamp');
    const sig = req.headers.get('x-slack-signature');
    if (!(await verifySlack(env.SLACK_SIGNING_SECRET, ts, body, sig))) {
      return new Response('bad signature', { status: 401 });
    }

    if (payload.type === 'event_callback') {
      const e = payload.event;
      const isPlainTopLevelMessage =
        e && e.type === 'message' && !e.subtype && !e.bot_id && !e.thread_ts;

      if (isPlainTopLevelMessage && e.channel === env.INSPO_CHANNEL) {
        const hasFile = Array.isArray(e.files) && e.files.length > 0;
        const text = e.text || '';
        const hasLink = /https?:\/\/\S+/i.test(text);
        const descWithoutLink = text.replace(/<?https?:\/\/\S+>?/gi, '').trim();

        if ((hasFile || hasLink) && descWithoutLink.length < 3) {
          await slack('chat.postMessage', env.SLACK_BOT_TOKEN, {
            channel: e.channel,
            thread_ts: e.ts,
            text: "Ooh, nice find! 🐼 But I can't add it to the gallery yet — tell me what caught your eye. Drop one line in this thread and it's in. ✨"
          });
        }
      }
    }

    return new Response('ok');
  },

  // Cron-triggered (Monday 11:30 UTC = 5 PM IST). Safety-net digest.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(postDigestIfNeeded(env));
  }
};

async function postDigestIfNeeded(env) {
  const token = env.SLACK_BOT_TOKEN;
  const channel = env.INSPO_CHANNEL;
  const link = 'https://cuemath-ai.github.io/design-inspo/';

  // 1. Did the Mac sweep already post this week's digest? Look for a 🧲 from the
  //    bot in roughly the last 10 hours (covers the 10 AM–5 PM Monday window).
  const oldest = (Math.floor(Date.now() / 1000) - 10 * 3600).toString();
  // conversations.history needs form-encoding, not JSON:
  const histRes = await fetch(`${SLACK}/conversations.history`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', authorization: `Bearer ${token}` },
    body: new URLSearchParams({ channel, oldest, limit: '50' })
  }).then(r => r.json());
  const alreadyPosted = (histRes.messages || []).some(m => (m.text || '').includes('🧲'));
  if (alreadyPosted) return;

  // 2. Count this week's additions from the public gallery data.
  let entries = [];
  try {
    entries = await fetch(`${link}index.json`, { cf: { cacheTtl: 0 } }).then(r => r.json());
  } catch { /* if the gallery is unreachable, fall through with 0 */ }

  const weekAgo = Date.now() - 7 * 864e5;
  const recent = entries.filter(e => {
    const t = Date.parse(`${e.date}T00:00:00Z`);
    return !Number.isNaN(t) && t >= weekAgo;
  });
  const n = recent.length;
  const top = recent.slice().sort((a, b) => (b.loves ?? 0) - (a.loves ?? 0))[0];

  // 3. Post the template digest (with 🧲 so the Mac sweep won't double up).
  await slack('chat.postMessage', token, { channel, text: digestText(n, top?.title, link) });
}

function digestText(n, topTitle, link) {
  const weekIdx = Math.floor(Date.now() / (7 * 864e5));
  if (n === 0) {
    const quiet = [
      `🧲 Quiet week on the board, team 🐼 But even one dumpling starts a feast — drop something that inspired you → ${link}`,
      `🧲 No new finds this week... a panda gets lonely 🐼 What caught your eye lately? Add it → ${link}`
    ];
    return quiet[weekIdx % quiet.length];
  }
  const word = n === 1 ? 'inspiration' : 'inspirations';
  const topPart = topTitle ? `The crew loved *${topTitle}* most. ` : '';
  const active = [
    `🧲 Skadoosh! ${n} new ${word} hit the board this week. ${topPart}What'll you add? There is no charge for awesomeness 🐼 → ${link}`,
    `🧲 Whoaa — ${n} fresh ${word} this week! A full plate of dumplings for the eyes 🥟 ${topPart}Drop yours, team → ${link}`,
    `🧲 ${n} new ${word} landed this week. ${topPart}The board's hungry for more — feed it 🐼 → ${link}`,
    `🧲 Inner peace... and ${n} new ${word} this week 🐼 ${topPart}Keep 'em coming → ${link}`,
    `🧲 Kapow! ${n} new ${word} this week. ${topPart}Your turn to drop a beauty → ${link}`
  ];
  return active[weekIdx % active.length];
}

async function verifySlack(secret, ts, body, sig) {
  if (!secret || !ts || !sig) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(`v0:${ts}:${body}`));
  const hex = [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, '0')).join('');
  const expected = `v0=${hex}`;

  if (expected.length !== sig.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}
