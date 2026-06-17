import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';
import { Pool } from 'pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg(new Pool({ connectionString: process.env.DATABASE_URL })),
});

async function main() {
  const passwordHash = await bcrypt.hash('password123', 12);

  // 1. Create Super Admin (no companyId)
  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@scannel.com' },
    update: {},
    create: {
      email: 'superadmin@scannel.com',
      firstName: 'Super',
      lastName: 'Admin',
      passwordHash,
      role: Role.SUPER_ADMIN,
      isActive: true,
    },
  });
  console.log('Seed: Created Super Admin user:', superAdmin.email);

  // 2. Create Company A
  const companyA = await prisma.company.create({
    data: {
      name: 'Company A',
      isActive: true,
    },
  });
  console.log('Seed: Created Company A:', companyA.name);

  // 3. Create Company Admin for Company A
  const companyAdmin = await prisma.user.upsert({
    where: { email: 'admin@company-a.com' },
    update: {},
    create: {
      email: 'admin@company-a.com',
      firstName: 'Company',
      lastName: 'Admin',
      passwordHash,
      role: Role.COMPANY_ADMIN,
      isActive: true,
      companyId: companyA.id,
      userCode: 'ADM-001',
    },
  });
  console.log('Seed: Created Company A Admin:', companyAdmin.email);

  // 4. Create App User for Company A
  const appUser = await prisma.user.upsert({
    where: { email: 'user@company-a.com' },
    update: {},
    create: {
      email: 'user@company-a.com',
      firstName: 'App',
      lastName: 'User',
      passwordHash,
      role: Role.APP_USER,
      isActive: true,
      companyId: companyA.id,
      userCode: 'USR-001',
    },
  });
  console.log('Seed: Created Company A App User:', appUser.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
