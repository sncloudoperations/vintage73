const prisma = require('../config/prisma');
const asyncHandler = require('../middleware/asyncHandler');
const { postTransaction } = require('../services/dynamicPostingService');
const { getLedgerByRole, postVoucher } = require('../utils/accountingHelper');

exports.createTransfer = asyncHandler(async (req, res) => {
  const { toBranchId, items, remarks } = req.body;
  let { fromBranchId } = req.body;
  const user = req.user;

  // 1. Validation & Defaulting
  if (user?.branchId) {
    // Branch-restricted users MUST use their own branch as source
    fromBranchId = user.branchId;
  } else if (!fromBranchId) {
    // For global admins who didn't specify, we still need a default or error
    res.status(400);
    throw new Error('From Branch is required for global admins.');
  }

  if (!fromBranchId || !toBranchId) {
    res.status(400);
    throw new Error('Both source and destination branches are required.');
  }

  const fBranchId = parseInt(fromBranchId);
  const tBranchId = parseInt(toBranchId);

  if (fBranchId === tBranchId) {
    res.status(400);
    throw new Error('Source and destination branches cannot be the same.');
  }

  // Verify branches exist
  const [fromBranch, toBranch] = await Promise.all([
    prisma.branch.findUnique({ where: { id: fBranchId } }),
    prisma.branch.findUnique({ where: { id: tBranchId } })
  ]);

  if (!fromBranch) {
    res.status(404);
    throw new Error('Source branch not found.');
  }
  if (!toBranch) {
    res.status(404);
    throw new Error('Destination branch not found.');
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400);
    throw new Error('Transfer must have at least one item.');
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1. Create Transfer Record
    let totalAmount = 0;
    const transferItems = [];

    for (const item of items) {
      const quantity = parseInt(item.quantity) || 0;
      const unitCost = parseFloat(item.unitCost) || 0;
      const taxPercent = parseFloat(item.taxPercent || 0);

      const subTotal = quantity * unitCost;
      const taxAmount = subTotal * (taxPercent / 100);
      const totalCost = subTotal + taxAmount;
      totalAmount += totalCost;

      transferItems.push({
        productId: parseInt(item.productId),
        quantity,
        unitCost,
        taxPercent,
        taxAmount,
        totalCost
      });
    }

    const transfer = await tx.stockTransfer.create({
      data: {
        fromBranchId: fBranchId,
        toBranchId: tBranchId,
        remarks,
        status: 'PENDING',
        items: {
          create: transferItems
        }
      }
    });

    // 2. Validate & Deduct stock from sending branch
    for (const item of transferItems) {
      // Check current stock
      const currentStock = await tx.productStock.findUnique({
        where: {
          branchId_productId: {
            branchId: fBranchId,
            productId: item.productId
          }
        },
        include: { product: { select: { name: true } } }
      });

      if (!currentStock || currentStock.quantity < item.quantity) {
        const error = new Error(`Insufficient stock for product: ${currentStock?.product?.name || item.productId}. Available: ${currentStock?.quantity || 0}, Requested: ${item.quantity}`);
        error.statusCode = 400;
        throw error;
      }

      await tx.productStock.update({
        where: { id: currentStock.id },
        data: {
          quantity: { decrement: item.quantity }
        }
      });
    }

    // 3. Accounting Integration (Sending)
    try {
      await postTransaction(tx, 'STOCK_TRANSFER', { ...transfer, items: transferItems, totalAmount }, user.id, `ST-${transfer.id}`, `Stock Transfer #${transfer.id}`);
    } catch (accErr) {
      console.error('Stock Transfer Accounting Error:', accErr);
      const error = new Error('Accounting Error: ' + accErr.message);
      error.statusCode = 500;
      throw error;
    }

    return transfer;
  });

  res.status(201).json(result);
});

exports.getTransfers = asyncHandler(async (req, res) => {
  const { branchId, type } = req.query; // type: 'outgoing' or 'incoming'
  const where = {};
  if (type === 'outgoing' && branchId) where.fromBranchId = parseInt(branchId);
  if (type === 'incoming' && branchId) where.toBranchId = parseInt(branchId);

  const transfers = await prisma.stockTransfer.findMany({
    where,
    include: {
      fromBranch: true,
      toBranch: true,
      receivedBy: {
        select: { name: true, username: true }
      },
      items: {
        include: { product: true }
      }
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json(transfers);
});

exports.receiveTransfer = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = req.user || { id: 1 };

  const result = await prisma.$transaction(async (tx) => {
    const transfer = await tx.stockTransfer.findUnique({
      where: { id: parseInt(id) },
      include: { items: true }
    });

    if (!transfer || transfer.status !== 'PENDING') {
      const error = new Error('Invalid transfer or already processed');
      error.statusCode = 400;
      throw error;
    }

    // 1. Update Transfer Status and Receipt Info
    const totalAmount = transfer.items.reduce((sum, item) => sum + parseFloat(item.totalCost || 0), 0);

    await tx.stockTransfer.update({
      where: { id: parseInt(id) },
      data: {
        status: 'RECEIVED',
        receivedById: user.id,
        receivedAt: new Date()
      }
    });

    // 2. Add stock to receiving branch
    for (const item of transfer.items) {
      await tx.productStock.upsert({
        where: {
          branchId_productId: {
            branchId: transfer.toBranchId,
            productId: item.productId
          }
        },
        update: {
          quantity: { increment: item.quantity }
        },
        create: {
          branchId: transfer.toBranchId,
          productId: item.productId,
          quantity: item.quantity
        }
      });
    }

    // 3. Accounting Integration (Receiving)
    try {
      await postTransaction(tx, 'STOCK_RECEIPT', { ...transfer, totalAmount }, user.id, `SR-${transfer.id}`, `Stock Receipt #${transfer.id}`);
    } catch (accErr) {
      console.error('Stock Receipt Accounting Error:', accErr);
      const error = new Error('Accounting Error: ' + accErr.message);
      error.statusCode = 500;
      throw error;
    }

    return { message: 'Stock received successfully' };
  });

  res.json(result);
});

exports.cancelTransfer = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const user = req.user || { id: 1 };

  const result = await prisma.$transaction(async (tx) => {
    const transfer = await tx.stockTransfer.findUnique({
      where: { id: parseInt(id) },
      include: { items: true }
    });

    if (!transfer || transfer.status !== 'PENDING') {
      const error = new Error('Invalid transfer or already processed');
      error.statusCode = 400;
      throw error;
    }

    // 1. Update Status
    const totalAmount = transfer.items.reduce((sum, item) => sum + parseFloat(item.totalCost || 0), 0);

    await tx.stockTransfer.update({
      where: { id: parseInt(id) },
      data: { status: 'CANCELLED' }
    });

    // 2. Restore stock to sender
    for (const item of transfer.items) {
      await tx.productStock.update({
        where: {
          branchId_productId: {
            branchId: transfer.fromBranchId,
            productId: item.productId
          }
        },
        data: {
          quantity: { increment: item.quantity }
        }
      });
    }

    // 3. Accounting Integration (Reversing)
    try {
      // Need to import getLedgerByRole and postVoucher or similar if not available
      // But assuming they are available or we need to import them?
      // dynamicPostingService matches `postTransaction` import above.
      // But the original code used `getLedgerByRole` and `postVoucher` which were NOT imported in the original file I viewed?
      // Wait, let's check the original file imports in step 419.
      // Line 1: const prisma...
      // Line 2: const { postTransaction } = require('../services/dynamicPostingService');
      // Line 208 calls `getLedgerByRole`.
      // Line 211 calls `postVoucher`.
      // THESE WERE MISSING IMPORTS IN THE ORIGINAL FILE!
      // I need to import them or the original code was broken.
      // The snippet shows `const { postTransaction } = ...`
      // It DOES NOT show `getLedgerByRole` or `postVoucher` imports.
      // It's possible `dynamicPostingService` exports them? Or `accountingHelper`?
      // I should assume they need to be imported from `../utils/accountingHelper` or `../services/dynamicPostingService`.
      // In `salesController`, they were imported from `../utils/accountingHelper`.
      // In `stockTransferController`, it seems they were used but maybe not imported?
      // I will add the import to be safe: `require('../utils/accountingHelper')`.

      const { getLedgerByRole, postVoucher } = require('../utils/accountingHelper');

      const stockLedger = await getLedgerByRole(tx, 'STOCK_TRANSFER', 'SOURCE_LEDGER', 'Inventory Account', 'Stock-in-Hand');
      const transitLedger = await getLedgerByRole(tx, 'STOCK_TRANSFER', 'TRANSIT_LEDGER', 'Stock in Transit', 'Stock-in-Hand');

      await postVoucher(tx, {
        type: 'JOURNAL',
        date: new Date(),
        amount: totalAmount,
        narration: `Stock Transfer CANCELLED #${transfer.id}`,
        reference: `STC-${transfer.id}`,
        createdBy: user.id
      }, [
        { ledgerId: stockLedger.id, type: 'DEBIT', amount: totalAmount },
        { ledgerId: transitLedger.id, type: 'CREDIT', amount: totalAmount }
      ]);
    } catch (accErr) {
      console.error('Stock Cancel Accounting Error:', accErr);
      const error = new Error('Accounting Error: ' + accErr.message);
      error.statusCode = 500;
      throw error;
    }

    return { message: 'Transfer cancelled and stock restored' };
  });

  res.json(result);
});
