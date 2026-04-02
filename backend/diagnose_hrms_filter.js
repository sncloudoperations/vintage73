// Uses the app's own prisma instance (already generated)
const prisma = require('./config/prisma');

async function diagnose() {
    console.log('=== HRMS BRANCH FILTER DIAGNOSIS ===\n');

    // 1. Show all admin/non-staff users and their branchIds
    const admins = await prisma.user.findMany({
        where: { role: { not: 'staff' } },
        select: { id: true, name: true, username: true, role: true, branchId: true }
    });
    console.log('--- ALL NON-STAFF USERS ---');
    admins.forEach(u => {
        console.log(`  id=${u.id} | role="${u.role}" | branchId=${u.branchId} | name="${u.name}"`);
    });

    // 2. Show all staff users and their branchIds
    const staff = await prisma.user.findMany({
        where: { role: 'staff' },
        select: { id: true, name: true, username: true, role: true, branchId: true }
    });
    console.log('\n--- ALL STAFF USERS ---');
    staff.forEach(u => {
        console.log(`  id=${u.id} | role="${u.role}" | branchId=${u.branchId} | name="${u.name}"`);
    });

    // 3. Show Miss Punch records with user branchIds
    const missPunches = await prisma.missPunchRequest.findMany({
        include: { user: { select: { id: true, name: true, branchId: true } } },
        take: 20,
        orderBy: { createdAt: 'desc' }
    });
    console.log('\n--- RECENT MISS PUNCH REQUESTS (last 20) ---');
    missPunches.forEach(mp => {
        console.log(`  id=${mp.id} | record.branchId=${mp.branchId} | user.id=${mp.userId} | user.name="${mp.user?.name}" | user.branchId=${mp.user?.branchId}`);
    });

    // 4. Show WorkLog records with user branchIds
    const workLogs = await prisma.workLog.findMany({
        include: { user: { select: { id: true, name: true, branchId: true } } },
        take: 20,
        orderBy: { createdAt: 'desc' }
    });
    console.log('\n--- RECENT WORK LOGS (last 20) ---');
    workLogs.forEach(wl => {
        console.log(`  id=${wl.id} | record.branchId=${wl.branchId} | user.id=${wl.userId} | user.name="${wl.user?.name}" | user.branchId=${wl.user?.branchId}`);
    });

    // 5. Simulate filter per admin
    console.log('\n--- SIMULATED FILTER PER ADMIN ---');
    for (const admin of admins) {
        if (admin.branchId) {
            const mpCount = await prisma.missPunchRequest.count({
                where: { user: { branchId: admin.branchId } }
            });
            const wlCount = await prisma.workLog.count({
                where: { user: { branchId: admin.branchId } }
            });
            console.log(`  "${admin.name}" (role="${admin.role}", branchId=${admin.branchId}) -> MissPunch: ${mpCount} | WorkLog: ${wlCount}`);
        } else {
            const mpTotal = await prisma.missPunchRequest.count();
            const wlTotal = await prisma.workLog.count();
            console.log(`  "${admin.name}" (role="${admin.role}", branchId=NULL) -> ⚠️ SEES ALL: MissPunch: ${mpTotal} | WorkLog: ${wlTotal}`);
        }
    }

    console.log('\n=== END ===');
}

diagnose().catch(e => { console.error(e); process.exit(1); });
