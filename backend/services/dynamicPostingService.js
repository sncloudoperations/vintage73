const prisma = require('../config/prisma');
const { evaluateFormula } = require('../utils/accountingUtils');

/**
 * Dynamic Posting Service
 * Generates accounting vouchers based on TransactionPosting configurations.
 */

/**
 * Generate a unique voucher number
 */
async function generateVoucherNumber(tx, voucherType) {
    const prefix = {
        'PAYMENT': 'PAY', 'RECEIPT': 'REC', 'JOURNAL': 'JV',
        'CONTRA': 'CON', 'SALES': 'SAL', 'PURCHASE': 'PUR'
    }[voucherType] || 'VOU';

    const year = new Date().getFullYear().toString().slice(-2);
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');

    const lastVoucher = await tx.voucher.findFirst({
        where: { voucherNumber: { startsWith: `${prefix}${year}${month}` } },
        orderBy: { voucherNumber: 'desc' }
    });

    let sequence = 1;
    if (lastVoucher) {
        const lastSequence = parseInt(lastVoucher.voucherNumber.slice(-4));
        if (!isNaN(lastSequence)) {
            sequence = lastSequence + 1;
        }
    }
    return `${prefix}${year}${month}${sequence.toString().padStart(4, '0')}`;
}

/**
 * Post a transaction dynamically
 * @param {Object} tx - Prisma transaction client
 * @param {string} transactionType - e.g. 'SALES'
 * @param {Object} data - The transaction object (Sale, Purchase, etc.)
 * @param {number} userId - The user ID performing the action
 * @param {string} reference - Optional reference (Invoice # / Bill #)
 * @param {string} narration - Optional narration
 */
async function postTransaction(tx, transactionType, data, userId, reference = '', narration = '') {
    // 1. Get rules for this transaction type
    const rules = await tx.transactionPosting.findMany({
        where: { transactionType },
        include: { ledger: true }
    });

    if (rules.length === 0) return null;

    // 2. Prepare Data (Enrich with Interstate logic if applicable)
    const enrichedData = { ...data };

    // Interstate Logic for Sales/Purchases
    if (transactionType === 'SALES' || transactionType === 'PURCHASE') {
        const company = await tx.companyProfile.findFirst();
        const contact = data.customer || data.supplier;

        if (company && contact) {
            const companyState = (company.state || '').toLowerCase().trim();
            const contactState = (contact.state || '').toLowerCase().trim();
            enrichedData.isInterState = contactState && companyState && contactState !== companyState;
        } else {
            enrichedData.isInterState = false;
        }
    }

    const entries = [];

    // 2. Process each rule
    for (const rule of rules) {
        // Evaluate condition if present
        if (rule.condition) {
            try {
                const conditionMet = evaluateFormula(rule.condition, enrichedData);
                if (!conditionMet) continue;
            } catch (e) {
                console.error(`Condition eval failed: ${rule.condition}`, e);
                continue;
            }
        }

        // Determine Ledger ID (Dynamic Resolution for certain roles)
        let resolvedLedgerId = rule.ledgerId;

        if (rule.role === 'CUSTOMER') {
            if (data.customer) {
                // Ensure ledger exists for this customer
                const { ensureLedger } = require('../utils/accountingHelper');
                const customerLedger = await ensureLedger(tx, data.customer.name, 'Sundry Debtors');
                resolvedLedgerId = customerLedger.id;
            }
        } else if (rule.role === 'SUPPLIER') {
            if (data.supplier) {
                const { ensureLedger } = require('../utils/accountingHelper');
                const supplierLedger = await ensureLedger(tx, data.supplier.name, 'Sundry Creditors');
                resolvedLedgerId = supplierLedger.id;
            }
        } else if (rule.role === 'CASH' || rule.role === 'BANK') {
            // If these roles are used, we might want to respect the transaction's payment method
            // This is optional but helpful for generic postings
        }

        // Determine Amount
        let amount = 0;
        try {
            if (rule.customFormula) {
                amount = evaluateFormula(rule.customFormula, enrichedData);
            } else if (rule.amountField && enrichedData[rule.amountField] !== undefined) {
                amount = parseFloat(enrichedData[rule.amountField]);
            }
        } catch (e) {
            console.error(`Amount eval failed for rule ${rule.role}:`, e);
            continue;
        }

        if (!amount || amount === 0) continue;

        entries.push({
            ledgerId: resolvedLedgerId,
            side: rule.side, // DEBIT or CREDIT
            amount: Math.abs(parseFloat(amount.toFixed(2))),
            description: rule.label || narration
        });
    }

    if (entries.length === 0) return null;

    // 3. Balancing Check
    const totalDebit = parseFloat(entries.filter(e => e.side === 'DEBIT').reduce((sum, e) => sum + e.amount, 0).toFixed(2));
    const totalCredit = parseFloat(entries.filter(e => e.side === 'CREDIT').reduce((sum, e) => sum + e.amount, 0).toFixed(2));

    if (Math.abs(totalDebit - totalCredit) > 0.1) {
        console.error(`Balancing Error in Dynamic Posting (${transactionType}): Dr ${totalDebit} != Cr ${totalCredit}`, entries);
        // We might want to check for a 'ROUND_OFF' rule to absorb the difference
        const roundOffRule = rules.find(r => r.role === 'ROUND_OFF');
        if (roundOffRule) {
            const diff = parseFloat((totalDebit - totalCredit).toFixed(2));
            entries.push({
                ledgerId: roundOffRule.ledgerId,
                side: diff > 0 ? 'CREDIT' : 'DEBIT',
                amount: Math.abs(diff),
                description: 'Round Off'
            });
        } else {
            throw new Error(`Accounting entries for ${transactionType} do not balance (Dr: ${totalDebit}, Cr: ${totalCredit}). Please check Posting Setup.`);
        }
    }

    // 4. Create Voucher
    // Determine Voucher Type mapping
    const vTypeMap = {
        'SALES': 'SALES',
        'PURCHASE': 'PURCHASE',
        'PAYMENT': 'PAYMENT',
        'RECEIPT': 'RECEIPT',
        'EXPENSE': 'PAYMENT'
    };
    const voucherType = vTypeMap[transactionType] || 'JOURNAL';

    const voucher = await tx.voucher.create({
        data: {
            voucherNumber: await generateVoucherNumber(tx, voucherType),
            voucherType: voucherType,
            date: data.saleDate || data.purchaseDate || data.paymentDate || new Date(),
            totalAmount: Math.max(totalDebit, totalCredit),
            narration: narration || `Auto-posted ${transactionType} #${reference}`,
            reference: reference,
            createdBy: userId || 1,
            entries: {
                create: entries.map(e => ({
                    debitLedgerId: e.side === 'DEBIT' ? e.ledgerId : null,
                    creditLedgerId: e.side === 'CREDIT' ? e.ledgerId : null,
                    amount: e.amount,
                    description: e.description
                }))
            }
        }
    });

    return voucher;
}

module.exports = {
    postTransaction
};
