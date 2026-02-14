const prisma = require('../config/prisma');

async function seedAccountGroups() {
  const groups = [
    { name: 'Sundry Debtors', groupType: 'ASSETS' },
    { name: 'Sundry Creditors', groupType: 'LIABILITIES' },
    { name: 'Sales Accounts', groupType: 'INCOME' },
    { name: 'Purchase Accounts', groupType: 'EXPENSES' },
    { name: 'Duties & Taxes', groupType: 'LIABILITIES' },
    { name: 'Bank Accounts', groupType: 'ASSETS' },
    { name: 'Cash-in-Hand', groupType: 'ASSETS' },
    { name: 'Indirect Expenses', groupType: 'EXPENSES' },
    { name: 'Direct Incomes', groupType: 'INCOME' },
    { name: 'Stock-in-Hand', groupType: 'ASSETS' },
    { name: 'Direct Expenses', groupType: 'EXPENSES' },
    { name: 'Indirect Incomes', groupType: 'INCOME' },
    { name: 'Fixed Assets', groupType: 'ASSETS' },
    { name: 'Current Assets', groupType: 'ASSETS' },
    { name: 'Current Liabilities', groupType: 'LIABILITIES' },
    { name: 'Capital Account', groupType: 'LIABILITIES' }
  ];

  console.log('Seeding Account Groups...');
  for (const g of groups) {
    await prisma.accountGroup.upsert({
      where: { name: g.name },
      update: { groupType: g.groupType },
      create: { name: g.name, groupType: g.groupType }
    });
  }
  console.log('Account Groups Seeded Successfully.');
}

module.exports = { seedAccountGroups };
