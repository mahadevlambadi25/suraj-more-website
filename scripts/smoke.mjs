// Post-deploy smoke test. Read-only: never creates orders or leads.
//   BASE_URL=https://your-preview.vercel.app npm run smoke
//   SESSION_COOKIE="sm_admin=<token>"   (optional) also checks authenticated dashboard pages
const base = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const cookie = process.env.SESSION_COOKIE;
let failures = 0;

async function check(name, path, expect, init = {}) {
  try {
    const res = await fetch(base + path, { redirect: 'manual', ...init });
    const body = expect.body ? await res.text() : '';
    const okStatus = Array.isArray(expect.status) ? expect.status.includes(res.status) : res.status === expect.status;
    const okLoc = !expect.location || (res.headers.get('location') ?? '').includes(expect.location);
    const okBody = !expect.body || expect.body.test(body);
    const ok = okStatus && okLoc && okBody;
    if (!ok) failures++;
    console.log(`${ok ? '✓' : '✗'} ${name.padEnd(42)} ${res.status}${res.headers.get('location') ? ` → ${res.headers.get('location')}` : ''}`);
  } catch (err) {
    failures++;
    console.log(`✗ ${name.padEnd(42)} ${err.message}`);
  }
}

const pages = ['/', '/about', '/programs', '/workshop', '/level-zero', '/mentorship', '/free-training', '/results', '/insights', '/contact', '/privacy-policy', '/terms-and-conditions', '/refund-policy', '/sitemap.xml', '/robots.txt'];
for (const p of pages) await check(`GET ${p}`, p, { status: 200 });
await check('GET unknown page → 404', '/definitely-not-a-page', { status: 404 });
await check('Health check', '/api/health', { status: 200, body: /"status":"ok"/ });
await check('Webhook endpoint reachable, rejects unsigned', '/api/webhooks/cashfree', { status: 401 }, { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } });
await check('Gated training page redirects', '/free-training/watch', { status: [307, 308], location: '/free-training' });
await check('/ops without session → login', '/ops', { status: [307, 308], location: '/ops/login' });
await check('/ops/orders without session → login', '/ops/orders', { status: [307, 308], location: '/ops/login' });
await check('Ops login page', '/ops/login', { status: 200, body: /Sign in/ });
await check('CSV export without session', '/ops/leads/export', { status: [307, 308, 401] });
await check('Security headers present', '/', { status: 200 });
const h = await fetch(base + '/');
for (const header of ['content-security-policy', 'strict-transport-security', 'x-frame-options', 'x-content-type-options']) {
  const ok = h.headers.has(header);
  if (!ok) failures++;
  console.log(`${ok ? '✓' : '✗'} header ${header}`);
}

if (cookie) {
  for (const p of ['/ops', '/ops/leads', '/ops/workshops', '/ops/orders', '/ops/webhooks', '/ops/refunds', '/ops/applications', '/ops/settings']) {
    await check(`(auth) GET ${p}`, p, { status: 200 }, { headers: { cookie } });
  }
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll smoke checks passed');
process.exit(failures ? 1 : 0);
