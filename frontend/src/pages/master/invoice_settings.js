import { useState, useEffect } from 'react';

import api from '@/lib/api';
import { toast } from 'react-toastify';
import { FiSave, FiLayout, FiFileText, FiRefreshCw, FiCalendar, FiPlus, FiSearch, FiEdit2, FiTrash2 } from 'react-icons/fi';
import Modal from '@/components/Modal';

export default function InvoiceSettings() {
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('sales'); // 'sales' | 'return' | 'fy'
    const [fyList, setFyList] = useState([]);
    const [isFyModalOpen, setIsFyModalOpen] = useState(false);
    const [fySearch, setFySearch] = useState('');
    const [editingFy, setEditingFy] = useState(null);
    const [fyFormData, setFyFormData] = useState({
        name: '',
        startDate: '',
        endDate: '',
        invoicePrefix: 'INV',
        invoiceSequence: '001'
    });

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
        fetchFinancialYears();
    }, []);

    const fetchFinancialYears = async () => {
        try {
            const res = await api.get('/financial-years');
            setFyList(res.data);
        } catch (err) {
            console.error(err);
        }
    };

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

    const handleFySubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingFy) {
                await api.put(`/financial-years/${editingFy.id}`, fyFormData);
                toast.success('Financial Year Updated');
            } else {
                await api.post('/financial-years', fyFormData);
                toast.success('Financial Year Created');
            }
            setIsFyModalOpen(false);
            setEditingFy(null);
            fetchFinancialYears();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save financial year');
        }
    };

    const deleteFy = async (id) => {
        if (!window.confirm('Are you sure you want to delete this financial year?')) return;
        try {
            await api.delete(`/financial-years/${id}`);
            toast.success('Financial Year Deleted');
            fetchFinancialYears();
        } catch (err) {
            toast.error('Failed to delete financial year');
        }
    };

    const openFyModal = (fy = null) => {
        if (fy) {
            setEditingFy(fy);
            setFyFormData({
                name: fy.name,
                startDate: fy.startDate.split('T')[0],
                endDate: fy.endDate.split('T')[0],
                invoicePrefix: fy.invoicePrefix || 'INV',
                invoiceSequence: fy.invoiceSequence || 0
            });
        } else {
            setEditingFy(null);
            setFyFormData({
                name: '',
                startDate: '',
                endDate: '',
                invoicePrefix: 'INV',
                invoiceSequence: 0
            });
        }
        setIsFyModalOpen(true);
    };

    const currentConfig = settings[activeTab];

    return (
        <div className="flex h-screen bg-slate-50">

            <div className="flex-1 overflow-auto">
                <div className="p-8">
                    <h1 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                        <FiLayout /> Invoice Customization
                    </h1>

                    {/* Tabs */}
                    <div className="flex gap-4 mb-6 border-b border-slate-200">
                        <button
                            onClick={() => setActiveTab('sales')}
                            className={`pb-3 px-4 font-bold flex items-center gap-2 transition-colors border-b-2 ${activeTab === 'sales' ? 'border-primary text-primary-dark' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                        >
                            <FiFileText /> Sales Invoice
                        </button>
                        <button
                            onClick={() => setActiveTab('return')}
                            className={`pb-3 px-4 font-bold flex items-center gap-2 transition-colors border-b-2 ${activeTab === 'return' ? 'border-red-500 text-red-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                        >
                            <FiRefreshCw /> Return Invoice
                        </button>
                        <button
                            onClick={() => setActiveTab('fy')}
                            className={`pb-3 px-4 font-bold flex items-center gap-2 transition-colors border-b-2 ${activeTab === 'fy' ? 'border-primary text-primary-dark' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                        >
                            <FiCalendar /> Financial Year
                        </button>
                    </div>

                    {activeTab !== 'fy' ? (
                    <div className="flex flex-col lg:flex-row gap-8">
                        {/* Controls */}
                        <div className="flex-1 bg-white p-6 rounded-xl shadow-sm border border-slate-200 h-fit">
                            <h2 className="font-bold text-lg mb-4 text-slate-700 flex items-center justify-between">
                                <span>{activeTab === 'sales' ? 'Sales' : 'Return'} Configuration</span>
                                <span className={`text-xs px-2 py-1 rounded-full ${activeTab === 'sales' ? 'bg-primary-light/10 text-primary-dark' : 'bg-red-100 text-red-700'}`}>
                                    {activeTab.toUpperCase()}
                                </span>
                            </h2>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                                    <label className="font-medium text-slate-700">Show Logo</label>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input
                                            type="checkbox"
                                            className="sr-only peer"
                                            checked={currentConfig.showLogo}
                                            onChange={e => updateSetting('showLogo', e.target.checked)}
                                        />
                                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all after:shadow-sm peer-checked:bg-primary"></div>
                                    </label>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Header Title</label>
                                    <input
                                        type="text"
                                        className="w-full p-2 border rounded-lg focus:outline-primary"
                                        value={currentConfig.headerTitle}
                                        onChange={e => updateSetting('headerTitle', e.target.value)}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Footer Text</label>
                                    <input
                                        type="text"
                                        className="w-full p-2 border rounded-lg focus:outline-primary"
                                        value={currentConfig.footerText}
                                        onChange={e => updateSetting('footerText', e.target.value)}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Terms & Conditions</label>
                                    <textarea
                                        className="w-full p-2 border rounded-lg focus:outline-primary h-24"
                                        value={currentConfig.termsConditions}
                                        onChange={e => updateSetting('termsConditions', e.target.value)}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Page Size</label>
                                    <select
                                        className="w-full p-2 border rounded-lg focus:outline-primary bg-white"
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
                    ) : (
                        <FinancialYearSection 
                            fyList={fyList} 
                            onRefresh={fetchFinancialYears}
                            search={fySearch}
                            onSearchChange={setFySearch}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

function FinancialYearSection({ fyList, onRefresh, search, onSearchChange }) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingFy, setEditingFy] = useState(null);
    const [formData, setFormData] = useState({
        name: '', startDate: '', endDate: '', invoicePrefix: 'INV', invoiceSequence: '001'
    });

    const filteredList = fyList.filter(fy => 
        fy.name.toLowerCase().includes(search.toLowerCase()) ||
        (fy.invoicePrefix && fy.invoicePrefix.toLowerCase().includes(search.toLowerCase()))
    );

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingFy) {
                await api.put(`/financial-years/${editingFy.id}`, formData);
                toast.success('Financial Year Updated');
            } else {
                await api.post('/financial-years', formData);
                toast.success('Financial Year Created');
            }
            setIsModalOpen(false);
            onRefresh();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Error saving financial year');
        }
    };

    const openModal = (fy = null) => {
        if (fy) {
            setEditingFy(fy);
            setFormData({
                name: fy.name,
                startDate: fy.startDate.split('T')[0],
                endDate: fy.endDate.split('T')[0],
                invoicePrefix: fy.invoicePrefix || 'INV',
                invoiceSequence: fy.invoiceSequence || '001'
            });
        } else {
            setEditingFy(null);
            setFormData({
                name: '', startDate: '', endDate: '', invoicePrefix: 'INV', invoiceSequence: '001'
            });
        }
        setIsModalOpen(true);
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h2 className="text-xl font-bold text-slate-800">Financial Years</h2>
                    <p className="text-slate-500 text-sm">Manage prefixes and sequences for your invoices.</p>
                </div>
                <button 
                    onClick={() => openModal()}
                    className="bg-primary text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-primary-dark transition-all"
                >
                    <FiPlus /> Add Financial Year
                </button>
            </div>

            <div className="relative mb-6 max-w-md">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                    type="text"
                    placeholder="Search by prefix or name..."
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-primary bg-slate-50"
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                />
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 text-slate-500 font-bold border-b">
                            <th className="p-4">Name</th>
                            <th className="p-4">From Date</th>
                            <th className="p-4">To Date</th>
                            <th className="p-4">Prefix</th>
                            <th className="p-4">Next Seq</th>
                            <th className="p-4">Status</th>
                            <th className="p-4 text-center">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredList.map(fy => (
                            <tr key={fy.id} className="border-b hover:bg-slate-50 transition-colors">
                                <td className="p-4 font-bold text-slate-700">{fy.name}</td>
                                <td className="p-4 text-slate-600">{new Date(fy.startDate).toLocaleDateString('en-GB')}</td>
                                <td className="p-4 text-slate-600">{new Date(fy.endDate).toLocaleDateString('en-GB')}</td>
                                <td className="p-4"><span className="px-2 py-1 bg-slate-100 rounded text-slate-700 font-mono">{fy.invoicePrefix}</span></td>
                                <td className="p-4 text-slate-600 font-bold font-mono">{fy.invoiceSequence}</td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${fy.isClosed ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                        {fy.isClosed ? 'Closed' : 'Active'}
                                    </span>
                                </td>
                                <td className="p-4 flex items-center justify-center gap-2">
                                    <button 
                                        onClick={() => openModal(fy)}
                                        className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                    >
                                        <FiEdit2 />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {isModalOpen && (
                <Modal 
                    title={editingFy ? "Edit Financial Year" : "Add Financial Year"}
                    onClose={() => setIsModalOpen(false)}
                >
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-600 mb-1">Financial Year Name</label>
                            <input 
                                type="text"
                                className="w-full p-2 border rounded-lg focus:outline-primary"
                                placeholder="e.g., FY 2026-27"
                                required
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">From Date</label>
                                <input 
                                    type="date"
                                    className="w-full p-2 border rounded-lg focus:outline-primary"
                                    required
                                    value={formData.startDate}
                                    onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">To Date</label>
                                <input 
                                    type="date"
                                    className="w-full p-2 border rounded-lg focus:outline-primary"
                                    required
                                    value={formData.endDate}
                                    onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Invoice Prefix</label>
                                <input 
                                    type="text"
                                    className="w-full p-2 border rounded-lg focus:outline-primary"
                                    placeholder="e.g., INV26"
                                    required
                                    value={formData.invoicePrefix}
                                    onChange={e => setFormData({ ...formData, invoicePrefix: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-600 mb-1">Starting Seq #</label>
                                <input 
                                    type="text"
                                    className="w-full p-2 border rounded-lg focus:outline-primary"
                                    placeholder="e.g. 001"
                                    required
                                    value={formData.invoiceSequence}
                                    onChange={e => setFormData({ ...formData, invoiceSequence: e.target.value })}
                                />
                            </div>
                        </div>
                        <div className="flex gap-2 pt-4">
                            <button 
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="flex-1 py-2 border rounded-lg hover:bg-slate-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                type="submit"
                                className="flex-1 py-2 bg-primary text-white rounded-lg font-bold hover:bg-primary-dark shadow-sm transition-all"
                            >
                                {editingFy ? "Update" : "Save"} Financial Year
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
}
