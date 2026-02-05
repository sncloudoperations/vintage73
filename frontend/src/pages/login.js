import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import api from '@/lib/api';
import { FiLock, FiUser, FiArrowRight, FiCheckCircle } from 'react-icons/fi';
import { toast } from 'react-toastify';

export default function Login() {
  const router = useRouter();
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSetupChecked, setIsSetupChecked] = useState(false);

  useEffect(() => {
    // Check if setup is needed
    api.get('/auth/check-setup')
      .then(res => {
        if (!res.data.isSetup) {
          router.push('/setup');
        } else {
          setIsSetupChecked(true);
        }
      })
      .catch(err => console.error("Setup check failed", err));
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { data } = await api.post('/auth/login', formData);
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      toast.success('Login Successful! Redirecting...');
      router.push('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!isSetupChecked) return null;

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Left Side: Branding (Visible on desktop) */}
      <div className="hidden lg:flex flex-1 bg-white relative overflow-hidden items-center justify-center border-r border-slate-100 p-16">
        <div className="relative z-10 w-full h-full flex items-center justify-center animate-fade-in">
          <img 
            src="/login-branding.png" 
            alt="Quick POS Branding" 
            className="max-w-full max-h-full object-contain drop-shadow-sm"
          />
        </div>
        
        <div className="absolute top-0 right-0 w-96 h-96 bg-green-500/5 rounded-full blur-[100px] -mr-48 -mt-48 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-green-400/5 rounded-full blur-[80px] -ml-32 -mb-32 pointer-events-none"></div>
      </div>

      {/* Right Side: Login Form */}
      <div className="w-full lg:w-[450px] flex items-center justify-center p-8 bg-white lg:bg-slate-50/50">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex flex-col items-center mb-10">
            <div className="w-14 h-14 bg-green-600 rounded-2xl flex items-center justify-center mb-4 shadow-xl shadow-green-100">
              <FiLock className="text-white text-2xl" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Quick POS</h1>
          </div>

          <div className="mb-10">
            <h2 className="text-3xl font-bold text-slate-900 mb-2">Welcome Back</h2>
            <p className="text-slate-500">Please enter your details to sign in.</p>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-4 rounded-xl mb-6 border border-red-100 flex items-center animate-shake">
              <span className="mr-2 font-bold">!</span>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">Username</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <FiUser className="text-slate-400 group-focus-within:text-green-600 transition-colors" />
                </div>
                <input 
                  type="text" 
                  className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-slate-900 text-sm focus:outline-none focus:border-green-600 focus:ring-4 focus:ring-green-600/5 transition-all placeholder:text-slate-400"
                  placeholder="Enter your username"
                  value={formData.username} 
                  onChange={e => setFormData({...formData, username: e.target.value})}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-slate-700">Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <FiLock className="text-slate-400 group-focus-within:text-green-600 transition-colors" />
                </div>
                <input 
                  type="password" 
                  className="w-full bg-white border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-slate-900 text-sm focus:outline-none focus:border-green-600 focus:ring-4 focus:ring-green-600/5 transition-all placeholder:text-slate-400"
                  placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
                  value={formData.password} 
                  onChange={e => setFormData({...formData, password: e.target.value})}
                  required
                />
              </div>
            </div>

            <div className="flex items-center space-x-2 py-1">
              <input type="checkbox" id="remember" className="w-4 h-4 rounded border-slate-300 text-green-600 focus:ring-green-600" />
              <label htmlFor="remember" className="text-sm text-slate-600 cursor-pointer">Remember for 30 days</label>
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="group w-full bg-[#152e25] hover:bg-[#1a382d] disabled:bg-slate-400 text-white font-semibold py-3.5 rounded-xl transition-all duration-200 flex items-center justify-center space-x-2 shadow-lg shadow-slate-200"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
              {!loading && <FiArrowRight className="group-hover:translate-x-1 transition-transform" />}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-[11px] text-slate-400 uppercase tracking-wider">
              &copy; {new Date().getFullYear()} SN Tech Business Solutions.
            </p>
            <p className="text-[10px] text-slate-300 mt-1">
              All Rights Reserved.
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.8s ease-out forwards;
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-4px); }
          75% { transform: translateX(4px); }
        }
        .animate-shake {
          animation: shake 0.4s ease-in-out;
        }
      `}</style>
    </div>
  );
}

