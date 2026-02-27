import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { FiPlus, FiPrinter, FiSearch, FiEdit, FiTrash2, FiBox, FiToggleLeft, FiToggleRight } from 'react-icons/fi';
import Barcode from 'react-barcode';
import { toast } from 'react-toastify';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [companyProfile, setCompanyProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '', category: '', price: '', costPrice: '',
    taxRate: '0', taxType: 'none', hsnCode: '', warranty: '0',
    description: '', barcode: '', hasBarcode: true,
    minDiscount: '', maxDiscount: '', isTaxInclusive: false
  });
  const [file, setFile] = useState(null); // For Image Upload
  const [imagePreview, setImagePreview] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusTarget, setStatusTarget] = useState(null);

  // Filters
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStock, setFilterStock] = useState('all'); // all, low, out

  const fetchProducts = async () => {
    try {
      const storedUser = localStorage.getItem('user');
      const branchId = storedUser ? JSON.parse(storedUser).branchId : null;
      const [prodRes, compRes, catRes] = await Promise.all([
        api.get('/products', { params: { branchId } }),
        api.get('/company'),
        api.get('/categories')
      ]);
      setProducts(prodRes.data);
      setCompanyProfile(compRes.data);
      setCategories(catRes.data);
    } catch (err) {
      console.error(err);
      toast.error('Failed to fetch products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setImagePreview(URL.createObjectURL(selectedFile));
    }
  };

  const handleEdit = (product) => {
    setFormData({
      ...product,
      categoryId: product.categoryId || '',
      category: product.categoryName || '', // Fallback for old data
      description: product.description || '',
      barcode: product.barcode || '',
      taxRate: product.taxRate || 0,
      taxPercent: product.taxPercent || 0,
      minDiscount: product.minDiscount || '',
      maxDiscount: product.maxDiscount || ''
    });
    setFile(null);
    setImagePreview(product.imageUrl || null); // Show validation preview or existing image
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Create FormData for file upload
    const data = new FormData();
    Object.keys(formData).forEach(key => {
      // Don't append null/undefined/empty string id/createdAt/updatedAt if new, but we need ID for update?
      // API routes usually take ID from params for PUT.
      // Filter out system fields if creating new, but for updating we just need the changed fields.
      // Simpler to just append all valid fields.
      if (key !== 'id' && key !== 'createdAt' && key !== 'updatedAt' && key !== 'imageUrl') {
        data.append(key, formData[key] === null ? '' : formData[key]);
      }
    });

    if (file) {
      data.append('image', file);
    }

    try {
      const config = { headers: { 'Content-Type': 'multipart/form-data' } };

      if (formData.id) {
        await api.put(`/products/${formData.id}`, data, config);
      } else {
        await api.post('/products', data, config);
      }

      setShowModal(false);
      fetchProducts();
      setFile(null);
      setImagePreview(null);
      toast.success('Product saved successfully!');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save product');
    }
  };

  // Filter Logic
  const filteredProducts = products.filter(product => {
    const matchesCategory = filterCategory === '' ||
      (typeof product.category === 'string'
        ? product.category.toLowerCase().includes(filterCategory.toLowerCase())
        : (product.category?.name?.toLowerCase() || '').includes(filterCategory.toLowerCase()));
    let matchesStock = true;
    if (filterStock === 'low') matchesStock = product.stock > 0 && product.stock <= product.minStockLevel;
    if (filterStock === 'out') matchesStock = product.stock === 0;

    return matchesCategory && matchesStock;
  });

  const uniqueCategories = [...new Set(products.map(p => p.category?.name || p.categoryName).filter(Boolean))];

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Products</h1>
          <p className="text-slate-500 text-sm mt-1">Manage your inventory and stock levels</p>
        </div>
        <button className="btn btn-primary" onClick={() => {
          setFormData({
            name: '', category: '', categoryId: '', price: '', costPrice: '',
            taxRate: '0', taxType: 'none', hsnCode: '', warranty: '0',
            description: '', barcode: '', hasBarcode: true,
            minDiscount: '', maxDiscount: '', isTaxInclusive: false,
            isActive: true
          });
          setFile(null);
          setImagePreview(null);
          setShowModal(true);
        }}>
          <FiPlus className="text-lg" /> Add New Product
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <select className="input w-48" value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
          <option value="">All Categories</option>
          {uniqueCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
        </select>

        <select className="input w-48" value={filterStock} onChange={e => setFilterStock(e.target.value)}>
          <option value="all">All Stock Status</option>
          <option value="low">Low Stock</option>
          <option value="out">Out of Stock</option>
        </select>
      </div>

      {/* Product List */}
      <div className="card border-0 shadow-lg">
        <div className="table-container">
          <table className="table-modern">
            <thead>
              <tr>
                <th>Product Name</th>
                <th>Category</th>
                <th>Selling Price</th>
                <th>Stock Status</th>
                <th>Barcode</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => (
                <tr key={product.id}>
                  <td className="font-medium text-slate-700">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded bg-slate-100 flex items-center justify-center text-slate-500 overflow-hidden">
                        {product.imageUrl ? (
                          <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <FiBox />
                        )}
                      </div>
                      {product.name}
                    </div>
                  </td>
                  <td>
                    <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs font-medium">
                      {product.category?.name || product.categoryName || 'Uncategorized'}
                    </span>
                  </td>
                  <td className="p-4 text-slate-800 font-bold">{companyProfile?.currencySymbol || '₹'}{Number(product.price).toFixed(2)}</td>
                  <td>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${product.stock < 10 ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-primary-light text-primary-dark border border-primary-light'}`}>
                      {product.stock} units
                    </span>
                  </td>
                  <td className="font-mono text-xs text-slate-500">{product.barcode}</td>
                  <td>
                    <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${product.isActive ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-slate-50 text-slate-400 border border-slate-100'}`}>
                      {product.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleEdit(product)} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors" title="Edit"><FiEdit /></button>
                      {/* Only Admin can toggle status */}
                      {(localStorage.getItem('user') && JSON.parse(localStorage.getItem('user')).role === 'admin') && (
                        <button
                          onClick={() => {
                            setStatusTarget(product);
                            setShowStatusModal(true);
                          }}
                          className="relative flex items-center cursor-pointer focus:outline-none group"
                          title={product.isActive ? 'Deactivate Product' : 'Activate Product'}
                        >
                          <div className={`w-11 h-6 rounded-full transition-colors duration-300 ${product.isActive ? 'bg-primary shadow-inner' : 'bg-slate-200'}`}></div>
                          <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform duration-300 transform ${product.isActive ? 'translate-x-5' : 'translate-x-0'} shadow-md group-hover:scale-110`}></div>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-slate-400">No products found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Product Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">{formData.id ? 'Edit Product' : 'Add New Product'}</h2>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">&times;</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Image Upload */}
              <div className="col-span-2 flex flex-col items-center mb-4">
                <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mb-2 overflow-hidden border-2 border-slate-200">
                  {imagePreview ? (
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <FiBox className="text-3xl" />
                  )}
                </div>
                <label className="btn btn-secondary text-xs cursor-pointer">
                  Upload Image
                  <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                </label>
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Product Name</label>
                <input required className="input" placeholder="e.g. Wireless Mouse" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <select
                  className="input"
                  value={formData.categoryId}
                  onChange={e => {
                    const selectedCat = categories.find(c => c.id.toString() === e.target.value);
                    setFormData({
                      ...formData,
                      categoryId: e.target.value,
                      categoryName: selectedCat ? selectedCat.name : ''
                    });
                  }}
                >
                  <option value="">Select Category</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Selling Price (₹)</label>
                <input required type="number" className="input" placeholder="0.00" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tax Rate (%)</label>
                <input type="number" className="input" value={formData.taxRate} onChange={e => {
                  const val = e.target.value;
                  setFormData({ ...formData, taxRate: val, taxPercent: val });
                }} />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tax Type</label>
                <select className="input" value={formData.taxType} onChange={e => setFormData({ ...formData, taxType: e.target.value })}>
                  <option value="none">None</option>
                  <option value="igst">IGST (Inter-state)</option>
                  <option value="cgst_sgst">CGST + SGST (Intra-state)</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-6">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    id="isTaxInclusive"
                    className="sr-only peer"
                    checked={formData.isTaxInclusive}
                    onChange={e => setFormData({ ...formData, isTaxInclusive: e.target.checked })}
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all after:shadow-sm peer-checked:bg-primary"></div>
                  <span className="ml-3 text-sm font-medium text-slate-700">Selling Price Includes Tax</span>
                </label>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">HSN Code</label>
                <input className="input" placeholder="XXXX" value={formData.hsnCode} onChange={e => setFormData({ ...formData, hsnCode: e.target.value })} />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Warranty (Months)</label>
                <input type="number" className="input" placeholder="0" value={formData.warranty} onChange={e => setFormData({ ...formData, warranty: e.target.value })} />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Min Discount (%)</label>
                <input type="number" className="input" placeholder="0" value={formData.minDiscount} onChange={e => setFormData({ ...formData, minDiscount: e.target.value })} />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Max Discount (%)</label>
                <input type="number" className="input" placeholder="0" value={formData.maxDiscount} onChange={e => setFormData({ ...formData, maxDiscount: e.target.value })} />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Barcode (Auto if empty)</label>
                <div className="flex gap-2">
                  <input className="input" placeholder="Scan or enter code" value={formData.barcode} onChange={e => setFormData({ ...formData, barcode: e.target.value })} />
                  <button type="button" className="btn btn-secondary text-xs" onClick={() => setFormData({ ...formData, barcode: Date.now().toString().slice(-8) })}>Generate</button>
                </div>
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                <textarea className="input" rows="3" placeholder="Product details..." value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
              </div>

              {/* Validation Preview */}
              {formData.barcode && (
                <div className="col-span-2 flex justify-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <Barcode value={formData.barcode} height={40} background="#f8fafc" />
                </div>
              )}

              {/* Status Toggle in Modal */}
              <div className="col-span-2 pt-4 border-t border-slate-50">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={formData.isActive}
                    onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all after:shadow-sm peer-checked:bg-primary"></div>
                  <span className="ml-3 text-sm font-medium text-slate-700">Product is Active</span>
                </label>
              </div>

              <div className="col-span-2 flex justify-end gap-3 mt-4 pt-4 border-t border-slate-100">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Product</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Status Confirmation Modal */}
      {showStatusModal && statusTarget && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all animate-in fade-in zoom-in duration-200">
            <div className={`p-6 ${statusTarget.isActive ? 'bg-amber-50' : 'bg-green-50'}`}>
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${statusTarget.isActive ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>
                  {statusTarget.isActive ? <FiToggleRight className="w-6 h-6" /> : <FiToggleLeft className="w-6 h-6" />}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {statusTarget.isActive ? 'Deactivate Product?' : 'Activate Product?'}
                  </h3>
                  <p className="text-sm text-slate-600 mt-1">
                    {statusTarget.name}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <p className="text-slate-600 text-sm leading-relaxed">
                {statusTarget.isActive
                  ? 'This product will be hidden from the POS and Sales pages. You can reactivate it anytime from the Master section.'
                  : 'This product will be visible again on the POS and Sales pages.'}
              </p>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => setShowStatusModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    try {
                      await api.put(`/products/${statusTarget.id}`, { isActive: !statusTarget.isActive });
                      toast.success(`Product ${statusTarget.isActive ? 'deactivated' : 'activated'} successfully`);
                      setShowStatusModal(false);
                      fetchProducts();
                    } catch (err) {
                      toast.error('Failed to update status');
                    }
                  }}
                  className={`flex-1 px-4 py-2.5 rounded-xl font-bold text-sm text-white shadow-lg transition-all active:scale-95 ${statusTarget.isActive ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-200' : 'bg-green-500 hover:bg-green-600 shadow-green-200'}`}
                >
                  Yes, {statusTarget.isActive ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
