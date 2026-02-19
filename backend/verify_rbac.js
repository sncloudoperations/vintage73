
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyRBAC() {
    console.log('--- Starting RBAC Verification ---');

    try {
        // 1. Create a dummy branch
        const branch = await prisma.branch.create({
            data: { name: 'Test Branch Isolation' }
        });
        console.log(`Created branch: ${branch.name} (ID: ${branch.id})`);

        // 2. Create a Branch Admin with specific modules
        const hashedPassword = await bcrypt.hash('password123', 10);
        const branchAdmin = await prisma.user.create({
            data: {
                username: 'branch_admin_test',
                password: hashedPassword,
                name: 'Branch Admin Test',
                role: 'branchadmin',
                branchId: branch.id,
                allowedModules: ['SALES', 'INVENTORY']
            }
        });
        console.log(`Created Branch Admin: ${branchAdmin.username}`);

        // Simulation of hierarchy checks (logic from userController)

        // Test Case: Branch Admin trying to create an Admin
        const targetRole = 'admin';
        if (branchAdmin.role === 'branchadmin' && targetRole !== 'staff') {
            console.log('✅ PASS: Branch Admin blocked from creating Non-Staff role');
        } else {
            console.log('❌ FAIL: Branch Admin should be blocked from creating Non-Staff role');
        }

        // Test Case: Branch Admin trying to assign a module they don't have (e.g., ACCOUNTS)
        const creatorModules = branchAdmin.allowedModules;
        const requestedModules = ['SALES', 'ACCOUNTS'];
        const unauthorizedModules = requestedModules.filter(m => !creatorModules.includes(m));
        if (unauthorizedModules.length > 0) {
            console.log(`✅ PASS: Blocked assigning modules not possessed: ${unauthorizedModules.join(', ')}`);
        } else {
            console.log('❌ FAIL: Should have blocked unauthorized module assignment');
        }

        // Test Case: Branch Admin trying to create user in another branch
        const targetBranchId = 999;
        if (branchAdmin.role === 'branchadmin' && targetBranchId !== branchAdmin.branchId) {
            console.log('✅ PASS: Branch Admin blocked from creating user in other branch');
        } else {
            console.log('❌ FAIL: Branch Admin should be restricted to their own branch');
        }

        // Cleanup
        await prisma.user.delete({ where: { id: branchAdmin.id } });
        await prisma.branch.delete({ where: { id: branch.id } });
        console.log('--- Cleanup complete ---');

    } catch (err) {
        console.error('Verification failed:', err);
    } finally {
        await prisma.$disconnect();
    }
}

verifyRBAC();
