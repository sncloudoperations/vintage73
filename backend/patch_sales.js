const fs = require('fs');
const path = 'c:/Users/Dell/Desktop/quickpos/inventory/backend/controllers/salesController.js';
let data = fs.readFileSync(path, 'utf8');

const updateSaleCode = `
// Update an existing sale / invoice
exports.updateSale = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { 
    customerId, items, paymentMethod, paidAmount, discount = 0, saleDate, salesmanId, 
    terminalId, currencyCode = 'INR', exchangeRate = 1.0 
  } = req.body;
  let { branchId } = req.body;

  if (!branchId && req.user && req.user.branchId) {
    branchId = req.user.branchId;
  }

  const validBranchId = parseInt(branchId);
  const validSaleId = parseInt(id);

  const existingSale = await prisma.sale.findUnique({
    where: { id: validSaleId },
    include: { items: true, payments: true }
  });

  if (!existingSale) {
    res.status(404);
    throw new Error('Sale not found.');
  }

  // Reverse stock for old items
  await prisma.$transaction(async (tx) => {
    // 1. Reverse old stock impacts
    for (const item of existingSale.items) {
      await tx.productStock.upsert({
        where: {
          branchId_productId: {
            branchId: existingSale.branchId,
            productId: item.productId
          }
        },
        create: {
          branchId: existingSale.branchId,
          productId: item.productId,
          quantity: item.quantity
        },
        update: { quantity: { increment: item.quantity } }
      });
    }

    // 2. Remove old items and payments
    await tx.saleItem.deleteMany({ where: { saleId: validSaleId } });
    await tx.payment.deleteMany({ where: { saleId: validSaleId } });

    // Cancel old vouchers
    await tx.voucher.updateMany({
      where: { reference: existingSale.invoiceNumber },
      data: { status: 'CANCELLED' }
    });

    // 3. Re-calculate Totals for NEW items
    let subTotal = 0;
    let taxAmount = 0;
    const saleItemsData = [];

    for (const item of items) {
      const productId = parseInt(item.productId);
      const product = await tx.product.findUnique({ where: { id: productId } });

      const stock = await tx.productStock.findUnique({
        where: { branchId_productId: { branchId: validBranchId, productId: productId } }
      });

      const unitPrice = item.unitPrice || item.price || 0;
      const netPrice = parseFloat(unitPrice) - parseFloat(item.discountAmount || 0);
      const taxRate = item.taxPercent !== undefined ? parseFloat(item.taxPercent) : parseFloat(product.taxRate || 0);
      const isTaxInclusive = product.isTaxInclusive || false;

      let lineTax = 0;
      let lineTotal = 0;

      if (isTaxInclusive && taxRate > 0) {
        lineTotal = item.quantity * netPrice;
        lineTax = lineTotal - (lineTotal / (1 + (taxRate / 100)));
      } else if (taxRate > 0) {
        lineTotal = item.quantity * netPrice;
        lineTax = (lineTotal * taxRate) / 100;
      } else {
        lineTotal = item.quantity * netPrice;
      }

      subTotal += (lineTotal - (isTaxInclusive ? lineTax : 0));
      taxAmount += lineTax;

      saleItemsData.push({
        productId: productId,
        quantity: item.quantity,
        unitPrice: parseFloat(unitPrice),
        discountPercent: parseFloat(item.discountPercent || 0),
        discountAmount: parseFloat(item.discountAmount || 0),
        total: parseFloat((lineTotal + (!isTaxInclusive ? lineTax : 0)).toFixed(2)),
        taxAmount: parseFloat(lineTax.toFixed(2)),
        taxRate: taxRate
      });
    }

    const calculatedDiscount = parseFloat(discount || 0) > 0 ? parseFloat(discount || 0) : saleItemsData.reduce((sum, item) => sum + ((parseFloat(item.discountAmount) || 0) * (item.quantity)), 0);

    const finalSubTotal = Number(subTotal.toFixed(2));
    const finalTaxAmount = Number(taxAmount.toFixed(2));
    const grandTotal = finalSubTotal + finalTaxAmount - parseFloat(discount || 0) + parseFloat(req.body.roundOffAmount || 0);
    const finalGrandTotal = Number(grandTotal.toFixed(0));
    const finalPaidAmount = parseFloat(paidAmount || 0);

    const updatedSale = await tx.sale.update({
      where: { id: validSaleId },
      data: {
        customer: customerId ? { connect: { id: parseInt(customerId) } } : { disconnect: true },
        paymentMethod,
        discount: calculatedDiscount,
        subTotal: finalSubTotal,
        taxAmount: finalTaxAmount,
        totalAmount: finalGrandTotal,
        roundOffAmount: parseFloat(req.body.roundOffAmount || 0),
        paidAmount: finalPaidAmount,
        balanceAmount: finalGrandTotal - finalPaidAmount,
        status: (finalGrandTotal - finalPaidAmount) > 0.5 ? 'partial' : 'completed',
        items: { create: saleItemsData }
      },
      include: { customer: true, items: { include: { product: true } } }
    });

    // Accounting & Stock
    const { processSalePosting } = require('../utils/accountingHelper');
    try {
      await processSalePosting(tx, updatedSale, req.user ? req.user.id : 1);
    } catch (e) { console.error('Accounting Error:', e); }

    for (const item of items) {
      await tx.productStock.upsert({
        where: { branchId_productId: { branchId: validBranchId, productId: parseInt(item.productId) } },
        create: {
          branchId: validBranchId,
          productId: parseInt(item.productId),
          quantity: -item.quantity
        },
        update: { quantity: { decrement: item.quantity } }
      });
    }

    const paymentsList = req.body.payments || [];
    if (paymentsList.length === 0 && finalPaidAmount > 0) {
      paymentsList.push({ method: paymentMethod, amount: finalPaidAmount });
    }

    for (const p of paymentsList) {
      if (p.amount > 0) {
        await tx.payment.create({
          data: {
            type: 'receipt', amount: parseFloat(p.amount), method: p.method,
            reference: 'Updated Payment', description: \`Payment for Invoice \${updatedSale.invoiceNumber}\`,
            sale: { connect: { id: validSaleId } }, branch: { connect: { id: validBranchId } }
          }
        });
      }
    }
  });

  res.status(200).json({ message: 'Sale updated successfully' });
});

`;

if (!data.includes('exports.updateSale = asyncHandler')) {
  data += updateSaleCode;
  fs.writeFileSync(path, data);
  console.log('Appended updateSale');
} else {
  console.log('updateSale already exists');
}
