const prisma = require('./prismaClient');

// Helper: Ensure Group Exists (Recursive-ish for known types)
async function ensureGroupExists(groupName) {
    let group = await prisma.accountGroup.findFirst({ where: { name: groupName } });
    if (group) return group;

    // Known Hierarchy Map for Auto-Recovery
    const hierarchy = {
        'Loans & Advances (Asset)': { parent: 'Current Assets', type: 'ASSETS' },
        'Current Assets': { parent: 'Assets', type: 'ASSETS' },
        'Assets': { parent: null, type: 'ASSETS' },
        
        'Current Liabilities': { parent: 'Liabilities', type: 'LIABILITIES' },
        'Liabilities': { parent: null, type: 'LIABILITIES' },

        'Indirect Expenses': { parent: 'Expenses', type: 'EXPENSES' },
        'Expenses': { parent: null, type: 'EXPENSES' }
    };

    const config = hierarchy[groupName];
    if (!config) throw new Error(`Account Group '${groupName}' not found and no auto-recovery definition exists.`);

    // Ensure parent exists
    let parentId = null;
    if (config.parent) {
        const parentGroup = await ensureGroupExists(config.parent);
        parentId = parentGroup.id;
    }

    // Create the group
    group = await prisma.accountGroup.create({
        data: {
            name: groupName,
            groupType: config.type,
            parentId: parentId,
            isSystem: true
        }
    });
    console.log(`Auto-created Account Group: ${groupName}`);
    return group;
}

// Helper to ensure Ledger Exists
async function getOrCreateLedger(name, groupName) {
    let ledger = await prisma.ledger.findFirst({
        where: { name: name }
    });

    if (!ledger) {
        // Find or Create Group
        const group = await ensureGroupExists(groupName);

        ledger = await prisma.ledger.create({
            data: {
                name: name,
                groupId: group.id,
                balanceType: group.groupType === 'ASSETS' || group.groupType === 'EXPENSES' ? 'DEBIT' : 'CREDIT',
                openingBalance: 0
            }
        });
    }
    return ledger;
}

// Helper: Get Company Bank or Default Cash
async function getSourceBankLedger(companyProfile) {
    if (companyProfile?.bankId) {
        // Find ledger for this bank
        // Assuming Bank Master doesn't directly map to ledger yet (it should, but for now we search by name)
        // Ideally we should have `ledgerId` in Bank model. 
        // Strategy: Search for ledger with Bank Name.
        const bank = await prisma.bank.findUnique({ where: { id: companyProfile.bankId } });
        if (bank) {
            let ledger = await prisma.ledger.findFirst({ where: { name: bank.name } });
            if (ledger) return ledger;
        }
    }
    // Fallback to 'Cash'
    return getOrCreateLedger('Cash', 'Cash-in-hand');
}


// 1. Handle Salary Advance Approval (Payment Voucher)
// Entry: Dr Salary Advance - Employee (Asset), Cr Bank/Cash
exports.handleSalaryAdvanceApproval = async (advanceId, userId) => {
    try {
        const advance = await prisma.salaryAdvance.findUnique({
            where: { id: advanceId },
            include: { user: true }
        });

        if (!advance || advance.status !== 'APPROVED') return;

        const company = await prisma.companyProfile.findFirst();
        const creditLedger = await getSourceBankLedger(company);
        
        // Debit: Employee Specific Advance Ledger
        const debitLedger = await getOrCreateLedger(`Salary Advance - ${advance.user.name}`, 'Loans & Advances (Asset)');

        // Create Voucher
        const voucher = await prisma.voucher.create({
            data: {
                voucherNumber: await generateVoucherNumber('PAYMENT'),
                voucherType: 'PAYMENT',
                date: new Date(),
                narration: `Salary Advance paid to ${advance.user.name} - ${advance.reason}`,
                reference: `ADV-${advance.id}`,
                totalAmount: advance.amount,
                createdBy: userId,
                entries: {
                    create: [
                        { debitLedgerId: debitLedger.id, amount: advance.amount, description: 'Advance Payout' },
                        { creditLedgerId: creditLedger.id, amount: advance.amount, description: 'Bank/Cash' }
                    ]
                }
            }
        });

        // Link Voucher to Advance
        await prisma.salaryAdvance.update({
            where: { id: advanceId },
            data: { voucherId: voucher.id }
        });

    } catch (error) {
        console.error("Accounting Error (Advance):", error.message);
    }
};

// 2. Handle Payroll Generation (Journal Voucher)
// Entry: Dr Salary Expense (Gross), Cr Salary Payable - Employee (Net), Cr Salary Advance - Employee (Deduction)
exports.handlePayrollGeneration = async (payrollId, userId) => {
    try {
        const payroll = await prisma.payroll.findUnique({
            where: { id: payrollId },
            include: { user: true, salaryAdvances: true }
        });

        // Debit: Salary Expense (Generic is fine for Expense, or split by Dept?)
        // Standard: Generic Salary Expense
        const expenseLedger = await getOrCreateLedger('Salary Expense', 'Indirect Expenses');
        
        // Credit: Salary Payable - Employee Specific
        const payableLedger = await getOrCreateLedger(`Salary Payable - ${payroll.user.name}`, 'Current Liabilities');

        // Entries
        const entries = [];
        
        // 1. Dr Salary Expense (Basic + Allowances)
        const grossEarnings = Number(payroll.basicSalary) + Number(payroll.allowances);
        
        entries.push({
            debitLedgerId: expenseLedger.id,
            amount: grossEarnings,
            description: `Salary Expense for ${payroll.month} ${payroll.year} - ${payroll.user.name}`
        });

        // 2. Cr Salary Advance - Employee Specific (if any deducted)
        const advanceDeduction = payroll.salaryAdvances.reduce((sum, adv) => sum + Number(adv.amount), 0);
        if (advanceDeduction > 0) {
            const advanceLedger = await getOrCreateLedger(`Salary Advance - ${payroll.user.name}`, 'Loans & Advances (Asset)');
            entries.push({
                creditLedgerId: advanceLedger.id,
                amount: advanceDeduction,
                description: `Advance Recovery - ${payroll.user.name}`
            });
        }

        // 3. Cr Deductions (Generic Liability)
        const deductionAmount = Number(payroll.deductions);
        if (deductionAmount > 0) {
             const deductionLedger = await getOrCreateLedger('Salary Deductions', 'Current Liabilities');
             entries.push({
                creditLedgerId: deductionLedger.id,
                amount: deductionAmount,
                description: `Deductions - ${payroll.user.name}`
             });
        }

        // 4. Cr Salary Payable (Net Pay)
        const netPayable = Number(payroll.netSalary);
        entries.push({
            creditLedgerId: payableLedger.id,
            amount: netPayable, 
            description: `Salary Payable - ${payroll.user.name}`
        });

        const voucher = await prisma.voucher.create({
            data: {
                voucherNumber: await generateVoucherNumber('JOURNAL'),
                voucherType: 'JOURNAL',
                date: new Date(),
                narration: `Payroll generated for ${payroll.user.name} (${payroll.month} ${payroll.year})`,
                reference: `PAY-${payroll.id}`,
                totalAmount: grossEarnings,
                createdBy: userId,
                entries: { create: entries }
            }
        });

        await prisma.payroll.update({
            where: { id: payrollId },
            data: { voucherId: voucher.id }
        });

    } catch (error) {
        console.error("Accounting Error (Payroll Gen):", error.message);
    }
};

// 3. Handle Payroll Payment (Payment Voucher)
// Entry: Dr Salary Payable - Employee, Cr Bank
exports.handlePayrollPayment = async (payrollId, userId) => {
    try {
        const payroll = await prisma.payroll.findUnique({
            where: { id: payrollId },
            include: { user: true }
        });
        
        if (!payroll || payroll.status !== 'PAID') return;

        const company = await prisma.companyProfile.findFirst();
        const creditLedger = await getSourceBankLedger(company);
        
        // Debit: Salary Payable - Employee Specific
        const debitLedger = await getOrCreateLedger(`Salary Payable - ${payroll.user.name}`, 'Current Liabilities');

        const voucher = await prisma.voucher.create({
            data: {
                voucherNumber: await generateVoucherNumber('PAYMENT'),
                voucherType: 'PAYMENT',
                date: new Date(),
                narration: `Salary payout for ${payroll.user.name} (${payroll.month} ${payroll.year})`,
                reference: `PAY-OUT-${payroll.id}`,
                totalAmount: payroll.netSalary,
                createdBy: userId,
                entries: {
                    create: [
                        { debitLedgerId: debitLedger.id, amount: payroll.netSalary, description: 'Salary Payout' },
                        { creditLedgerId: creditLedger.id, amount: payroll.netSalary, description: 'Bank/Cash' }
                    ]
                }
            }
        });

    } catch (error) {
        console.error("Accounting Error (Payroll Pay):", error.message);
    }
};


// Copied Sequence Generator (refactor later to shared utils)
async function generateVoucherNumber(voucherType) {
  const prefix = {
    'PAYMENT': 'PAY', 'RECEIPT': 'REC', 'JOURNAL': 'JV',
    'CONTRA': 'CON', 'SALES': 'SAL', 'PURCHASE': 'PUR'
  }[voucherType] || 'VOU';
  
  const year = new Date().getFullYear().toString().slice(-2);
  const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
  
  const lastVoucher = await prisma.voucher.findFirst({
    where: { voucherNumber: { startsWith: `${prefix}${year}${month}` } },
    orderBy: { voucherNumber: 'desc' }
  });
  
  let sequence = 1;
  if (lastVoucher) {
    const lastSequence = parseInt(lastVoucher.voucherNumber.slice(-4));
    sequence = lastSequence + 1;
  }
  return `${prefix}${year}${month}${sequence.toString().padStart(4, '0')}`;
}
