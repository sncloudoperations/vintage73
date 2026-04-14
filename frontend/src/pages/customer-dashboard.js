import { useState, useEffect } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { FiLock, FiUser, FiActivity, FiKey } from 'react-icons/fi';
import api from '@/lib/api';
import { toast } from 'react-toastify';
import { motion } from 'framer-motion';

export default function CustomerDashboard() {
  const { theme } = useTheme();
  const [user, setUser] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setUser(JSON.parse(localStorage.getItem('user')));
  }, []);

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/change-password', {
        oldPassword: passwordData.oldPassword,
        newPassword: passwordData.newPassword
      });
      toast.success('Password changed successfully');
      setShowPasswordModal(false);
      setPasswordData({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const primaryColor = theme?.primaryColor || '#10b981';

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto p-6 mt-8">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden relative">
        {/* Header Decor */}
        <div className="h-32 absolute top-0 left-0 right-0 bg-gradient-to-r from-primary-dark to-primary opacity-10"></div>
        
        <div className="relative p-8 pt-12 flex flex-col md:flex-row items-center md:items-start gap-8">
          <div 
            className="w-24 h-24 rounded-2xl shadow-xl flex items-center justify-center text-white text-4xl shrink-0 font-semibold"
            style={{ backgroundColor: primaryColor }}
          >
            {user.username?.charAt(0).toUpperCase() || <FiUser />}
          </div>
          
          <div className="flex-1 text-center md:text-left">
            <h1 className="text-3xl font-semibold text-slate-800 tracking-tight">Welcome, {user.name || user.username}</h1>
            <p className="text-slate-500 mt-2">You are logged in as a <strong>Customer</strong>.</p>
            
            <div className="mt-6 flex flex-wrap gap-4 justify-center md:justify-start">
              <button 
                onClick={() => setShowPasswordModal(true)}
                className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-all"
              >
                <FiKey /> Change Password
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-3 mb-4 text-slate-800">
            <FiActivity className="text-primary text-xl" />
            <h3 className="font-medium text-lg">Your Access</h3>
          </div>
          <p className="text-sm text-slate-500 mb-4">You have been granted access to the following modules. Use the top navigation or sidebar to explore these areas.</p>
          <div className="flex flex-wrap gap-2">
            {user.allowedModules?.map(mod => (
              <span key={mod} className="px-3 py-1 bg-slate-50 border border-slate-200 text-slate-600 text-[10px] font-medium uppercase tracking-wider rounded-lg">
                {mod.replace(':', ' - ')}
              </span>
            ))}
          </div>
        </div>
      </div>

      {showPasswordModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2"><FiLock className="text-primary"/> Setup New Password</h2>
              <button onClick={() => setShowPasswordModal(false)} className="text-slate-400 hover:text-slate-600 text-xl">&times;</button>
            </div>
            <form onSubmit={handlePasswordChange} className="p-6 space-y-4 text-left">
              <div>
                <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-widest pl-1 mb-1">Current Password</label>
                <input 
                  type="password" 
                  required 
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20" 
                  value={passwordData.oldPassword} 
                  onChange={e => setPasswordData({...passwordData, oldPassword: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-widest pl-1 mb-1">New Password</label>
                <input 
                  type="password" 
                  required 
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20" 
                  value={passwordData.newPassword} 
                  onChange={e => setPasswordData({...passwordData, newPassword: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-widest pl-1 mb-1">Confirm New Password</label>
                <input 
                  type="password" 
                  required 
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20" 
                  value={passwordData.confirmPassword} 
                  onChange={e => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button type="button" onClick={() => setShowPasswordModal(false)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs uppercase tracking-wider rounded-xl transition-colors">Cancel</button>
                <button type="submit" disabled={loading} className="flex-1 py-3 bg-primary hover:bg-primary-dark text-white font-medium text-xs uppercase tracking-wider rounded-xl transition-colors flex justify-center items-center">
                  {loading ? 'Saving...' : 'Update Password'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
