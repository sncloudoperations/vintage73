import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';
import { toast } from 'react-toastify';
import { FiSave, FiLayout, FiFileText, FiRefreshCw } from 'react-icons/fi';

export default function InvoiceSettings() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('sales'); // 'sales' | 'return'
  
  const defaultSettings = {
      showLogo: true,
      headerTitle: 'TAX INVOICE',
      footerText: 'Thank you for your business!',
      termsConditions: 'Goods once sold will not be taken back.',
      accentColor: '#10b981',
      pageSize: 'A5' // A4, A5, Thermal
  };

  const defaultReturnSettings = {
      showLogo: true,
      headerTitle: 'SALES RETURN / CREDIT NOTE',
      footerText: 'Authorized Signature',
      termsConditions: 'Valid for credit adjustment only.',
      accentColor: '#ef4444',
      pageSize: 'A5'
  };

  const [settings, setSettings] = useState({
      sales: defaultSettings,
      return: defaultReturnSettings
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/company');
      const data = res.data?.invoiceSettings;
      
      if (data) {
        // Handle migration from old flat structure if needed
        if (data.sales && data.return) {
            setSettings(data);
        } else {
            // Assume existing data is for sales, and use default for return
            setSettings({
                sales: { ...defaultSettings, ...data }, // Merge existing items
                return: defaultReturnSettings
            });
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      await api.put('/company', { invoiceSettings: settings });
      toast.success('Invoice Settings Saved!');
    } catch (err) {
      toast.error('Failed to save settings');
    }
  };

  const updateSetting = (key, value) => {
      setSettings(prev => ({
          ...prev,
          [activeTab]: {
              ...prev[activeTab],
              [key]: value
          }
      }));
  };

  const currentConfig = settings[activeTab];

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar />
      <div className="flex-1 overflow-auto">
        <div className="p-8">
            <h1 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                <FiLayout /> Invoice Customization
            </h1>

            {/* Tabs */}
            <div className="flex gap-4 mb-6 border-b border-slate-200">
                <button 
                    onClick={() => setActiveTab('sales')}
                    className={`pb-3 px-4 font-bold flex items-center gap-2 transition-colors border-b-2 ${activeTab === 'sales' ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    <FiFileText /> Sales Invoice
                </button>
                <button 
                    onClick={() => setActiveTab('return')}
                    className={`pb-3 px-4 font-bold flex items-center gap-2 transition-colors border-b-2 ${activeTab === 'return' ? 'border-red-500 text-red-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                    <FiRefreshCw /> Return Invoice
                </button>
            </div>

            <div className="flex flex-col lg:flex-row gap-8">
                {/* Controls */}
                <div className="flex-1 bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-fit">
                    <h2 className="font-bold text-lg mb-4 text-slate-700 flex items-center justify-between">
                        <span>{activeTab === 'sales' ? 'Sales' : 'Return'} Configuration</span>
                        <span className={`text-xs px-2 py-1 rounded-full ${activeTab === 'sales' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                            {activeTab.toUpperCase()}
                        </span>
                    </h2>
                    
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                            <label className="font-medium text-slate-700">Show Logo</label>
                            <input 
                                type="checkbox" 
                                className="w-5 h-5 accent-emerald-600"
                                checked={currentConfig.showLogo}
                                onChange={e => updateSetting('showLogo', e.target.checked)}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">Header Title</label>
                            <input 
                                type="text"
                                className="w-full p-2 border rounded-lg focus:outline-emerald-500"
                                value={currentConfig.headerTitle}
                                onChange={e => updateSetting('headerTitle', e.target.value)}
                            />
                        </div>

                         <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">Footer Text</label>
                            <input 
                                type="text"
                                className="w-full p-2 border rounded-lg focus:outline-emerald-500"
                                value={currentConfig.footerText}
                                onChange={e => updateSetting('footerText', e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">Terms & Conditions</label>
                            <textarea 
                                className="w-full p-2 border rounded-lg focus:outline-emerald-500 h-24"
                                value={currentConfig.termsConditions}
                                onChange={e => updateSetting('termsConditions', e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">Page Size</label>
                            <select 
                                className="w-full p-2 border rounded-lg focus:outline-emerald-500 bg-white"
                                value={currentConfig.pageSize || 'A5'}
                                onChange={e => updateSetting('pageSize', e.target.value)}
                            >
                                <option value="A4">A4 (Standard Office)</option>
                                <option value="A5">A5 (Half A4)</option>
                                <option value="Thermal">Thermal (80mm)</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">Accent Color</label>
                            <div className="flex items-center gap-2">
                                <input 
                                    type="color"
                                    className="w-10 h-10 border rounded cursor-pointer"
                                    value={currentConfig.accentColor}
                                    onChange={e => updateSetting('accentColor', e.target.value)}
                                />
                                <span className="text-sm font-mono text-slate-500">{currentConfig.accentColor}</span>
                            </div>
                        </div>

                        <button 
                            onClick={handleSave}
                            className="w-full py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition-colors flex items-center justify-center gap-2 mt-4"
                        >
                            <FiSave /> Save All Settings
                        </button>
                    </div>
                </div>

                {/* Preview */}
                <div className="flex-[1.5] bg-slate-200 p-8 rounded-xl flex justify-center overflow-auto shadow-inner">
                    <div 
                        className="bg-white shadow-xl transition-all duration-300 relative group overflow-hidden"
                        style={{ 
                            width: currentConfig.pageSize === 'A4' ? '400px' : currentConfig.pageSize === 'Thermal' ? '250px' : '300px', 
                            minHeight: currentConfig.pageSize === 'Thermal' ? '400px' : '500px',
                            padding: currentConfig.pageSize === 'Thermal' ? '10px' : '20px',
                            borderTop: `8px solid ${currentConfig.accentColor}`,
                            fontSize: currentConfig.pageSize === 'Thermal' ? '10px' : '12px'
                        }}
                    >
                         <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 text-white text-xs px-2 py-1 rounded">
                             Preview: {activeTab.toUpperCase()}
                         </div>

                        {/* Preview Header */}
                        <div className="text-center mb-6">
                            {currentConfig.showLogo && (
                                <div className="w-16 h-16 bg-slate-100 rounded-full mx-auto mb-2 flex items-center justify-center text-xs text-slate-400">LOGO</div>
                            )}
                            <h2 className="text-xl font-bold uppercase" style={{ color: currentConfig.accentColor }}>{currentConfig.headerTitle}</h2>
                            <p className="text-xs text-slate-500">Your Company Name</p>
                        </div>

                        {/* ... items ... */}
                         <div className="mb-4 text-xs">
                             <div className="flex justify-between border-b pb-1 font-bold mb-2">
                                 <span>Item</span>
                                 <span>Total</span>
                             </div>
                             <div className="flex justify-between py-1 border-b border-dashed">
                                 <span>Sample Product A</span>
                                 <span>₹100.00</span>
                             </div>
                         </div>

                         {/* ... total ... */}
                         <div className="flex justify-end mb-6">
                             <div className="w-1/2">
                                <div className="flex justify-between font-bold text-sm">
                                    <span>Total</span>
                                    <span>₹100.00</span>
                                </div>
                             </div>
                         </div>

                         {/* Preview Footer */}
                         <div className="text-center mt-auto pt-8 border-t">
                            <p className="font-bold text-xs mb-1" style={{ color: currentConfig.accentColor }}>Terms & Conditions</p>
                            <p className="text-[10px] text-slate-500 whitespace-pre-wrap">{currentConfig.termsConditions}</p>
                            <p className="text-[10px] text-slate-400 mt-4">{currentConfig.footerText}</p>
                         </div>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
}
