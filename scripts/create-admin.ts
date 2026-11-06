// Creates (or resets the password of) an admin account. Credentials come from environment variables
// so they never land in shell history files or Git:
//
//   ADMIN_EMAIL=you@domain.com ADMIN_NAME="Your Name" ADMIN_PASSWORD='long-unique-password' npm run admin:create
//   ADMIN_ROLE=OWNER|ADMIN|VIEWER   (default OWNER)
//   --reset   reset the password of an existing admin (also revokes all their sessions)
import { PrismaClient, type AdminRole } from '@prisma/client';
import { hashPassword, passwordProblems } from '../src/lib/auth/password';

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  const name = (process.env.ADMIN_NAME ?? '').trim() || email.split('@')[0];
  const password = process.env.ADMIN_PASSWORD ?? '';
  const role = (process.env.ADMIN_ROLE ?? 'OWNER').toUpperCase() as AdminRole;
  const reset = process.argv.includes('--reset');

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Set ADMIN_EMAIL to a valid email address.');
  if (!['OWNER', 'ADMIN', 'VIEWER'].includes(role)) throw new Error('ADMIN_ROLE must be OWNER, ADMIN or VIEWER.');
  const problem = passwordProblems(password);
  if (problem) throw new Error(`ADMIN_PASSWORD rejected: ${problem}`);

  const existing = await prisma.admin.findUnique({ where: { email } });
  const passwordHash = await hashPassword(password);

  if (existing && !reset) throw new Error(`Admin ${email} already exists. Use --reset to change the password.`);
  if (existing) {
    await prisma.$transaction([
      prisma.admin.update({ where: { id: existing.id }, data: { passwordHash, isActive: true } }),
      prisma.adminSession.deleteMany({ where: { adminId: existing.id } }),
      prisma.auditLog.create({ data: { action: 'admin.password_reset_cli', entityType: 'admin', entityId: existing.id } }),
    ]);
    console.log(`Password reset for ${email}; existing sessions revoked.`);
  } else {
    const admin = await prisma.admin.create({ data: { email, name, passwordHash, role } });
    await prisma.auditLog.create({ data: { action: 'admin.create_cli', entityType: 'admin', entityId: admin.id, metadata: { role } } });
    console.log(`Admin created: ${email} (${role}). Sign in at /ops/login`);
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
