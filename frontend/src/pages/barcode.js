import { useState, useEffect, useRef } from 'react';
import api from '@/lib/api';
import ReactBarcode from 'react-barcode';
import { FiPrinter, FiSearch, FiBox, FiSettings, FiCheck, FiSave, FiGrid, FiAlignLeft, FiAlignCenter, FiAlignRight, FiLayout } from 'react-icons/fi';
import { toast } from 'react-toastify';

export default function BarcodeGenerator() {
    const [products, setProducts] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(false);

    // Barcode Settings State
    const [settings, setSettings] = useState({
        nameFontSize: 20,
        priceFontSize: 16,
        barcodeWidth: 2,
        barcodeHeight: 100,
        barcodeFontSize: 18,
        alignment: 'center',
        showName: true,
        showPrice: true,
        showBarcodeValue: true,
        paperSize: 'Single', // Single, Grid
        columns: 1,
        margin: 10,
        labelWidth: 40,
        labelHeight: 20,
        paperWidth: 210,
        columnGap: 5,
        rowGap: 5
    });

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            const u = JSON.parse(storedUser);
            setUser(u);
            fetchSettings(u.branchId);
        }
        fetchProducts();
    }, []);

    const fetchProducts = async () => {
        try {
            const { data } = await api.get('/products');
            setProducts(data);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchSettings = async (branchId) => {
        if (!branchId) return;
        try {
            const { data } = await api.get(`/barcode-settings/${branchId}`);
            if (data) setSettings({
                ...data,
                labelWidth: data.labelWidth ?? 40,
                labelHeight: data.labelHeight ?? 20,
                paperWidth: data.paperWidth ?? 210,
                columnGap: data.columnGap ?? 5,
                rowGap: data.rowGap ?? 5
            });
        } catch (err) {
            console.error("Error fetching barcode settings:", err);
        }
    };

    const handleSaveSettings = async () => {
        if (!user?.branchId) return;
        setLoading(true);
        try {
            await api.put(`/barcode-settings/${user.branchId}`, settings);
            toast.success("Design settings saved for this branch");
        } catch (err) {
            toast.error("Failed to save settings");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.barcode && p.barcode.includes(searchTerm))
    );

    return (
        <div className="space-y-6 max-w-[1600px] mx-auto">
            <div className="flex justify-between items-center print:hidden">
                <div>
                    <h1 className="text-2xl font-semibold text-slate-800">Barcode Generator</h1>
                    <p className="text-slate-500 text-sm">Design and print branch-specific barcodes</p>
                </div>
                <div className="flex gap-3">
                    <button
                        className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 transition-colors"
                        onClick={handleSaveSettings}
                        disabled={loading}
                    >
                        {loading ? <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent animate-spin rounded-full" /> : <FiSave />}
                        Save Design
                    </button>
                    <button className="flex items-center gap-2 px-6 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-dark transition-colors shadow-lg shadow-primary/20" onClick={handlePrint} disabled={!selectedProduct}>
                        <FiPrinter className="text-lg" /> Print Barcode
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Step 1: Product Selection */}
                <div className="lg:col-span-3 card h-fit print:hidden">
                    <div className="flex items-center gap-2 mb-4 text-slate-400 font-medium uppercase text-[10px] tracking-widest">
                        <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">1</span>
                        Select Product
                    </div>
                    <div className="relative mb-4">
                        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                            placeholder="Search products..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1 custom-scrollbar">
                        {filteredProducts.map(product => (
                            <div
                                key={product.id}
                                className={`p-3 rounded-xl cursor-pointer border-2 transition-all ${selectedProduct?.id === product.id ? 'bg-primary-light/10 border-primary' : 'bg-white border-slate-100 hover:border-slate-300'}`}
                                onClick={() => setSelectedProduct(product)}
                            >
                                <div className="flex justify-between items-start">
                                    <p className={`font-medium text-sm ${selectedProduct?.id === product.id ? 'text-primary' : 'text-slate-700'}`}>{product.name}</p>
                                    {selectedProduct?.id === product.id && <FiCheck className="text-primary" />}
                                </div>
                                <div className="flex justify-between items-center mt-1">
                                    <p className="text-[10px] text-slate-400 font-mono italic">{product.barcode || 'NO BARCODE'}</p>
                                    <p className="text-xs font-medium text-slate-900">₹{Number(product.price).toFixed(2)}</p>
                                </div>
                            </div>
                        ))}
                        {filteredProducts.length === 0 && <p className="text-center text-slate-400 text-sm py-8">No products found</p>}
                    </div>
                </div>

                {/* Step 2: Visualization (The Designer) */}
                <div className="lg:col-span-6 bg-slate-100/50 rounded-2xl border-2 border-dashed border-slate-200 p-8 flex flex-col items-center justify-center min-h-[500px] print:w-full print:bg-white print:border-0 print:p-0 overflow-auto">
                    {selectedProduct ? (
                        <div
                            className="DesignerContent bg-white shadow-2xl transition-all duration-300 print:shadow-none print:p-0 mx-auto"
                            style={{
                                width: settings.paperSize === 'Grid' ? `${settings.paperWidth}mm` : 'auto',
                                minWidth: settings.paperSize === 'Grid' ? `${settings.paperWidth}mm` : 'auto',
                                padding: settings.paperSize === 'Grid' ? '10mm' : '0',
                                display: settings.paperSize === 'Grid' ? 'grid' : 'block',
                                gridTemplateColumns: settings.paperSize === 'Grid' ? `repeat(${settings.columns}, 1fr)` : 'none',
                                columnGap: `${settings.columnGap}mm`,
                                rowGap: `${settings.rowGap}mm`
                            }}
                        >
                            {/* Render multiple labels if valid grid, otherwise just one */}
                            {Array.from({ length: settings.paperSize === 'Grid' ? (settings.columns * 5) : 1 }).map((_, idx) => (
                                <div
                                    key={idx}
                                    className="border border-slate-100 rounded-sm overflow-hidden print:border-0"
                                    style={{
                                        width: settings.paperSize === 'Grid' ? `${settings.labelWidth}mm` : 'fit-content',
                                        height: settings.paperSize === 'Grid' ? `${settings.labelHeight}mm` : 'auto',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: settings.alignment === 'left' ? 'flex-start' : settings.alignment === 'right' ? 'flex-end' : 'center',
                                        justifyContent: 'center',
                                        padding: settings.paperSize === 'Grid' ? '2mm' : `${settings.margin}px`,
                                        textAlign: settings.alignment,
                                        pageBreakInside: 'avoid'
                                    }}
                                >
                                    {settings.showName && (
                                        <h3
                                            className="font-medium mb-1 text-slate-800 print:text-black leading-tight"
                                            style={{ fontSize: `${settings.nameFontSize}px`, lineHeight: 1.1 }}
                                        >
                                            {selectedProduct.name}
                                        </h3>
                                    )}

                                    {settings.showPrice && (
                                        <p
                                            className="text-slate-600 print:text-black mb-1 font-medium"
                                            style={{ fontSize: `${settings.priceFontSize}px` }}
                                        >
                                            ₹{Number(selectedProduct.price).toFixed(2)}
                                        </p>
                                    )}

                                    <div className="bg-transparent inline-block max-w-full overflow-hidden">
                                        <ReactBarcode
                                            value={selectedProduct.barcode || `GEN-${selectedProduct.id}`}
                                            width={settings.barcodeWidth}
                                            height={settings.barcodeHeight}
                                            fontSize={settings.barcodeFontSize}
                                            displayValue={settings.showBarcodeValue}
                                            background="transparent"
                                            margin={0}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center text-slate-400">
                            <FiBox className="text-6xl mx-auto mb-4 opacity-20" />
                            <p className="font-medium">Selected product will appear here</p>
                            <p className="text-xs mt-1">Select a product from the left to start</p>
                        </div>
                    )}

                    <div className="mt-8 px-4 py-2 bg-primary-light text-primary text-[10px] font-medium uppercase tracking-widest rounded-full border border-primary-light print:hidden animate-pulse">
                        Live Preview
                    </div>
                </div>

                {/* Step 3: Properties Panel */}
                <div className="lg:col-span-3 card h-fit print:hidden max-h-[85vh] overflow-y-auto custom-scrollbar">
                    <div className="flex items-center gap-2 mb-6 text-slate-400 font-medium uppercase text-[10px] tracking-widest sticky top-0 bg-white py-2 z-10 border-b border-slate-50">
                        <FiSettings className="text-sm" />
                        Design Properties
                    </div>

                    <div className="space-y-8">
                        {/* Page Setup Section (New for Multi-Column) */}
                        <div>
                            <label className="text-[10px] font-medium text-slate-400 uppercase tracking-tighter mb-3 block flex items-center gap-2">
                                <FiLayout /> Page & Grid Setup
                            </label>
                            <div className="space-y-4 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-semibold text-slate-700">Mode</span>
                                    <div className="flex bg-white rounded-lg p-1 border border-slate-200">
                                        <button
                                            onClick={() => setSettings({ ...settings, paperSize: 'Single' })}
                                            className={`px-2 py-1 text-[10px] font-medium rounded ${settings.paperSize === 'Single' ? 'bg-primary text-white shadow-sm' : 'text-slate-500'}`}
                                        >
                                            Single
                                        </button>
                                        <button
                                            onClick={() => setSettings({ ...settings, paperSize: 'Grid' })}
                                            className={`px-2 py-1 text-[10px] font-medium rounded ${settings.paperSize === 'Grid' ? 'bg-primary text-white shadow-sm' : 'text-slate-500'}`}
                                        >
                                            Multi-up
                                        </button>
                                    </div>
                                </div>

                                {settings.paperSize === 'Grid' && (
                                    <>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <span className="text-[10px] font-medium text-slate-500">Cols</span>
                                                <input
                                                    type="number" className="input text-xs py-1"
                                                    value={settings.columns}
                                                    onChange={e => setSettings({ ...settings, columns: parseInt(e.target.value) })}
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <span className="text-[10px] font-medium text-slate-500">Total W (mm)</span>
                                                <input
                                                    type="number" className="input text-xs py-1"
                                                    value={settings.paperWidth}
                                                    onChange={e => setSettings({ ...settings, paperWidth: parseFloat(e.target.value) })}
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <span className="text-[10px] font-medium text-slate-500">Label W (mm)</span>
                                                <input
                                                    type="number" className="input text-xs py-1"
                                                    value={settings.labelWidth}
                                                    onChange={e => setSettings({ ...settings, labelWidth: parseFloat(e.target.value) })}
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <span className="text-[10px] font-medium text-slate-500">Label H (mm)</span>
                                                <input
                                                    type="number" className="input text-xs py-1"
                                                    value={settings.labelHeight}
                                                    onChange={e => setSettings({ ...settings, labelHeight: parseFloat(e.target.value) })}
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="space-y-1">
                                                <span className="text-[10px] font-medium text-slate-500">Col Gap</span>
                                                <input
                                                    type="number" className="input text-xs py-1"
                                                    value={settings.columnGap}
                                                    onChange={e => setSettings({ ...settings, columnGap: parseFloat(e.target.value) })}
                                                />
                                            </div>
                                            <div className="space-y-1">
                                                <span className="text-[10px] font-medium text-slate-500">Row Gap</span>
                                                <input
                                                    type="number" className="input text-xs py-1"
                                                    value={settings.rowGap}
                                                    onChange={e => setSettings({ ...settings, rowGap: parseFloat(e.target.value) })}
                                                />
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Typography Section */}
                        <div>
                            <label className="text-[10px] font-medium text-slate-400 uppercase tracking-tighter mb-3 block">Typography</label>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-xs font-semibold text-slate-600">Name Size</span>
                                        <span className="text-[10px] font-mono font-medium bg-slate-100 px-1 rounded">{settings.nameFontSize}px</span>
                                    </div>
                                    <input
                                        type="range" min="10" max="40"
                                        className="w-full accent-primary h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                                        value={settings.nameFontSize}
                                        onChange={e => setSettings({ ...settings, nameFontSize: parseInt(e.target.value) })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-xs font-semibold text-slate-600">Price Size</span>
                                        <span className="text-[10px] font-mono font-medium bg-slate-100 px-1 rounded">{settings.priceFontSize}px</span>
                                    </div>
                                    <input
                                        type="range" min="8" max="30"
                                        className="w-full accent-primary h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                                        value={settings.priceFontSize}
                                        onChange={e => setSettings({ ...settings, priceFontSize: parseInt(e.target.value) })}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Barcode Section */}
                        <div>
                            <label className="text-[10px] font-medium text-slate-400 uppercase tracking-tighter mb-3 block">Barcode Specs</label>
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-xs font-semibold text-slate-600">Height</span>
                                        <span className="text-[10px] font-mono font-medium bg-slate-100 px-1 rounded">{settings.barcodeHeight}px</span>
                                    </div>
                                    <input
                                        type="range" min="20" max="200"
                                        className="w-full accent-primary h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                                        value={settings.barcodeHeight}
                                        onChange={e => setSettings({ ...settings, barcodeHeight: parseInt(e.target.value) })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between">
                                        <span className="text-xs font-semibold text-slate-600">Line Width</span>
                                        <span className="text-[10px] font-mono font-medium bg-slate-100 px-1 rounded">{settings.barcodeWidth}</span>
                                    </div>
                                    <input
                                        type="range" min="1" max="4" step="0.5"
                                        className="w-full accent-primary h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                                        value={settings.barcodeWidth}
                                        onChange={e => setSettings({ ...settings, barcodeWidth: parseFloat(e.target.value) })}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Layout Section */}
                        <div>
                            <label className="text-[10px] font-medium text-slate-400 uppercase tracking-tighter mb-3 block">Arrangement</label>
                            <div className="flex p-1 bg-slate-100 rounded-lg gap-1">
                                <button
                                    className={`flex-1 py-1.5 rounded-md flex justify-center transition-all ${settings.alignment === 'left' ? 'bg-white shadow-sm text-primary' : 'text-slate-400 hover:text-slate-600'}`}
                                    onClick={() => setSettings({ ...settings, alignment: 'left' })}
                                >
                                    <FiAlignLeft size={16} />
                                </button>
                                <button
                                    className={`flex-1 py-1.5 rounded-md flex justify-center transition-all ${settings.alignment === 'center' ? 'bg-white shadow-sm text-primary' : 'text-slate-400 hover:text-slate-600'}`}
                                    onClick={() => setSettings({ ...settings, alignment: 'center' })}
                                >
                                    <FiAlignCenter size={16} />
                                </button>
                                <button
                                    className={`flex-1 py-1.5 rounded-md flex justify-center transition-all ${settings.alignment === 'right' ? 'bg-white shadow-sm text-primary' : 'text-slate-400 hover:text-slate-600'}`}
                                    onClick={() => setSettings({ ...settings, alignment: 'right' })}
                                >
                                    <FiAlignRight size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Visibility Toggles */}
                        <div className="pt-4 border-t border-slate-100 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-slate-600">Show Name</span>
                                <button
                                    onClick={() => setSettings({ ...settings, showName: !settings.showName })}
                                    className={`w-8 h-4 rounded-full transition-colors relative ${settings.showName ? 'bg-primary' : 'bg-slate-300'}`}
                                >
                                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${settings.showName ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                                </button>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-slate-600">Show Price</span>
                                <button
                                    onClick={() => setSettings({ ...settings, showPrice: !settings.showPrice })}
                                    className={`w-8 h-4 rounded-full transition-colors relative ${settings.showPrice ? 'bg-primary' : 'bg-slate-300'}`}
                                >
                                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${settings.showPrice ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                                </button>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-slate-600">Code Text</span>
                                <button
                                    onClick={() => setSettings({ ...settings, showBarcodeValue: !settings.showBarcodeValue })}
                                    className={`w-8 h-4 rounded-full transition-colors relative ${settings.showBarcodeValue ? 'bg-primary' : 'bg-slate-300'}`}
                                >
                                    <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${settings.showBarcodeValue ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .DesignerContent, .DesignerContent * {
            visibility: visible;
          }
          .DesignerContent {
            position: absolute;
            left: 0;
            top: 0;
            width: ${settings.paperSize === 'Grid' ? '100%' : 'auto'} !important;
          }
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 10px;
        }
      `}</style>
        </div>
    );
}

