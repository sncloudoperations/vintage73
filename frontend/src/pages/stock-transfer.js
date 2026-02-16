import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { FiPlus, FiTrash, FiSend, FiTruck, FiInfo, FiX, FiPrinter } from 'react-icons/fi';
import { useReactToPrint } from 'react-to-print';
import { useRef } from 'react';
import { toast } from 'react-toastify';

export default function StockTransfer() {
  const [branches, setBranches] = useState([]);
  const [products, setProducts] = useState([]);
  const [rows, setRows] = useState([{ productId: '', quantity: 1, unitCost: 0, taxPercent: 0, total: 0 }]);
  const [toBranchId, setToBranchId] = useState('');
  const [fromBranchId, setFromBranchId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [outgoingTransfers, setOutgoingTransfers] = useState([]);
  const [incomingTransfers, setIncomingTransfers] = useState([]);
  const [activeTab, setActiveTab] = useState('new'); // 'new' | 'outgoing' | 'incoming'
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedForPrint, setSelectedForPrint] = useState(null);
  const [company, setCompany] = useState(null);

  const stockPrintRef = useRef();
  const handlePrint = useReactToPrint({ contentRef: stockPrintRef });

  // Filter States
  const [filterBranchId, setFilterBranchId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    const user = JSON.parse(localStorage.getItem('user'));
    setCurrentUser(user);
    if (user.branchId) setFromBranchId(user.branchId.toString());
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (fromBranchId) {
      fetchProductsForBranch(fromBranchId);
      fetchHistory(fromBranchId);
      fetchIncoming(fromBranchId);
      // Reset rows when changing source branch to prevent invalid product selection
      setRows([{ productId: '', quantity: 1, unitCost: 0, taxPercent: 0, total: 0 }]);
    } else {
      setProducts([]);
      setOutgoingTransfers([]);
      setIncomingTransfers([]);
    }
  }, [fromBranchId]);

  const fetchInitialData = async () => {
    try {
      const [{ data: branchData }, { data: companyData }] = await Promise.all([
        api.get('/branches'),
        api.get('/company')
      ]);
      setBranches(branchData);
      setCompany(companyData);
    } catch (err) {
      toast.error('Failed to load data');
    }
  };

  const fetchProductsForBranch = async (branchId) => {
    try {
      const { data } = await api.get('/products', { params: { branchId } });
      const availableProducts = data.filter(p => p.stock > 0);
      setProducts(availableProducts);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load products for branch');
    }
  };

  const fetchHistory = async (branchId) => {
    try {
      const { data } = await api.get('/transfers', {
        params: { branchId, type: 'outgoing' }
      });
      setOutgoingTransfers(data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchIncoming = async (branchId) => {
    try {
      const { data } = await api.get('/transfers', {
        params: { branchId, type: 'incoming' }
      });
      setIncomingTransfers(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddRow = () => setRows([...rows, { productId: '', quantity: 1, unitCost: 0, taxPercent: 0, total: 0 }]);

  const handleRemoveRow = (index) => {
    if (rows.length > 1) {
      setRows(rows.filter((_, i) => i !== index));
    }
  };

  const handleRowChange = (index, field, value) => {
    const newRows = [...rows];
    newRows[index][field] = value;

    // Auto-fill from Product
    if (field === 'productId') {
      const product = products.find(p => p.id === parseInt(value));
      if (product) {
        newRows[index].taxPercent = parseFloat(product.taxRate || product.taxPercent || 0);
        if (product.costPrice) newRows[index].unitCost = parseFloat(product.costPrice);
      }
    }

    // Calculations
    const qty = parseFloat(newRows[index].quantity || 0);
    const cost = parseFloat(newRows[index].unitCost || 0);
    const taxRate = parseFloat(newRows[index].taxPercent || 0);

    const subTotal = qty * cost;
    const taxAmt = subTotal * (taxRate / 100);
    newRows[index].total = subTotal + taxAmt;

    setRows(newRows);
  };

  const handleSubmit = async () => {
    if (!fromBranchId) return toast.error('Select origin branch');
    if (!toBranchId) return toast.error('Select destination branch');
    if (fromBranchId === toBranchId) return toast.error('Source and destination branches cannot be the same');
    if (rows.some(r => !r.productId || r.quantity <= 0)) return toast.error('Check items and quantities');

    try {
      await api.post('/transfers', {
        fromBranchId,
        toBranchId,
        items: rows,
        remarks
      });
      toast.success('Stock transfer initiated!');
      setRows([{ productId: '', quantity: 1, unitCost: 0, taxPercent: 0, total: 0 }]);
      setRemarks('');
      setToBranchId('');
      fetchHistory(fromBranchId);
      fetchIncoming(fromBranchId);
      setActiveTab('outgoing');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Transfer failed');
    }
  };

  const handleCancel = async (id) => {
    if (!confirm('Cancel this transfer? Stock will be restored to your branch.')) return;
    try {
      await api.put(`/transfers/${id}/cancel`);
      toast.success('Transfer cancelled');
      fetchHistory(fromBranchId);
      fetchIncoming(fromBranchId);
    } catch (err) {
      toast.error('Failed to cancel');
    }
  };

  const handleAccept = async (id) => {
    if (!confirm('Accept this transfer? Stock will be added to your inventory.')) return;
    try {
      await api.put(`/transfers/${id}/receive`);
      toast.success('Transfer accepted! Stock has been added to your inventory.');
      fetchHistory(fromBranchId);
      fetchIncoming(fromBranchId);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to accept transfer');
    }
  };

  const filteredHistory = outgoingTransfers.filter(t => {
    const matchBranch = filterBranchId === '' || t.toBranchId === parseInt(filterBranchId);
    const date = new Date(t.createdAt).setHours(0, 0, 0, 0);
    const matchStart = startDate ? date >= new Date(startDate).setHours(0, 0, 0, 0) : true;
    const matchEnd = endDate ? date <= new Date(endDate).setHours(23, 59, 59, 999) : true;
    return matchBranch && matchStart && matchEnd;
  });

  const triggerPrint = (transfer) => {
    setSelectedForPrint(transfer);
    setTimeout(() => handlePrint(), 100);
  };

  return (
    <div className="p-4 md:p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Stock Transfer</h1>
          <p className="text-slate-500 text-sm">Move inventory to another branch</p>
        </div>
      </div>

      <div className="flex gap-4 mb-6 border-b border-slate-200 text-sm font-medium">
        <button
          onClick={() => setActiveTab('new')}
          className={`pb-2 px-1 border-b-2 transition-colors ${activeTab === 'new' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          New Transfer
        </button>
        <button
          onClick={() => setActiveTab('outgoing')}
          className={`pb-2 px-1 border-b-2 transition-colors ${activeTab === 'outgoing' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Outgoing History
        </button>
        <button
          onClick={() => setActiveTab('incoming')}
          className={`pb-2 px-1 border-b-2 transition-colors ${activeTab === 'incoming' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Incoming Transfers
        </button>
      </div>

      {activeTab === 'new' ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 max-w-4xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2 whitespace-nowrap">From Branch</label>
              <select
                className="input w-full"
                value={fromBranchId}
                onChange={e => setFromBranchId(e.target.value)}
              >
                <option value="">Select Origin Branch...</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2 whitespace-nowrap">To Branch</label>
              <select
                className="input w-full"
                value={toBranchId}
                onChange={e => setToBranchId(e.target.value)}
                disabled={!fromBranchId}
              >
                <option value="">Select Destination...</option>
                {branches.filter(b => b.id.toString() !== fromBranchId).map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Remarks</label>
              <input
                type="text"
                className="input w-full"
                placeholder="Optional notes..."
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-3">
            {rows.map((row, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-3 items-end">
                <div className="col-span-4">
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Product</label>
                  <select
                    className="input w-full text-sm"
                    value={row.productId}
                    onChange={e => handleRowChange(idx, 'productId', e.target.value)}
                  >
                    <option value="">Select Product...</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name} (Stock: {p.stock})</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Qty</label>
                  <input
                    type="number"
                    className="input w-full text-sm"
                    value={row.quantity}
                    onChange={e => handleRowChange(idx, 'quantity', e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Unit Cost</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input w-full text-sm"
                    value={row.unitCost}
                    onChange={e => handleRowChange(idx, 'unitCost', e.target.value)}
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Tax %</label>
                  <input
                    type="number"
                    step="0.01"
                    className="input w-full text-sm"
                    value={row.taxPercent}
                    onChange={e => handleRowChange(idx, 'taxPercent', e.target.value)}
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">Total</label>
                  <p className="font-bold text-sm text-slate-700 py-2">{row.total.toFixed(2)}</p>
                </div>
                <div className="col-span-1 flex justify-end pb-2">
                  {rows.length > 1 && (
                    <button onClick={() => handleRemoveRow(idx)} className="text-red-500 hover:bg-red-50 p-2 rounded-lg transition-colors">
                      <FiTrash />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button onClick={handleAddRow} className="mt-4 text-primary hover:bg-primary-light/10 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors">
            <FiPlus /> Add Item
          </button>

          <div className="mt-8 flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={!fromBranchId || !toBranchId || products.length === 0}
              className="bg-primary text-white font-bold px-8 py-3 rounded-2xl flex items-center gap-2 hover:bg-primary-dark shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FiSend /> Initiate Transfer
            </button>
          </div>
        </div>
      ) : activeTab === 'outgoing' ? (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">To Branch</label>
              <select className="input w-full" value={filterBranchId} onChange={e => setFilterBranchId(e.target.value)}>
                <option value="">All Branches</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">From Date</label>
              <input type="date" className="input" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase mb-2">To Date</label>
              <input type="date" className="input" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <button
              onClick={() => { setFilterBranchId(''); setStartDate(''); setEndDate(''); }}
              className="text-slate-400 hover:text-red-500 font-bold text-xs flex items-center gap-1 pb-3 px-2 transition-colors uppercase"
            >
              Reset
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-widest border-b border-slate-100">
                <tr>
                  <th className="p-4 pl-6">Date</th>
                  <th className="p-4">To Branch</th>
                  <th className="p-4">Items</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4">Received By/Date</th>
                  <th className="p-4 text-right pr-6">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredHistory.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50/50">
                    <td className="p-4 pl-6">{new Date(t.createdAt).toLocaleDateString()}</td>
                    <td className="p-4 font-bold text-slate-700">{t.toBranch?.name}</td>
                    <td className="p-4 text-xs">
                      {t.items.map(i => `${i.product.name} (x${i.quantity})`).join(', ')}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${t.status === 'PENDING' ? 'bg-orange-100 text-orange-600' :
                        t.status === 'RECEIVED' ? 'bg-primary-light/10 text-primary' :
                          'bg-slate-100 text-slate-400'
                        }`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="p-4">
                      {t.status === 'RECEIVED' ? (
                        <div className="flex flex-col">
                          <p className="font-bold text-slate-700">{t.receivedBy?.name || t.receivedBy?.username || 'System'}</p>
                          <p className="text-[10px] text-slate-400 font-medium">
                            {t.receivedAt ? new Date(t.receivedAt).toLocaleString() : '-'}
                          </p>
                        </div>
                      ) : (
                        <span className="text-slate-300 italic text-[10px]">Not yet received</span>
                      )}
                    </td>
                    <td className="p-4 text-right pr-6 flex justify-end gap-2">
                      <button
                        onClick={() => triggerPrint(t)}
                        className="text-primary hover:bg-primary-light/10 px-2 py-1 rounded-lg text-[10px] font-bold uppercase transition-colors flex items-center gap-1"
                      >
                        <FiPrinter /> Print
                      </button>
                      {t.status === 'PENDING' && (
                        <button onClick={() => handleCancel(t.id)} className="text-red-500 hover:bg-red-50 px-2 py-1 rounded-lg text-[10px] font-bold uppercase transition-colors">
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredHistory.length === 0 && (
                  <tr><td colSpan="6" className="p-12 text-center text-slate-400 italic">No transfers match your filters</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-widest border-b border-slate-100">
                <tr>
                  <th className="p-4 pl-6">Date</th>
                  <th className="p-4">From Branch</th>
                  <th className="p-4">Items</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-right pr-6">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {incomingTransfers.map(t => (
                  <tr key={t.id} className="hover:bg-slate-50/50">
                    <td className="p-4 pl-6">{new Date(t.createdAt).toLocaleDateString()}</td>
                    <td className="p-4 font-bold text-slate-700">{t.fromBranch?.name}</td>
                    <td className="p-4 text-xs">
                      {t.items.map(i => `${i.product.name} (x${i.quantity})`).join(', ')}
                    </td>
                    <td className="p-4 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${t.status === 'PENDING' ? 'bg-orange-100 text-orange-600' :
                        t.status === 'RECEIVED' ? 'bg-primary-light/10 text-primary' :
                          'bg-slate-100 text-slate-400'
                        }`}>
                        {t.status}
                      </span>
                    </td>
                    <td className="p-4 text-right pr-6 flex justify-end gap-2">
                      <button
                        onClick={() => triggerPrint(t)}
                        className="text-primary hover:bg-primary-light/10 px-2 py-1 rounded-lg text-[10px] font-bold uppercase transition-colors flex items-center gap-1"
                      >
                        <FiPrinter /> Print
                      </button>
                      {t.status === 'PENDING' && (
                        <button
                          onClick={() => handleAccept(t.id)}
                          className="bg-primary text-white hover:bg-primary-dark px-3 py-1 rounded-lg text-[10px] font-bold uppercase transition-colors flex items-center gap-1"
                        >
                          <FiTruck /> Accept Transfer
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {incomingTransfers.length === 0 && (
                  <tr><td colSpan="5" className="p-12 text-center text-slate-400 italic">No incoming transfers</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Printable Stock Transfer Challan (A4 Size) */}
      <div style={{ display: 'none' }}>
        <div ref={stockPrintRef} className="p-10 text-black bg-white" style={{ width: '210mm', minHeight: '297mm', fontFamily: 'sans-serif' }}>
          <div className="text-center border-b-2 border-slate-900 pb-3 mb-6">
            <h1 className="text-xl font-black uppercase tracking-tighter">Stock Transfer Challan</h1>
            <h2 className="text-base font-bold mt-0.5 text-slate-700">{company?.companyName || 'BILLING SOFTWARE'}</h2>
            <p className="text-[9px] text-slate-500 uppercase tracking-widest">{company?.address || 'Inventory Management System'}</p>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6 text-[10px]">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <p className="font-black text-slate-400 uppercase text-[8px] mb-1 tracking-widest">Sending Branch</p>
              <p className="font-bold text-base text-slate-800">{selectedForPrint?.fromBranch?.name}</p>
              <p className="text-slate-500 mt-0.5">{selectedForPrint?.fromBranch?.address || 'Branch Address Not Set'}</p>
            </div>
            <div className="bg-primary-light/10 p-3 rounded-xl border border-primary-light/20">
              <p className="font-black text-primary uppercase text-[8px] mb-1 tracking-widest">Receiving Branch</p>
              <p className="font-bold text-base text-slate-800">{selectedForPrint?.toBranch?.name}</p>
              <p className="text-slate-500 mt-0.5">{selectedForPrint?.toBranch?.address || 'Branch Address Not Set'}</p>
            </div>
          </div>

          <div className="flex justify-between items-end mb-4 pb-2 border-b border-slate-100">
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase">Transfer ID</p>
              <p className="text-sm font-mono font-bold text-slate-800">#ST-{selectedForPrint?.id?.toString().padStart(6, '0')}</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] font-bold text-slate-400 uppercase">Transfer Date</p>
              <p className="text-[11px] font-bold text-slate-800">{selectedForPrint?.createdAt ? new Date(selectedForPrint.createdAt).toLocaleString() : '-'}</p>
            </div>
          </div>

          <table className="w-full text-[11px] mb-6">
            <thead>
              <tr className="bg-slate-900 text-white">
                <th className="p-2 text-left rounded-l-md font-bold uppercase tracking-wider">Item Name</th>
                <th className="p-2 text-center w-20 font-bold uppercase tracking-wider">Qty</th>
                <th className="p-2 text-right w-24 font-bold uppercase tracking-wider">Price/Unit</th>
                <th className="p-2 text-right w-24 rounded-r-md font-bold uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {selectedForPrint?.items?.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50">
                  <td className="p-2 font-medium text-slate-700">{item.product?.name}</td>
                  <td className="p-2 text-center font-bold text-slate-900">{item.quantity}</td>
                  <td className="p-2 text-right text-slate-600">{parseFloat(item.unitCost).toFixed(2)}</td>
                  <td className="p-2 text-right font-bold text-slate-800">{parseFloat(item.totalCost).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {selectedForPrint?.remarks && (
            <div className="mb-6 p-3 bg-slate-50 rounded-lg border border-slate-100">
              <p className="text-[9px] font-bold text-slate-400 uppercase mb-0.5">Remarks</p>
              <p className="text-[10px] text-slate-600 italic">"{selectedForPrint.remarks}"</p>
            </div>
          )}

          {selectedForPrint?.status === 'RECEIVED' && (
            <div className="mt-auto grid grid-cols-2 gap-6 pt-6 border-t font-sans">
              <div>
                <p className="text-[8px] font-black text-slate-400 uppercase mb-3 tracking-widest text-center">Issued By (Sender)</p>
                <div className="h-12 border-b border-slate-200"></div>
              </div>
              <div className="text-right">
                <p className="text-[8px] font-black text-primary uppercase mb-1 tracking-widest">Received & Verified By</p>
                <p className="font-bold text-sm text-slate-800">{selectedForPrint.receivedBy?.name || 'Staff'}</p>
                <p className="text-[9px] text-slate-400 uppercase">
                  {selectedForPrint.receivedAt ? new Date(selectedForPrint.receivedAt).toLocaleString() : '-'}
                </p>
              </div>
            </div>
          )}

          <div className="mt-8 text-center border-t pt-4">
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">Electronic Stock Transfer Document - No Signature Required</p>
          </div>
        </div>
      </div>
    </div>
  );
}
