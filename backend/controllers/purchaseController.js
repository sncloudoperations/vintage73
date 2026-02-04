const prisma = require('../utils/prismaClient');

// Helper to ensure Ledger exists
async function ensureLedger(tx, name, groupName, groupType = 'EXPENSES') {
  let ledger = await tx.ledger.findUnique({ where: { name } });
  if (!ledger) {
      let group = await tx.accountGroup.findUnique({ where: { name: groupName } });
      if (!group) {
          group = await tx.accountGroup.create({
              data: { name: groupName, groupType }
          });
      }
      ledger = await tx.ledger.create({
          data: {
              name,
              groupId: group.id,
              balanceType: groupType === 'ASSETS' || groupType === 'EXPENSES' ? 'DEBIT' : 'CREDIT'
          }
      });
  }
  return ledger;
}

// Helper to generate Voucher Number
async function generateVoucherNumber(tx, type) {
    const prefix = {
        'PURCHASE': 'PUR',
        'PAYMENT': 'PAY'
    }[type] || 'VOU';
    
    const count = await tx.voucher.count({
        where: { voucherType: type }
    });
    const pad = (num) => num.toString().padStart(4, '0');
    return `${prefix}-${new Date().getFullYear()}-${pad(count + 1)}`;
}

// Create Purchase (Inward Stock)
exports.createPurchase = async (req, res) => {
  const { supplierName, items, paymentMethod, branchId: bodyBranchId } = req.body; 
  const user = req.user;

  // Use branchId from body if provided, otherwise fallback to user's branch
  const branchId = bodyBranchId ? parseInt(bodyBranchId) : (user?.branchId || null);
  
  console.log('Purchase Debug:', { bodyBranchId, userBranchId: user?.branchId, finalBranchId: branchId });

  if (!branchId) {
    return res.status(400).json({ error: 'Branch ID is required. Please ensure you are logged in with a valid branch assignment.' });
  }

  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Purchase must have at least one item' });
  } 

  try {
    // Verify branch exists
    const branch = await prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) {
      return res.status(400).json({ error: `Branch with ID ${branchId} not found. Please select a valid branch.` });
    }

    const result = await prisma.$transaction(async (tx) => {
        // 1. Ensure Supplier & Get Ledger
        let supplierId = null;
        let supplierLedgerId = null;
        
        let supplier = null;
        if (supplierName) {
            supplier = await tx.supplier.findFirst({ where: { name: supplierName } });
            if (!supplier) {
                supplier = await tx.supplier.create({ 
                    data: { 
                        name: supplierName,
                        phone: req.body.supplierContact,
                        state: req.body.supplierState,
                        contactPerson: req.body.supplierContact
                    } 
                });
            }
            supplierId = supplier.id;

            // Ensure Supplier Ledger (Sundry Creditors)
            const credGroup = await tx.accountGroup.findFirst({ where: { name: 'Sundry Creditors' } });
            let supLedger = await tx.ledger.findUnique({ where: { name: supplier.name } });
            if (!supLedger) {
                // If group missing, create it (fallback)
                let groupId = credGroup?.id;
                if (!groupId) {
                    const g = await tx.accountGroup.create({ data: { name: 'Sundry Creditors', groupType: 'LIABILITIES' }});
                    groupId = g.id;
                }
                supLedger = await tx.ledger.create({
                    data: { name: supplier.name, groupId, balanceType: 'CREDIT' }
                });
            }
            supplierLedgerId = supLedger.id;
        }

        // 2. Calculate Totals (Items + Tax)
        let totalSubTotal = 0;
        let totalTax = 0;
        let totalAmount = 0;

        const processedItems = items.map(item => {
            const qty = parseFloat(item.quantity);
            const cost = parseFloat(item.unitCost);
            const taxRate = parseFloat(item.taxPercent || 0);
            
            const subTotal = qty * cost;
            const tax = subTotal * (taxRate / 100);
            const total = subTotal + tax;

            totalSubTotal += subTotal;
            totalTax += tax;
            totalAmount += total;

            return {
                productId: item.productId,
                quantity: qty,
                unitCost: cost, // Basic Cost
                totalCost: total // Including Tax logic? Usually DB stores totalCost. 
                                // Schema PurchaseItem has unitCost and totalCost. 
                                // We'll store basic total cost or total with tax? 
                                // Ideally, totalCost in PurchaseItem = subTotal.
            };
        });

        const isCredit = paymentMethod === 'Credit';
        const paidAmount = isCredit ? 0 : totalAmount;
        const balanceAmount = isCredit ? totalAmount : 0;

        // 3. Create Purchase Record
        const purchase = await tx.purchase.create({
            data: {
                supplierId,
                totalAmount: totalAmount, // Grand Total
                paidAmount,
                balanceAmount,
                paymentMethod: paymentMethod || 'Cash',
                purchaseDate: req.body.purchaseDate ? new Date(req.body.purchaseDate) : new Date(),
                status: balanceAmount > 0 ? 'partial' : 'completed',
                branchId: branchId,
                items: {
                    create: processedItems.map((item, idx) => ({
                        productId: item.productId,
                        quantity: item.quantity,
                        unitCost: item.unitCost,
                        totalCost: item.unitCost * item.quantity // Storing Basic Total in Item
                    }))
                }
            }
        });

        // 4. Update Stock & Cost Price
        for (const item of items) {
            await tx.productStock.upsert({
                where: { branchId_productId: { branchId, productId: item.productId } },
                update: { quantity: { increment: item.quantity } },
                create: { branchId, productId: item.productId, quantity: item.quantity }
            });

            // Update Product Master Cost Price (Moving Average or Last Purchase?)
            // User requested "Cost Price asper the Professional Purchase Module" - usually Last Purchase Price
            await tx.product.update({
                where: { id: item.productId },
                data: { costPrice: item.unitCost }
            });
        }

        // 5. ACCOUNTING ENTRIES ---------------------------
        
        // A. Purchase Voucher (Accrual)
        // Debit: Purchase Account (Expense)
        // Debit: Input Tax (Asset)
        // Credit: Supplier (Liability)

        const purchaseLedger = await ensureLedger(tx, 'Purchase Account', 'Purchase Accounts', 'EXPENSES');
        const taxLedger = await ensureLedger(tx, 'Input GST', 'Duties & Taxes', 'ASSETS'); // Or Liabilities (negative)

        const purchaseVoucherNo = await generateVoucherNumber(tx, 'PURCHASE');
        
        const purchaseEntries = [
            { ledgerId: purchaseLedger.id, type: 'DEBIT', amount: totalSubTotal },
            { ledgerId: supplierLedgerId, type: 'CREDIT', amount: totalAmount }
        ];

        if (totalTax > 0) {
            purchaseEntries.push({ ledgerId: taxLedger.id, type: 'DEBIT', amount: totalTax });
        }
        
        // Ensure debits = credits check not strictly needed here if math is right
        // Debits: SubTotal + Tax = Total
        // Credit: Total

        await tx.voucher.create({
            data: {
                voucherNumber: purchaseVoucherNo,
                voucherType: 'PURCHASE',
                date: new Date(purchase.purchaseDate),
                totalAmount: totalAmount,
                reference: `PUR-${purchase.id}`,
                narration: `Purchase from ${supplierName}`,
                createdBy: user.id,
                entries: {
                    create: purchaseEntries.map(e => ({
                        debitLedgerId: e.type === 'DEBIT' ? e.ledgerId : null,
                        creditLedgerId: e.type === 'CREDIT' ? e.ledgerId : null,
                        amount: e.amount,
                        description: `Purchase #${purchase.id}`
                    }))
                }
            }
        });

        // B. Payment Voucher (if Paid)
        if (paidAmount > 0) {
            const paymentVoucherNo = await generateVoucherNumber(tx, 'PAYMENT');
            
            // Debit: Supplier
            // Credit: Cash/Bank
            let creditLedgerName = 'Cash';
            if (paymentMethod === 'Bank Transfer' || paymentMethod === 'Cheque' || paymentMethod === 'UPI') {
                 creditLedgerName = 'Bank Account';
            }
            const creditLedger = await ensureLedger(tx, creditLedgerName, 'Bank Accounts', 'ASSETS');

            await tx.voucher.create({
                data: {
                    voucherNumber: paymentVoucherNo,
                    voucherType: 'PAYMENT',
                    date: new Date(purchase.purchaseDate),
                    totalAmount: paidAmount,
                    reference: `PAY-${purchase.id}`,
                    narration: `Payment for Purchase #${purchase.id}`,
                    createdBy: user.id,
                    entries: {
                        create: [
                            {
                                debitLedgerId: supplierLedgerId,
                                amount: paidAmount,
                                description: 'Payment Out'
                            },
                            {
                                creditLedgerId: creditLedger.id,
                                amount: paidAmount,
                                description: 'Payment Out'
                            }
                        ]
                    }
                }
            });

            // Keep Legacy Payment Record
            await tx.payment.create({
                 data: {
                    type: 'payment',
                    amount: paidAmount,
                    method: paymentMethod || 'Cash',
                    reference: `PUR-${purchase.id}`,
                    description: `Supplier payment`,
                    supplierId: supplierId,
                    branchId: branchId,
                    paymentDate: new Date(purchase.purchaseDate)
                 }
            });
        }

        return purchase;
    });

    res.status(201).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

exports.getPurchases = async (req, res) => {
  const { branchId } = req.query;
  const user = req.user;

  try {
    const where = {};
    
    // If admin, allowing filtering by branch. If not, force user's branch.
    if (user.role === 'admin') {
        if (branchId) where.branchId = parseInt(branchId);
    } else {
        where.branchId = user.branchId;
    }

    const purchases = await prisma.purchase.findMany({
      where,
      include: { supplier: true, items: { include: { product: true } } },
      orderBy: { purchaseDate: 'desc' }
    });
    res.json(purchases);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Soft delete (Cancel) Purchase
exports.deletePurchase = async (req, res) => {
  const { id } = req.params;
  
  try {
    const purchase = await prisma.purchase.findUnique({
      where: { id: parseInt(id) },
      include: { items: true }
    });

    if (!purchase) {
      return res.status(404).json({ error: 'Purchase not found' });
    }

    if (purchase.status === 'CANCELLED') {
      return res.status(400).json({ error: 'Purchase already cancelled' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Revert Stock
      for (const item of purchase.items) {
          await tx.productStock.update({
             where: {
               branchId_productId: {
                 branchId: purchase.branchId,
                 productId: item.productId
               }
             },
             data: {
               quantity: { decrement: item.quantity }
             }
          });
      }

      // Update Purchase Status
      return await tx.purchase.update({
        where: { id: parseInt(id) },
        data: { status: 'CANCELLED' }
      });
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
