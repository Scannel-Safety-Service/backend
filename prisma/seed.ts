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

  console.log('Seed: Cleaning database...');
  await prisma.impersonationLog.deleteMany({});
  await prisma.refreshToken.deleteMany({});
  await prisma.passwordResetToken.deleteMany({});
  await prisma.invitationToken.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.company.deleteMany({});
  console.log('Seed: Database clean complete.');

  // 1. Create Companies
  const companiesData = [
    { name: 'Acme Corporation', isActive: true },
    { name: 'Globex Corporation', isActive: true },
    { name: 'Initech', isActive: true },
    { name: 'Umbrella Corporation', isActive: true },
    { name: 'Hooli', isActive: true },
  ];

  const companies: { [key: string]: string } = {};

  for (const c of companiesData) {
    const created = await prisma.company.create({
      data: c,
    });
    companies[c.name] = created.id;
    console.log(`Seed: Created Company ${created.name} (${created.id})`);
  }

  // 2. Define Users
  const usersData = [
    // Super Admins (no companyId)
    {
      email: 'superadmin@scannel.com',
      firstName: 'Super',
      lastName: 'Admin',
      role: Role.SUPER_ADMIN,
      isActive: true,
      companyName: null,
      userCode: null,
    },
    {
      email: 'system@scannel.com',
      firstName: 'System',
      lastName: 'Administrator',
      role: Role.SUPER_ADMIN,
      isActive: true,
      companyName: null,
      userCode: null,
    },
    // Acme Corporation
    {
      email: 'admin@acme.com',
      firstName: 'Alice',
      lastName: 'Smith',
      role: Role.COMPANY_ADMIN,
      isActive: true,
      companyName: 'Acme Corporation',
      userCode: 'ACM-ADM-01',
    },
    {
      email: 'user1@acme.com',
      firstName: 'Bob',
      lastName: 'Jones',
      role: Role.COMPANY_USER,
      isActive: true,
      companyName: 'Acme Corporation',
      userCode: 'ACM-USR-01',
    },
    {
      email: 'app1@acme.com',
      firstName: 'Charlie',
      lastName: 'Brown',
      role: Role.APP_USER,
      isActive: true,
      companyName: 'Acme Corporation',
      userCode: 'ACM-APP-01',
    },
    {
      email: 'app2@acme.com',
      firstName: 'Diana',
      lastName: 'Prince',
      role: Role.APP_USER,
      isActive: true,
      companyName: 'Acme Corporation',
      userCode: 'ACM-APP-02',
    },
    // Globex Corporation
    {
      email: 'admin@globex.com',
      firstName: 'Hank',
      lastName: 'Scorpio',
      role: Role.COMPANY_ADMIN,
      isActive: true,
      companyName: 'Globex Corporation',
      userCode: 'GBX-ADM-01',
    },
    {
      email: 'user1@globex.com',
      firstName: 'Homer',
      lastName: 'Simpson',
      role: Role.COMPANY_USER,
      isActive: true,
      companyName: 'Globex Corporation',
      userCode: 'GBX-USR-01',
    },
    {
      email: 'app1@globex.com',
      firstName: 'Marge',
      lastName: 'Simpson',
      role: Role.APP_USER,
      isActive: true,
      companyName: 'Globex Corporation',
      userCode: 'GBX-APP-01',
    },
    // Initech
    {
      email: 'admin@initech.com',
      firstName: 'Bill',
      lastName: 'Lumbergh',
      role: Role.COMPANY_ADMIN,
      isActive: true,
      companyName: 'Initech',
      userCode: 'INI-ADM-01',
    },
    {
      email: 'app1@initech.com',
      firstName: 'Peter',
      lastName: 'Gibbons',
      role: Role.APP_USER,
      isActive: true,
      companyName: 'Initech',
      userCode: 'INI-APP-01',
    },
    // Umbrella Corporation
    {
      email: 'admin@umbrella.com',
      firstName: 'Albert',
      lastName: 'Wesker',
      role: Role.COMPANY_ADMIN,
      isActive: true,
      companyName: 'Umbrella Corporation',
      userCode: 'UMB-ADM-01',
    },
    {
      email: 'app1@umbrella.com',
      firstName: 'Alice',
      lastName: 'Abernathy',
      role: Role.APP_USER,
      isActive: true,
      companyName: 'Umbrella Corporation',
      userCode: 'UMB-APP-01',
    },
    // Hooli
    {
      email: 'admin@hooli.com',
      firstName: 'Gavin',
      lastName: 'Belson',
      role: Role.COMPANY_ADMIN,
      isActive: true,
      companyName: 'Hooli',
      userCode: 'HOL-ADM-01',
    },
    {
      email: 'app1@hooli.com',
      firstName: 'Richard',
      lastName: 'Hendricks',
      role: Role.APP_USER,
      isActive: true,
      companyName: 'Hooli',
      userCode: 'HOL-APP-01',
    },
  ];

  for (const u of usersData) {
    const companyId = u.companyName ? companies[u.companyName] : null;
    const user = await prisma.user.create({
      data: {
        email: u.email,
        firstName: u.firstName,
        lastName: u.lastName,
        passwordHash,
        role: u.role,
        isActive: u.isActive,
        companyId,
        userCode: u.userCode,
      },
    });
    console.log(`Seed: Created user ${user.email} (${user.role})`);
  }

  console.log('Seed: Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

