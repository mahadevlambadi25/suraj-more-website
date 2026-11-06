import { execSync } from 'node:child_process';

/** Applies all migrations to the TEST database once per run. Refuses to touch anything not named *test*. */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5433/suraj_test';
  const dbName = new URL(url).pathname.slice(1);
  if (!/test/i.test(dbName)) throw new Error(`Refusing to run tests against database "${dbName}" (name must contain "test")`);
  execSync('npx prisma migrate deploy', { stdio: 'pipe', env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url } });
}
