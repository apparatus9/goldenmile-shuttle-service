/* Shuttle request endpoint — receives the form POST from the embed on
 * goldenmilechrysler.ca and emails the service team via Resend.
 *
 * Why this exists: the embed's fallback is a mailto: link, which depends on the
 * visitor having a working mail client. When they don't, the click does nothing
 * at all — no error, no draft, no lead. This endpoint removes that dependency.
 *
 * Env vars (set in Vercel, never in this file):
 *   RESEND_API_KEY   required — https://resend.com/api-keys
 *   SHUTTLE_TO       comma-separated recipients. Falls back to TO_FALLBACK.
 *   SHUTTLE_FROM     verified Resend sender. Defaults to onboarding@resend.dev
 *   SHUTTLE_CC       optional, comma-separated
 *   ALLOW_ORIGINS    optional, comma-separated extra origins to allow
 */

const TO_FALLBACK = [
  'sanshia@goldenmilechrysler.ca',
  'dhaanush@goldenmilechrysler.ca',
];

const ALLOWED_ORIGINS = [
  'https://www.goldenmilechrysler.ca',
  'https://goldenmilechrysler.ca',
];

/* Fields we accept, with the label used in the email and a length cap.
   Anything not listed here is dropped — including the client's `_to`. */
const FIELDS = [
  ['first', 'First name', 80],
  ['last', 'Last name', 80],
  ['phone', 'Phone', 40],
  ['email', 'Email', 160],
  ['date', 'Appointment date', 40],
  ['time', 'Appointment time', 40],
  ['trip', 'Trip type', 60],
  ['dest', 'Destination', 200],
  ['notes', 'Notes', 2000],
];

const REQUIRED = ['first', 'last', 'phone', 'date', 'time'];

/* ---------- helpers ---------- */

const esc = s => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const list = v => String(v || '').split(',').map(s => s.trim()).filter(Boolean);

/* Strip CR/LF so a field can never inject extra headers, and clamp length. */
const clean = (v, cap) => String(v == null ? '' : v)
  .replace(/[\r\n]+/g, ' ').trim().slice(0, cap);

function originFor(req) {
  const origin = req.headers.origin || '';
  const extra = list(process.env.ALLOW_ORIGINS);
  if (ALLOWED_ORIGINS.includes(origin) || extra.includes(origin)) return origin;
  return null;
}

function cors(req, res) {
  const ok = originFor(req);
  if (ok) {
    res.setHeader('Access-Control-Allow-Origin', ok);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

/* Vercel parses JSON and urlencoded bodies for us. multipart/form-data it does
   not, so handle that by hand — the embed used to send FormData and an older
   cached copy of the page may still be doing so. */
function parseMultipart(raw, contentType) {
  const m = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || '');
  if (!m) return {};
  const boundary = '--' + (m[1] || m[2]).trim();
  const out = {};
  for (const part of raw.split(boundary)) {
    const i = part.indexOf('\r\n\r\n');
    if (i === -1) continue;
    const name = /name="([^"]*)"/i.exec(part.slice(0, i));
    if (name) out[name[1]] = part.slice(i + 4).replace(/\r\n$/, '');
  }
  return out;
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;

  let raw = req.body;
  if (raw == null || Buffer.isBuffer(raw)) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    raw = Buffer.concat(chunks).toString('utf8');
  }
  raw = String(raw);

  const ct = req.headers['content-type'] || '';
  if (ct.includes('multipart/form-data')) return parseMultipart(raw, ct);
  if (ct.includes('application/json')) { try { return JSON.parse(raw); } catch { return {}; } }
  return Object.fromEntries(new URLSearchParams(raw));
}

/* ---------- handler ---------- */

export default async function handler(req, res) {
  cors(req, res);

  if (req.method === 'OPTIONS') return res.status(204).end();

  /* Health check — reports whether config is present, never its values. */
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      endpoint: 'shuttle-request',
      resendKey: process.env.RESEND_API_KEY ? 'set' : 'MISSING',
      recipients: (list(process.env.SHUTTLE_TO).length ? list(process.env.SHUTTLE_TO) : TO_FALLBACK).length,
      from: process.env.SHUTTLE_FROM || 'onboarding@resend.dev',
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS, GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  let body;
  try { body = await readBody(req); }
  catch { return res.status(400).json({ ok: false, error: 'Could not read the submission.' }); }

  /* Honeypot: real people leave these empty. Answer 200 so a bot learns nothing. */
  if (clean(body._gotcha, 50) || clean(body.website, 50)) {
    return res.status(200).json({ ok: true });
  }

  const data = {};
  for (const [name, , cap] of FIELDS) data[name] = clean(body[name], cap);

  const missing = REQUIRED.filter(n => !data[n]);
  if (missing.length) {
    return res.status(400).json({ ok: false, error: 'Please fill out all required fields.', missing });
  }

  /* Checked after validation so a misconfigured server still rejects junk. */
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY is not set');
    return res.status(500).json({ ok: false, error: 'Email is not configured on the server.' });
  }

  const to = list(process.env.SHUTTLE_TO).length ? list(process.env.SHUTTLE_TO) : TO_FALLBACK;
  const cc = list(process.env.SHUTTLE_CC);
  const from = process.env.SHUTTLE_FROM || 'onboarding@resend.dev';

  const name = `${data.first} ${data.last}`.trim();
  const subject = `Shuttle request - ${name} - ${data.date}`;

  const rows = FIELDS
    .filter(([n]) => data[n])
    .map(([n, label]) =>
      `<tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600;width:170px;vertical-align:top">${label}</td>` +
      `<td style="padding:8px 12px;vertical-align:top">${esc(data[n])}</td></tr>`)
    .join('');

  const html =
    `<div style="font-family:Inter,Arial,sans-serif;max-width:640px;margin:0 auto;color:#0f172a">` +
    `<div style="background:#0c0c0e;color:#fff;padding:20px 24px;border-radius:10px 10px 0 0;border-bottom:3px solid #c8a24a">` +
    `<h2 style="margin:0;font-size:20px">New shuttle request</h2>` +
    `<p style="margin:6px 0 0;color:#c8a24a;font-size:13px">Submitted from the shuttle service page on goldenmilechrysler.ca</p>` +
    `</div>` +
    `<table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-top:0;font-size:14px">${rows}</table>` +
    `<p style="font-size:12px;color:#64748b;padding:14px 4px 0">` +
    (data.phone ? `Call the customer back at <strong>${esc(data.phone)}</strong>.` : '') +
    `</p></div>`;

  const text = ['New shuttle request', '']
    .concat(FIELDS.filter(([n]) => data[n]).map(([n, label]) => `${label}: ${data[n]}`))
    .join('\n');

  const payload = { from: `Shuttle Requests <${from}>`, to, subject, html, text };
  if (cc.length) payload.cc = cc;
  /* Only trust an email address that looks like one, and only for reply-to. */
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) payload.reply_to = data.email;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const out = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error('Resend rejected the send:', r.status, out);
      return res.status(502).json({
        ok: false,
        error: out.message || `Email provider returned ${r.status}.`,
      });
    }
    console.log('Shuttle request sent', { id: out.id, to: to.length });
    return res.status(200).json({ ok: true, id: out.id });
  } catch (err) {
    console.error('Send threw:', err);
    return res.status(502).json({ ok: false, error: 'Could not send the request.' });
  }
}
