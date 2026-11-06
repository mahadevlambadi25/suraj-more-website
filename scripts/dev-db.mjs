// DEV/TEST ONLY: runs a disposable local PostgreSQL (real Postgres binaries via `embedded-postgres`)
// on port 5433 with data in ./.pgdata. Production uses managed Postgres (e.g. Neon) — never this.
//
//   npm run db:local        → starts Postgres, creates `suraj_dev` and `suraj_test`, keeps running
//
// Connection strings:
//   postgresql://postgres:postgres@localhost:5433/suraj_dev
//   postgresql://postgres:postgres@localhost:5433/suraj_test
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';
import path from 'node:path';

const databaseDir = path.resolve('.pgdata');
const pg = new EmbeddedPostgres({
  databaseDir,
  user: 'postgres',
  password: 'postgres',
  port: 5433,
  persistent: true,
  // Force UTF-8: on Windows initdb otherwise defaults to WIN1252, which cannot store ₹ or → (Neon is UTF-8 too).
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
});

if (!existsSync(path.join(databaseDir, 'PG_VERSION'))) {
  console.log('Initialising local Postgres cluster in .pgdata …');
  await pg.initialise();
}
await pg.start();

for (const db of ['suraj_dev', 'suraj_test']) {
  try {
    await pg.createDatabase(db);
    console.log(`created database ${db}`);
  } catch {
    console.log(`database ${db} already exists`);
  }
}
console.log('Local Postgres ready on postgresql://postgres:postgres@localhost:5433 (Ctrl+C to stop)');

const stop = async () => {
  await pg.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
setInterval(() => {}, 1 << 30);
