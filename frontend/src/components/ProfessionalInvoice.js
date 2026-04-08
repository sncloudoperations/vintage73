
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

const ProfessionalInvoice = React.forwardRef(({ printData, companyProfile, previewMode = 'Desktop' }, ref) => {
    if (!printData) return null;

    const {
        invoiceNumber, saleDate, items, subTotal, taxAmount, totalAmount, roundOffAmount,
        customer, customerName, previousBalance, currentBalance, placeOfSupply,
        currencyCode, currencySymbol, exchangeRate
    } = printData;

    const currentSymbol = currencySymbol || '₹';
    const settings = printData.settings || {};
    const tpl = settings.template || 'modern';
    const pageSize = settings.pageSize || 'A5';
    const accent = settings.accentColor || '#10b981';

    const isThermal = pageSize === 'Thermal';
    const isA5 = pageSize === 'A5';
    const isA4 = pageSize === 'A4';
    const isMobile = previewMode === 'Mobile';

    const isModern = tpl === 'modern';
    const isClassic = tpl === 'classic';
    const isBold = tpl === 'bold';
    const isMinimal = tpl === 'minimal';
    const exRate = parseFloat(exchangeRate) || 1;
    const formatAmt = (amt) => (parseFloat(amt || 0) * exRate).toFixed(2);

    // Use stored discount from DB — single source of truth, do NOT recalculate
    const invoiceDiscount = parseFloat(printData.discount || 0);

    const taxBreakdown = useMemo(() => {
        const breakdown = {};
        items?.forEach(item => {
            const rate = parseFloat(item.taxRate || 0);
            const lineTax = parseFloat(item.taxAmount || 0);
            const taxable = (parseFloat(item.total) || 0) - lineTax;
            if (!breakdown[rate]) {
                breakdown[rate] = { taxableAmount: 0, taxAmount: 0 };
            }
            breakdown[rate].taxableAmount += taxable;
            breakdown[rate].taxAmount += lineTax;
        });
        return breakdown;
    }, [items]);

    const getContainerStyle = () => {
        const base = {
            width: isThermal ? '80mm' : (isA5 ? '148mm' : '210mm'),
            minHeight: isThermal ? 'auto' : (isA5 ? '210mm' : '297mm'),
            padding: isThermal ? '4mm' : (isA5 ? '4mm 12mm 12mm 12mm' : '5mm 18mm 15mm 18mm'),
            fontSize: isThermal ? '10px' : (isA5 ? '12px' : '13px'),
            backgroundColor: 'white',
            color: '#1f2937',
            margin: isMobile ? '0' : '0 auto',
            boxSizing: 'border-box',
            position: 'relative',
            fontFamily: isThermal ? 'monospace' : "'Inter', system-ui, sans-serif"
        };

        if (isMobile) {
            base.width = '100%';
            base.minHeight = 'auto';
            base.padding = '15px';
            base.fontSize = '12px';
        }

        if (isClassic && !isThermal) {
            base.border = '2px solid black';
        }

        return base;
    };

    // Shared Typography Scale (Slightly improved readability)
    const s_Title = "text-[21px] font-bold tracking-[0.5px] uppercase";
    const s_Company = "text-[17px] font-semibold leading-tight mb-1";
    const s_AddressLabel = "text-[12.5px] text-[#6b7280] leading-[1.6]";
    const s_SecHead = "text-[12.5px] font-bold uppercase tracking-wider mb-2.5";
    const s_Label = "text-[12.5px] font-medium text-[#6b7280]";
    const s_Value = "text-[13.5px] font-bold text-[#1f2937] leading-[1.6]";
    const s_TableTh = "px-2.5 text-[10.5px] font-bold uppercase tracking-wider";
    const s_TableTd = "py-2 px-2.5 text-[12.5px] font-medium border-b border-slate-50";
    const s_TotalBox = "text-[14px] font-bold";
    const s_GrandTotal = "text-[18px] font-bold";

    if (isThermal) {
        return (
            <div ref={ref} style={getContainerStyle()} className="thermal-invoice">
                <style>{`@media print { @page { size: 80mm auto; margin: 0; } body { margin: 0; } .thermal-invoice { width: 80mm !important; margin: 0 !important; padding: 4mm !important; } }`}</style>
                <div className="text-center border-b border-dashed border-black pb-2 mb-4">
                    {settings.showLogo !== false && (
                        companyProfile?.logoUrl ? (
                            <img src={companyProfile.logoUrl} alt="Logo" className="w-8 h-8 object-contain mx-auto mb-1" />
                        ) : (
                            <div className="w-8 h-8 border border-black rounded flex items-center justify-center text-[8px] font-bold mx-auto mb-1 uppercase tracking-tighter">Logo</div>
                        )
                    )}
                    {settings.showCompanyName !== false && <h2 className="text-[14px] font-bold uppercase">{companyProfile?.companyName || 'OUR STORE'}</h2>}
                    <p className="text-[10px]">{companyProfile?.address}</p>
                    <p className="text-[10px]">Ph: {companyProfile?.phone}</p>
                    <div className="border-t border-b border-black py-1 mt-1 font-bold">{settings.headerTitle || 'TAX INVOICE'}</div>
                </div>
                <div className="text-[10px] mb-4">
                    <div className="flex justify-between"><span>Inv: {invoiceNumber || ''}</span><span>{saleDate ? new Date(saleDate).toLocaleDateString() : ''}</span></div>
                    <div className="font-bold mt-1">Bill To: {customer?.name || customerName || 'Walk-in'}</div>
                </div>
                <table className="w-full text-[10px] border-b border-dashed border-black mb-4">
                    <thead><tr><th className="text-left font-bold py-1">Item</th><th className="text-right font-bold w-12 py-1">Qty</th><th className="text-right font-bold w-16 py-1">Amt</th></tr></thead>
                    <tbody>{items?.map((item, i) => (<tr key={i}><td className="py-1">{item.product?.name || item.name || 'Item'}</td><td className="text-right py-1">{item.quantity || 0}</td><td className="text-right py-1">{currentSymbol}{formatAmt(item.total)}</td></tr>))}</tbody>
                </table>
                <div className="space-y-1 text-[11px] font-bold flex flex-col items-end">
                    <div className="flex justify-between w-full"><span>Subtotal:</span><span>{currentSymbol}{formatAmt(subTotal)}</span></div>
                    {invoiceDiscount > 0 && (
                        <div className="flex justify-between w-full"><span>Discount:</span><span>- {currentSymbol}{formatAmt(invoiceDiscount)}</span></div>
                    )}
                    <div className="flex justify-between w-full text-[13px] border-t border-black pt-1 mt-1 font-black"><span>TOTAL:</span><span>{currentSymbol}{formatAmt(totalAmount)}</span></div>
                </div>
                <div className="text-center mt-4 pt-2 border-t border-dashed border-black text-[9px] font-bold tracking-widest"><p>{settings.footerText || settings.footerNote || 'THANK YOU!'}</p></div>
            </div>
        );
    }

    return (
        <div ref={ref} style={getContainerStyle()} className={`professional-invoice leading-normal`}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
                @media print {
                    @page { 
                        size: ${pageSize === 'A4' ? '210mm 297mm' : '148mm 210mm'}; 
                        margin: 0; 
                    }
                    body { margin: 0 !important; -webkit-print-color-adjust: exact; background: #fff !important; }
                    .professional-invoice {
                        width: ${isA4 ? '210mm' : '148mm'} !important;
                        min-height: ${isA4 ? '297mm' : '210mm'} !important;
                        box-shadow: none !important; 
                        margin: 0 !important;
                        border: none !important;
                    }
                }
                .professional-invoice { font-family: 'Inter', sans-serif !important; }
            `}</style>

            {/* HEADER AREA */}
            <div className={`flex justify-between items-start mb-6`}>
                <div className="flex-1">
                    {settings.showLogo !== false && (
                        companyProfile?.logoUrl ? (
                            <img src={companyProfile.logoUrl} alt="Logo" style={{ width: '140px', height: 'auto', objectFit: 'contain' }} />
                        ) : (
                            <div style={{ width: '140px', height: '140px' }} className="bg-white rounded-xl flex items-center justify-center font-bold text-slate-300 border border-slate-100 shadow-sm uppercase text-[9px] tracking-widest">Logo</div>
                        )
                    )}
                </div>
                <div className="text-right flex-1">
                    <h1 className={`${s_Title} mb-2`} style={{ color: (isBold || isModern) ? accent : '#1f2937' }}>
                        {settings.headerTitle || 'TAX INVOICE'}
                    </h1>
                    {settings.showCompanyName !== false && (
                        <p className={s_Company}>{companyProfile?.companyName || 'Your Company Name'}</p>
                    )}
                    {settings.showAddress !== false && (
                        <div className={s_AddressLabel}>
                            <p>{companyProfile?.address || ''}</p>
                            <p>{companyProfile?.phone ? `+91 ${companyProfile.phone}` : ''}</p>
                        </div>
                    )}
                </div>
            </div>

            {/* BILL TO & INVOICE DETAILS */}
            <div className={`flex mb-10 gap-x-20 ${isMinimal ? '' : 'border-t border-slate-100 pt-8'}`}>
                {settings.showCustomer !== false && (
                    <div className={`flex-1 ${isMinimal ? '' : 'border-r border-slate-100 pr-8'}`}>
                        <p className={`${s_SecHead}`} style={(isBold || isModern) ? { color: accent } : { color: '#94a3b8' }}>Bill To</p>
                        <div className="space-y-1">
                            <p className={s_Value}>{customer?.name || customerName || 'Walk-in'}</p>
                            {customer?.phone && <p className={s_AddressLabel}>📞 {customer.phone}</p>}
                            {customer?.address && <p className={s_AddressLabel}>{customer.address}{customer.city ? `, ${customer.city}` : ''}{customer.state ? `, ${customer.state}` : ''}{customer.pincode ? ` - ${customer.pincode}` : ''}</p>}
                            {customer?.gstin && <p className={`${s_Label} font-semibold`}>GSTIN: {customer.gstin}</p>}
                            {customer?.email && <p className={s_AddressLabel}>{customer.email}</p>}
                        </div>
                    </div>
                )}
                {settings.showInvoiceMeta !== false && (
                    <div className="flex-1 pl-4">
                        <p className={`${s_SecHead}`} style={(isBold || isModern) ? { color: accent } : { color: '#94a3b8' }}>Invoice Details</p>
                        <div className="space-y-2">
                            <div className="flex items-center gap-6">
                                <span className={s_Label}>Invoice No:</span>
                                <span className={s_Value}>{invoiceNumber || ''}</span>
                            </div>
                            <div className="flex items-center gap-6">
                                <span className={s_Label}>Date:</span>
                                <span className={s_Value} style={{ letterSpacing: '0.2px' }}>{saleDate ? new Date(saleDate).toLocaleDateString('en-GB') : ''}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* ITEMS TABLE */}
            <div className={`mb-8`}>
                <table className={`w-full ${(isBold || isModern) ? 'border-separate border-spacing-0' : 'border-collapse'}`}>
                    <thead>
                        <tr className={(isBold || isModern) ? 'text-white' : ''} style={(isBold || isModern) ? { backgroundColor: accent, height: (isBold || isModern) ? '36px' : 'auto' } : { backgroundColor: isMinimal ? 'white' : '#f9fbfd' }}>
                            <th className={`${s_TableTh} text-left ${isMinimal ? 'border-b border-slate-200' : isBold ? 'rounded-l-lg' : 'rounded-l-lg'}`}>{isBold ? 'DESCRIPTION' : 'Description'}</th>
                            {settings.showColQty !== false && <th className={`${s_TableTh} text-center w-14 ${isMinimal ? 'border-b border-slate-200' : ''}`}>{isBold ? 'QTY' : 'Qty'}</th>}
                            {settings.showColPrice !== false && <th className={`${s_TableTh} text-center w-24 ${isMinimal ? 'border-b border-slate-200' : ''}`}>{isBold ? 'PRICE' : 'Price'}</th>}
                            {settings.showColTax !== false && parseFloat(taxAmount || 0) > 0 && <th className={`${s_TableTh} text-center w-16 ${isMinimal ? 'border-b border-slate-200' : ''}`}>{isBold ? 'GST%' : 'Gst %'}</th>}
                            {settings.showColTotal !== false && <th className={`${s_TableTh} text-right w-28 ${isMinimal ? 'border-b border-slate-200' : isBold ? 'rounded-r-lg' : 'rounded-r-lg'}`}>{isBold ? 'TOTAL' : 'Total'}</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {items?.map((item, idx) => (
                            <tr key={idx} className="border-b border-transparent">
                                <td className={`${s_TableTd} text-left font-bold text-slate-800`}>{item.product?.name || item.name || 'Item'}</td>
                                {settings.showColQty !== false && <td className={`${s_TableTd} text-center font-semibold text-slate-600`}>{item.quantity || 0}</td>}
                                {settings.showColPrice !== false && <td className={`${s_TableTd} text-center text-slate-400 font-medium`}>{currentSymbol}{formatAmt(item.unitPrice)}</td>}
                                {settings.showColTax !== false && parseFloat(taxAmount || 0) > 0 && <td className={`${s_TableTd} text-center text-slate-400 font-medium`}>{parseFloat(item.taxRate || 0)}%</td>}
                                {settings.showColTotal !== false && <td className={`${s_TableTd} text-right font-bold text-slate-800`}>{currentSymbol}{formatAmt((parseFloat(item.unitPrice) - parseFloat(item.discountAmount || 0)) * (parseFloat(item.quantity) || 0))}</td>}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* TAX & TOTALS */}
            <div className="flex justify-between items-start mb-8">
                <div className="w-[42%]">
                    {settings.showTaxSummary !== false && parseFloat(taxAmount || 0) > 0 && Object.entries(taxBreakdown).filter(([rate]) => parseFloat(rate) > 0).length > 0 && (
                        <div className={`bg-[#f8fafc] p-3.5 rounded-xl border border-slate-100`}>
                            <p className={`${s_SecHead} mb-1.5`} style={(isBold || isModern) ? { color: accent } : { color: '#94a3b8' }}>{isBold ? 'TAX SUMMARY' : 'Tax Summary'}</p>
                            <div className={`space-y-1 text-[10px]`}>
                                {Object.entries(taxBreakdown)
                                    .filter(([rate]) => parseFloat(rate) > 0)
                                    .map(([rate, data]) => (
                                        <React.Fragment key={rate}>
                                            <div className="flex justify-between font-normal text-slate-500">
                                                <span>CGST ({parseFloat(rate) / 2}%)</span>
                                                <span className="font-semibold text-slate-700">{currentSymbol}{formatAmt(data.taxAmount / 2)}</span>
                                            </div>
                                            <div className="flex justify-between font-normal text-slate-500">
                                                <span>SGST ({parseFloat(rate) / 2}%)</span>
                                                <span className="font-semibold text-slate-700">{currentSymbol}{formatAmt(data.taxAmount / 2)}</span>
                                            </div>
                                        </React.Fragment>
                                    ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className={`w-[260px] p-4 rounded-xl bg-[#f8fafc] border border-slate-100 ${isBold ? 'border-l-[4px]' : isModern ? 'border-t-2' : isClassic ? 'border-2 border-black' : ''}`} style={isBold ? { borderLeftColor: accent } : isModern ? { borderTopColor: accent } : {}}>
                    <div className="space-y-1 mb-2">
                        <div className="flex justify-between text-slate-400 text-[11px] font-medium tracking-tight">
                            <span>Subtotal</span>
                            <span className="font-semibold text-slate-700">{currentSymbol}{formatAmt(parseFloat(subTotal) + parseFloat(invoiceDiscount))}</span>
                        </div>
                        {Number(invoiceDiscount) > 0 && (
                            <div className="flex justify-between text-slate-400 text-[11px] font-medium tracking-tight mt-1">
                                <span>Discount</span>
                                <span className="font-semibold text-red-500">- {currentSymbol}{(Number(invoiceDiscount) * (parseFloat(exchangeRate) || 1)).toFixed(2)}</span>
                            </div>
                        )}
                        {parseFloat(taxAmount || 0) > 0 && (
                            <div className="flex justify-between text-slate-400 text-[11px] font-medium tracking-tight">
                                <span>Total Tax</span>
                                <span className="font-semibold text-slate-700">{currentSymbol}{formatAmt(taxAmount)}</span>
                            </div>
                        )}
                    </div>
                    <div className={`pt-2.5 border-t border-slate-200/50 flex justify-between items-center mt-1`}>
                        <span className="font-bold uppercase tracking-tight text-[12px]" style={(isBold || isModern) ? { color: accent } : { color: '#10b981' }}>GRAND TOTAL</span>
                        <span className="font-bold text-[16px] tracking-tighter" style={(isBold || isModern) ? { color: accent } : { color: '#10b981' }}>{currentSymbol}{formatAmt(totalAmount)}</span>
                    </div>
                </div>
            </div>

            {/* FOOTER */}
            <div className={`mt-auto pt-8 border-t border-slate-50 flex justify-between items-end`}>
                <div className="flex-1">
                    <p className={`${s_SecHead} mb-1.5`} style={isBold ? { color: accent } : { color: '#94a3b8' }}>Terms</p>
                    <p className="text-[12px] text-slate-400 leading-relaxed max-w-[380px] font-normal">{settings.termsConditions || 'Goods once sold will not be taken back.'}</p>
                </div>
                <div className="text-right text-slate-300 font-medium italic text-[14px] opacity-80">
                    {settings.footerText || settings.footerNote || 'Thank you for your business!'}
                </div>
            </div>
        </div>
    );
});

ProfessionalInvoice.displayName = 'ProfessionalInvoice';
export default ProfessionalInvoice;
