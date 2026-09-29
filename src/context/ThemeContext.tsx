import React, { createContext, useContext, useEffect } from 'react';
import { useFirestoreSync } from '../hooks/useFirestoreSync';

type ThemeMode = 'light' | 'dark';
type ThemeColor = 'orange' | 'blue' | 'green' | 'red' | 'purple';
type SidebarPosition = 'left' | 'right' | 'top' | 'bottom';

interface ThemeContextType {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  accentColor: ThemeColor;
  setAccentColor: (color: ThemeColor) => void;
  sidebarPosition: SidebarPosition;
  setSidebarPosition: (position: SidebarPosition) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mode, setMode] = useFirestoreSync<ThemeMode>('ferreteria_theme_mode', 'light');
  const [accentColor, setAccentColor] = useFirestoreSync<ThemeColor>('ferreteria_theme_color', 'orange');
  const [sidebarPosition, setSidebarPosition] = useFirestoreSync<SidebarPosition>('ferreteria_sidebar_position', 'left');

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', mode);
    root.setAttribute('data-color', accentColor);
    
    if (mode === 'dark') {
      root.classList.add('dark-mode');
    } else {
      root.classList.remove('dark-mode');
    }
  }, [mode, accentColor]);

  return (
    <ThemeContext.Provider value={{ mode, setMode, accentColor, setAccentColor, sidebarPosition, setSidebarPosition }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
};
