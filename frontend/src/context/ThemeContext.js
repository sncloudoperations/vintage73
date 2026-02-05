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

  useEffect(() => {
    fetchTheme();
  }, []);

  const fetchTheme = async () => {
    try {
      const { data } = await api.get('/company');
      if (data) {
        setTheme({
          primaryColor: data.primaryColor || '#10b981',
          secondaryColor: data.secondaryColor || '#059669',
          gradientType: data.gradientType || 'linear',
          companyProfile: data // Store full profile
        });
        applyTheme(data);
      }
    } catch (err) {
      console.error('Failed to load theme:', err);
    } finally {
      setLoading(false);
    }
  };

  const applyTheme = (themeData) => {
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
    applyTheme(newTheme);
    
    // Persist to backend is handled by the Settings page calling company update API,
    // but the context exposes the current state for the whole app.
  };

  return (
    <ThemeContext.Provider value={{ theme, updateTheme, refreshTheme: fetchTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
