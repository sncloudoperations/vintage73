const { ensureLedger, getLedgerByRole, processPurchasePosting } = require('../utils/accountingHelper');

// Helper to generate Voucher Number
async function generateVoucherNumber(tx, type) {
  // ... existing logic ...
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
            const g = await tx.accountGroup.create({ data: { name: 'Sundry Creditors', groupType: 'LIABILITIES' } });
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

      const subTotal = processedItems.reduce((sum, item) => sum + item.totalCost, 0);
      const taxAmount = totalAmount - subTotal;

      // 3. Create Purchase Record
      const purchase = await tx.purchase.create({
        data: {
          supplierId,
          subTotal: subTotal,
          taxAmount: taxAmount,
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
        },
        include: {
          supplier: true,
          items: { include: { product: true } }
        }
      });

      // 4. Update Stock & Cost Price
      for (const item of items) {
        await tx.productStock.upsert({
          where: { branchId_productId: { branchId, productId: item.productId } },
          update: { quantity: { increment: item.quantity } },
          create: { branchId, productId: item.productId, quantity: item.quantity }
        });

        // Update Product Master Cost Price
        await tx.product.update({
          where: { id: item.productId },
          data: { costPrice: item.unitCost }
        });
      }

      // 5. ACCOUNTING ENTRIES ---------------------------
      try {
        const userId = req.user ? req.user.id : 1;
        await processPurchasePosting(tx, purchase, userId);
      } catch (accErr) {
        console.error("Accounting Integration Failed:", accErr);
        throw new Error('Accounting Error: ' + accErr.message);
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
