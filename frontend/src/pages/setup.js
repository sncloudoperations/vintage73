import { useState } from 'react';
import { useRouter } from 'next/router';
import api from '@/lib/api';
import { FiCheckCircle, FiCpu } from 'react-icons/fi';

export default function Setup() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    username: '',
    name: '',
    password: '',
    companyName: '',
    address: '',
    phone: '',
    email: ''
  });

  const handleChange = (e) => {
    setFormData({...formData, [e.target.name]: e.target.value});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.post('/auth/setup', formData);
      alert('Setup Complete! Please login.');
      router.push('/login');
    } catch (err) {
      setError(err.response?.data?.message || 'Setup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-4">
          <FiCpu className="h-6 w-6 text-green-600" />
        </div>
        <h2 className="text-center text-3xl font-bold text-gray-900">
          Initial System Setup
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Create your admin account and company profile
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {error && <div className="mb-4 text-red-600 text-sm">{error}</div>}
          
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <h3 className="text-lg font-medium text-gray-900 border-b pb-2 mb-4">Admin Credentials</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Full Name</label>
                  <input name="name" type="text" required className="input" onChange={handleChange} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Username</label>
                  <input name="username" type="text" required className="input" onChange={handleChange} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Password</label>
                  <input name="password" type="password" required className="input" onChange={handleChange} />
                </div>
              </div>
            </div>

            <div className="pt-4">
              <h3 className="text-lg font-medium text-gray-900 border-b pb-2 mb-4">Company Profile</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Company Name</label>
                  <input name="companyName" type="text" required className="input" onChange={handleChange} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input name="email" type="email" className="input" onChange={handleChange} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Phone</label>
                  <input name="phone" type="text" className="input" onChange={handleChange} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Address</label>
                  <textarea name="address" rows={3} className="input" onChange={handleChange} />
                </div>
              </div>
            </div>

            <button type="submit" disabled={loading} className="w-full btn btn-primary justify-center">
              {loading ? 'Setting up...' : 'Complete Setup'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
