const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    console.log('--- DATABASE URL CHECK ---');
    console.log('ENV DATABASE_URL:', process.env.DATABASE_URL);

    try {
        const dbInfo = await prisma.$queryRaw`SELECT current_database(), current_user, inet_server_addr(), inet_server_port()`;
        console.log('Postgres Info:', JSON.stringify(dbInfo, null, 2));

        const tables = await prisma.$queryRaw`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
        console.log('\nTables found:', tables.map(t => t.table_name).join(', '));

        console.log('\n--- COLUMN CHECK ---');
        const columns = await prisma.$queryRaw`
      SELECT table_name, column_name 
      FROM information_schema.columns 
      WHERE table_name IN ('CompanyProfile', 'companyprofile', 'company_profile')
      AND table_schema = 'public'
    `;
        console.log('Columns found:', JSON.stringify(columns, null, 2));

        console.log('\n--- PRISMA QUERY TEST ---');
        const company = await prisma.companyProfile.findFirst();
        console.log('Prisma Query Result:', !!company);
    } catch (err) {
        console.error('\n!!! ERROR !!!');
        console.error('Code:', err.code);
        console.error('Message:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}

check();
