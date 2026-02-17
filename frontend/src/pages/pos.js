
import { useState, useEffect, useRef } from 'react';
import api from '@/lib/api';
import { FiSearch, FiUser, FiX, FiPlus, FiTrash2, FiCreditCard, FiMonitor, FiShoppingCart, FiClock, FiCalendar, FiEdit2 } from 'react-icons/fi';
import { useReactToPrint } from 'react-to-print';
import { toast } from 'react-toastify';
import { getTerminalId, checkTerminalAccess } from '@/lib/terminal';
import SearchableSelect from '@/components/SearchableSelect';
import DynamicInvoice from '@/components/DynamicInvoice';

export default function POS() {
    const [products, setProducts] = useState([]);
    const [customers, setCustomers] = useState([]);

    // Parse user from localStorage safely at top level for UI use
    const [user, setUser] = useState(null);
    const [terminal, setTerminal] = useState(null);
    const [branches, setBranches] = useState([]);
    const [selectedBranch, setSelectedBranch] = useState('');

    useEffect(() => {
        const stored = localStorage.getItem('user');
        if (stored) {
            const parsed = JSON.parse(stored);
            setUser(parsed);
            setCashier(parsed);
        }

        // Fetch terminal details
        checkTerminalAccess().then(res => {
            if (res.authorized && res.terminal) {
                setTerminal(res.terminal);
                if (res.terminal.branchId) {
                    setSelectedBranch(res.terminal.branchId);
                }
            }
        });
    }, []);


    // Fetch branches for Admin to populate selector
    useEffect(() => {
        if (user?.role === 'admin') {
            api.get('/branches').then(res => setBranches(res.data)).catch(console.error);
        }
    }, [user]);

    const [cart, setCart] = useState([]);
    const [search, setSearch] = useState('');
    const [customerId, setCustomerId] = useState('');
    const [customerName, setCustomerName] = useState('');
    const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]); // Backdating

    // Salesman Selection
    const [salesmanId, setSalesmanId] = useState('');
    const [availableSalesmen, setAvailableSalesmen] = useState([]);

    // Customer Search
    const [customerSearch, setCustomerSearch] = useState('');
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
    const dropdownRef = useRef(null);

    // New Customer Modal
    const [showCustomerModal, setShowCustomerModal] = useState(false);
    const [newCustomerData, setNewCustomerData] = useState({ name: '', phone: '', email: '', address: '' });

    // Payment Modal
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentData, setPaymentData] = useState({ method: 'Cash', paidAmount: '', notes: '' });
    const [addedPayments, setAddedPayments] = useState([]); // For Split Payments
    const [lastSale, setLastSale] = useState(null); // Store last sale for printing

    // History Modal
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [salesHistory, setSalesHistory] = useState([]);
    const [selectedHistorySale, setSelectedHistorySale] = useState(null); // For detail view

    // Numpad Support
    const [activeInput, setActiveInput] = useState('search'); // 'search' or cartItemId
    const [invoiceSettings, setInvoiceSettings] = useState(null);
    const [companyProfile, setCompanyProfile] = useState(null);
    const [customerBalance, setCustomerBalance] = useState(0);
    const [cashier, setCashier] = useState(null);
    const [sessionTime, setSessionTime] = useState('');

    // Round Off State
    const [roundOff, setRoundOff] = useState(0);

    // Restore POS state on mount or when user changes
    useEffect(() => {
        if (user?.id) {
            const storedPosState = localStorage.getItem(`pos_state_${user.id}`);
            if (storedPosState) {
                try {
                    const parsed = JSON.parse(storedPosState);
                    setCart(parsed.cart || []);
                    setCustomerId(parsed.customerId || '');
                    setCustomerName(parsed.customerName || '');
                    setSalesmanId(parsed.salesmanId || '');
                    setSaleDate(parsed.saleDate || new Date().toISOString().split('T')[0]);
                    setRoundOff(parsed.roundOff || 0);
                } catch (e) {
                    console.error('Failed to restore POS state:', e);
                }
            }
        }
    }, [user?.id]);

    // Save POS state whenever it changes
    useEffect(() => {
        if (user?.id) {
            const stateToStore = {
                cart,
                customerId,
                customerName,
                salesmanId,
                saleDate,
                roundOff
            };
            localStorage.setItem(`pos_state_${user.id}`, JSON.stringify(stateToStore));
        }
    }, [cart, customerId, customerName, salesmanId, saleDate, roundOff, user?.id]);

    // Fetch Data
    useEffect(() => {
        // Session time update
        setSessionTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

        const fetchData = async () => {
            try {
                const [prodRes, custRes, compRes, userRes] = await Promise.all([
                    api.get('/products', { params: { branchId: user?.branchId } }),
                    api.get('/customers'),
                    api.get('/company'),
                    // Fetch users as salesmen, filter by branch if needed
                    api.get('/users')
                ]);
                setProducts(prodRes.data);
                setCustomers(custRes.data);


                // Filter salesmen: match branchId or global (no branch)
                // Also possibly filter by role if needed, but for now allow all users
                const branchUsers = prodRes.data ? userRes.data.filter(u => !u.branchId || u.branchId === user?.branchId) : [];
                setAvailableSalesmen(branchUsers);
                if (compRes.data) {
                    setCompanyProfile(compRes.data);
                }

                // Fetch Branch Specific Settings
                if (user?.branchId) {
                    try {
                        const branchRes = await api.get(`/branches/${user.branchId}`);
                        if (branchRes.data?.invoiceSettings) {
                            setInvoiceSettings(branchRes.data.invoiceSettings);
                        } else if (compRes.data?.invoiceSettings) {
                            // Fallback to company settings if branch settings are empty
                            setInvoiceSettings(compRes.data.invoiceSettings);
                        }
                    } catch (err) {
                        console.error('Failed to load branch settings', err);
                    }
                }
            } catch (err) {
                console.error(err);
                toast.error('Failed to fetch initial data');
            }
        };
        fetchData();
    }, []);

    // --- CART SYNC EFFECT ---
    useEffect(() => {
        if (products.length > 0 && cart.length > 0) {
            let hasChanges = false;

            const updatedCart = cart.map(cartItem => {
                const freshProd = products.find(p => p.id === cartItem.id);
                if (freshProd) {
                    const freshPrice = Number(freshProd.price);
                    const freshTaxRate = parseFloat(freshProd.taxRate || 0);
                    const freshIsInclusive = freshProd.isTaxInclusive === true || freshProd.isTaxInclusive === 'true';

                    const isPriceDiff = cartItem.price !== freshPrice;
                    const isTaxDiff = cartItem.taxRate !== freshTaxRate;
                    const isIncDiff = cartItem.isTaxInclusive !== freshIsInclusive;

                    if (isPriceDiff || isTaxDiff || isIncDiff) {
                        hasChanges = true;
                        return {
                            ...cartItem,
                            price: freshPrice,
                            taxRate: freshTaxRate,
                            isTaxInclusive: freshIsInclusive,
                            name: freshProd.name
                        };
                    }
                }
                return cartItem;
            });

            if (hasChanges) {
                console.log("Syncing cart with fresh product data...");
                setCart(updatedCart);
                toast.info("Cart prices updated to latest values");
            }
        }
    }, [products, cart]);


    // Update Invoice Settings when Branch Changes (for Admin)
    useEffect(() => {
        const updateSettings = async () => {
            if (selectedBranch) {
                try {
                    const { data } = await api.get(`/branches/${selectedBranch}`);
                    if (data?.invoiceSettings && Object.keys(data.invoiceSettings).length > 0) {
                        setInvoiceSettings(data.invoiceSettings);
                    } else {
                        // Fallback to company settings
                        setInvoiceSettings(companyProfile?.invoiceSettings || null);
                    }
                } catch (err) {
                    console.error("Failed to fetch branch settings", err);
                }
            } else if (companyProfile) {
                // Revert to company settings or User Branch settings if deselecting?
                // If user has a branch, we should go back to that.
                if (user?.branchId) {
                    // We need to re-fetch user branch settings or store them. 
                    // For simplicity, let's re-fetch or rely on company if user branch logic handled elsewhere.
                    // Actually, if selectedBranch is "" (All/None), we usually default to company or user branch.
                    // Let's just set to company for now to be safe, or re-run the initial logic?
                    // Initial logic is in mount. 
                    // Better: Fallback to companyProfile.invoiceSettings
                    setInvoiceSettings(companyProfile.invoiceSettings);
                } else {
                    setInvoiceSettings(companyProfile.invoiceSettings);
                }
            }
        };

        if (companyProfile) {
            updateSettings();
        }
    }, [selectedBranch, companyProfile, user]);

    // Fetch Customer Balance when customerId changes
    useEffect(() => {
        const fetchBalance = async () => {
            if (customerId) {
                try {
                    const { data } = await api.get(`/customers/${customerId}/balance`);
                    setCustomerBalance(parseFloat(data.balance || 0));
                } catch (err) {
                    console.error(err);
                }
            } else {
                setCustomerBalance(0);
            }
        };
        fetchBalance();
    }, [customerId]);

    // ... (useEffect for dropdown click outside - lines 50-61, unchanged)

    const handleScan = (e) => {
        if (e.key === 'Enter') {
            const product = products.find(p => p.barcode === search || p.name.toLowerCase().includes(search.toLowerCase()));
            if (product) {
                addToCart(product);
                setSearch('');
            }
        }
    };

    const addToCart = (product) => {
        const existing = cart.find(item => item.id === product.id);

        // Always use FRESH data from the passed 'product' object
        const freshPrice = Number(product.price);
        const freshTaxRate = parseFloat(product.taxRate || 0);
        const freshIsInclusive = product.isTaxInclusive === true || product.isTaxInclusive === 'true';

        if (existing) {
            setCart(cart.map(item => item.id === product.id ? {
                ...item,
                quantity: item.quantity + 1,
                // FORCE UPDATE details
                price: freshPrice,
                taxRate: freshTaxRate,
                isTaxInclusive: freshIsInclusive
            } : item));
        } else {
            setCart([...cart, {
                ...product,
                // Ensure we spread product but also explicitly set the fields we depend on for calc
                id: product.id,
                name: product.name,
                price: freshPrice,
                quantity: 1,
                discountPercent: 0,
                discountAmount: 0,
                taxRate: freshTaxRate,
                isTaxInclusive: freshIsInclusive
            }]);
        }
    };

    const updateQuantity = (id, newQty) => {
        if (newQty < 1) return;
        setCart(cart.map(item => item.id === id ? { ...item, quantity: newQty } : item));
    };

    const updateDiscount = (id, type, value) => {
        setCart(cart.map(item => {
            if (item.id === id) {
                let newPercent = item.discountPercent;
                let newAmount = item.discountAmount;

                if (type === 'percent') {
                    newPercent = parseFloat(value) || 0;
                    newAmount = (item.price * newPercent) / 100;
                    newAmount = parseFloat(newAmount.toFixed(2));
                } else if (type === 'amount') {
                    newAmount = parseFloat(value) || 0;
                    newPercent = (newAmount / item.price) * 100;
                    newPercent = parseFloat(newPercent.toFixed(2));
                }

                return { ...item, discountPercent: newPercent, discountAmount: newAmount };
            }
            return item;
        }));
    };

    const removeFromCart = (id) => setCart(cart.filter(item => item.id !== id));

    // Numpad Input Handler
    const handleNumpadInput = (value) => {
        if (activeInput === 'search') {
            if (value === 'BACK') setSearch(prev => prev.slice(0, -1));
            else if (value === 'CLEAR') setSearch('');
            else setSearch(prev => prev + value);
        }
    };

    // Calculations
    const calcResults = cart.reduce((acc, item) => {
        const price = parseFloat(item.price || 0);
        const qty = parseFloat(item.quantity || 0);
        const disc = parseFloat(item.discountAmount || 0);
        const rate = parseFloat(item.taxRate || 0);
        const isInc = item.isTaxInclusive === true;

        // Discount is applied on Unit Price. 
        // Net Price = Price - Discount
        const netPricePerUnit = price - disc;

        let lineTax = 0;
        let lineSubTotal = 0; // Exclusive of tax

        // Total for line before splitting tax
        const lineTotalPayable = qty * netPricePerUnit;

        if (isInc && rate > 0) {
            // Inclusive Case: 
            // The Price (and thus Net Price) already includes tax.
            // Total Payable = Price (adjusted for qty/disc).
            // We need to extract Tax from it.

            const baseAmount = lineTotalPayable / (1 + (rate / 100)); // This is the Subtotal
            lineTax = lineTotalPayable - baseAmount;
            lineSubTotal = baseAmount;
        } else if (rate > 0) {
            // Exclusive Case:
            // The Price is Ex-Tax.
            // Tax is added ON TOP.

            lineSubTotal = lineTotalPayable;
            lineTax = (lineTotalPayable * rate) / 100;
        } else {
            // No Tax
            lineSubTotal = lineTotalPayable;
            lineTax = 0;
        }

        return {
            subTotal: acc.subTotal + lineSubTotal,
            tax: acc.tax + lineTax
        };
    }, { subTotal: 0, tax: 0 });

    const { subTotal, tax } = calcResults;
    const totalBeforeRound = subTotal + tax;
    const total = totalBeforeRound + parseFloat(roundOff || 0);
    const currencySymbol = companyProfile?.currencySymbol || '₹';

    // Auto Round Function
    const handleAutoRound = () => {
        const rounded = Math.round(totalBeforeRound);
        const diff = rounded - totalBeforeRound;
        setRoundOff(diff.toFixed(2));
    };

    // Manual Total Change -> Recalculate Items (Reverse Tax Calc)
    const handleTotalChange = (newTotalStr) => {
        // Allow decimal point while typing
        if (newTotalStr.endsWith('.')) return;

        const matchTotal = parseFloat(newTotalStr);
        if (isNaN(matchTotal)) return;

        // If cart is empty, do nothing
        if (cart.length === 0) return;

        // Calculate Ratio
        // Current Total (Pre-RoundOff) derived from items
        // We need to adjust items so that their sum + tax equals matchTotal
        // This effectively means applying a discount.

        // Reset current discounts first to get "Base Total"
        // Note: This is complex because we need the ORIGINAL prices. 
        // For simplicity in this iteration, we assume current cart state is the base, 
        // OR we rely on the fact that existing discounts are intentional.

        // Simple Approach: Adjust 'Global Discount' distributed via item discounts?
        // Better: Calculate the required reduction ratio.

        if (matchTotal <= 0) return;

        // 1. Calculate current potential total without round off
        const currentTotal = subTotal + tax; // This uses current cart items' net prices

        if (currentTotal === 0) return;

        const ratio = matchTotal / currentTotal;

        // Apply this ratio to the PRICE of items (effectively increasing discount)
        // NewNetPrice = OldNetPrice * ratio
        // DiscountAmount = Price - NewNetPrice

        const newCart = cart.map(item => {
            const currentNet = item.price - (item.discountAmount || 0); // Current net per unit
            const newNet = currentNet * ratio;
            const newDiscountAmt = item.price - newNet;

            return {
                ...item,
                discountAmount: parseFloat(newDiscountAmt.toFixed(2)),
                discountPercent: 0 // Clear percent to avoid conflict, relying on amount
            };
        });

        setCart(newCart);

        // Also reset RoundOff because we absorbed the diff into items
        setRoundOff(0);
    };

    // Checkout
    const componentRef = useRef();
    const handlePrint = useReactToPrint({ contentRef: componentRef });

    const initiateCheckout = () => {
        if (cart.length === 0) { toast.error("Cart is empty"); return; }
        // Validation removed to allow Walk-in customers
        setPaymentData({ ...paymentData, paidAmount: total.toFixed(2), method: 'Cash' });
        setAddedPayments([]); // Reset split payments
        // Auto-select logged in user as salesman if not already selected?
        if (!salesmanId && cashier) setSalesmanId(cashier.id);
        setShowPaymentModal(true);
    };

    const handleAddPayment = () => {
        const amount = parseFloat(paymentData.paidAmount) || 0;
        if (amount <= 0) return;

        const newPayment = { method: paymentData.method, amount: amount };
        const updatedList = [...addedPayments, newPayment];
        setAddedPayments(updatedList);

        // Calc remaining
        const totalPaidSoFar = updatedList.reduce((sum, p) => sum + p.amount, 0);
        const remaining = total - totalPaidSoFar;
        setPaymentData({
            ...paymentData,
            paidAmount: remaining > 0 ? remaining.toFixed(2) : '0',
            method: 'Cash' // Reset method to default? Or keep?
        });
    };

    const removePayment = (index) => {
        const updatedList = addedPayments.filter((_, i) => i !== index);
        setAddedPayments(updatedList);

        // Update balance display input
        const totalPaidSoFar = updatedList.reduce((sum, p) => sum + p.amount, 0);
        setPaymentData({
            ...paymentData,
            paidAmount: (total - totalPaidSoFar).toFixed(2)
        });
    };

    const handleCheckout = async () => {
        try {
            const currentInputAmount = parseFloat(paymentData.paidAmount) || 0;

            let finalPayments = [];
            let finalPaidAmount = 0;

            // Combine added payments with current input if valid
            if (addedPayments.length > 0) {
                finalPayments = [...addedPayments];

                // If there's a value in the input, add it as a payment too (for "Add & Complete")
                if (currentInputAmount > 0) {
                    finalPayments.push({
                        method: paymentData.method,
                        amount: currentInputAmount
                    });
                }

                finalPaidAmount = finalPayments.reduce((sum, p) => sum + p.amount, 0);
            } else {
                // Simple Mode (No split list started)
                if (currentInputAmount < 0) { toast.error("Invalid Amount"); return; }

                // If Credit, allow 0 paidAmount. If Cash/Card, warn if 0? 
                // Actually, 0 paidAmount is valid for Credit. For Cash, it means nothing paid (also kind of valid but unusual without Credit method).

                finalPayments = [{ method: paymentData.method, amount: currentInputAmount }];
                finalPaidAmount = currentInputAmount;
            }

            // Basic Total Validation (Optional: warn if underpaid? Logic handled in backend status)
            // Check Overpayment
            if (finalPaidAmount > total + 1) {
                toast.error(`Paid amount (₹${finalPaidAmount}) cannot exceed Total (₹${total.toFixed(2)})`);
                return;
            }

            // Validate Discounts before sending
            for (const item of cart) {
                if (!item.discountPercent || item.discountPercent === 0) continue; // Skip if no discount

                const effectiveMax = (item.maxDiscount !== null && item.maxDiscount !== undefined) ? item.maxDiscount : 100;
                const effectiveMin = (item.minDiscount !== null && item.minDiscount !== undefined) ? item.minDiscount : 0;

                if (item.discountPercent < effectiveMin || item.discountPercent > effectiveMax) {
                    toast.error(`Discount for ${item.name} must be between ${effectiveMin}% and ${effectiveMax}%`);
                    return;
                }
            }



            const payload = {
                customerId: customerId ? parseInt(customerId) : null,
                customerName: customerName || 'Walk-in Customer',
                branchId: user?.branchId || (selectedBranch ? parseInt(selectedBranch) : null),
                saleDate,
                items: cart.map(item => ({
                    productId: item.id,
                    quantity: item.quantity,
                    unitPrice: item.price,
                    taxPercent: item.taxPercent,
                    discountPercent: item.discountPercent,
                    discountAmount: item.discountAmount
                })),
                paymentMethod: finalPayments.length === 1 ? finalPayments[0].method : 'Split',
                paidAmount: finalPaidAmount,
                terminalId: terminal?.id,
                roundOffAmount: roundOff,
                payments: finalPayments,
                salesmanId: salesmanId ? parseInt(salesmanId) : null
            };

            const res = await api.post('/sales', payload);

            setLastSale(res.data); // Save for printing
            setShowPaymentModal(false);
            // Delay print slightly to allow state update
            setTimeout(() => handlePrint(), 100);

            setCart([]);
            setSearch('');
            setRoundOff(0);
            setSalesmanId(cashier?.id || ''); // Reset to cashier
            localStorage.removeItem(`pos_state_${user?.id}`);
            toast.success('Sale Completed Successfully!');

            // WhatsApp Integration
            const wsSettings = await api.get('/whatsapp/settings').then(r => r.data).catch(() => null);
            if (wsSettings && wsSettings.isActive && wsSettings.apiKey && (customerId || customerName)) {
                const customer = customers.find(c => c.id === customerId);
                const phone = customer?.phone || '';
                if (phone) {
                    let msg = wsSettings.salesTemplate || 'Hello [[customer_name]], your invoice [[bill_no]] for [[total_amount]] is ready.';
                    msg = msg.replace(/\[\[customer_name\]\]/g, customerName || customer?.name || 'Customer')
                        .replace(/\[\[bill_no\]\]/g, res.data.invoiceNumber)
                        .replace(/\[\[total_amount\]\]/g, `₹${total.toFixed(2)}`)
                        .replace(/\[\[company_name\]\]/g, companyProfile?.companyName || 'Our Store');

                    try {
                        await api.post('/whatsapp/send', { mobile: phone, message: msg });
                        toast.info('WhatsApp Invoice Sent!');
                    } catch (wsErr) {
                        console.error('WhatsApp failed:', wsErr);
                    }
                }
            }
        } catch (err) {
            console.error(err);
            toast.error(err.response?.data?.error || 'Checkout Failed');
        }
    };

    const fetchHistory = async () => {
        try {

            const { data } = await api.get('/sales', {
                params: {
                    branchId: user?.branchId,
                    terminalId: terminal?.id
                }
            });
            setSalesHistory(data);
        } catch (err) {
            toast.error('Failed to fetch sales history');
        }
    };

    useEffect(() => {
        if (showHistoryModal) {
            fetchHistory();
        }
    }, [showHistoryModal]);

    const handleCreateCustomer = async (e) => {
        e.preventDefault();
        try {
            const { data } = await api.post('/customers', newCustomerData);
            setCustomers([...customers, data]);
            setCustomerId(data.id);
            setCustomerName(data.name);
            setCustomerSearch(data.name);
            setShowCustomerModal(false);
            setNewCustomerData({ name: '', phone: '', email: '', address: '' });
            toast.success('Customer added');
        } catch (err) {
            toast.error('Failed to create customer');
        }
    };

    return (
        <div className="flex h-[calc(100vh-80px)] gap-4 overflow-hidden">

            {/* LEFT PANEL: PRODUCTS (60%) */}
            <div className="flex-[3] flex flex-col bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
                {/* Search Bar */}
                <div className="p-4 border-b border-slate-100 bg-white z-10">
                    <div className="relative">
                        <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg" />
                        <input
                            autoFocus
                            className="w-full pl-12 pr-4 h-12 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-primary transition-colors text-lg"
                            placeholder="Search product by name or scan barcode..."
                            value={search}
                            onChange={e => { setSearch(e.target.value); setActiveInput('search'); }}
                            onKeyDown={handleScan}
                            onClick={() => setActiveInput('search')}
                        />
                    </div>
                </div>

                {/* Product Grid */}
                <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50">
                    <div className="grid grid-cols-3 xl:grid-cols-4 gap-4">
                        {products.filter(p => p.name.toLowerCase().includes(search.toLowerCase())).map(product => (
                            <div key={product.id}
                                className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group active:scale-95"
                                onClick={() => {
                                    if (product.stock <= 0) {
                                        toast.error('Out of stock in your branch');
                                        return;
                                    }
                                    addToCart(product);
                                }}>
                                <div className="aspect-square bg-slate-50 rounded-lg mb-3 flex items-center justify-center overflow-hidden relative">
                                    {product.imageUrl ? (
                                        <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                                    ) : (
                                        <span className="text-2xl font-bold text-slate-300">{product.name.substring(0, 2)}</span>
                                    )}
                                    <div className="absolute top-2 right-2 bg-slate-900/70 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm">
                                        {product.stock}
                                    </div>
                                </div>
                                <h3 className="font-semibold text-slate-700 text-sm truncate mb-1">{product.name}</h3>
                                <div className="flex justify-between items-center">
                                    <p className="text-primary font-bold">₹{product.price}</p>
                                    <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-primary group-hover:text-white transition-colors">
                                        <FiPlus size={14} />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* RIGHT PANEL: CART & NUMPAD (40%) */}
            <div className="md:w-[400px] lg:w-[450px] xl:w-[500px] flex flex-col bg-white h-full border-l border-slate-200">

                {/* Header: Cashier, Salesman & Customer - Compact View */}
                <div className="bg-white border-b border-slate-200 p-4 space-y-3">
                    {/* Cashier Info */}
                    <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                        <div className="flex items-center gap-2">
                            <span className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"><FiUser size={16} /></span>
                            <div>
                                <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Cashier</p>
                                <p className="text-sm font-bold text-slate-700">{cashier?.name || 'Admin'}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            {user?.role === 'admin' && !user.branchId ? (
                                <div className="w-40 ml-auto">
                                    <label className="block text-[10px] text-slate-400 font-bold uppercase mb-1 text-right">Branch / Terminal</label>
                                    <SearchableSelect
                                        options={branches.map(b => ({ value: b.id, label: b.name }))}
                                        value={selectedBranch}
                                        onChange={val => setSelectedBranch(val)}
                                        placeholder="Select Branch"
                                        className="h-8 text-xs font-bold"
                                    />
                                </div>
                            ) : (
                                <>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase">Terminal</p>
                                    <p className="text-xs font-mono font-bold text-primary">POS-01</p>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Combined Salesman & Customer Row */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Salesman</label>
                            <SearchableSelect
                                options={availableSalesmen.map(s => ({ value: s.id, label: s.name }))}
                                value={salesmanId}
                                onChange={val => setSalesmanId(val)}
                                placeholder="Select Salesman"
                            />
                        </div>
                        <div ref={dropdownRef} className="relative">
                            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Customer</label>
                            <div
                                className="flex items-center justify-between text-sm font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded p-1.5 cursor-pointer hover:bg-slate-100"
                                onClick={() => setShowCustomerDropdown(!showCustomerDropdown)}
                            >
                                <span className="truncate">{customerId ? (customers.find(c => c.id === customerId)?.name || customerName) : 'Walk-in Customer'}</span>
                                <FiEdit2 size={12} className="text-slate-400 ml-1" />
                            </div>

                            {/* Customer Dropdown */}
                            {showCustomerDropdown && (
                                <div className="absolute top-full left-0 right-0 z-30 bg-white border border-slate-200 mt-1 rounded-lg shadow-xl p-2">
                                    <input
                                        autoFocus
                                        className="w-full p-2 text-sm border border-slate-200 rounded mb-2 outline-none focus:border-primary"
                                        placeholder="Search Customer..."
                                        value={customerSearch}
                                        onChange={e => setCustomerSearch(e.target.value)}
                                    />
                                    <div className="max-h-40 overflow-y-auto space-y-1">
                                        <div className="p-2 hover:bg-slate-50 rounded cursor-pointer text-sm font-medium text-slate-600" onClick={() => { setCustomerId(''); setCustomerName(''); setCustomerSearch(''); setShowCustomerDropdown(false); }}>
                                            Walk-in Customer
                                        </div>
                                        {customers.filter(c => c.name.toLowerCase().includes(customerSearch.toLowerCase())).map(c => (
                                            <div key={c.id} className="p-2 hover:bg-primary-light/10 rounded cursor-pointer text-sm font-semibold text-slate-700"
                                                onClick={() => { setCustomerId(c.id); setCustomerName(c.name); setCustomerSearch(c.name); setShowCustomerDropdown(false); }}>
                                                {c.name}
                                                {c.phone && <span className="block text-xs text-slate-400 font-normal">{c.phone}</span>}
                                            </div>
                                        ))}
                                    </div>
                                    <button onClick={() => { setShowCustomerModal(true); setShowCustomerDropdown(false); }} className="w-full mt-2 py-2 bg-primary-light/10 text-primary text-xs font-bold rounded hover:bg-primary-light/20 flex items-center justify-center gap-1">
                                        <FiPlus /> New Customer
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Cart Headers */}
                <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                    <div className="flex-[3]">Item</div>
                    <div className="flex-[2] text-center">Qty</div>
                    <div className="flex-[2] text-right">Price</div>
                    <div className="flex-[2] text-right">Total</div>
                    <div className="w-6"></div>
                </div>

                {/* Cart List */}
                <div className="flex-1 overflow-y-auto bg-white">
                    {cart.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-3">
                            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center">
                                <FiShoppingCart size={24} className="text-slate-300" />
                            </div>
                            <p className="text-sm font-medium">Cart is empty</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-50">
                            {cart.map(item => (
                                <div key={item.id} className="px-4 py-3 hover:bg-slate-50 group transition-colors">
                                    <div className="flex items-center text-sm">
                                        {/* Item & Disc */}
                                        <div className="flex-[3] pr-2">
                                            <h4 className="font-bold text-slate-700 leading-tight mb-1">{item.name}</h4>
                                            <div className="flex items-center gap-1 mt-1">
                                                <div className="flex items-center gap-0.5">
                                                    <input
                                                        className="w-8 p-0.5 text-[10px] text-center bg-slate-100 border border-slate-200 rounded outline-none focus:border-primary"
                                                        placeholder="%"
                                                        value={item.discountPercent || ''}
                                                        onChange={e => updateDiscount(item.id, 'percent', e.target.value)}
                                                    />
                                                </div>
                                                <div className="flex items-center gap-0.5">
                                                    <span className="text-[10px] text-slate-400">₹</span>
                                                    <input
                                                        className="w-10 p-0.5 text-[10px] text-center bg-slate-100 border border-slate-200 rounded outline-none focus:border-primary"
                                                        placeholder="Amt"
                                                        value={item.discountAmount || ''}
                                                        onChange={e => updateDiscount(item.id, 'amount', e.target.value)}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Qty */}
                                        <div className="flex-[2] flex justify-center">
                                            <div className="flex items-center border border-slate-200 rounded bg-white">
                                                <button className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary-light/10" onClick={() => updateQuantity(item.id, item.quantity - 1)}>-</button>
                                                <input
                                                    className="w-8 text-center text-xs font-bold text-slate-700 outline-none"
                                                    value={item.quantity}
                                                    onChange={e => updateQuantity(item.id, parseInt(e.target.value) || 1)}
                                                />
                                                <button className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-primary hover:bg-primary-light/10" onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</button>
                                            </div>
                                        </div>

                                        {/* Price */}
                                        <div className="flex-[2] text-right">
                                            <div className="font-bold text-slate-600">₹{item.price}</div>
                                            {item.discountAmount > 0 && <div className="text-[10px] text-orange-500 line-through">₹{item.price * item.quantity}</div>}
                                        </div>

                                        {/* Total */}
                                        <div className="flex-[2] text-right font-bold text-slate-800">
                                            ₹{((item.price - (item.discountAmount || 0)) * item.quantity).toFixed(2)}
                                        </div>

                                        {/* Remove */}
                                        <div className="w-6 text-right pl-2">
                                            <button onClick={() => removeFromCart(item.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                                                <FiTrash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Totals & Actions - Pinned Bottom */}
                <div className="bg-slate-50 border-t border-slate-200 p-4 space-y-3">
                    <div className="space-y-1 text-sm">
                        <div className="flex justify-between text-slate-500">
                            <span>Subtotal</span>
                            <span className="font-medium">₹{subTotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-slate-500">
                            <span>Tax</span>
                            <span className="font-medium">₹{tax.toFixed(2)}</span>
                        </div>
                        {customerBalance !== 0 && (
                            <div className="flex justify-between text-orange-600 font-bold">
                                <span>Balance Due</span>
                                <span>₹{customerBalance.toFixed(2)}</span>
                            </div>
                        )}

                        {/* Round Off Control */}
                        <div className="flex justify-between items-center text-slate-500">
                            <span className="flex items-center gap-2">
                                Round Off
                                <button onClick={handleAutoRound} className="text-[10px] bg-slate-200 px-1.5 py-0.5 rounded hover:bg-slate-300 font-bold text-slate-600">AUTO</button>
                            </span>
                            <input
                                className="w-20 text-right bg-transparent border-b border-dashed border-slate-300 outline-none focus:border-primary font-mono"
                                value={roundOff}
                                onChange={e => setRoundOff(e.target.value)}
                                placeholder="0.00"
                            />
                        </div>

                    </div>

                    <div className="flex justify-between items-end pt-2 border-t border-slate-200">
                        <span className="text-slate-800 font-bold text-lg">Total</span>
                        <span className="text-slate-800 font-bold text-lg">Total</span>
                        <div className="relative">
                            <span className="absolute left-0 top-1/2 -translate-y-1/2 text-3xl font-black text-slate-800 pointer-events-none">₹</span>
                            <input
                                className="w-40 text-right text-3xl font-black text-slate-800 bg-transparent border-b-2 border-transparent hover:border-slate-200 focus:border-primary outline-none transition-all pl-6"
                                value={total.toFixed(2)}
                                onChange={e => handleTotalChange(e.target.value)}
                                onFocus={e => e.target.select()}
                            />
                        </div>
                    </div>

                    <button
                        onClick={initiateCheckout}
                        disabled={cart.length === 0}
                        className="w-full py-4 bg-primary hover:bg-primary-dark disabled:bg-slate-300 text-white rounded-xl shadow-lg shadow-primary/20 disabled:shadow-none font-bold text-lg transition-all flex items-center justify-center gap-2"
                    >
                        <FiMonitor /> Pay Now
                    </button>
                </div>
            </div>


            {/* Payment Modal */}
            {showPaymentModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 transition-all duration-300">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">

                        {/* Standard Header */}
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-white">
                            <h2 className="text-lg font-bold text-slate-800">Complete Payment</h2>
                            <button onClick={() => setShowPaymentModal(false)} className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-colors">
                                <FiX />
                            </button>
                        </div>

                        <div className="p-6 flex-1 overflow-y-auto">

                            {/* Total Amount Display */}
                            <div className="text-center mb-8">
                                <p className="text-sm font-semibold text-slate-400 uppercase tracking-widest mb-1">Total Payable</p>
                                <span className="text-2xl font-black text-slate-800">{currencySymbol}{total.toFixed(2)}</span>
                            </div>

                            {/* Payment Method Tabs */}
                            <div className="mb-6">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Payment Method</label>
                                <div className="grid grid-cols-5 gap-2">
                                    {['Cash', 'Card', 'UPI', 'Credit', 'Sales Return'].map(method => (
                                        <button
                                            key={method}
                                            onClick={() => {
                                                const isCredit = method === 'Credit';
                                                // If Credit, default to 0. If others, default to remaining total.
                                                const alreadyPaid = addedPayments.reduce((s, x) => s + x.amount, 0);
                                                const remaining = total - alreadyPaid;
                                                setPaymentData({
                                                    ...paymentData,
                                                    method,
                                                    paidAmount: isCredit ? '0' : remaining.toFixed(2)
                                                });
                                            }}
                                            className={`py-2 px-1 rounded-lg text-[10px] font-bold transition-all border whitespace-nowrap ${paymentData.method === method
                                                ? 'bg-primary text-white border-primary shadow-md shadow-primary/20'
                                                : 'bg-white text-slate-600 border-slate-200 hover:border-primary/50 hover:bg-primary-light/10'
                                                }`}
                                        >
                                            {method}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Payment Input */}
                            <div className="mb-6">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Received Amount</label>
                                    <span className={`text-xs font-bold ${(parseFloat(paymentData.paidAmount || 0) - (total - addedPayments.reduce((s, x) => s + x.amount, 0))) >= 0
                                        ? 'text-primary'
                                        : 'text-orange-500'
                                        }`}>
                                        {(() => {
                                            const paid = parseFloat(paymentData.paidAmount || 0);
                                            const alreadyPaid = addedPayments.reduce((s, x) => s + x.amount, 0);
                                            const balance = total - alreadyPaid - paid;
                                            if (balance < -0.01) return `Change: ${currencySymbol}${Math.abs(balance).toFixed(2)}`;
                                            if (balance > 0.01) return `Balance: ${currencySymbol}${balance.toFixed(2)}`;
                                            return 'Settled';
                                        })()}
                                    </span>
                                </div>

                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">₹</span>
                                        <input
                                            autoFocus
                                            type="number"
                                            className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 font-bold text-lg text-slate-800 transition-all"
                                            placeholder="0.00"
                                            value={paymentData.paidAmount}
                                            onChange={e => setPaymentData({ ...paymentData, paidAmount: e.target.value })}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') handleCheckout();
                                            }}
                                        />
                                    </div>
                                    <button
                                        onClick={handleAddPayment}
                                        className="px-4 py-3 bg-white border border-slate-200 text-primary rounded-lg font-bold hover:bg-primary-light/10 hover:border-primary/30 transition-all text-sm whitespace-nowrap"
                                        title="Add as Partial Payment"
                                    >
                                        + Add
                                    </button>
                                </div>
                            </div>

                            {/* Added Payments List */}
                            {addedPayments.length > 0 && (
                                <div className="mb-2 bg-slate-50 rounded-lg border border-slate-100 p-3">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Split Payments</p>
                                    <div className="space-y-2">
                                        {addedPayments.map((p, i) => (
                                            <div key={i} className="flex justify-between items-center text-sm">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-primary"></span>
                                                    <span className="font-medium text-slate-700">{p.method}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <span className="font-bold text-slate-800">₹{p.amount.toFixed(2)}</span>
                                                    <button onClick={() => removePayment(i)} className="text-slate-400 hover:text-red-500"><FiX size={14} /></button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-100 bg-slate-50 flex gap-3">
                            <button onClick={() => setShowPaymentModal(false)} className="px-5 py-3 rounded-xl font-bold text-slate-500 hover:bg-white hover:shadow-sm border border-transparent hover:border-slate-200 transition-all text-sm">
                                Cancel
                            </button>
                            <button
                                onClick={handleCheckout}
                                className="flex-1 py-3 px-6 bg-primary hover:bg-primary-dark text-white rounded-xl font-bold shadow-lg shadow-primary/30 transition-all flex items-center justify-center gap-2 text-sm"
                            >
                                <FiMonitor size={16} />
                                {addedPayments.length > 0 ? 'Complete Split Sale' : 'Complete Sale'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Hidden Print Invoice */}
            <div style={{ display: 'none' }}>
                <DynamicInvoice
                    ref={componentRef}
                    printData={lastSale}
                    companyProfile={companyProfile}
                    invoiceSettings={invoiceSettings}
                />
            </div>

            {/* Sales History Modal */}
            {showHistoryModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowHistoryModal(false)}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2"><FiClock /> Sales History</h2>
                            <button onClick={() => setShowHistoryModal(false)} className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center hover:bg-slate-300"><FiX /></button>
                        </div>

                        <div className="flex-1 overflow-auto flex">
                            {/* List */}
                            <div className={`${selectedHistorySale ? 'w-1/3 border-r hidden md:block' : 'w-full'} overflow-y-auto`}>
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-slate-600 sticky top-0">
                                        <tr>
                                            <th className="p-3">Date</th>
                                            <th className="p-3">Customer</th>
                                            <th className="p-3 text-right">Total</th>
                                            <th className="p-3"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {salesHistory.map(sale => (
                                            <tr key={sale.id} className={`border-b hover:bg-slate-50 cursor-pointer ${selectedHistorySale?.id === sale.id ? 'bg-primary-light/10' : ''}`} onClick={() => setSelectedHistorySale(sale)}>
                                                <td className="p-3">
                                                    <p className="font-bold text-slate-700">{new Date(sale.saleDate).toLocaleDateString()}</p>
                                                    <p className="text-xs text-slate-400 font-mono">#{sale.invoiceNumber}</p>
                                                </td>
                                                <td className="p-3 text-slate-600 truncate max-w-[100px]">{sale.customer?.name || 'Walk-in'}</td>
                                                <td className="p-3 text-right font-bold text-slate-800">₹{parseFloat(sale.totalAmount).toFixed(2)}</td>
                                                <td className="p-3 text-primary"><FiMonitor /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Preview Detail */}
                            {selectedHistorySale && (
                                <div className="flex-1 bg-slate-50/50 p-6 overflow-y-auto">
                                    <div className="bg-white p-6 rounded-xl shadow-sm border">
                                        <div className="flex justify-between items-start mb-6 border-b pb-4">
                                            <div>
                                                <h3 className="text-xl font-bold text-slate-800">Invoice #{selectedHistorySale.invoiceNumber}</h3>
                                                <p className="text-sm text-slate-500">{new Date(selectedHistorySale.saleDate).toLocaleString()}</p>
                                            </div>
                                            <div className="text-right">
                                                <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase ${selectedHistorySale.isReturn ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                                    {selectedHistorySale.isReturn ? 'Return' : selectedHistorySale.status}
                                                </span>
                                                <button
                                                    onClick={async () => {
                                                        const wsSettings = await api.get('/whatsapp/settings').then(r => r.data).catch(() => null);
                                                        if (!wsSettings?.apiKey) return toast.error('WhatsApp not configured');
                                                        const phone = selectedHistorySale.customer?.phone;
                                                        if (!phone) return toast.error('Customer phone missing');

                                                        let msg = wsSettings.salesTemplate || '';
                                                        msg = msg.replace(/\[\[customer_name\]\]/g, selectedHistorySale.customer?.name || 'Customer')
                                                            .replace(/\[\[bill_no\]\]/g, selectedHistorySale.invoiceNumber)
                                                            .replace(/\[\[total_amount\]\]/g, `₹${parseFloat(selectedHistorySale.totalAmount).toFixed(2)}`)
                                                            .replace(/\[\[company_name\]\]/g, companyProfile?.companyName || 'Our Store');

                                                        try {
                                                            await api.post('/whatsapp/send', { mobile: phone, message: msg });
                                                            toast.success('WhatsApp Sent!');
                                                        } catch (err) {
                                                            toast.error('WhatsApp failed');
                                                        }
                                                    }}
                                                    className="ml-2 p-2 rounded-full bg-green-50 text-green-600 hover:bg-green-100 transition-colors"
                                                    title="Send WhatsApp"
                                                >
                                                    <FiMessageSquare />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="mb-6">
                                            <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Customer</p>
                                            <p className="font-bold text-slate-700">{selectedHistorySale.customer?.name || 'Walk-in Customer'}</p>
                                        </div>

                                        <table className="w-full text-sm mb-6">
                                            <thead className="bg-slate-50 text-slate-500">
                                                <tr>
                                                    <th className="p-2 text-left">Item</th>
                                                    <th className="p-2 text-center">Qty</th>
                                                    <th className="p-2 text-right">Price</th>
                                                    <th className="p-2 text-right">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedHistorySale.items.map(item => (
                                                    <tr key={item.id} className="border-b border-slate-50 last:border-0">
                                                        <td className="p-2 text-slate-700">{item.product?.name}</td>
                                                        <td className="p-2 text-center">{item.quantity}</td>
                                                        <td className="p-2 text-right">₹{item.unitPrice}</td>
                                                        <td className="p-2 text-right font-bold">₹{item.total}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>

                                        <div className="flex justify-between items-center text-xl font-black text-slate-900 border-t pt-4">
                                            <span>Total Amount</span>
                                            <span>{currencySymbol}{parseFloat(selectedHistorySale.totalAmount).toFixed(2)}</span>
                                        </div>

                                        <div className="mt-6 flex gap-3">
                                            <button
                                                onClick={() => { setLastSale(selectedHistorySale); setTimeout(() => handlePrint(), 100); }}
                                                className="flex-1 py-2 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-900 flex items-center justify-center gap-2"
                                            >
                                                <FiMonitor /> Reprint Invoice
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Add Customer Modal */}
            {showCustomerModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-slate-800">Add New Customer</h2>
                            <button onClick={() => setShowCustomerModal(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
                        </div>
                        <form onSubmit={handleCreateCustomer} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                                <input required className="input" placeholder="e.g. Jane Doe" value={newCustomerData.name} onChange={e => setNewCustomerData({ ...newCustomerData, name: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                                <input className="input" placeholder="e.g. 9876543210" value={newCustomerData.phone} onChange={e => setNewCustomerData({ ...newCustomerData, phone: e.target.value })} />
                            </div>
                            <div className="flex justify-end gap-3 mt-6">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowCustomerModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Create</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
