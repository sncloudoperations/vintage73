const fs = require('fs');
const path = require('path');
const logFile = path.join(__dirname, 'debug_output.txt');

function log(msg) {
  fs.appendFileSync(logFile, msg + '\n');
  console.log(msg);
}

log('Starting debug script...');

try {
  const prisma = require('./config/prisma');
  
  async function debugSetup() {
    log('--- Checking Account Groups ---');
    const groups = await prisma.accountGroup.findMany();
    log(`Found ${groups.length} groups`);
    if (groups.length > 0) {
      log(JSON.stringify(groups.map(g => ({ id: g.id, name: g.name, type: g.groupType })), null, 2));
    }

    log('\n--- Checking Transaction Posting Rules (PURCHASE) ---');
    const rules = await prisma.transactionPosting.findMany({
      where: { transactionType: 'PURCHASE' },
      include: { ledger: true }
    });
    
    if (rules.length === 0) {
      log('!!! NO PURCHASE POSTING RULES FOUND !!!');
    } else {
      log(JSON.stringify(rules.map(r => ({
        id: r.id,
        role: r.role,
        ledger: r.ledger ? r.ledger.name : 'DYNAMIC',
        side: r.side,
        amountField: r.amountField
      })), null, 2));
    }

    log('\n--- Checking Ledgers ---');
    const ledgers = await prisma.ledger.findMany({
      take: 20
    });
    log(JSON.stringify(ledgers.map(l => ({ id: l.id, name: l.name, groupId: l.groupId })), null, 2));
  }

  debugSetup()
    .catch(err => {
      log('Error in debugSetup: ' + err.stack);
    })
    .finally(async () => {
      log('Disconnecting...');
      await prisma.$disconnect();
    });

} catch (err) {
  log('Top level error: ' + err.stack);
}
