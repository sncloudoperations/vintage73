const prisma = require('../config/prisma');
const asyncHandler = require('../middleware/asyncHandler');
const { processPurchasePosting } = require('../utils/accountingHelper');

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
exports.createPurchase = asyncHandler(async (req, res) => {
  const { supplierName, items, paymentMethod, branchId: bodyBranchId } = req.body;
  const user = req.user;

  // Use branchId from body if provided, otherwise fallback to user's branch
  const branchId = bodyBranchId ? parseInt(bodyBranchId) : (user?.branchId || null);

  if (!branchId) {
    res.status(400);
    throw new Error('Branch ID is required. Please ensure you are logged in with a valid branch assignment.');
  }

  if (!items || items.length === 0) {
    res.status(400);
    throw new Error('Purchase must have at least one item');
  }

  // Verify branch exists
  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  if (!branch) {
    res.status(400);
    throw new Error(`Branch with ID ${branchId} not found. Please select a valid branch.`);
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1. Ensure Supplier & Get Ledger
    let supplierId = null;

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
        await tx.ledger.create({
          data: { name: supplier.name, groupId, balanceType: 'CREDIT' }
        });
      }
    }

    // 2. Identify Financial Year & Generate Number
    const pDate = req.body.purchaseDate ? new Date(req.body.purchaseDate) : new Date();
    
    // Explicitly look for branch-specific FY first
    let financialYear = await tx.financialYear.findFirst({
        where: {
            branchId: parseInt(branchId),
            startDate: { lte: pDate },
            endDate: { gte: pDate },
            isClosed: false
        }
    });

    // Fallback to global FY if no branch-specific one exists
    if (!financialYear) {
        financialYear = await tx.financialYear.findFirst({
            where: {
                branchId: null,
                startDate: { lte: pDate },
                endDate: { gte: pDate },
                isClosed: false
            }
        });
    }

    let invoiceNumber;
    if (financialYear) {
        const prefix = financialYear.invoicePrefix || 'PUR';
        const startingSeq = financialYear.invoiceSequence || '001';

        // BRANCH-WISE SEQUENCING: Look for the last purchase in this branch and FY
        const lastPurchaseInBranch = await tx.purchase.findFirst({
            where: { 
                branchId: branchId ? parseInt(branchId) : null,
                financialYearId: financialYear.id,
                invoiceNumber: { startsWith: prefix }
            },
            orderBy: { invoiceNumber: 'desc' }
        });

        let nextSeq;
        if (lastPurchaseInBranch && lastPurchaseInBranch.invoiceNumber) {
        const lastInvoiceNum = lastPurchaseInBranch.invoiceNumber;
        
        let lastNum = NaN;
        if (lastInvoiceNum.startsWith(prefix)) {
            const seqPart = lastInvoiceNum.slice(prefix.length);
            lastNum = parseInt(seqPart, 10);
        } else {
            const match = lastInvoiceNum.match(/(\d+)$/);
            lastNum = match ? parseInt(match[0], 10) : NaN;
        }
        
        if (!isNaN(lastNum)) {
            nextSeq = (lastNum + 1).toString().padStart(startingSeq.length, '0');
        } else {
            nextSeq = (parseInt(startingSeq, 10) || 1).toString().padStart(startingSeq.length, '0');
        }
    } else {
        nextSeq = startingSeq;
    }

        invoiceNumber = `${prefix}${nextSeq}`;
        console.log(`[PURCHASE-NUMBERING] Branch: ${branchId}, Last: ${lastPurchaseInBranch?.invoiceNumber}, New: ${invoiceNumber}`);

        // Sync global FY sequence
        await tx.financialYear.update({
            where: { id: financialYear.id },
            data: { invoiceSequence: nextSeq }
        });
    } else {
        invoiceNumber = req.body.invoiceNumber || `PUR-${Date.now()}`;
    }

    // 2b. Calculate Totals (Items + Tax) - RESTORED
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
        unitCost: cost,
        totalCost: total
      };
    });

    // 3. Create Purchase Record
    const purchase = await tx.purchase.create({
      data: {
        invoiceNumber,
        supplierId: supplierId,
        paymentMethod: paymentMethod,
        branchId: branchId,
        subTotal: totalSubTotal,
        taxAmount: totalTax,
        totalAmount: totalAmount,
        status: 'completed',
        purchaseDate: pDate,
        items: {
          create: processedItems
        }
      },
      include: {
        supplier: true,
        items: {
          include: { product: true }
        }
      }
    });

    // 4. Update Stock
    for (const item of purchase.items) {
      const productId = parseInt(item.productId);
      const validBranchId = parseInt(branchId);

      // Upsert ProductStock
      const existingStock = await tx.productStock.findUnique({
        where: {
          branchId_productId: {
            branchId: validBranchId,
            productId: productId
          }
        }
      });

      if (existingStock) {
        await tx.productStock.update({
          where: { id: existingStock.id },
          data: {
            quantity: { increment: item.quantity }
          }
        });
      } else {
        await tx.productStock.create({
          data: {
            branchId: validBranchId,
            productId: productId,
            quantity: item.quantity
          }
        });
      }
    }

    // 5. Accounting Posting
    try {
      if (!req.body.skipAccounting) {
        await processPurchasePosting(tx, purchase, req.user?.id || 1);
      }
    } catch (accErr) {
      console.error("Accounting Integration Failed (Purchase):", accErr);
      const error = new Error('Accounting Error: ' + accErr.message);
      error.statusCode = 500;
      throw error;
    }

    return purchase;
  });

  res.status(201).json(result);
});

// Get All Purchases
exports.getPurchases = asyncHandler(async (req, res) => {
  const { branchId: queryBranchId, startDate, endDate } = req.query;
  const where = {};

  // Branch Isolation
  if (req.user.branchId) {
    where.branchId = req.user.branchId;
  } else if (queryBranchId) {
    where.branchId = parseInt(queryBranchId);
  }

  if (startDate && endDate) {
    where.purchaseDate = {
      gte: new Date(startDate),
      lte: new Date(endDate)
    };
  }

  const purchases = await prisma.purchase.findMany({
    where,
    include: {
      supplier: true,
      items: { include: { product: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json(purchases);
});

// Delete Purchase (and reverse stock)
exports.deletePurchase = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const purchase = await prisma.purchase.findUnique({
    where: { id: parseInt(id) },
    include: { items: true }
  });

  if (!purchase) {
    res.status(404);
    throw new Error('Purchase not found');
  }

  // Branch Isolation
  if (req.user.branchId && purchase.branchId !== req.user.branchId) {
    res.status(403);
    throw new Error('Access denied: Cannot delete purchases from other branches');
  }

  await prisma.$transaction(async (tx) => {
    // 1. Reverse Stock
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

    // 2. Void Accounting Vouchers
    const reference = purchase.invoiceNumber || `PUR-${purchase.id}`;
    await tx.voucher.updateMany({
      where: { reference: reference },
      data: { status: 'CANCELLED' }
    });

    // 3. Delete Purchase Record (Items will be deleted via cascade if set, or manual)
    await tx.purchaseItem.deleteMany({ where: { purchaseId: parseInt(id) } });
    await tx.purchase.delete({ where: { id: parseInt(id) } });
  });

  res.json({ message: 'Purchase and associated stock/accounting records reversed successfully' });
});
