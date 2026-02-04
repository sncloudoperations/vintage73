import '@/styles/globals.css';
import Layout from '@/components/Layout';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { Toaster } from 'react-hot-toast';

export default function App({ Component, pageProps }) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Basic Auth Check
    const token = localStorage.getItem('token');
    const publicPaths = ['/login', '/setup'];
    
    if (!token && !publicPaths.includes(router.pathname)) {
      router.push('/login');
    }
  }, [router.pathname]);

  if (!mounted) return null; // Prevent hydration mismatch

  return (
    <Layout>
      <Component {...pageProps} />
      <Toaster position="top-right" toastOptions={{
        duration: 3000,
        style: {
          background: '#333',
          color: '#fff',
        },
      }} />
    </Layout>
  );
}
