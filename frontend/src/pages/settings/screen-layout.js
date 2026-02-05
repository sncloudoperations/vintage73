import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { toast } from 'react-toastify';
import { FiUpload, FiImage, FiSave } from 'react-icons/fi';

export default function ScreenLayoutSettings() {
  const [loading, setLoading] = useState(false);
  const [currentImage, setCurrentImage] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [showLogoOnly, setShowLogoOnly] = useState(false);

  useEffect(() => {
    fetchCompanyData();
  }, []);

  const fetchCompanyData = async () => {
    try {
      const res = await api.get('/company');
      if (res.data) {
          if (res.data.dashboardImageUrl) setCurrentImage(res.data.dashboardImageUrl);
          setShowLogoOnly(res.data.showOnlyLogoOnDashboard || false);
      }
    } catch (err) {
      console.error('Failed to fetch company settings', err);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Allow submit if file selected OR just changing settings
    if (!selectedFile && !currentImage && !showLogoOnly) return; 

    setLoading(true);
    const formData = new FormData();
    if (selectedFile) {
        formData.append('dashboardImage', selectedFile);
    }
    formData.append('showOnlyLogoOnDashboard', showLogoOnly);

    // We typically need to send other required fields if the backend validation is strict,
    // but our controller updates partially based on what's in req.body/files.
    // Ideally, we should fetch current data and send it back or ensure backend allows partial updates.
    // The current updateCompanyProfile implementation seems to try to update ALL fields from req.body.
    // We should probably fetch existing values and append them, OR update the backend to support PATCH.
    // For now, let's fetch and re-send.
    
    try {
       const currentDataRes = await api.get('/company');
       const currentData = currentDataRes.data || {};
       
       Object.keys(currentData).forEach(key => {
           if (currentData[key] !== null && key !== 'id' && key !== 'createdAt' && key !== 'updatedAt' && key !== 'logoUrl' && key !== 'dashboardImageUrl' && key !== 'bank' && key !== 'invoiceSettings' && key !== 'showOnlyLogoOnDashboard') {
               formData.append(key, currentData[key]);
           }
       });
       
       if (currentData.bankId) formData.append('bankId', currentData.bankId);

       await api.post('/company', formData, {
         headers: { 'Content-Type': 'multipart/form-data' }
       });
       
       toast.success('Screen Layout Image updated!');
       fetchCompanyData();
       setSelectedFile(null);
       setPreviewUrl(null);
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.error || err.response?.data?.message || 'Failed to update image';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Screen Layout Settings</h1>
        <p className="text-slate-500 text-sm">Customize the default dashboard layout image.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="grid md:grid-cols-2 gap-8">
            {/* Current / Preview */}
            <div>
                <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                    <FiImage />
                    Current Visualization
                </h3>
                <div className="aspect-video bg-slate-50 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center overflow-hidden relative">
                    {previewUrl ? (
                         <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : currentImage ? (
                        <img src={`http://localhost:5000${currentImage}`} alt="Current Layout" className="w-full h-full object-cover" />
                    ) : (
                        <div className="text-center text-slate-400 p-4">
                            <FiImage className="mx-auto text-4xl mb-2 opacity-50" />
                            <p className="text-sm">No layout image set</p>
                        </div>
                    )}
                </div>
                <p className="text-xs text-slate-400 mt-2 text-center">
                    This image will be displayed on the main dashboard area.
                </p>
            </div>

            {/* Upload Control */}
            <div>
                 <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">Upload New Image</label>
                        <div className="flex items-center justify-center w-full">
                            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-emerald-300 border-dashed rounded-lg cursor-pointer bg-emerald-50 hover:bg-emerald-100 transition-colors">
                                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                    <FiUpload className="w-8 h-8 mb-3 text-emerald-500" />
                                    <p className="mb-2 text-sm text-emerald-700"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                                    <p className="text-xs text-emerald-600">SVG, PNG, JPG or GIF (MAX. 5MB)</p>
                                </div>
                                <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                            </label>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 py-2">
                        <input 
                            type="checkbox" 
                            id="showLogoOnly"
                            className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500"
                            checked={showLogoOnly}
                            onChange={(e) => setShowLogoOnly(e.target.checked)}
                        />
                        <label htmlFor="showLogoOnly" className="text-sm font-medium text-slate-700 select-none cursor-pointer">
                            Show only this layout on Dashboard (Hide Stats)
                        </label>
                    </div>

                    <div className="flex justify-end pt-4">
                        <button 
                            type="submit" 
                            disabled={loading}
                            className={`flex items-center gap-2 px-6 py-2 rounded-lg text-white font-medium transition-all
                                ${loading ? 'bg-slate-300 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 shadow-md hover:shadow-lg'}
                            `}
                        >
                            {loading ? 'Saving...' : <><FiSave /> Save Settings</>}
                        </button>
                    </div>
                 </form>
            </div>
        </div>
      </div>
    </div>
  );
}
