// Runs before `next build` on Vercel. Fails the deploy early on dangerous or missing configuration.
// Prints variable NAMES only — never values.
const env = process.env;
const isVercel = !!env.VERCEL;
const target = env.VERCEL_ENV ?? 'local'; // production | preview | development
const errors = [];
const warnings = [];

for (const k of ['DATABASE_URL', 'DIRECT_URL']) if (!env[k]) errors.push(`${k} is not set`);
if (env.DATABASE_URL && /localhost|127\.0\.0\.1/.test(env.DATABASE_URL) && isVercel) errors.push('DATABASE_URL points to localhost');

const mode = env.CASHFREE_MODE ?? 'mock';
if (!['mock', 'sandbox', 'production'].includes(mode)) errors.push(`CASHFREE_MODE must be mock | sandbox | production`);
if (isVercel && mode === 'mock') errors.push('CASHFREE_MODE=mock cannot be deployed — use sandbox (test payments) or production');
if (mode !== 'mock' && (!env.CASHFREE_APP_ID || !env.CASHFREE_SECRET_KEY)) errors.push('CASHFREE_APP_ID and CASHFREE_SECRET_KEY are required for sandbox/production');
if (mode === 'production' && env.CASHFREE_ALLOW_PRODUCTION !== 'true') errors.push('Live payments are locked: set CASHFREE_ALLOW_PRODUCTION=true only at launch sign-off');
if (mode === 'production' && target !== 'production') errors.push('Live Cashfree credentials must only be used in the Production environment');
if (!env.NEXT_PUBLIC_SITE_URL?.startsWith('https://') && isVercel) errors.push('NEXT_PUBLIC_SITE_URL must be the public https:// URL (used for Cashfree return/notify URLs)');
if (!env.HASH_SALT) warnings.push('HASH_SALT not set (a default is used for IP hashing)');
for (const k of ['EMAIL_WEBHOOK_URL', 'WHATSAPP_WEBHOOK_URL', 'CRM_WEBHOOK_URL', 'OPS_ALERT_WEBHOOK_URL']) {
  if (!env[k] && !(k.includes('EMAIL') || k.includes('WHATSAPP') ? env.NOTIFY_WEBHOOK_URL : '')) warnings.push(`${k} not set — those messages will be recorded as NOT_CONFIGURED`);
}

for (const w of warnings) console.warn(`⚠ ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`✗ ${e}`);
  process.exit(1);
}
console.log(`✓ Environment OK for ${target} (payments: ${mode})`);
