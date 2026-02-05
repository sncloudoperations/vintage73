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
  const [remarks, setRemarks] = useState('');
  const [outgoingTransfers, setOutgoingTransfers] = useState([]);
  const [activeTab, setActiveTab] = useState('new'); // 'new' | 'history'
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
    fetchInitialData(user.branchId);
  }, []);

  const fetchInitialData = async (branchId) => {
    try {
      const [{ data: branchData }, { data: productData }, { data: companyData }] = await Promise.all([
        api.get('/branches'),
        api.get('/products', { params: { branchId } }),
        api.get('/company')
      ]);
      setBranches(branchData.filter(b => b.id !== branchId));
      setProducts(productData);
      setCompany(companyData);
      fetchHistory(branchId);
    } catch (err) {
      toast.error('Failed to load data');
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
    if (!toBranchId) return toast.error('Select destination branch');
    if (rows.some(r => !r.productId || r.quantity <= 0)) return toast.error('Check items and quantities');

    try {
      await api.post('/transfers', {
        fromBranchId: currentUser.branchId,
        toBranchId,
        items: rows,
        remarks
      });
      toast.success('Stock transfer initiated!');
      setRows([{ productId: '', quantity: 1, unitCost: 0, taxPercent: 0, total: 0 }]);
      setRemarks('');
      setToBranchId('');
      fetchHistory(currentUser.branchId);
      setActiveTab('history');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Transfer failed');
    }
  };

  const handleCancel = async (id) => {
    if (!confirm('Cancel this transfer? Stock will be restored to your branch.')) return;
    try {
      await api.put(`/transfers/${id}/cancel`);
      toast.success('Transfer cancelled');
      fetchHistory(currentUser.branchId);
    } catch (err) {
      toast.error('Failed to cancel');
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
          onClick={() => setActiveTab('history')}
          className={`pb-2 px-1 border-b-2 transition-colors ${activeTab === 'history' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
        >
          Outgoing History
        </button>
      </div>

      {activeTab === 'new' ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 max-w-4xl">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2 whitespace-nowrap">Destination Branch</label>
              <select
                className="input w-full"
                value={toBranchId}
                onChange={e => setToBranchId(e.target.value)}
              >
                <option value="">Select Target Branch...</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2 whitespace-nowrap">Remarks (Optional)</label>
              <input
                className="input w-full"
                placeholder="Internal notes..."
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
              />
            </div>
          </div>

          <table className="w-full text-sm mb-6">
            <thead>
              <tr className="text-left text-slate-500 border-b border-slate-100">
                <th className="pb-3 px-2">Product</th>
                <th className="pb-3 px-2 w-24">Qty</th>
                <th className="pb-3 px-2 w-24">Cost</th>
                <th className="pb-3 px-2 w-20">Tax %</th>
                <th className="pb-3 px-2 w-28">Total</th>
                <th className="pb-3 px-2 w-16 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((row, index) => (
                <tr key={index}>
                  <td className="py-3 px-2">
                    <select
                      className="input w-full"
                      value={row.productId}
                      onChange={e => handleRowChange(index, 'productId', e.target.value)}
                    >
                      <option value="">Choose Product...</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} (Stk: {p.stock})</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3 px-2">
                    <input
                      type="number"
                      className="input w-full"
                      min="1"
                      value={row.quantity}
                      onChange={e => handleRowChange(index, 'quantity', e.target.value)}
                    />
                  </td>
                  <td className="py-3 px-2">
                    <input
                      type="number"
                      className="input w-full"
                      min="0"
                      value={row.unitCost}
                      onChange={e => handleRowChange(index, 'unitCost', e.target.value)}
                    />
                  </td>
                  <td className="py-3 px-2">
                    <input
                      type="number"
                      className="input w-full"
                      min="0"
                      value={row.taxPercent}
                      onChange={e => handleRowChange(index, 'taxPercent', e.target.value)}
                    />
                  </td>
                  <td className="py-3 px-2 font-bold text-slate-700">
                    {row.total?.toFixed(2)}
                  </td>
                  <td className="py-3 px-2 text-center">
                    <button onClick={() => handleRemoveRow(index)} className="text-red-400 hover:text-red-600 transition-colors">
                      <FiTrash />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-between items-center pt-4 border-t border-slate-100">
            <button onClick={handleAddRow} className="text-primary font-bold flex items-center gap-2 hover:bg-primary-light/10 px-4 py-2 rounded-xl transition-colors">
              <FiPlus /> Add Another Item
            </button>
            <button onClick={handleSubmit} className="bg-primary text-white font-bold px-8 py-3 rounded-2xl flex items-center gap-2 hover:bg-primary-dark shadow-lg shadow-primary/20 transition-all active:scale-95">
              <FiSend /> Initiate Transfer
            </button>
          </div>
        </div>
      ) : (
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
                  <tr><td colSpan="5" className="p-12 text-center text-slate-400 italic">No transfers match your filters</td></tr>
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
