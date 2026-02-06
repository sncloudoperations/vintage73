const prisma = require('../utils/prismaClient');
const { postTransaction } = require('../services/dynamicPostingService');

exports.createTransfer = async (req, res) => {
  const { fromBranchId, toBranchId, items, remarks } = req.body;
  const user = req.user || { id: 1 };

  try {
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
          fromBranchId: parseInt(fromBranchId),
          toBranchId: parseInt(toBranchId),
          remarks,
          status: 'PENDING',
          items: {
            create: transferItems
          }
        }
      });

      // 2. Deduct stock from sending branch
      for (const item of transferItems) {
        await tx.productStock.update({
          where: {
            branchId_productId: {
              branchId: parseInt(fromBranchId),
              productId: item.productId
            }
          },
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
      }

      return transfer;
    });

    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getTransfers = async (req, res) => {
  const { branchId, type } = req.query; // type: 'outgoing' or 'incoming'
  try {
    const where = {};
    if (type === 'outgoing') where.fromBranchId = parseInt(branchId);
    if (type === 'incoming') where.toBranchId = parseInt(branchId);

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
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.receiveTransfer = async (req, res) => {
  const { id } = req.params;
  const user = req.user || { id: 1 };

  try {
    const result = await prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.findUnique({
        where: { id: parseInt(id) },
        include: { items: true }
      });

      if (!transfer || transfer.status !== 'PENDING') {
        throw new Error('Invalid transfer or already processed');
      }

      // 1. Update Transfer Status and Receipt Info
      const { receivedById } = req.body;
      const totalAmount = transfer.items.reduce((sum, item) => sum + parseFloat(item.totalCost || 0), 0);

      await tx.stockTransfer.update({
        where: { id: parseInt(id) },
        data: {
          status: 'RECEIVED',
          receivedById: receivedById ? parseInt(receivedById) : null,
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
      }

      return { message: 'Stock received successfully' };
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.cancelTransfer = async (req, res) => {
  const { id } = req.params;
  const user = req.user || { id: 1 };

  try {
    const result = await prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.findUnique({
        where: { id: parseInt(id) },
        include: { items: true }
      });

      if (!transfer || transfer.status !== 'PENDING') {
        throw new Error('Invalid transfer or already processed');
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
      }

      return { message: 'Transfer cancelled and stock restored' };
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
