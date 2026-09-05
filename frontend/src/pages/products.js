import { useState, useEffect, useMemo } from 'react';
import api from '@/lib/api';
import { FiPlus, FiPrinter, FiSearch, FiEdit, FiTrash2, FiBox, FiToggleLeft, FiToggleRight, FiLayers, FiTag, FiCheck, FiInfo } from 'react-icons/fi';
import Barcode from 'react-barcode';
import { toast } from 'react-toastify';
import SearchableSelect from '@/components/SearchableSelect';

const DEFAULT_GENDERS = ['Men', 'Women', 'Boy', 'Girl', 'Unisex'];

export default function Products() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [productTypes, setProductTypes] = useState([]);
  const [companyProfile, setCompanyProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const initialFormState = {
    id: null,
    name: '',
    categoryId: '',
    categoryName: '',
    productTypeId: '',
    productTypeName: '',
    gender: '',
    attributes: {},
    sizeMode: 'single', // 'single' or 'multi'
    size: '',
    sizeStocks: [],
    stock: '0',
    price: '',
    costPrice: '',
    taxRate: '0',
    taxType: 'none',
    taxPercent: '0',
    hsnCode: '',
    warranty: '0',
    description: '',
    barcode: '',
    hasBarcode: true,
    minDiscount: '',
    maxDiscount: '',
    isTaxInclusive: false,
    isActive: true
  };

  const [formData, setFormData] = useState(initialFormState);
  const [file, setFile] = useState(null); // For Image Upload
  const [imagePreview, setImagePreview] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusTarget, setStatusTarget] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterProductType, setFilterProductType] = useState('');
  const [filterStock, setFilterStock] = useState('all'); // all, low, out

  const fetchProducts = async () => {
    try {
      const storedUser = localStorage.getItem('user');
      const branchId = storedUser ? JSON.parse(storedUser).branchId : null;
      const [prodRes, compRes, catRes, ptRes] = await Promise.all([
        api.get('/products', { params: { branchId } }),
        api.get('/company'),
        api.get('/categories'),
        api.get('/product-types')
      ]);
      setProducts(prodRes.data);
      setCompanyProfile(compRes.data);
      setCategories(catRes.data);
      setProductTypes(ptRes.data);
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

  // Filtered product types based on selected Category in modal
  const categoryProductTypes = useMemo(() => {
    if (!formData.categoryId) return [];
    return productTypes.filter(
      pt => pt.categoryId?.toString() === formData.categoryId?.toString() && pt.isActive !== false
    );
  }, [formData.categoryId, productTypes]);

  // Selected Product Type object
  const selectedProductTypeObj = useMemo(() => {
    if (!formData.productTypeId) return null;
    return productTypes.find(pt => pt.id?.toString() === formData.productTypeId?.toString()) || null;
  }, [formData.productTypeId, productTypes]);

  // Available Genders from selected product type
  const availableGenders = useMemo(() => {
    if (selectedProductTypeObj && Array.isArray(selectedProductTypeObj.genders) && selectedProductTypeObj.genders.length > 0) {
      return selectedProductTypeObj.genders;
    }
    return DEFAULT_GENDERS;
  }, [selectedProductTypeObj]);

  // Configured Attributes from selected product type
  const configuredAttributes = useMemo(() => {
    if (selectedProductTypeObj && Array.isArray(selectedProductTypeObj.attributes)) {
      return selectedProductTypeObj.attributes;
    }
    return [];
  }, [selectedProductTypeObj]);

  // Configured Sizes from selected product type
  const configuredSizes = useMemo(() => {
    if (selectedProductTypeObj && Array.isArray(selectedProductTypeObj.sizes)) {
      return selectedProductTypeObj.sizes;
    }
    return [];
  }, [selectedProductTypeObj]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setImagePreview(URL.createObjectURL(selectedFile));
    }
  };

  // Open modal for new product
  const handleAddNew = () => {
    setFormData(initialFormState);
    setFile(null);
    setImagePreview(null);
    setShowModal(true);
  };

  // Open modal to edit existing product
  const handleEdit = (product) => {
    let parsedAttributes = {};
    if (product.attributes) {
      parsedAttributes = typeof product.attributes === 'string' ? JSON.parse(product.attributes) : product.attributes;
    }

    let parsedSizeStocks = [];
    if (product.sizeStocks) {
      parsedSizeStocks = typeof product.sizeStocks === 'string' ? JSON.parse(product.sizeStocks) : product.sizeStocks;
    }

    const hasMultiSizes = Array.isArray(parsedSizeStocks) && parsedSizeStocks.length > 1;

    setFormData({
      ...product,
      id: product.id,
      name: product.name || '',
      categoryId: product.categoryId ? product.categoryId.toString() : '',
      categoryName: product.categoryName || product.category?.name || '',
      productTypeId: product.productTypeId ? product.productTypeId.toString() : '',
      productTypeName: product.productTypeName || product.productType?.name || '',
      gender: product.gender || '',
      attributes: parsedAttributes || {},
      sizeMode: hasMultiSizes ? 'multi' : 'single',
      size: product.size || '',
      sizeStocks: parsedSizeStocks || [],
      stock: product.stock !== undefined ? product.stock.toString() : '0',
      price: product.price ? product.price.toString() : '',
      costPrice: product.costPrice ? product.costPrice.toString() : '',
      taxRate: product.taxRate !== undefined ? product.taxRate.toString() : '0',
      taxPercent: product.taxPercent !== undefined ? product.taxPercent.toString() : '0',
      taxType: product.taxType || 'none',
      hsnCode: product.hsnCode || '',
      warranty: product.warranty !== null && product.warranty !== undefined ? product.warranty.toString() : '0',
      description: product.description || '',
      barcode: product.barcode || '',
      hasBarcode: product.hasBarcode !== undefined ? product.hasBarcode : true,
      minDiscount: product.minDiscount !== null && product.minDiscount !== undefined ? product.minDiscount.toString() : '',
      maxDiscount: product.maxDiscount !== null && product.maxDiscount !== undefined ? product.maxDiscount.toString() : '',
      isTaxInclusive: product.isTaxInclusive || false,
      isActive: product.isActive !== undefined ? product.isActive : true
    });
    setFile(null);
    setImagePreview(product.imageUrl || null);
    setShowModal(true);
  };

  // Handle Category change (resets dependent fields)
  const handleCategoryChange = (val) => {
    const selectedCat = categories.find(c => c.id.toString() === val.toString());
    setFormData(prev => ({
      ...prev,
      categoryId: val,
      categoryName: selectedCat ? selectedCat.name : '',
      productTypeId: '',
      productTypeName: '',
      gender: '',
      attributes: {},
      size: '',
      sizeStocks: [],
      stock: '0'
    }));
  };

  // Handle Product Type change (initializes attributes, genders, sizes)
  const handleProductTypeChange = (val) => {
    const selectedPt = productTypes.find(pt => pt.id.toString() === val.toString());
    let initialSizeStocks = [];

    if (selectedPt && Array.isArray(selectedPt.sizes) && selectedPt.sizes.length > 0) {
      initialSizeStocks = selectedPt.sizes.map(s => ({ size: s, stock: 0 }));
    }

    setFormData(prev => ({
      ...prev,
      productTypeId: val,
      productTypeName: selectedPt ? selectedPt.name : '',
      gender: selectedPt && selectedPt.genders?.length > 0 ? selectedPt.genders[0] : '',
      attributes: {},
      size: selectedPt && selectedPt.sizes?.length > 0 ? selectedPt.sizes[0] : '',
      sizeStocks: initialSizeStocks,
      stock: '0'
    }));
  };

  // Handle attribute selection
  const handleAttributeChange = (attrName, optionVal) => {
    setFormData(prev => ({
      ...prev,
      attributes: {
        ...prev.attributes,
        [attrName]: optionVal
      }
    }));
  };

  // Handle size stock change in multi-size mode
  const handleSizeStockChange = (sizeName, qty) => {
    const parsedQty = Math.max(0, parseInt(qty, 10) || 0);
    setFormData(prev => {
      const existingIdx = prev.sizeStocks.findIndex(item => item.size === sizeName);
      let updatedList = [...prev.sizeStocks];

      if (existingIdx >= 0) {
        updatedList[existingIdx] = { size: sizeName, stock: parsedQty };
      } else {
        updatedList.push({ size: sizeName, stock: parsedQty });
      }

      const totalCalculatedStock = updatedList.reduce((sum, item) => sum + (parseInt(item.stock, 10) || 0), 0);

      return {
        ...prev,
        sizeStocks: updatedList,
        stock: totalCalculatedStock.toString(),
        size: updatedList.filter(item => item.stock > 0).map(item => item.size).join(', ') || prev.size
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Product Name is required');
      return;
    }
    if (!formData.categoryId) {
      toast.error('Category is required');
      return;
    }

    // Create FormData for file upload
    const data = new FormData();

    // Append basic fields
    data.append('name', formData.name.trim());
    data.append('categoryId', formData.categoryId);
    data.append('categoryName', formData.categoryName || '');
    data.append('price', formData.price || '0');
    data.append('costPrice', formData.costPrice || '');
    data.append('taxRate', formData.taxRate || '0');
    data.append('taxPercent', formData.taxRate || '0');
    data.append('taxType', formData.taxType || 'none');
    data.append('isTaxInclusive', formData.isTaxInclusive);
    data.append('hsnCode', formData.hsnCode || '');
    data.append('warranty', formData.warranty || '0');
    data.append('minDiscount', formData.minDiscount || '');
    data.append('maxDiscount', formData.maxDiscount || '');
    data.append('barcode', formData.barcode || '');
    data.append('hasBarcode', formData.hasBarcode);
    data.append('description', formData.description || '');
    data.append('isActive', formData.isActive);

    // Append hierarchy fields
    if (formData.productTypeId) {
      data.append('productTypeId', formData.productTypeId);
      data.append('productTypeName', formData.productTypeName || '');
    }
    if (formData.gender) {
      data.append('gender', formData.gender);
    }
    if (formData.attributes && Object.keys(formData.attributes).length > 0) {
      data.append('attributes', JSON.stringify(formData.attributes));
    }
    if (formData.size) {
      data.append('size', formData.size);
    }
    if (formData.sizeStocks && formData.sizeStocks.length > 0) {
      data.append('sizeStocks', JSON.stringify(formData.sizeStocks));
    }
    data.append('stock', formData.stock || '0');

    if (file) {
      data.append('image', file);
    }

    try {
      const config = { headers: { 'Content-Type': 'multipart/form-data' } };

      if (formData.id) {
        await api.put(`/products/${formData.id}`, data, config);
        toast.success('Product updated successfully!');
      } else {
        await api.post('/products', data, config);
        toast.success('Product created successfully!');
      }

      setShowModal(false);
      fetchProducts();
      setFile(null);
      setImagePreview(null);
    } catch (err) {
      toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to save product');
    }
  };

  // Filter Logic
  const filteredProducts = products.filter(product => {
    const matchesCategory = filterCategory === '' ||
      (typeof product.category === 'string'
        ? product.category.toLowerCase().includes(filterCategory.toLowerCase())
        : (product.category?.name?.toLowerCase() || '').includes(filterCategory.toLowerCase()) ||
          product.categoryName?.toLowerCase().includes(filterCategory.toLowerCase()));

    const matchesProductType = filterProductType === '' ||
      (product.productType?.name?.toLowerCase() || '').includes(filterProductType.toLowerCase()) ||
      (product.productTypeName?.toLowerCase() || '').includes(filterProductType.toLowerCase());

    let matchesStock = true;
    if (filterStock === 'low') matchesStock = product.stock > 0 && product.stock <= product.minStockLevel;
    if (filterStock === 'out') matchesStock = product.stock === 0;

    const matchesSearch = searchTerm === '' ||
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.barcode || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.productTypeName || product.productType?.name || '').toLowerCase().includes(searchTerm.toLowerCase());

    return matchesCategory && matchesProductType && matchesStock && matchesSearch;
  });

  const uniqueCategories = [...new Set(products.map(p => p.category?.name || p.categoryName).filter(Boolean))];
  const uniqueProductTypes = [...new Set(products.map(p => p.productType?.name || p.productTypeName).filter(Boolean))];

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Products</h1>
          <p className="text-slate-500 text-sm mt-1">Manage your inventory, category hierarchy, size variants and stock levels</p>
        </div>
        <button className="btn btn-primary w-full md:w-auto shadow-lg shadow-primary/20" onClick={handleAddNew}>
          <FiPlus className="text-lg" /> Add New Product
        </button>
      </div>

      {/* Search & Filters */}
      <div className="card mb-6 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200">
            <FiSearch className="text-slate-400" />
            <input
              type="text"
              placeholder="Search product, barcode..."
              className="bg-transparent text-sm focus:outline-none text-slate-700 w-full"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div>
            <SearchableSelect
              options={[{ label: 'All Categories', value: '' }, ...uniqueCategories.map(cat => ({ label: cat, value: cat }))]}
              value={filterCategory}
              onChange={setFilterCategory}
              placeholder="Filter by Category..."
            />
          </div>

          <div>
            <SearchableSelect
              options={[{ label: 'All Product Types', value: '' }, ...uniqueProductTypes.map(pt => ({ label: pt, value: pt }))]}
              value={filterProductType}
              onChange={setFilterProductType}
              placeholder="Filter by Product Type..."
            />
          </div>

          <div>
            <SearchableSelect
              options={[
                { label: 'All Stock Status', value: 'all' },
                { label: 'Low Stock', value: 'low' },
                { label: 'Out of Stock', value: 'out' }
              ]}
              value={filterStock}
              onChange={setFilterStock}
              placeholder="Stock Status..."
            />
          </div>
        </div>
      </div>

      {/* Product List Table */}
      <div className="card border-0 shadow-lg overflow-hidden">
        <div className="table-container lg:no-scrollbar overflow-x-auto">
          <table className="table-modern">
            <thead>
              <tr className="whitespace-nowrap">
                <th>Product Name</th>
                <th>Category</th>
                <th>Product Type</th>
                <th>Gender</th>
                <th>Size</th>
                <th>Selling Price</th>
                <th>Stock</th>
                <th>Stock Status</th>
                <th>Barcode</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="11" className="text-center py-8 text-slate-400">Loading products...</td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan="11" className="text-center py-8 text-slate-400">No products found.</td>
                </tr>
              ) : (
                filteredProducts.map((product) => {
                  let parsedSizeStocks = [];
                  if (product.sizeStocks) {
                    parsedSizeStocks = typeof product.sizeStocks === 'string' ? JSON.parse(product.sizeStocks) : product.sizeStocks;
                  }
                  const hasMultiSizes = Array.isArray(parsedSizeStocks) && parsedSizeStocks.length > 0;

                  return (
                    <tr key={product.id} className="whitespace-nowrap hover:bg-slate-50/80 transition-colors">
                      {/* Product Name & Image */}
                      <td className="font-semibold text-slate-800">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 overflow-hidden border border-slate-200 shrink-0">
                            {product.imageUrl ? (
                              <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                            ) : (
                              <FiBox className="text-lg" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-slate-800">{product.name}</div>
                            {product.attributes && typeof product.attributes === 'object' && Object.keys(product.attributes).length > 0 && (
                              <div className="text-[10px] text-slate-400 font-normal">
                                {Object.entries(product.attributes).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(' • ')}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td>
                        <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-md text-xs font-medium border border-slate-200">
                          {product.category?.name || product.categoryName || 'Uncategorized'}
                        </span>
                      </td>

                      {/* Product Type */}
                      <td>
                        {product.productType?.name || product.productTypeName ? (
                          <span className="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-md text-xs font-semibold border border-indigo-100">
                            {product.productType?.name || product.productTypeName}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </td>

                      {/* Gender / Group */}
                      <td>
                        {product.gender ? (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md text-[11px] font-medium border border-blue-100">
                            {product.gender}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </td>

                      {/* Size */}
                      <td>
                        {hasMultiSizes ? (
                          <div className="flex flex-wrap gap-1 max-w-[150px]">
                            {parsedSizeStocks.filter(s => s.stock > 0).map((s, idx) => (
                              <span key={idx} className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px] font-semibold border border-emerald-100" title={`${s.size}: ${s.stock} units`}>
                                {s.size}
                              </span>
                            ))}
                            {parsedSizeStocks.filter(s => s.stock > 0).length === 0 && (
                              <span className="text-xs text-slate-400">{product.size || '-'}</span>
                            )}
                          </div>
                        ) : product.size ? (
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md text-[11px] font-bold border border-emerald-100">
                            {product.size}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-xs">-</span>
                        )}
                      </td>

                      {/* Selling Price */}
                      <td className="p-4 text-slate-900 font-semibold">
                        {companyProfile?.currencySymbol || '₹'}{Number(product.price).toFixed(2)}
                      </td>

                      {/* Stock */}
                      <td>
                        {hasMultiSizes ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="font-semibold text-xs text-slate-800">
                              {product.stock} units
                            </span>
                            <div className="text-[10px] text-slate-500">
                              {parsedSizeStocks.map(s => `${s.size}:${s.stock}`).join(' | ')}
                            </div>
                          </div>
                        ) : (
                          <span className="font-semibold text-xs text-slate-800">
                            {product.stock} units
                          </span>
                        )}
                      </td>

                      {/* Stock Status */}
                      <td>
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${product.stock === 0 ? 'bg-red-50 text-red-600 border border-red-200' : product.stock <= product.minStockLevel ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
                          {product.stock === 0 ? 'Out of Stock' : product.stock <= product.minStockLevel ? 'Low Stock' : 'In Stock'}
                        </span>
                      </td>

                      {/* Barcode */}
                      <td className="font-mono text-xs text-slate-500">{product.barcode}</td>

                      {/* Status */}
                      <td>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${product.isActive ? 'bg-green-50 text-green-600 border border-green-200' : 'bg-slate-100 text-slate-400 border border-slate-200'}`}>
                          {product.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="text-right">
                        <div className="flex justify-end items-center gap-2">
                          <button
                            onClick={() => handleEdit(product)}
                            className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors"
                            title="Edit Product"
                          >
                            <FiEdit />
                          </button>
                          {(localStorage.getItem('user') && JSON.parse(localStorage.getItem('user')).role === 'admin') && (
                            <button
                              onClick={() => {
                                setStatusTarget(product);
                                setShowStatusModal(true);
                              }}
                              className="relative flex items-center cursor-pointer focus:outline-none group"
                              title={product.isActive ? 'Deactivate Product' : 'Activate Product'}
                            >
                              <div className={`w-9 h-5 rounded-full transition-colors duration-300 ${product.isActive ? 'bg-primary shadow-inner' : 'bg-slate-200'}`}></div>
                              <div className={`absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-300 transform ${product.isActive ? 'translate-x-4' : 'translate-x-0'} shadow-md`}></div>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col my-4">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 rounded-t-2xl">
              <div>
                <h2 className="text-xl font-bold text-slate-800">{formData.id ? 'Edit Product' : 'Add New Product'}</h2>
                <p className="text-xs text-slate-500 mt-0.5">Define product hierarchy: Category &rarr; Product Type &rarr; Gender &rarr; Attributes &rarr; Size & Stock</p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 text-2xl font-bold">&times;</button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Product Image & Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80">
                <div className="flex flex-col items-center justify-center">
                  <div className="w-24 h-24 bg-white rounded-2xl flex items-center justify-center text-slate-400 mb-2 overflow-hidden border-2 border-slate-200 shadow-sm">
                    {imagePreview ? (
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <FiBox className="text-3xl" />
                    )}
                  </div>
                  <label className="btn btn-secondary text-xs cursor-pointer px-3 py-1.5">
                    Upload Image
                    <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                  </label>
                </div>

                <div className="md:col-span-2 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Product Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      required
                      className="input w-full"
                      placeholder="e.g. Cotton Slim Fit T-Shirt"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Category <span className="text-red-500">*</span>
                    </label>
                    <SearchableSelect
                      options={categories.map(cat => ({ label: cat.name, value: cat.id }))}
                      value={formData.categoryId}
                      onChange={handleCategoryChange}
                      placeholder="Select Category..."
                    />
                  </div>
                </div>
              </div>

              {/* HIERARCHY SECTION */}
              <div className="border border-indigo-100 bg-indigo-50/30 rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2 text-indigo-950 font-bold text-sm">
                  <FiLayers className="text-primary" /> Product Hierarchy & Classification
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Step 2: Product Type (Category Dependent) */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Product Type {formData.categoryId && <span className="text-primary font-normal">(Filtered for Category)</span>}
                    </label>
                    {formData.categoryId ? (
                      categoryProductTypes.length > 0 ? (
                        <SearchableSelect
                          options={categoryProductTypes.map(pt => ({ label: pt.name, value: pt.id }))}
                          value={formData.productTypeId}
                          onChange={handleProductTypeChange}
                          placeholder="Select Product Type..."
                        />
                      ) : (
                        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
                          <FiInfo className="shrink-0" />
                          <span>No product types configured for this category. (Configure in Product Type Master)</span>
                        </div>
                      )
                    ) : (
                      <div className="input text-xs text-slate-400 bg-slate-100 flex items-center">
                        Select Category first
                      </div>
                    )}
                  </div>

                  {/* Step 3: Gender / Group */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Gender / Group</label>
                    <select
                      className="input w-full text-xs"
                      value={formData.gender}
                      onChange={e => setFormData({ ...formData, gender: e.target.value })}
                      disabled={!formData.productTypeId}
                    >
                      <option value="">Select Gender / Group</option>
                      {availableGenders.map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Step 4: Dynamic Product Attributes */}
                {configuredAttributes.length > 0 && (
                  <div className="pt-2 border-t border-indigo-100/80">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Product Attributes ({configuredAttributes.length} configured)
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {configuredAttributes.map((attr, idx) => (
                        <div key={idx} className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs">
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                            {attr.name}
                          </label>
                          <select
                            className="input w-full !py-1 text-xs"
                            value={formData.attributes[attr.name] || ''}
                            onChange={e => handleAttributeChange(attr.name, e.target.value)}
                          >
                            <option value="">Select {attr.name}...</option>
                            {(attr.options || []).map((opt, oIdx) => (
                              <option key={oIdx} value={opt}>{opt}</option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* SIZE & STOCK MANAGEMENT SECTION */}
              <div className="border border-emerald-100 bg-emerald-50/30 rounded-2xl p-5 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                  <div className="flex items-center gap-2 text-emerald-950 font-bold text-sm">
                    <FiTag className="text-emerald-600" /> Size & Stock Configuration
                  </div>
                  <div className="flex items-center gap-2 bg-white px-2 py-1 rounded-xl border border-emerald-200 text-xs font-medium">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, sizeMode: 'single' })}
                      className={`px-3 py-1 rounded-lg transition-all ${formData.sizeMode === 'single' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                      Single Size
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, sizeMode: 'multi' })}
                      className={`px-3 py-1 rounded-lg transition-all ${formData.sizeMode === 'multi' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
                    >
                      Multi-Size Breakdown
                    </button>
                  </div>
                </div>

                {formData.sizeMode === 'single' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Select Size / Variant</label>
                      {configuredSizes.length > 0 ? (
                        <select
                          className="input w-full text-xs"
                          value={formData.size}
                          onChange={e => setFormData({ ...formData, size: e.target.value })}
                        >
                          <option value="">Select Size</option>
                          {configuredSizes.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          className="input w-full text-xs"
                          placeholder="e.g. M, L, XL, 32"
                          value={formData.size}
                          onChange={e => setFormData({ ...formData, size: e.target.value })}
                        />
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Opening Stock Quantity</label>
                      <input
                        type="number"
                        min="0"
                        className="input w-full text-xs font-bold text-slate-800"
                        placeholder="0"
                        value={formData.stock}
                        onChange={e => setFormData({ ...formData, stock: e.target.value })}
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-2">
                      Enter Stock for Each Configured Size (Total: <span className="text-emerald-700 font-bold">{formData.stock} units</span>)
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                      {(configuredSizes.length > 0 ? configuredSizes : ['S', 'M', 'L', 'XL', 'XXL']).map((s) => {
                        const currentVal = formData.sizeStocks.find(item => item.size === s)?.stock || '';
                        return (
                          <div key={s} className="bg-white p-2.5 rounded-xl border border-emerald-200 shadow-2xs">
                            <span className="block text-xs font-bold text-emerald-800 mb-1">Size: {s}</span>
                            <input
                              type="number"
                              min="0"
                              className="input w-full !py-1 text-xs text-center font-semibold"
                              placeholder="0"
                              value={currentVal}
                              onChange={e => handleSizeStockChange(s, e.target.value)}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* PRICING & TAX SECTION */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Selling Price (₹) <span className="text-red-500">*</span>
                  </label>
                  <input
                    required
                    type="number"
                    step="0.01"
                    className="input w-full font-bold text-slate-900"
                    placeholder="0.00"
                    value={formData.price}
                    onChange={e => setFormData({ ...formData, price: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tax Rate (%)</label>
                  <input
                    type="number"
                    className="input w-full"
                    value={formData.taxRate}
                    onChange={e => {
                      const val = e.target.value;
                      setFormData({ ...formData, taxRate: val, taxPercent: val });
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tax Type</label>
                  <select
                    className="input w-full"
                    value={formData.taxType}
                    onChange={e => setFormData({ ...formData, taxType: e.target.value })}
                  >
                    <option value="none">None</option>
                    <option value="igst">IGST (Inter-state)</option>
                    <option value="cgst_sgst">CGST + SGST (Intra-state)</option>
                  </select>
                </div>
              </div>

              {/* TAX INCLUSIVE TOGGLE */}
              <div className="flex items-center gap-2">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={formData.isTaxInclusive}
                    onChange={e => setFormData({ ...formData, isTaxInclusive: e.target.checked })}
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all after:shadow-sm peer-checked:bg-primary"></div>
                  <span className="ml-3 text-sm font-medium text-slate-700">Selling Price Includes Tax</span>
                </label>
              </div>

              {/* HSN, WARRANTY, DISCOUNTS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">HSN Code</label>
                  <input
                    className="input w-full text-xs"
                    placeholder="XXXX"
                    value={formData.hsnCode}
                    onChange={e => setFormData({ ...formData, hsnCode: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Warranty (Months)</label>
                  <input
                    type="number"
                    className="input w-full text-xs"
                    placeholder="0"
                    value={formData.warranty}
                    onChange={e => setFormData({ ...formData, warranty: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Min Discount (%)</label>
                  <input
                    type="number"
                    className="input w-full text-xs"
                    placeholder="0"
                    value={formData.minDiscount}
                    onChange={e => setFormData({ ...formData, minDiscount: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Max Discount (%)</label>
                  <input
                    type="number"
                    className="input w-full text-xs"
                    placeholder="0"
                    value={formData.maxDiscount}
                    onChange={e => setFormData({ ...formData, maxDiscount: e.target.value })}
                  />
                </div>
              </div>

              {/* BARCODE & DESCRIPTION */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Barcode (Auto-generated if left empty)</label>
                  <div className="flex gap-2">
                    <input
                      className="input flex-1"
                      placeholder="Scan or enter code"
                      value={formData.barcode}
                      onChange={e => setFormData({ ...formData, barcode: e.target.value })}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary text-xs"
                      onClick={() => setFormData({ ...formData, barcode: 'BC' + Date.now().toString().slice(-8) })}
                    >
                      Generate
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                  <textarea
                    className="input w-full"
                    rows="2"
                    placeholder="Product details, fabric specifications, washing instructions..."
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
              </div>

              {/* Barcode Preview */}
              {formData.barcode && (
                <div className="flex justify-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <Barcode value={formData.barcode} height={35} background="#f8fafc" />
                </div>
              )}

              {/* Status Toggle */}
              <div className="pt-2 border-t border-slate-100">
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

              {/* Modal Footer */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary shadow-lg shadow-primary/20"
                >
                  {formData.id ? 'Update Product' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Custom Status Confirmation Modal */}
      {showStatusModal && statusTarget && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all animate-in fade-in zoom-in duration-200">
            <div className={`p-6 ${statusTarget.isActive ? 'bg-amber-50' : 'bg-green-50'}`}>
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${statusTarget.isActive ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>
                  {statusTarget.isActive ? <FiToggleRight className="w-6 h-6" /> : <FiToggleLeft className="w-6 h-6" />}
                </div>
                <div>
                  <h3 className="text-lg font-medium text-slate-900">
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
                  ? 'This product will be hidden from the POS and Sales pages. You can reactivate it anytime from the Products or Master section.'
                  : 'This product will be visible again on the POS and Sales pages.'}
              </p>

              <div className="flex gap-3 mt-8">
                <button
                  onClick={() => setShowStatusModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-medium text-sm hover:bg-slate-50 transition-colors"
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
                  className={`flex-1 px-4 py-2.5 rounded-xl font-medium text-sm text-white shadow-lg transition-all active:scale-95 ${statusTarget.isActive ? 'bg-amber-500 hover:bg-amber-600 shadow-amber-200' : 'bg-green-500 hover:bg-green-600 shadow-green-200'}`}
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
