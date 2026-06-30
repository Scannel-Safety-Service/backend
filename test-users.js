const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.user.count();
  console.log(`Total users in DB: ${count}`);
  
  const users = await prisma.user.findMany({ select: { id: true, email: true, role: true } });
  console.log('Users:', users);
}

main().catch(console.error).finally(() => prisma.$disconnect());
