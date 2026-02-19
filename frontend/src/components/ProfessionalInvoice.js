
import React, { useMemo } from 'react';

// Indian Number to Words conversion
const numberToWords = (num) => {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
        'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    if (num === 0) return 'Zero';

    const convertLessThanThousand = (n) => {
        if (n === 0) return '';
        if (n < 20) return ones[n];
        if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
        return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + convertLessThanThousand(n % 100) : '');
    };

    const convert = (n) => {
        if (n < 1000) return convertLessThanThousand(n);
        if (n < 100000) return convertLessThanThousand(Math.floor(n / 1000)) + ' Thousand ' + convertLessThanThousand(n % 1000);
        if (n < 10000000) return convertLessThanThousand(Math.floor(n / 100000)) + ' Lakh ' + convert(n % 100000);
        return convertLessThanThousand(Math.floor(n / 10000000)) + ' Crore ' + convert(n % 10000000);
    };

    const rupees = Math.floor(num);
    const paise = Math.round((num - rupees) * 100);

    let result = convert(rupees) + ' Rupees';
    if (paise > 0) {
        result += ' and ' + convert(paise) + ' Paise';
    }
    return result + ' Only';
};

const ProfessionalInvoice = React.forwardRef(({ printData, companyProfile }, ref) => {
    if (!printData) return null;

    const {
        invoiceNumber, saleDate, items, subTotal, taxAmount, totalAmount, roundOffAmount,
        customer, customerName, previousBalance, currentBalance, placeOfSupply
    } = printData;

    const amountInWords = useMemo(() => numberToWords(parseFloat(totalAmount || 0)), [totalAmount]);

    // Breakdown taxes for footer
    const taxBreakdown = useMemo(() => {
        const breakdown = {};
        items?.forEach(item => {
            const rate = parseFloat(item.taxRate || 0);
            const lineTax = parseFloat(item.taxAmount || 0);
            const taxable = parseFloat(item.total) - lineTax;

            if (!breakdown[rate]) {
                breakdown[rate] = { taxableAmount: 0, taxAmount: 0 };
            }
            breakdown[rate].taxableAmount += taxable;
            breakdown[rate].taxAmount += lineTax;
        });
        return breakdown;
    }, [items]);

    return (
        <div ref={ref} className="p-6 bg-white text-black text-[12px] leading-tight" style={{ width: '210mm', minHeight: '148mm', fontFamily: 'Arial, sans-serif' }}>
            {/* Header */}
            <div className="text-center mb-4">
                <h1 className="text-[20px] font-bold uppercase mb-1">{companyProfile?.companyName || 'ABS HARDWARE'}</h1>
                <p className="mb-0.5">{companyProfile?.address || 'Ayiramkolly, Ambalavayal, Wayanad'}</p>
                <p className="mb-0.5">Ph. no: {companyProfile?.phone || '7510133133'}</p>
                <p className="font-semibold uppercase">GSTIN: {companyProfile?.gstNumber || '32DXHPK3898B1ZF'}, State: {companyProfile?.state || '32-Kerala'}</p>
            </div>

            {/* Title */}
            <div className="text-center mb-4">
                <span className="border border-black px-10 py-1 font-bold text-[14px] uppercase tracking-wider">Tax Invoice</span>
            </div>

            {/* Meta Info */}
            <div className="flex justify-between border-t border-x border-black p-3 pb-2">
                <div className="flex-1">
                    <p className="font-bold text-[11px] mb-1 uppercase">Bill To</p>
                    <p className="font-bold uppercase text-[13px]">{customer?.name || customerName || 'Walk-in Customer'}</p>
                    <p>Contact No. : {customer?.phone || 'N/A'}</p>
                    <p>State: {customer?.state || 'N/A'}</p>
                </div>
                <div className="text-right flex-1">
                    <p className="font-bold text-[11px] mb-1 uppercase text-right">Invoice Details</p>
                    <div className="grid grid-cols-2 gap-x-2 text-right justify-end ml-auto max-w-[200px]">
                        <span className="font-semibold">Invoice No. :</span>
                        <span>{invoiceNumber || 'N/A'}</span>
                        <span className="font-semibold">Date :</span>
                        <span>{new Date(saleDate || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                        <span className="font-semibold">Place of supply :</span>
                        <span>{placeOfSupply || companyProfile?.state || '32-Kerala'}</span>
                    </div>
                </div>
            </div>

            {/* Body Table */}
            <table className="w-full border-collapse border border-black">
                <thead>
                    <tr className="bg-gray-50 uppercase text-[10px]">
                        <th className="border border-black p-1 text-center w-[30px]">#</th>
                        <th className="border border-black p-1 text-left">Item Name</th>
                        <th className="border border-black p-1 text-center w-[100px]">HSN/ SAC</th>
                        <th className="border border-black p-1 text-center w-[60px]">Qty</th>
                        <th className="border border-black p-1 text-right w-[90px]">Price/ Unit</th>
                        <th className="border border-black p-1 text-right w-[60px]">GST</th>
                        <th className="border border-black p-1 text-right w-[100px]">Taxable Amount</th>
                    </tr>
                </thead>
                <tbody>
                    {items?.map((item, index) => {
                        const lineTax = parseFloat(item.taxAmount || 0);
                        const taxable = parseFloat(item.total) - lineTax;
                        return (
                            <tr key={index} className="text-[11px]">
                                <td className="border border-black p-1.5 text-center">{index + 1}</td>
                                <td className="border border-black p-1.5 font-bold uppercase">{item.product?.name || item.name}</td>
                                <td className="border border-black p-1.5 text-center">{item.product?.hsnCode || '-'}</td>
                                <td className="border border-black p-1.5 text-center font-semibold">{item.quantity}</td>
                                <td className="border border-black p-1.5 text-right">₹ {(taxable / item.quantity).toFixed(2)}</td>
                                <td className="border border-black p-1.5 text-right">{item.taxRate}%</td>
                                <td className="border border-black p-1.5 text-right font-semibold">₹ {taxable.toFixed(2)}</td>
                            </tr>
                        );
                    })}
                    {/* Empty rows to fill space if needed, or just standard list */}
                </tbody>
            </table>

            {/* Footer Summary Section */}
            <div className="flex border-x border-b border-black">
                {/* Tax Breakdown (Left) */}
                <div className="flex-1 p-2 border-r border-black">
                    <table className="w-full text-[10px]">
                        <thead>
                            <tr className="text-left text-gray-500 font-semibold border-b border-gray-200">
                                <th className="pb-1 text-left">Tax type</th>
                                <th className="pb-1 text-right">Taxable amount</th>
                                <th className="pb-1 text-center">Rate</th>
                                <th className="pb-1 text-right">Tax amount</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(taxBreakdown).map(([rate, data]) => (
                                <React.Fragment key={rate}>
                                    <tr>
                                        <td className="py-1">SGST</td>
                                        <td className="py-1 text-right">₹ {data.taxableAmount.toFixed(1)}</td>
                                        <td className="py-1 text-center">{parseFloat(rate) / 2}%</td>
                                        <td className="py-1 text-right">₹ {(data.taxAmount / 2).toFixed(2)}</td>
                                    </tr>
                                    <tr>
                                        <td className="py-1">CGST</td>
                                        <td className="py-1 text-right">₹ {data.taxableAmount.toFixed(1)}</td>
                                        <td className="py-1 text-center">{parseFloat(rate) / 2}%</td>
                                        <td className="py-1 text-right">₹ {(data.taxAmount / 2).toFixed(2)}</td>
                                    </tr>
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Amounts (Right) */}
                <div className="w-[300px] p-2 bg-white">
                    <div className="flex justify-between font-semibold mb-1">
                        <span>Sub Total</span>
                        <span>₹ {parseFloat(subTotal || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600 mb-1">
                        <span>Round off</span>
                        <span>₹ {parseFloat(roundOffAmount || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-[14px] border-y border-black py-1 my-1">
                        <span>Total</span>
                        <span>₹ {parseFloat(totalAmount || 0).toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600 mb-0.5">
                        <span>Previous Balance</span>
                        <span>₹ {parseFloat(previousBalance || 0).toFixed(0)}</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                        <span>Current Balance</span>
                        <span>₹ {parseFloat(currentBalance || 0).toFixed(0)}</span>
                    </div>
                </div>
            </div>

            {/* Words */}
            <div className="mt-4">
                <p className="font-bold text-[11px] uppercase mb-1">Invoice Amount In Words</p>
                <p className="italic text-[12px]">{amountInWords}</p>
            </div>

            <div className="mt-12 flex justify-between">
                <div className="w-[150px] border-t border-black pt-1 text-center">
                    <p className="text-[10px] font-bold">Authorized Signatory</p>
                </div>
            </div>
        </div>
    );
});

ProfessionalInvoice.displayName = 'ProfessionalInvoice';

export default ProfessionalInvoice;
