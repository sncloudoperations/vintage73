import { useState, useEffect } from 'react';

import api from '@/lib/api';
import { toast } from 'react-toastify';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import {
  FiLayout, FiSave, FiFileText, FiRefreshCw, FiGrid, FiImage, FiMapPin,
  FiPhone, FiHash, FiUser, FiCheckSquare, FiPenTool, FiType, FiMaximize, FiAlignLeft, FiAlignCenter, FiAlignRight, FiPrinter,
  FiPlus, FiDollarSign, FiBriefcase, FiTrash2, FiPercent, FiCheck, FiEdit2
} from 'react-icons/fi';

const COMPONENT_METADATA = {
  logo: { label: 'Logo', icon: FiImage },
  company_name: { label: 'Company Name', icon: FiType },
  address: { label: 'Address', icon: FiMapPin },
  contact: { label: 'Contact Info', icon: FiPhone },
  invoice_meta: { label: 'Invoice Info', icon: FiGrid },
  customer: { label: 'Customer', icon: FiUser },
  salesman: { label: 'Salesman', icon: FiUser },
  details_table: { label: 'Items Table', icon: FiGrid },
  total_summary: { label: 'Billing Summary', icon: FiHash },
  tax_summary: { label: 'GST Breakdown', icon: FiPercent },
  payment_info: { label: 'Payment Details', icon: FiDollarSign },
  bank_details: { label: 'Bank Details', icon: FiBriefcase },
  udf_fields: { label: 'Custom Fields (UDF)', icon: FiEdit2 },
  custom_note: { label: 'Custom Note/Text', icon: FiFileText },
  terms: { label: 'Terms', icon: FiCheckSquare },
  signature: { label: 'Signature', icon: FiPenTool },
  footer_note: { label: 'Footer Note', icon: FiFileText },
  return_info: { label: 'Return Info', icon: FiRefreshCw }
};

const FONT_FAMILIES = [
  { label: 'Sans Serif (Modern)', value: 'sans-serif' },
  { label: 'Serif (Classic)', value: 'serif' },
  { label: 'Monospace (Typewriter)', value: 'monospace' },
  { label: 'Inter', value: 'Inter, sans-serif' },
  { label: 'Roboto', value: 'Roboto, sans-serif' }
];

export default function ReportDesign() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('sales');
  const [selectedId, setSelectedId] = useState(null);
  const [settings, setSettings] = useState({});
  const [company, setCompany] = useState(null);
  const [branches, setBranches] = useState([]);
  const [selectedBranchId, setSelectedBranchId] = useState('');

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [compRes, branchRes] = await Promise.all([
        api.get('/company'),
        api.get('/branches')
      ]);
      setCompany(compRes.data);
      setBranches(branchRes.data);

      const user = JSON.parse(localStorage.getItem('user'));
      const initialBranchId = user?.branchId || branchRes.data[0]?.id || '';
      setSelectedBranchId(initialBranchId);

      if (initialBranchId) {
        fetchBranchSettings(initialBranchId);
      } else {
        // No branch available, initialize with default settings and stop loading
        const defaultLayout = {
          header: ['logo', 'company_name', 'address', 'contact', 'invoice_meta', 'customer'],
          body: ['details_table', 'total_summary'],
          footer: ['terms', 'signature', 'footer_note']
        };
        const defaultStyles = {};
        Object.keys(COMPONENT_METADATA).forEach(id => {
          defaultStyles[id] = {
            fontSize: (id === 'company_name' || id === 'details_table') ? '18' : '12',
            fontWeight: (id === 'company_name' || id === 'terms' || id === 'total_summary') ? 'bold' : 'normal',
            fontFamily: 'sans-serif',
            align: id === 'total_summary' ? 'right' : 'center',
            paddingTop: '4',
            paddingBottom: '4',
            color: '#000000',
            showHSN: id === 'details_table' ? true : false,
            showDiscount: id === 'details_table' ? true : false,
            showTax: id === 'details_table' ? true : false
          };
        });
        const initial = {
          sales: { layout: { ...defaultLayout }, styles: { ...defaultStyles }, pageSize: 'A5', printerName: '' },
          return: { layout: { ...defaultLayout }, styles: { ...defaultStyles }, pageSize: 'A5', printerName: '' }
        };
        setSettings(initial);
        setLoading(false);
        toast.error('No branches found. Please create a branch first.');
      }
    } catch (err) {
      toast.error('Failed to load initial data');
      setLoading(false);
    }
  };

  const fetchBranchSettings = async (branchId) => {
    setLoading(true);
    try {
      const res = await api.get(`/branches/${branchId}`);
      const invSettings = res.data?.invoiceSettings;

      if (invSettings && invSettings.sales?.styles) {
        setSettings(invSettings);
      } else {
        // Initialize with default complex structure
        const defaultLayout = {
          header: ['logo', 'company_name', 'address', 'contact', 'invoice_meta', 'customer'],
          body: ['details_table', 'total_summary'],
          footer: ['terms', 'signature', 'footer_note']
        };
        const defaultStyles = {};
        Object.keys(COMPONENT_METADATA).forEach(id => {
          defaultStyles[id] = {
            fontSize: (id === 'company_name' || id === 'details_table') ? '18' : '12',
            fontWeight: (id === 'company_name' || id === 'terms' || id === 'total_summary') ? 'bold' : 'normal',
            fontFamily: 'sans-serif',
            align: id === 'total_summary' ? 'right' : 'center',
            paddingTop: '4',
            paddingBottom: '4',
            color: '#000000',
            showHSN: id === 'details_table' ? true : false,
            showDiscount: id === 'details_table' ? true : false,
            showTax: id === 'details_table' ? true : false
          };
        });

        const initial = {
          sales: { layout: { ...defaultLayout }, styles: { ...defaultStyles }, pageSize: 'A5', printerName: '' },
          return: { layout: { ...defaultLayout }, styles: { ...defaultStyles }, pageSize: 'A5', printerName: '' }
        };
        setSettings(initial);
      }
    } catch (err) {
      toast.error('Failed to load branch settings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedBranchId) {
      fetchBranchSettings(selectedBranchId);
    }
  }, [selectedBranchId]);

  const currentTabSettings = settings[activeTab] || {};
  const currentStyles = currentTabSettings.styles || {};
  const currentLayout = currentTabSettings.layout || { header: [], footer: [] };

  const onDragEnd = (result) => {
    const { destination, source } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const newSettings = { ...settings };
    const tabLayout = { ...newSettings[activeTab].layout };

    const [removed] = tabLayout[source.droppableId].splice(source.index, 1);
    tabLayout[destination.droppableId].splice(destination.index, 0, removed);

    newSettings[activeTab].layout = tabLayout;
    setSettings(newSettings);
  };

  const removeComponent = (id) => {
    const newSettings = { ...settings };
    const tabLayout = { ...newSettings[activeTab].layout };

    // Search and remove from any zone
    Object.keys(tabLayout).forEach(zone => {
      tabLayout[zone] = tabLayout[zone].filter(item => item !== id);
    });

    newSettings[activeTab].layout = tabLayout;
    setSettings(newSettings);
    setSelectedId(null);
    toast.success('Element removed');
  };

  const updateStyle = (styleKey, value) => {
    if (!selectedId) return;
    const newSettings = { ...settings };
    newSettings[activeTab].styles[selectedId][styleKey] = value;
    setSettings(newSettings);
  };

  const updatePageSetting = (key, value) => {
    const newSettings = { ...settings };
    newSettings[activeTab][key] = value;
    setSettings(newSettings);
  };

  const handleSave = async () => {
    if (!selectedBranchId) return toast.error('Please select a branch');
    try {
      await api.put(`/branches/${selectedBranchId}/invoice-settings`, { invoiceSettings: settings });
      toast.success('Design Saved for Branch!');
    } catch (err) {
      toast.error('Failed to save design');
    }
  };

  if (loading) return <div className="p-8 text-center">Loading Designer...</div>;

  const selectedStyle = selectedId ? currentStyles[selectedId] : null;

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-100 lg:overflow-hidden text-slate-800">

      <div className="flex-1 flex flex-col min-w-0">

        {/* Header Bar */}
        <div className="bg-white border-b border-slate-200 px-4 md:px-8 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 z-10">
          <div className="flex flex-wrap items-center gap-4">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <FiLayout className="text-primary" /> Designer <span className="text-slate-300 font-light hidden sm:inline">|</span>
            </h1>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest whitespace-nowrap">Branch:</span>
              <select
                className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium outline-none focus:ring-2 focus:ring-primary min-w-[150px] max-w-[200px]"
                value={selectedBranchId}
                onChange={e => setSelectedBranchId(e.target.value)}
              >
                {branches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>

            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setActiveTab('sales')}
                className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'sales' ? 'bg-white shadow text-primary' : 'text-slate-400'}`}
              >
                SALES
              </button>
              <button
                onClick={() => setActiveTab('return')}
                className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${activeTab === 'return' ? 'bg-white shadow text-red-600' : 'text-slate-400'}`}
              >
                RETURN
              </button>
            </div>
          </div>
          <button
            onClick={handleSave}
            className="w-full md:w-auto px-6 py-2 bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95 whitespace-nowrap"
          >
            <FiSave /> Save for Branch
          </button>
        </div>

        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden lg:overflow-visible">

          {/* Left: Component Toolbox */}
          <div className="w-full lg:w-72 bg-white border-r border-slate-200 p-6 overflow-y-auto lg:h-[calc(100vh-80px)]">
            <h3 className="text-xs font-medium text-slate-400 uppercase tracking-widest mb-4">Toolbar</h3>
            <div className="space-y-6">

              {/* Page Settings */}
              <div className="space-y-3">
                <label className="text-[10px] font-medium text-slate-400 uppercase">Page Configuration</label>
                <div className="space-y-2">
                  <div>
                    <span className="text-xs text-slate-500">Page Size</span>
                    <select
                      className="w-full mt-1 p-2 bg-slate-50 border border-slate-200 rounded-md text-sm outline-none"
                      value={currentTabSettings.pageSize}
                      onChange={e => updatePageSetting('pageSize', e.target.value)}
                    >
                      <option value="A4">A4 Standard</option>
                      <option value="A5">A5 Half Size</option>
                      <option value="Thermal">Thermal 80mm</option>
                    </select>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Default Printer</span>
                    <div className="relative">
                      <FiPrinter className="absolute left-3 top-3 text-slate-300" />
                      <input
                        className="w-full mt-1 p-2 pl-9 bg-slate-50 border border-slate-200 rounded-md text-sm outline-none"
                        placeholder="e.g. Epson-XP-500"
                        value={currentTabSettings.printerName}
                        onChange={e => updatePageSetting('printerName', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <hr className="border-slate-100" />

              {/* Elements */}
              <div className="space-y-3">
                <label className="text-[10px] font-medium text-slate-400 uppercase">Interactive Elements</label>
                <p className="text-[10px] text-slate-400 italic">Toggle an element to add or remove it from the layout</p>
                <div className="grid grid-cols-1 gap-2">
                  {Object.entries(COMPONENT_METADATA).map(([id, meta]) => {
                    const isOn = settings[activeTab]?.layout?.header?.includes(id) ||
                      settings[activeTab]?.layout?.body?.includes(id) ||
                      settings[activeTab]?.layout?.footer?.includes(id);

                    const handleToggle = () => {
                      const newSettings = { ...settings };
                      const layout = newSettings[activeTab].layout;
                      if (isOn) {
                        // Remove from all zones
                        layout.header = (layout.header || []).filter(i => i !== id);
                        layout.body = (layout.body || []).filter(i => i !== id);
                        layout.footer = (layout.footer || []).filter(i => i !== id);
                        setSettings(newSettings);
                        toast.success(`${meta.label} removed from layout`);
                      } else {
                        // Add to header
                        layout.header = [...(layout.header || []), id];
                        setSettings(newSettings);
                        toast.success(`${meta.label} added to Header`);
                      }
                    };

                    return (
                      <div
                        key={id}
                        className="w-full p-2.5 rounded-lg border border-slate-100 bg-white shadow-sm flex items-center gap-3"
                      >
                        <meta.icon className={isOn ? 'text-primary' : 'text-slate-400'} />
                        <span className={`text-xs font-medium flex-1 ${isOn ? 'text-slate-900' : 'text-slate-600'}`}>{meta.label}</span>
                        <button
                          type="button"
                          onClick={handleToggle}
                          className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isOn ? 'bg-primary' : 'bg-slate-200'}`}
                          aria-pressed={isOn}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isOn ? 'translate-x-4' : 'translate-x-0'}`}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Center: Live Canvas */}
          <div className="flex-1 bg-slate-100 p-4 md:p-12 overflow-y-auto flex justify-center items-start lg:h-[calc(100vh-80px)] lg:no-scrollbar">
            <DragDropContext onDragEnd={onDragEnd}>
              <div
                className={`bg-white shadow-2xl transition-all duration-300 relative ${currentTabSettings.pageSize === 'Thermal' ? 'w-[320px]' : currentTabSettings.pageSize === 'A5' ? 'w-[480px]' : 'w-[640px]'}`}
                style={{ minHeight: '800px', padding: '40px' }}
              >
                <div className="absolute -top-6 left-0 text-[10px] font-medium text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <FiMaximize /> Preview Canvas ({currentTabSettings.pageSize})
                </div>

                {/* Header Zone */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="bg-slate-50 px-6 py-3 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Header Zone</span>
                    <FiLayout className="text-slate-300" />
                  </div>
                  <Droppable droppableId="header">
                    {(provided, snapshot) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className={`p-4 min-h-[100px] transition-colors ${snapshot.isDraggingOver ? 'bg-primary-light/10' : 'bg-white'}`}
                      >
                        {currentLayout.header.map((id, index) => (
                          <DraggableElement key={id} id={id} index={index} styles={currentStyles[id]} isSelected={selectedId === id} onClick={() => setSelectedId(id)} removeComponent={removeComponent} />
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>

                {/* Body Zone */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="bg-slate-50 px-6 py-3 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Body Zone (Details)</span>
                    <FiGrid className="text-slate-300" />
                  </div>
                  <Droppable droppableId="body">
                    {(provided, snapshot) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className={`p-4 min-h-[200px] transition-colors ${snapshot.isDraggingOver ? 'bg-primary-light/10' : 'bg-white'}`}
                      >
                        {currentLayout.body?.map((id, index) => (
                          <DraggableElement key={id} id={id} index={index} styles={currentStyles[id]} isSelected={selectedId === id} onClick={() => setSelectedId(id)} removeComponent={removeComponent} />
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>

                {/* Footer Zone */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                  <div className="bg-slate-50 px-6 py-3 border-b border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">Footer Zone</span>
                    <FiLayout className="text-slate-300" />
                  </div>
                  <Droppable droppableId="footer">
                    {(provided, snapshot) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className={`p-4 min-h-[100px] transition-colors ${snapshot.isDraggingOver ? 'bg-primary-light/10' : 'bg-white'}`}
                      >
                        {currentLayout.footer.map((id, index) => (
                          <DraggableElement key={id} id={id} index={index} styles={currentStyles[id]} isSelected={selectedId === id} onClick={() => setSelectedId(id)} removeComponent={removeComponent} />
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              </div>
            </DragDropContext>
          </div>

          {/* Right: Property Panel */}
          <div className="w-full lg:w-80 bg-white border-l border-slate-200 p-6 overflow-y-auto lg:h-[calc(100vh-80px)]">
            {selectedId ? (
              <div className="space-y-6 animate-fade-in">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-medium text-slate-800 uppercase tracking-widest">{COMPONENT_METADATA[selectedId]?.label} Styles</h3>
                  <button onClick={() => setSelectedId(null)} className="text-slate-400 hover:text-slate-600">&times;</button>
                </div>

                <div className="space-y-4">
                  {/* Font Family */}
                  <div>
                    <label className="text-[10px] font-medium text-slate-400 uppercase block mb-1">Font Family</label>
                    <select
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-sm outline-none"
                      value={selectedStyle.fontFamily}
                      onChange={e => updateStyle('fontFamily', e.target.value)}
                    >
                      {FONT_FAMILIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                  </div>

                  {/* Size & Weight */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-medium text-slate-400 uppercase block mb-1">Font Size (px)</label>
                      <input
                        type="number"
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-sm outline-none"
                        value={selectedStyle.fontSize}
                        onChange={e => updateStyle('fontSize', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-slate-400 uppercase block mb-1">Weight</label>
                      <button
                        onClick={() => updateStyle('fontWeight', selectedStyle.fontWeight === 'bold' ? 'normal' : 'bold')}
                        className={`w-full p-2 rounded text-sm font-medium border transition-all ${selectedStyle.fontWeight === 'bold' ? 'bg-primary text-white border-primary' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
                      >
                        BOLD
                      </button>
                    </div>
                  </div>

                  {/* Alignment */}
                  <div>
                    <label className="text-[10px] font-medium text-slate-400 uppercase block mb-1">Alignment</label>
                    <div className="flex bg-slate-50 p-1 rounded border border-slate-200">
                      <button onClick={() => updateStyle('align', 'left')} className={`flex-1 py-1.5 flex justify-center rounded transition-all ${selectedStyle.align === 'left' ? 'bg-white shadow text-primary' : 'text-slate-400'}`}><FiAlignLeft /></button>
                      <button onClick={() => updateStyle('align', 'center')} className={`flex-1 py-1.5 flex justify-center rounded transition-all ${selectedStyle.align === 'center' ? 'bg-white shadow text-primary' : 'text-slate-400'}`}><FiAlignCenter /></button>
                      <button onClick={() => updateStyle('align', 'right')} className={`flex-1 py-1.5 flex justify-center rounded transition-all ${selectedStyle.align === 'right' ? 'bg-white shadow text-primary' : 'text-slate-400'}`}><FiAlignRight /></button>
                    </div>
                  </div>

                  {/* Spacing */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-medium text-slate-400 uppercase block mb-1">Padding Top</label>
                      <input type="number" className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-sm" value={selectedStyle.paddingTop} onChange={e => updateStyle('paddingTop', e.target.value)} />
                    </div>
                    <div>
                      <label className="text-[10px] font-medium text-slate-400 uppercase block mb-1">Padding Bottom</label>
                      <input type="number" className="w-full p-2 bg-slate-50 border border-slate-200 rounded text-sm" value={selectedStyle.paddingBottom} onChange={e => updateStyle('paddingBottom', e.target.value)} />
                    </div>
                  </div>

                  {/* Table Specific Controls */}
                  {selectedId === 'details_table' && (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                      <label className="text-[10px] font-medium text-slate-400 uppercase block mb-1">Table Columns</label>
                      {[
                        { key: 'showHSN', label: 'HSN Code' },
                        { key: 'showDiscount', label: 'Discount %' },
                        { key: 'showTax', label: 'GST (SGST/CGST)' }
                      ].map(col => (
                        <button
                          key={col.key}
                          onClick={() => updateStyle(col.key, !selectedStyle[col.key])}
                          className={`w-full p-2.5 rounded-lg text-xs font-medium flex items-center justify-between border transition-all ${selectedStyle[col.key] ? 'bg-primary text-white border-primary' : 'bg-white text-slate-600 border-slate-200 hover:border-primary-light'}`}
                        >
                          {col.label}
                          {selectedStyle[col.key] ? <FiCheck /> : <div className="w-4 h-4 rounded border border-slate-200" />}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* UDF Fields Specific Controls */}
                  {selectedId === 'udf_fields' && (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
                      <label className="text-[10px] font-medium text-slate-400 uppercase block mb-1">Custom Fields (Label: Value)</label>
                      <div className="space-y-2">
                        {(selectedStyle.fields || [{ label: 'Field Name', value: 'Value' }]).map((field, idx) => (
                          <div key={idx} className="flex gap-2">
                            <input
                              className="flex-1 p-1.5 bg-white border border-slate-200 rounded text-[10px] outline-none"
                              placeholder="Label"
                              value={field.label}
                              onChange={e => {
                                const newFields = [...(selectedStyle.fields || [])];
                                newFields[idx].label = e.target.value;
                                updateStyle('fields', newFields);
                              }}
                            />
                            <input
                              className="flex-1 p-1.5 bg-white border border-slate-200 rounded text-[10px] outline-none"
                              placeholder="Value"
                              value={field.value}
                              onChange={e => {
                                const newFields = [...(selectedStyle.fields || [])];
                                newFields[idx].value = e.target.value;
                                updateStyle('fields', newFields);
                              }}
                            />
                            <button
                              onClick={() => {
                                const newFields = (selectedStyle.fields || []).filter((_, i) => i !== idx);
                                updateStyle('fields', newFields);
                              }}
                              className="text-red-400 hover:text-red-600"
                            >
                              &times;
                            </button>
                          </div>
                        ))}
                        <button
                          onClick={() => {
                            const newFields = [...(selectedStyle.fields || []), { label: '', value: '' }];
                            updateStyle('fields', newFields);
                          }}
                          className="w-full py-2 bg-primary-light/10 text-primary rounded text-[10px] font-medium uppercase hover:bg-primary-light/20 transition-colors"
                        >
                          + Add Field
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Custom Note Specific Controls */}
                  {selectedId === 'custom_note' && (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <label className="text-[10px] font-medium text-slate-400 uppercase block mb-1">Custom Note Content</label>
                      <textarea
                        className="w-full p-3 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-primary"
                        rows="4"
                        placeholder="Type your custom text or instructions here..."
                        value={selectedStyle.content || ''}
                        onChange={e => updateStyle('content', e.target.value)}
                      />
                    </div>
                  )}

                  {/* Color */}
                  <div>
                    <label className="text-[10px] font-medium text-slate-400 uppercase block mb-1">Hex Color</label>
                    <div className="flex items-center gap-2">
                      <input type="color" className="w-10 h-10 rounded border-none cursor-pointer" value={selectedStyle.color} onChange={e => updateStyle('color', e.target.value)} />
                      <input type="text" className="flex-1 p-2 bg-slate-50 border border-slate-200 rounded text-sm font-mono uppercase" value={selectedStyle.color} onChange={e => updateStyle('color', e.target.value)} />
                    </div>
                  </div>

                  <hr className="border-slate-100 mt-6" />

                  <button
                    onClick={() => removeComponent(selectedId)}
                    className="w-full py-4 bg-red-50 text-red-600 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-red-100 transition-colors border border-red-100"
                  >
                    <FiTrash2 /> Remove Element
                  </button>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center px-4 space-y-4 opacity-50">
                <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-slate-300">
                  <FiLayout size={32} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">No element selected</p>
                  <p className="text-xs text-slate-400">Click an element on the canvas to customize its typography and layout</p>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

function DraggableElement({ id, index, styles, isSelected, onClick, removeComponent }) {
  const meta = COMPONENT_METADATA[id];

  return (
    <Draggable draggableId={id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          className={`
            relative p-3 transition-all cursor-pointer group
            ${isSelected ? 'ring-2 ring-primary ring-offset-2 z-10' : 'hover:bg-slate-50/50'}
            ${snapshot.isDragging ? 'opacity-50 ring-2 ring-primary shadow-2xl scale-105' : ''}
          `}
          style={{
            ...styles,
            fontSize: `${styles.fontSize}px`,
            textAlign: styles.align,
            paddingTop: `${styles.paddingTop}px`,
            paddingBottom: `${styles.paddingBottom}px`,
            fontFamily: styles.fontFamily,
          }}
        >
          {isSelected && (
            <>
              <div className="absolute -top-3 -left-2 bg-primary text-white text-[8px] px-1.5 py-0.5 rounded-full font-medium uppercase tracking-tighter shadow-sm z-20">
                EDITING: {meta.label}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onClick(); removeComponent(id); }}
                className="absolute -top-3 -right-2 bg-red-500 text-white p-1 rounded-full shadow-sm hover:bg-red-600 transition-colors z-20"
              >
                <FiTrash2 size={10} />
              </button>
            </>
          )}

          <ComponentPreview id={id} styles={styles} />

          {/* Visual Indicators */}
          <div className="absolute inset-0 border border-transparent group-hover:border-primary-light/50 rounded pointer-events-none"></div>
        </div>
      )}
    </Draggable>
  );
}

function ComponentPreview({ id, styles }) {
  // Use dummy data for preview
  switch (id) {
    case 'logo': return <div className="h-12 w-12 bg-slate-100 rounded inline-flex items-center justify-center text-[8px] text-slate-400 border-2 border-dashed border-slate-200">LOGO</div>;
    case 'company_name': return <div>YOUR COMPANY NAME</div>;
    case 'address': return <div className="leading-tight">123 Business Street, Tech City<br />State, Country - 123456</div>;
    case 'contact': return <div>Phone: +91 99999 00000 | email@company.com</div>;
    case 'tax_info': return <div>GSTIN: 09AAAAA0000A1Z5</div>;
    case 'invoice_meta': return (
      <div className="flex justify-between border-y border-dashed py-2 my-2 mt-4 text-[10px] font-mono">
        <div className="text-left">INV #2024-001<br />DATE: 01/01/2024</div>
        <div className="text-right">MODE: CASH<br />TIME: 10:00 AM</div>
      </div>
    );
    case 'tax_summary': return (
      <div className="mt-4 border-t-2 border-slate-900 pt-2 text-[8px]">
        <div className="flex justify-between border-b pb-1 font-medium">
          <span>GST BREAKDOWN</span>
          <span>AMOUNT</span>
        </div>
        <div className="space-y-1 mt-1">
          <div className="flex justify-between"><span>SGST (9%):</span><span>₹4.50</span></div>
          <div className="flex justify-between"><span>CGST (9%):</span><span>₹4.50</span></div>
        </div>
      </div>
    );
    case 'udf_fields': return (
      <div className="mt-4 space-y-1">
        {(styles.fields || [
          { label: 'E-WAY BILL', value: '1234-5678-9012' },
          { label: 'VEHICLE NO', value: 'KL-01-AB-1234' }
        ]).map((f, i) => (
          <div key={i} className="flex justify-between text-[8px] bg-slate-50 p-1 px-2 rounded border border-slate-100">
            <span className="font-medium uppercase text-slate-400">{f.label}:</span>
            <span className="font-medium">{f.value}</span>
          </div>
        ))}
      </div>
    );
    case 'details_table': return (
      <div className="mt-4 border-y-2 border-slate-900 py-2">
        <div className="flex justify-between text-[7px] font-medium border-b border-slate-100 pb-1 mb-1 uppercase tracking-tighter">
          <span className="w-1/3">ITEM</span>
          {styles.showHSN && <span className="w-16">HSN</span>}
          <span className="w-10 text-center">QTY</span>
          <span className="w-16 text-right">UNIT</span>
          {styles.showDiscount && <span className="w-10 text-right">DESC%</span>}
          {styles.showTax && <span className="w-16 text-right">TAX</span>}
          <span className="w-20 text-right">TOTAL</span>
        </div>
        <div className="flex justify-between text-[8px] text-slate-800 font-medium">
          <span className="w-1/3 truncate font-medium">SAMPLE PRODUCT...</span>
          {styles.showHSN && <span className="w-16">123456</span>}
          <span className="w-10 text-center">1</span>
          <span className="w-16 text-right">100.00</span>
          {styles.showDiscount && <span className="w-10 text-right">5%</span>}
          {styles.showTax && <span className="w-16 text-right">SGST 9%...</span>}
          <span className="w-20 text-right font-medium">₹95.00</span>
        </div>
      </div>
    );
    case 'total_summary': return (
      <div className="mt-4 pt-2 border-t-2 border-slate-900 flex flex-col items-end gap-1">
        <div className="flex justify-between w-40 text-[8px]"><span>Subtotal:</span><span>₹100.00</span></div>
        <div className="flex justify-between w-40 text-[8px] text-red-500"><span>Discount:</span><span>- ₹5.00</span></div>
        <div className="flex justify-between w-40 text-[8px]"><span>CGST (9%):</span><span>₹4.50</span></div>
        <div className="flex justify-between w-40 text-[8px]"><span>SGST (9%):</span><span>₹4.50</span></div>
        <div className="flex justify-between w-40 text-[8px] italic"><span>Round Off:</span><span>₹0.00</span></div>
        <div className="flex justify-between w-40 text-[10px] font-extrabold border-t border-slate-200 pt-1 mt-1"><span>Grand Total:</span><span>₹104.00</span></div>
      </div>
    );
    case 'payment_info': return <div className="text-left py-1 border-l-4 border-primary pl-2 bg-slate-50">Payment: CASH | Status: PAID</div>;
    case 'salesman': return <div>Sales Person: John Doe</div>;
    case 'bank_details': return (
      <div className="text-[8px] text-left border p-2 rounded bg-slate-50">
        <p className="font-medium">BANK DETAILS:</p>
        <p>A/C: 1234567890 | IFSC: SBIN000123</p>
      </div>
    );
    case 'return_info': return (
      <div className="text-[8px] text-left py-1 px-2 bg-red-50 text-red-700 rounded border border-red-100">
        Return Reason: Defective | Original Inv: #2024-001
      </div>
    );
    case 'customer': return (
      <div className="bg-slate-50 p-2 rounded text-left mt-2">
        <p className="text-[8px] text-slate-400 font-medium">CLIENT:</p>
        <p>Walk-in Customer</p>
      </div>
    );
    case 'terms': return <div className="italic">Terms & Conditions: Goods once sold will not be returned.</div>;
    case 'signature': return <div className="mt-8 border-t border-slate-300 w-48 inline-block pt-1 uppercase tracking-widest text-[8px]">Authorized Signature</div>;
    case 'footer_note': return <div>Thank you for choosing Quick POS. Have a great day!</div>;
    case 'custom_note': return (
      <div className="mt-2 p-2 bg-yellow-50 border-l-4 border-yellow-400 text-[8px] italic">
        {styles.content || 'Add your custom note here...'}
      </div>
    );
    default:
      return null;
  }
}
