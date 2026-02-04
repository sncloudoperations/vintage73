const prisma = require('../utils/prismaClient');
const { ensureLedger, postVoucher } = require('../utils/accountingHelper');

// Create new sale
exports.createSale = async (req, res) => {
  const { customerId, items, paymentMethod, paidAmount, discount = 0, saleDate, branchId, salesmanId } = req.body;

  if (!branchId) {
    return res.status(400).json({ error: 'Branch selection is required' });
  }

  try {
    let customer = null;
    if (customerId) {
      customer = await prisma.customer.findUnique({ where: { id: parseInt(customerId) } });
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Calculate Totals
      let subTotal = 0;
      let taxAmount = 0;
      const saleItemsData = [];

      for (const item of items) {
        const productId = parseInt(item.productId);
        const product = await tx.product.findUnique({ where: { id: productId } });
        if (!product) {
          throw new Error(`STATUS_404: Product with ID ${productId} not found.`);
        }

        // Stock check
        const productStock = await tx.productStock.findUnique({
          where: {
            branchId_productId: {
              branchId: parseInt(branchId),
              productId: productId
            }
          }
        });

        if (!productStock || productStock.quantity < item.quantity) {
          throw new Error(`STATUS_400: Insufficient stock for product: ${product.name} in this branch`);
        }

        const netPrice = parseFloat(item.unitPrice) - parseFloat(item.discountAmount || 0);
        const taxRate = parseFloat(product.taxRate || 0);
        const isTaxInclusive = product.isTaxInclusive || false;

        let lineTax = 0;
        let lineTotal = 0;

        if (isTaxInclusive && taxRate > 0) {
            // Price includes tax: Tax = TotalPrice - (TotalPrice / (1 + Rate))
            lineTotal = item.quantity * netPrice;
            lineTax = lineTotal - (lineTotal / (1 + (taxRate / 100)));
        } else if (taxRate > 0) {
            // Price excludes tax: Tax = TotalPrice * Rate
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
          unitPrice: parseFloat(item.unitPrice),
          discountPercent: parseFloat(item.discountPercent || 0),
          discountAmount: parseFloat(item.discountAmount || 0),
          total: parseFloat((lineTotal + (!isTaxInclusive ? lineTax : 0)).toFixed(2)),
          taxAmount: parseFloat(lineTax.toFixed(2)),
          taxRate: parseFloat(taxRate)
        });
      }

    const grandTotal = subTotal + taxAmount - parseFloat(discount) + parseFloat(req.body.roundOffAmount || 0);
      const finalPaidAmount = parseFloat(paidAmount || 0);
      const roundOffAmount = parseFloat(req.body.roundOffAmount || 0);

      // 2. Calculate Incentive
      let incentiveAmount = 0;
      // Ensure salesmanId is a valid number before using
      const validSalesmanId = (salesmanId && !isNaN(parseInt(salesmanId))) ? parseInt(salesmanId) : null;
      
      if (validSalesmanId) {
        const salesman = await tx.user.findUnique({ where: { id: validSalesmanId } });
        if (salesman && salesman.incentivePercentage > 0) {
           incentiveAmount = (grandTotal * parseFloat(salesman.incentivePercentage)) / 100;
        }
      }

      // 3. Create Sale Record
      const sale = await tx.sale.create({
        data: {
          invoiceNumber: `INV-${Date.now()}`,
          customerId: customer ? customer.id : null,
          paymentMethod,
          subTotal,
          taxAmount,
          totalAmount: grandTotal,
          roundOffAmount,
          paidAmount: finalPaidAmount,
          balanceAmount: grandTotal - finalPaidAmount,
          saleDate: saleDate ? new Date(saleDate) : new Date(),
          branchId: parseInt(branchId),
          salesmanId: validSalesmanId,
          incentiveAmount: incentiveAmount,
          status: (grandTotal - finalPaidAmount) > 0.5 ? 'partial' : 'completed',
          items: {
            create: saleItemsData
          }
        },
        include: {
          customer: true,
          items: {
            include: {
              product: true
            }
          }
        }
      });

      // --- ACCOUNTING INTEGRATION ---
      try {
        const saleAmount = parseFloat(grandTotal);
        const userId = req.user ? req.user.id : 1; // Assuming authMiddleware populates req.user

        // 1. Get/Create Customer Ledger
        let customerLedgerId;
        if (customer) {
            const ledger = await ensureLedger(tx, customer.name, 'Sundry Debtors');
            customerLedgerId = ledger.id;
        } else {
            // Cash Sale - Use "Cash Balance" or similar dummy Customer if needed,
            // OR directly debit Cash.
            // Professional practice: 'Cash Sales' ledger or 'Walk-in Customer' ledger.
            // Let's assume a generic 'Walk-in Customer' ledger in Debtors.
            const ledger = await ensureLedger(tx, 'Walk-in Customer', 'Sundry Debtors');
            customerLedgerId = ledger.id;
        }

        // 2. Get Income Ledger (Sales Account)
        const salesLedger = await ensureLedger(tx, 'Sales Account', 'Sales Accounts');

        // 3. Prepare Entries for SALES Voucher
        // Debit: Customer (Total Amount)
        // Credit: Sales Account (Subtotal - Discount) OR (Total - Tax)
        // Credit: Output Tax (Tax Amount)
        
        // Note: Logic depends on if we track Tax separately.
        const saleEntries = [
            { ledgerId: customerLedgerId, type: 'DEBIT', amount: saleAmount }
        ];

        if (taxAmount > 0) {
            // Credit Sales (Net)
            saleEntries.push({ ledgerId: salesLedger.id, type: 'CREDIT', amount: subTotal });
            
            // Credit Tax (GST Split)
            // Default to 'INTRA' (Local) if not specified.
            const taxType = req.body.taxType || 'INTRA'; 
            
            if (taxType === 'INTER') {
                // IGST (100%)
                const igstLedger = await ensureLedger(tx, 'Output IGST', 'Duties & Taxes');
                saleEntries.push({ ledgerId: igstLedger.id, type: 'CREDIT', amount: taxAmount });
            } else {
                // CGST + SGST (50% each)
                // Use precise math for split to avoid floating point issues if od
                const halfTax = parseFloat((taxAmount / 2).toFixed(2));
                const otherHalf = taxAmount - halfTax; // Ensure sum matches exactly
                
                const cgstLedger = await ensureLedger(tx, 'Output CGST', 'Duties & Taxes');
                const sgstLedger = await ensureLedger(tx, 'Output SGST', 'Duties & Taxes');
                
                saleEntries.push({ ledgerId: cgstLedger.id, type: 'CREDIT', amount: halfTax });
                saleEntries.push({ ledgerId: sgstLedger.id, type: 'CREDIT', amount: otherHalf });
            }
            
            // Handle differences due to Round Off
            // Handle differences (Round Off or Calculation Mismatch)
            // Logic: Total Debit (Sale Amount) MUST equal Total Credit (SubTotal + Tax + Balancing).
            const currentCredit = subTotal + taxAmount;
            const diff = saleAmount - currentCredit;
            
            if (Math.abs(diff) > 0.01) {
                 if (diff > 0) {
                     // Need more Credit (Income) to match Debit
                     // e.g. Total 100, Sub+Tax = 99. Diff = 1.
                     // Add 1 to Sales Account or Round Off Income.
                     // Using Sales Account to keep it simple and balance.
                     const salesEntry = saleEntries.find(e => e.ledgerId === salesLedger.id);
                     if (salesEntry) {
                         salesEntry.amount += diff;
                     } else {
                         saleEntries.push({ ledgerId: salesLedger.id, type: 'CREDIT', amount: diff });
                     }
                 } else {
                     // Need less Credit or more Debit
                     // e.g. Total 99, Sub+Tax = 100. Diff = -1.
                     // We can Debit 'Round Off Expense' for 1.
                     // OR Reduce Sales Credit.
                     
                     // Let's Debit Round Off Expense for clarity
                     const roLedger = await ensureLedger(tx, 'Round Off', 'Indirect Expenses');
                     saleEntries.push({ ledgerId: roLedger.id, type: 'DEBIT', amount: Math.abs(diff) });
                 }
            }
        } else {
             // Exempt Sale
             saleEntries.push({ ledgerId: salesLedger.id, type: 'CREDIT', amount: saleAmount });
        }

        await postVoucher(tx, {
            type: 'SALES',
            date: saleDate ? new Date(saleDate) : new Date(),
            amount: saleAmount,
            narration: `Sales Invoice #${sale.invoiceNumber}`,
            reference: sale.invoiceNumber,
            createdBy: userId
        }, saleEntries);


        // 4. Handle PAYMENT (Receipt Voucher)
        // If finalPaidAmount > 0
        if (finalPaidAmount > 0) {
             const payMethod = paymentMethod || 'Cash';
             let assetLedgerName = 'Cash';
             let assetGroupName = 'Cash-in-Hand';

             if (payMethod.toLowerCase().includes('online') || payMethod.toLowerCase().includes('bank') || payMethod.toLowerCase().includes('card')) {
                 assetLedgerName = 'Bank Account';
                 assetGroupName = 'Bank Accounts';
             }

             const assetLedger = await ensureLedger(tx, assetLedgerName, assetGroupName);

             await postVoucher(tx, {
                type: 'RECEIPT',
                date: saleDate ? new Date(saleDate) : new Date(),
                amount: finalPaidAmount,
                narration: `Payment for #${sale.invoiceNumber}`,
                reference: sale.invoiceNumber,
                createdBy: userId
             }, [
                 { ledgerId: assetLedger.id, type: 'DEBIT', amount: finalPaidAmount },
                 { ledgerId: customerLedgerId, type: 'CREDIT', amount: finalPaidAmount }
             ]);
        }

      } catch (accErr) {
          console.error("Accounting Integration Failed:", accErr);
          // Don't fail the sale? Or Should we? 
          // Better to throw so data is consistent.
          throw new Error('Accounting Error: ' + accErr.message);
      }
      for (const item of items) {
        await tx.productStock.update({
          where: {
            branchId_productId: {
              branchId: parseInt(branchId),
              productId: parseInt(item.productId)
            }
          },
          data: {
            quantity: { decrement: item.quantity }
          }
        });
      }

      // 5. Record Payment (if any)
      const paymentsList = req.body.payments || [];
      
      // If no detailed payments array, fallback to single payment structure
      if (paymentsList.length === 0 && finalPaidAmount > 0) {
          paymentsList.push({
              method: paymentMethod,
              amount: finalPaidAmount
          });
      }

      // Create Payment Records
      for (const p of paymentsList) {
          if (p.amount > 0) {
            await tx.payment.create({
              data: {
                type: 'receipt',
                amount: parseFloat(p.amount),
                method: p.method,
                reference: 'Initial Payment',
                description: `Payment for Invoice ${sale.invoiceNumber}`,
                saleId: sale.id,
                branchId: parseInt(branchId),
                customerId: customer ? customer.id : null
              }
            });
          }
      }

      return sale;
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('Create Sale Error:', error);
    if (error.message.startsWith('STATUS_400:')) {
        return res.status(400).json({ error: error.message.replace('STATUS_400: ', '') });
    }
    if (error.message.startsWith('STATUS_404:')) {
        return res.status(404).json({ error: error.message.replace('STATUS_404: ', '') });
    }
    res.status(500).json({ error: error.message });
  }
};

exports.getAllSales = async (req, res) => {
  const { branchId, startDate, endDate } = req.query;
  try {
    const where = {};
    if (branchId) where.branchId = parseInt(branchId);
    if (startDate && endDate) {
      where.saleDate = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      };
    }

    const sales = await prisma.sale.findMany({
      where,
      include: {
        customer: true,
        items: { include: { product: true } },
        salesman: { select: { name: true } } // Include salesman name
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(sales);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Cancel Sale (Invoice)
exports.cancelSale = async (req, res) => {
  const { id } = req.params;
  const { cancelledBy, cancelReason } = req.body;
  
  try {
    const sale = await prisma.sale.findUnique({
      where: { id: parseInt(id) },
      include: { items: true }
    });

    if (!sale) return res.status(404).json({ message: 'Sale not found' });
    if (sale.status === 'cancelled') return res.status(400).json({ message: 'Sale is already cancelled' });

    await prisma.$transaction(async (tx) => {
      // 1. Update Sale Status and metadata
      await tx.sale.update({
        where: { id: parseInt(id) },
        data: { 
          status: 'cancelled', 
          balanceAmount: 0,
          cancelledAt: new Date(),
          cancelledBy: cancelledBy || 'Unknown Admin',
          cancelReason: cancelReason || 'No reason provided'
        }
      });

      // 2. Restock Items in Branch
      for (const item of sale.items) {
        await tx.productStock.update({
          where: {
            branchId_productId: {
              branchId: sale.branchId,
              productId: item.productId
            }
          },
          data: { quantity: { increment: item.quantity } }
        });
      }

      // 3. Remove associated Receipts from Accounts
      await tx.payment.deleteMany({
        where: { saleId: parseInt(id) }
      });

      // --- ACCOUNTING INTEGRATION ---
      // Cancel associated Vouchers (Sales & Receipts)
      await tx.voucher.updateMany({
        where: { reference: sale.invoiceNumber },
        data: { status: 'CANCELLED' }
      });
    });

    res.json({ message: 'Invoice cancelled and stock restored successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
