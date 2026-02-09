const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    try {
        const dbs = await prisma.$queryRaw`SELECT datname FROM pg_database WHERE datistemplate = false`;
        console.log('Databases:', dbs.map(d => d.datname));
    } catch (err) {
        console.error(err);
    } finally {
        await prisma.$disconnect();
    }
}

check();
