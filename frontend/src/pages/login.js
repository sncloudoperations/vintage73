import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import api, { getServerUrl } from '@/lib/api';
import { FiLock, FiUser, FiArrowRight } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { useTheme } from '@/context/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import { getTerminalId } from '@/lib/terminal';

export default function Login() {
  const router = useRouter();
  const { theme } = useTheme();
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
      const terminalCode = getTerminalId();
      const { data } = await api.post('/auth/login', { ...formData, terminalCode });
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      toast.success('Login Successful! Redirecting...');
      
      if (data.user.role === 'customer') {
        router.push('/customer-dashboard');
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed';
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const primaryColor = theme?.primaryColor || '#10b981';

  if (!isSetupChecked) return null;

  return (
    <div className="min-h-screen flex bg-slate-50 overflow-hidden">
      {/* Left Side: Branding (Visible on desktop) */}
      <motion.div
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="hidden lg:flex flex-1 bg-white relative overflow-hidden items-center justify-center border-r border-slate-100 p-16"
      >
        <motion.div
          animate={{
            y: [0, -15, 0],
          }}
          transition={{
            duration: 6,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          className="relative z-10 w-full h-full flex items-center justify-center"
        >
          <img
            src={theme.companyProfile?.dashboardImageUrl ? `${getServerUrl()}${theme.companyProfile.dashboardImageUrl}` : "/login-branding.png"}
            alt="Branding"
            className="max-w-[70%] max-h-[70%] object-contain drop-shadow-2xl"
          />
        </motion.div>
      </motion.div>

      {/* Right Side: Login Form */}
      <div className="w-full lg:w-[450px] flex items-center justify-center p-8 bg-white lg:bg-slate-50/50 relative">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="w-full max-w-md relative z-10"
        >
          {/* Mobile Logo */}
          <div className="lg:hidden flex flex-col items-center mb-10">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-xl shadow-green-100"
              style={{ backgroundColor: primaryColor }}
            >
              <FiLock className="text-white text-3xl" />
            </motion.div>
            <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Quick POS</h1>
          </div>

          <div className="mb-10">
            <h2 className="text-2xl font-semibold text-slate-900 mb-2 tracking-tight">Welcome Back</h2>
            <p className="text-slate-500 font-medium text-sm">Please enter your credentials to proceed.</p>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: [0, -5, 5, -5, 5, 0], opacity: 1 }}
                exit={{ opacity: 0, x: 20 }}
                className="bg-rose-50 text-rose-600 text-xs font-medium uppercase tracking-widest p-4 rounded-xl mb-6 border border-rose-100 flex items-center gap-3 shadow-sm"
              >
                <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div>
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-widest pl-1">Username</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <FiUser className="text-slate-400 group-focus-within:text-[var(--primary)] transition-colors" style={{ color: 'var(--primary-dark)' }} />
                </div>
                <input
                  type="text"
                  className="w-full bg-white border border-slate-100 rounded-xl pl-11 pr-4 py-3.5 text-slate-800 text-sm font-semibold focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all placeholder:text-slate-300 shadow-sm"
                  placeholder="Identify yourself"
                  value={formData.username}
                  onChange={e => setFormData({ ...formData, username: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-medium text-slate-400 uppercase tracking-widest pl-1">Secret Key</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <FiLock className="text-slate-400 group-focus-within:text-[var(--primary)] transition-colors" style={{ color: 'var(--primary-dark)' }} />
                </div>
                <input
                  type="password"
                  className="w-full bg-white border border-slate-100 rounded-xl pl-11 pr-4 py-3.5 text-slate-800 text-sm font-semibold focus:outline-none focus:ring-4 focus:ring-primary/5 transition-all placeholder:text-slate-300 shadow-sm"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="flex items-center space-x-2 py-1">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  id="remember"
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                <span className="ml-3 text-[11px] font-medium text-slate-400 uppercase tracking-wider">Keep me signed in</span>
              </label>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={loading}
              className="group w-full text-white font-medium py-4 rounded-xl transition-all duration-300 flex items-center justify-center gap-3 shadow-xl hover:shadow-primary/20 disabled:opacity-50 text-[11px] uppercase tracking-[0.2em] relative overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${primaryColor} 0%, ${theme?.secondaryColor || primaryColor} 100%)`
              }}
            >
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <span>{loading ? 'Validating...' : 'Authenticate'}</span>
              {!loading && <FiArrowRight className="group-hover:translate-x-1 transition-transform" />}
            </motion.button>
          </form>

          <div className="mt-12 text-center">
            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-[3px] mb-1">
              &copy; {new Date().getFullYear()} SN Tech Solutions
            </p>
            <div className="w-8 h-1 bg-slate-100 mx-auto rounded-full"></div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

