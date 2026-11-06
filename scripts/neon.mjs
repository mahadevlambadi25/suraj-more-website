// Guarded runner for operations against the Neon (production) database.
//
//   npm run neon -- migrate status [--ipv4]
//   npm run neon -- migrate deploy [--ipv4]
//   npm run neon -- migrate diff   [--ipv4]     (schema drift check, read-only)
//   npm run neon -- verify         [--ipv4]     (read-only structure + record counts)
//
// Safety:
//  • Credentials come ONLY from .env.neon (git-ignored). Normal development (.env) is never touched,
//    and .env.neon is never loaded by Next.js or the Prisma CLI on their own.
//  • Refuses non-Neon hosts and any Prisma command outside the allowlist (no reset, db push, migrate dev, seed…).
//  • Credentials and endpoint ids are scrubbed from all output.
//  • --ipv4: temporary workaround for networks where IPv6 to Neon is unreachable (Prisma's engine does not
//    fall back to IPv4). Applied in memory for this process only: the IPv4 address is used as host and
//    Neon's documented `options=endpoint=<id>` parameter routes the connection. Nothing is persisted.
import { spawnSync } from 'node:child_process';
import { promises as dns } from 'node:dns';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const ipv4 = args.includes('--ipv4');
const cmd = args.filter((a) => a !== '--ipv4');

const ALLOWED = [['migrate', 'status'], ['migrate', 'deploy'], ['migrate', 'diff'], ['verify']];
if (!ALLOWED.some((a) => a.every((w, i) => cmd[i] === w)) || (cmd[0] === 'migrate' && cmd.length !== 2)) {
  console.error(`Refused: "${cmd.join(' ')}". Allowed: ${ALLOWED.map((a) => a.join(' ')).join(' | ')} (optionally with --ipv4).`);
  process.exit(2);
}

const file = path.join(root, '.env.neon');
if (!existsSync(file)) {
  console.error('Missing .env.neon (see .env.neon.example).');
  process.exit(2);
}
const env = Object.fromEntries(
  readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .map((l) => /^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/.exec(l))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim().replace(/^['"]|['"]$/g, '')]),
);
for (const k of ['DATABASE_URL', 'DIRECT_URL']) {
  let host;
  try {
    host = new URL(env[k]).hostname;
  } catch {
    console.error(`${k} in .env.neon is missing or invalid.`);
    process.exit(2);
  }
  if (!host.endsWith('.neon.tech')) {
    console.error(`Refused: ${k} in .env.neon is not a Neon host.`);
    process.exit(2);
  }
}

async function toIpv4(raw) {
  const u = new URL(raw);
  const endpoint = u.hostname.split('.')[0].replace(/-pooler$/, '');
  const [ip] = await dns.resolve4(u.hostname);
  u.hostname = ip;
  u.searchParams.set('options', `endpoint=${endpoint}`);
  if (!u.searchParams.has('connect_timeout')) u.searchParams.set('connect_timeout', '20');
  return u.toString();
}

const pooled = ipv4 ? await toIpv4(env.DATABASE_URL) : env.DATABASE_URL;
const direct = ipv4 ? await toIpv4(env.DIRECT_URL) : env.DIRECT_URL;
const secrets = [pooled, direct, env.DATABASE_URL, env.DIRECT_URL];
const scrub = (s) =>
  secrets
    .reduce((acc, x) => acc.split(x).join('[neon-url]'), String(s))
    .replace(/postgres(ql)?:\/\/[^\s'"`]+/g, '[neon-url]')
    .replace(/ep-[a-z]+-[a-z]+-[a-z0-9]+/g, 'ep-•••')
    .replace(/\b\d{1,3}(\.\d{1,3}){3}\b/g, 'x.x.x.x');

console.log(`→ Neon ${cmd.join(' ')}${ipv4 ? ' (temporary IPv4 routing)' : ''}`);

if (cmd[0] === 'verify') {
  const { PrismaClient } = await import('@prisma/client');
  const prisma = new PrismaClient({ datasourceUrl: direct, log: [] });
  try {
    const out = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
      const one = async (sql) => (await tx.$queryRawUnsafe(sql))[0];
      const tables = (await tx.$queryRawUnsafe(`SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename <> '_prisma_migrations' ORDER BY 1`)).map((r) => r.tablename);
      const counts = {};
      for (const t of tables) counts[t] = (await one(`SELECT count(*)::int AS n FROM "${t}"`)).n;
      return {
        server: await one(`SELECT split_part(version(),' ',2) AS postgres, current_setting('server_encoding') AS encoding, current_setting('transaction_read_only') AS read_only`),
        tables: tables.length,
        enums: (await one(`SELECT count(*)::int AS n FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typtype='e'`)).n,
        indexes: (await one(`SELECT count(*)::int AS n FROM pg_indexes WHERE schemaname='public' AND tablename <> '_prisma_migrations' AND indexname NOT LIKE '%_pkey'`)).n,
        primaryKeys: (await one(`SELECT count(*)::int AS n FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' AND c.contype='p' AND c.conrelid::regclass::text <> '_prisma_migrations'`)).n,
        foreignKeys: (await one(`SELECT count(*)::int AS n FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' AND c.contype='f'`)).n,
        migrations: await tx.$queryRawUnsafe(`SELECT migration_name, finished_at IS NOT NULL AS finished, rolled_back_at IS NOT NULL AS rolled_back FROM _prisma_migrations ORDER BY started_at`).catch(() => []),
        totalRecords: Object.values(counts).reduce((a, b) => a + b, 0),
        counts,
      };
    });
    console.log(scrub(JSON.stringify(out, null, 1)));
  } catch (e) {
    console.error(scrub(e.message).slice(0, 800));
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
} else {
  const prismaArgs = [...cmd];
  if (cmd[1] === 'diff') prismaArgs.push('--from-url', direct, '--to-schema-datamodel', 'prisma/schema.prisma', '--exit-code');
  // Explicit env vars take precedence over the .env file Prisma would otherwise load.
  const r = spawnSync(process.execPath, [path.join(root, 'node_modules/prisma/build/index.js'), ...prismaArgs], {
    cwd: root,
    env: { ...process.env, DATABASE_URL: pooled, DIRECT_URL: direct, PRISMA_HIDE_UPDATE_MESSAGE: '1' },
    encoding: 'utf8',
  });
  process.stdout.write(scrub(r.stdout ?? ''));
  process.stderr.write(scrub(r.stderr ?? ''));
  // `migrate diff --exit-code`: 0 = no difference, 2 = differences found.
  process.exitCode = r.status ?? 1;
}
