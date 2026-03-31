import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          const user = JSON.parse(storedUser);
          if (user.role === 'customer') {
            router.push('/customer-dashboard');
          } else {
            router.push('/dashboard');
          }
        } catch (e) {
          router.push('/dashboard');
        }
      } else {
        router.push('/dashboard');
      }
    } else {
      router.push('/login');
    }
  }, [router]);

  return <div className="flex items-center justify-center h-screen">Loading...</div>;
}
