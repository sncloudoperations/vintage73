import { createContext, useContext, useState, useEffect } from 'react';
import api from '@/lib/api';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState({
    primaryColor: '#10b981', // Default Emerald 500
    secondaryColor: '#059669', // Default Emerald 600
    gradientType: 'linear',
  });
  const [loading, setLoading] = useState(true);

  // 1. Initial Load from LocalStorage (Instant)
  useEffect(() => {
    const savedTheme = localStorage.getItem('app_theme');
    if (savedTheme) {
      try {
        const parsed = JSON.parse(savedTheme);
        setTheme(parsed);
        applyTheme(parsed);
      } catch (err) {
        console.error('Failed to parse cached theme');
      }
    }
    fetchTheme();
  }, []);

  // 2. Apply theme whenever it changes
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const fetchTheme = async () => {
    try {
      const { data } = await api.get('/company');
      if (data) {
        const newTheme = {
          primaryColor: data.primaryColor || '#10b981',
          secondaryColor: data.secondaryColor || '#059669',
          gradientType: data.gradientType || 'linear',
          companyProfile: data // Store full profile
        };
        setTheme(newTheme);
        localStorage.setItem('app_theme', JSON.stringify(newTheme));
      }
    } catch (err) {
      console.error('Failed to load theme:', err);
    } finally {
      setLoading(false);
    }
  };

  const applyTheme = (themeData) => {
    if (typeof window === 'undefined') return;

    const root = document.documentElement;
    const primary = themeData.primaryColor || '#10b981';
    const secondary = themeData.secondaryColor || '#059669';

    root.style.setProperty('--primary', primary);
    root.style.setProperty('--primary-dark', secondary);

    // Calculate light variant (optional, simple opacity version)
    root.style.setProperty('--primary-light', `${primary}20`); // 20% opacity hex
  };

  const updateTheme = async (newTheme) => {
    // Optimistic update
    setTheme(newTheme);
    localStorage.setItem('app_theme', JSON.stringify(newTheme));
    applyTheme(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, updateTheme, refreshTheme: fetchTheme }}>
      {!loading || theme.primaryColor ? children : null}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
