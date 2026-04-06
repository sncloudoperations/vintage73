const fs = require('fs');
const path = 'c:/Users/Dell/Desktop/quickpos/inventory/frontend/src/pages/pos.js';
let data = fs.readFileSync(path, 'utf8');
const original = data;

// ─────────────────────────────────────────────────
// 1. Add useRouter import
// ─────────────────────────────────────────────────
if (!data.includes("import { useRouter }")) {
  data = data.replace(
    `import api from '@/lib/api';`,
    `import api from '@/lib/api';\nimport { useRouter } from 'next/router';`
  );
}

// ─────────────────────────────────────────────────
// 2. Add router & editId inside component (after "export default function POS() {")
// ─────────────────────────────────────────────────
if (!data.includes('const router = useRouter()')) {
  data = data.replace(
    'export default function POS() {\n    const [products',
    `export default function POS() {
    const router = useRouter();
    const { editId } = router.query;
    const [products`
  );
}

// ─────────────────────────────────────────────────
// 3. Fix the localStorage restore effect to not override edit data
//    Add a flag to skip restore when editId is present
// ─────────────────────────────────────────────────
// Find the restore effect and add editId guard
data = data.replace(
  `    // Restore POS state on mount or when user changes
    useEffect(() => {
        if (user?.id) {
            const storedPosState = localStorage.getItem(\`pos_state_\${user.id}\`);
            if (storedPosState) {`,
  `    // Restore POS state on mount or when user changes (skip when editing invoice)
    useEffect(() => {
        if (user?.id && !editId) {
            const storedPosState = localStorage.getItem(\`pos_state_\${user.id}\`);
            if (storedPosState) {`
);

// ─────────────────────────────────────────────────
// 4. Add LOAD EDIT SALE useEffect before the CART SYNC EFFECT
// ─────────────────────────────────────────────────
const cartSyncMarker = `    // --- CART SYNC EFFECT ---`;
const editSaleEffect = `
    // LOAD EDIT SALE — fetch invoice by ID and populate POS
    useEffect(() => {
        if (editId && products.length > 0) {
            api.get('/sales?isInvoice=true').then(res => {
                const allSales = Array.isArray(res.data) ? res.data : [];
                const sale = allSales.find(s => s.id === parseInt(editId));
                if (sale) {
                    setCustomerId(sale.customerId || '');
                    setCustomerName(sale.customer?.name || '');
                    setSaleDate(sale.saleDate ? sale.saleDate.split('T')[0] : new Date().toISOString().split('T')[0]);
                    setSalesmanId(sale.salesmanId || '');
                    setRoundOff(parseFloat(sale.roundOffAmount || 0));
                    if (sale.currencyCode) {
                        setCurrencyCode(sale.currencyCode);
                        setCurrencySymbol(CURRENCY_SYMBOLS[sale.currencyCode] || '₹');
                        setExchangeRate(EXCHANGE_RATES[sale.currencyCode] || 1);
                    }
                    const loadedCart = sale.items.map(item => {
                        const product = products.find(p => p.id === item.productId) || item.product;
                        return {
                            id: item.productId,
                            name: product?.name || item.product?.name || 'Unknown Product',
                            price: parseFloat(item.unitPrice || 0),
                            quantity: item.quantity,
                            taxRate: parseFloat(item.taxRate || 0),
                            taxPercent: parseFloat(item.taxRate || 0),
                            isTaxInclusive: product?.isTaxInclusive || false,
                            discountPercent: parseFloat(item.discountPercent || 0),
                            discountAmount: parseFloat(item.discountAmount || 0),
                            stock: product?.stock || 999,
                            stockQuantity: product?.stockQuantity || 999,
                            maxDiscount: product?.maxDiscount ?? null,
                            minDiscount: product?.minDiscount ?? null,
                            _fromInvoice: true  // prevents Cart Sync from overwriting prices/discounts
                        };
                    });
                    setCart(loadedCart);
                } else {
                    toast.error('Invoice not found for editing');
                }
            }).catch(e => console.error('Failed to load invoice for editing', e));
        }
    }, [editId, products.length]);

`;

if (!data.includes('LOAD EDIT SALE')) {
  data = data.replace(cartSyncMarker, editSaleEffect + cartSyncMarker);
}

// ─────────────────────────────────────────────────
// 5. Fix Cart Sync Effect to skip _fromInvoice items
// ─────────────────────────────────────────────────
data = data.replace(
  `    // --- CART SYNC EFFECT ---
    useEffect(() => {
        if (products.length > 0 && cart.length > 0) {
            let hasChanges = false;

            const updatedCart = cart.map(cartItem => {
                const freshProd = products.find(p => p.id === cartItem.id);`,
  `    // --- CART SYNC EFFECT --- (skips items loaded from invoice edit)
    useEffect(() => {
        if (products.length > 0 && cart.length > 0) {
            let hasChanges = false;

            const updatedCart = cart.map(cartItem => {
                if (cartItem._fromInvoice) return cartItem; // preserve invoice-loaded data
                const freshProd = products.find(p => p.id === cartItem.id);`
);

// ─────────────────────────────────────────────────
// 6. Fix handleCheckout to use PUT when editId present
// ─────────────────────────────────────────────────
if (!data.includes('editId ? await api.put') && !data.includes("api.put(`/sales/${editId}`")) {
  data = data.replace(
    `            const res = await api.post('/sales', payload);`,
    `            let res;
            if (editId) {
                res = await api.put(\`/sales/\${editId}\`, payload);
            } else {
                res = await api.post('/sales', payload);
            }`
  );
  data = data.replace(
    `            toast.success('Sale Completed Successfully!');`,
    `            toast.success(editId ? 'Invoice Updated Successfully!' : 'Sale Completed Successfully!');
            if (editId) { router.replace('/sales/invoices'); return; }`
  );
}

// ─────────────────────────────────────────────────
// 7. Add Edit Mode Banner in the right panel header
//    Insert BEFORE the "Cashier Info" comment/div
// ─────────────────────────────────────────────────
const cashierInfoMarker = `                {/* Header: Cashier, Salesman & Customer - Compact View */}
                <div className="bg-white border-b border-slate-200 p-4 space-y-3">`;

const bannerBlock = `                {/* Header: Cashier, Salesman & Customer - Compact View */}
                <div className="bg-white border-b border-slate-200 p-4 space-y-3">
                    {/* Edit Mode Banner — shown when editing an existing invoice */}
                    {editId && (
                        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                            <div className="flex items-center gap-2">
                                <FiEdit2 size={13} className="text-amber-600" />
                                <span className="text-xs font-bold text-amber-700 uppercase tracking-wide">Editing Invoice</span>
                            </div>
                            <button
                                onClick={() => router.replace('/sales/invoices')}
                                className="text-[10px] font-bold text-amber-500 hover:text-amber-700 underline"
                            >
                                Cancel Edit
                            </button>
                        </div>
                    )}`;

if (!data.includes('Editing Invoice') && data.includes(cashierInfoMarker)) {
  data = data.replace(cashierInfoMarker, bannerBlock);
}

if (data === original) {
  console.log('WARNING: No changes were applied — markers may not have matched.');
} else {
  fs.writeFileSync(path, data, 'utf8');
  console.log('pos.js patched successfully!');
}
