const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seedChartOfAccounts() {
  console.log('Seeding Professional Chart of Accounts...');

  // 1. Define Root Groups (The Big 4/5)
  // These are the top-level categories for balance sheet and P&L
  const roots = [
    { name: 'Assets', type: 'ASSETS' },
    { name: 'Liabilities', type: 'LIABILITIES' },
    { name: 'Equity', type: 'EQUITY' },
    { name: 'Income', type: 'INCOME' },
    { name: 'Expenses', type: 'EXPENSES' },
  ];

  const rootMap = {};

  for (const root of roots) {
    const group = await prisma.accountGroup.upsert({
      where: { name: root.name },
      update: {},
      create: {
        name: root.name,
        groupType: root.type,
        isSystem: true,
        parentId: null
      }
    });
    rootMap[root.name] = group;
    console.log(`Created Root: ${root.name}`);
  }

  // 2. Define Standard Sub-Groups (Tally/GAAP Style)
  // Structure: { name, parentName, type }
  const subgroups = [
    // --- ASSETS ---
    { name: 'Current Assets', parent: 'Assets', type: 'ASSETS' },
    { name: 'Fixed Assets', parent: 'Assets', type: 'ASSETS' },
    { name: 'Investments', parent: 'Assets', type: 'ASSETS' },
    { name: 'Misc. Expenses (ASSET)', parent: 'Assets', type: 'ASSETS' },
    
    // Sub-groups of Current Assets
    { name: 'Bank Accounts', parent: 'Current Assets', type: 'ASSETS' },
    { name: 'Cash-in-Hand', parent: 'Current Assets', type: 'ASSETS' },
    { name: 'Deposits (Asset)', parent: 'Current Assets', type: 'ASSETS' },
    { name: 'Loans & Advances (Asset)', parent: 'Current Assets', type: 'ASSETS' },
    { name: 'Stock-in-Hand', parent: 'Current Assets', type: 'ASSETS' },
    { name: 'Sundry Debtors', parent: 'Current Assets', type: 'ASSETS' },

    // --- LIABILITIES ---
    { name: 'Current Liabilities', parent: 'Liabilities', type: 'LIABILITIES' },
    { name: 'Loans (Liability)', parent: 'Liabilities', type: 'LIABILITIES' },
    { name: 'Suspense A/c', parent: 'Liabilities', type: 'LIABILITIES' }, // Often kept here or separate

    // Sub-groups of Current Liabilities
    { name: 'Duties & Taxes', parent: 'Current Liabilities', type: 'LIABILITIES' },
    { name: 'Provisions', parent: 'Current Liabilities', type: 'LIABILITIES' },
    { name: 'Sundry Creditors', parent: 'Current Liabilities', type: 'LIABILITIES' },

    // Sub-groups of Loans (Liability)
    { name: 'Bank OD A/c', parent: 'Loans (Liability)', type: 'LIABILITIES' },
    { name: 'Secured Loans', parent: 'Loans (Liability)', type: 'LIABILITIES' },
    { name: 'Unsecured Loans', parent: 'Loans (Liability)', type: 'LIABILITIES' },

    // --- EQUITY ---
    { name: 'Capital Account', parent: 'Equity', type: 'EQUITY' },
    { name: 'Reserves & Surplus', parent: 'Equity', type: 'EQUITY' },

    // --- INCOME ---
    { name: 'Sales Accounts', parent: 'Income', type: 'INCOME' },
    { name: 'Direct Incomes', parent: 'Income', type: 'INCOME' },
    { name: 'Indirect Incomes', parent: 'Income', type: 'INCOME' },

    // --- EXPENSES ---
    { name: 'Purchase Accounts', parent: 'Expenses', type: 'EXPENSES' },
    { name: 'Direct Expenses', parent: 'Expenses', type: 'EXPENSES' },
    { name: 'Indirect Expenses', parent: 'Expenses', type: 'EXPENSES' },
  ];

  // Helper to find parent ID recursively or from map
  // For this script, we can do a multi-pass approach or just lookups since it's shallow 2-3 levels.
  // We'll iterate and fetch parent.

  for (const group of subgroups) {
    // Find parent
    let parent = rootMap[group.parent]; // First check roots
    
    if (!parent) {
      // If not a root, search in database (it must have been created in a previous iteration if we order correctly)
      // Actually, since we have dependencies (Current Assets needs Assets, Bank needs Current Assets),
      // we need to ensure order. The array above IS ordered by dependency roughly.
      // But "Current Assets" is created in the first block of subgroups.
      // "Bank Accounts" is created in second block.
      // So simple linear execution works if ordered.
      
      parent = await prisma.accountGroup.findUnique({ where: { name: group.parent } });
    }

    if (!parent) {
      console.error(`Parent ${group.parent} not found for ${group.name}! Skipping.`);
      continue;
    }

    await prisma.accountGroup.upsert({
      where: { name: group.name },
      update: {},
      create: {
        name: group.name,
        groupType: group.type,
        isSystem: true,
        parentId: parent.id
      }
    });
    console.log(`Created Group: ${group.name} (Parent: ${group.parent})`);
  }

  // 3. Create Key Ledgers (Optional but helpful)
  const defaultLedgers = [
    { name: 'Cash', groupName: 'Cash-in-Hand', type: 'DEBIT' },
    { name: 'Profit & Loss A/c', groupName: 'Reserves & Surplus', type: 'CREDIT' }, // Or Primary
  ];

  for (const ledger of defaultLedgers) {
      const g = await prisma.accountGroup.findUnique({ where: { name: ledger.groupName } });
      if (g) {
          await prisma.ledger.upsert({
              where: { name: ledger.name },
              update: {},
              create: {
                  name: ledger.name,
                  groupId: g.id,
                  balanceType: ledger.type,
                  openingBalance: 0
              }
          });
          console.log(`Created Ledger: ${ledger.name}`);
      }
  }

  console.log('Professional Chart of Accounts Seeded Successfully.');
}

async function main() {
  try {
      await seedChartOfAccounts();
  } catch (error) {
      console.error(error);
      process.exit(1);
  } finally {
      await prisma.$disconnect();
  }
}

main();
