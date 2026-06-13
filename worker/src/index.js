// Inspo instant-nudge Worker — runs 24/7 on Cloudflare, independent of any Mac.
// Slack pings this the moment someone posts in #design-inspo. It does ONE simple,
// AI-free check: if the post looks like an inspiration (has a link or a file) but
// has no description, the Inspo bot replies in-thread within a second.
// All the smart work (tagging, screenshots, gallery, digest) stays in the hourly sweep.

export default {
  async fetch(req, env) {
    if (req.method !== 'POST') return new Response('Inspo nudge worker');

    const body = await req.text();
    let payload;
    try { payload = JSON.parse(body); } catch { return new Response('bad request', { status: 400 }); }

    // 1. One-time handshake when you paste the URL into Slack's Event Subscriptions.
    if (payload.type === 'url_verification') {
      return new Response(payload.challenge, { headers: { 'content-type': 'text/plain' } });
    }

    // 2. Verify the request genuinely came from Slack.
    const ts = req.headers.get('x-slack-request-timestamp');
    const sig = req.headers.get('x-slack-signature');
    if (!(await verifySlack(env.SLACK_SIGNING_SECRET, ts, body, sig))) {
      return new Response('bad signature', { status: 401 });
    }

    // 3. Handle a new message event.
    if (payload.type === 'event_callback') {
      const e = payload.event;
      const isPlainTopLevelMessage =
        e && e.type === 'message' &&
        !e.subtype &&        // skips joins, edits, bot messages, file-change notices, etc.
        !e.bot_id &&         // skips the Inspo bot's own messages
        !e.thread_ts;        // skips thread replies (those are descriptions/edits)

      if (isPlainTopLevelMessage && e.channel === env.INSPO_CHANNEL) {
        const hasFile = Array.isArray(e.files) && e.files.length > 0;
        const text = e.text || '';
        const hasLink = /https?:\/\/\S+/i.test(text);
        const descWithoutLink = text.replace(/<?https?:\/\/\S+>?/gi, '').trim();

        // An inspiration attempt = has a link or a file. Nudge only when the
        // description is essentially empty. Plain chatter (no link, no file) is
        // ignored, so we never nag normal conversation.
        if ((hasFile || hasLink) && descWithoutLink.length < 3) {
          await fetch('https://slack.com/api/chat.postMessage', {
            method: 'POST',
            headers: {
              'content-type': 'application/json; charset=utf-8',
              authorization: `Bearer ${env.SLACK_BOT_TOKEN}`
            },
            body: JSON.stringify({
              channel: e.channel,
              thread_ts: e.ts,
              text: "Ooh, nice find! 🐼 Quick one — what caught your eye? Drop a line here and it's in the gallery."
            })
          });
        }
      }
    }

    return new Response('ok');
  }
};

// HMAC-SHA256 signature check per Slack's spec, using the Workers Web Crypto API.
async function verifySlack(secret, ts, body, sig) {
  if (!secret || !ts || !sig) return false;
  // Replay protection: reject anything older than 5 minutes.
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
