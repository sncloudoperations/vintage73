const prisma = require('../utils/prismaClient');

// Get all customers with outstanding balance
exports.getDebtors = async (req, res) => {
    try {
        const debtors = await prisma.customer.findMany({
            where: {
                sales: {
                    some: {
                        balanceAmount: { gt: 0 }
                    }
                }
            },
            include: {
                sales: {
                    where: {
                        balanceAmount: { gt: 0 },
                        status: { not: 'cancelled' }
                    },
                    select: {
                        id: true,
                        invoiceNumber: true,
                        saleDate: true,
                        totalAmount: true,
                        paidAmount: true,
                        balanceAmount: true
                    }
                }
            }
        });

        // Calculate total debt for each customer
        const formattedDebtors = debtors.map(customer => {
            const totalDebt = customer.sales.reduce((sum, sale) => sum + Number(sale.balanceAmount), 0);
            return {
                ...customer,
                totalDebt,
                pendingInvoices: customer.sales.length
            };
        }).filter(c => c.totalDebt > 0); // Double check

        res.json(formattedDebtors);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Settle Credit (Pay outstanding amount)
exports.settleCredit = async (req, res) => {
    const { customerId, amount, paymentMethod, reference, notes } = req.body;
    
    // Validate inputs
    if (!customerId || !amount || amount <= 0) {
        return res.status(400).json({ error: "Invalid customer or amount" });
    }

    try {
        const result = await prisma.$transaction(async (tx) => {
            const payAmount = parseFloat(amount);
            
            // 1. Get Customer Pending Sales (FIFO)
            const pendingSales = await tx.sale.findMany({
                where: {
                    customerId: parseInt(customerId),
                    balanceAmount: { gt: 0 },
                    status: { not: 'cancelled' }
                },
                orderBy: { saleDate: 'asc' } // Oldest first
            });

            if (pendingSales.length === 0) {
                throw new Error("No outstanding debt found for this customer");
            }

            let remainingPayment = payAmount;
            const updatedSales = [];

            // 2. Allocate Payment to Sales
            for (const sale of pendingSales) {
                if (remainingPayment <= 0) break;

                const pending = parseFloat(sale.balanceAmount);
                const deduction = Math.min(remainingPayment, pending);
                
                // Update Sale
                const updatedSale = await tx.sale.update({
                    where: { id: sale.id },
                    data: {
                        balanceAmount: { decrement: deduction },
                        paidAmount: { increment: deduction },
                        status: (pending - deduction) <= 0.01 ? 'completed' : 'partial'
                    }
                });
                updatedSales.push(updatedSale);
                
                remainingPayment -= deduction;
            }

            // 3. Create Payment Record (Accounts Effect)
            // Even if it's an overpayment (remainingPayment > 0), we record the full amount received.
            // Overpayment handling could be credited to customer account, but for now we just record it.
            const payment = await tx.payment.create({
                data: {
                    type: 'receipt', // 'receipt' -> Money In
                    amount: payAmount,
                    method: paymentMethod || 'Cash',
                    reference: reference || 'Credit Settlement',
                    description: notes || `Credit Settlement for ${updatedSales.length} invoices`,
                    customerId: parseInt(customerId),
                    branchId: pendingSales[0].branchId, // Use branch from first sale or req.user logic
                    paymentDate: new Date()
                }
            });

            return { payment, settledInvoices: updatedSales.length };
        });

        res.json({ message: "Settlement successful", ...result });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get specific customer credit deatils
exports.getCustomerCredits = async (req, res) => {
    const { id } = req.params;
    try {
        const customer = await prisma.customer.findUnique({
            where: { id: parseInt(id) },
            include: {
                sales: {
                    where: {
                        balanceAmount: { gt: 0 },
                        status: { not: 'cancelled' }
                    },
                    orderBy: { saleDate: 'asc' }
                }
            }
        });
        
        if (!customer) return res.status(404).json({ error: "Customer not found" });

        const totalDebt = customer.sales.reduce((sum, sale) => sum + Number(sale.balanceAmount), 0);

        res.json({ ...customer, totalDebt });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
