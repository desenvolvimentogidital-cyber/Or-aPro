import { useAuth } from './AuthContext';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { PlatformTheme } from '../types';
import { defaultTheme } from '../data/defaults';

interface ThemePreset {
  id: string;
  name: string;
  primary: string;
  primaryHover: string;
  secondary: string;
  primaryGradient: string;
  card: string;
  bg: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'orange-fire',
    name: 'Laranja Elétrica (Degradê Original)',
    primary: '#ff6b00',
    primaryHover: '#e05d00',
    secondary: '#ff8a33',
    primaryGradient: 'linear-gradient(135deg, #ffa114 0%, #ff6b00 50%, #ff3b00 100%)',
    card: '#161922',
    bg: '#0c0e14'
  },
  {
    id: 'cyan-tech',
    name: 'Azul Eletro Pro',
    primary: '#0077ff',
    primaryHover: '#0062d6',
    secondary: '#38bdf8',
    primaryGradient: 'linear-gradient(135deg, #38bdf8 0%, #0077ff 50%, #0052cc 100%)',
    card: '#111726',
    bg: '#080c14'
  },
  {
    id: 'emerald-eco',
    name: 'Verde Esmeralda Solar',
    primary: '#10b981',
    primaryHover: '#059669',
    secondary: '#34d399',
    primaryGradient: 'linear-gradient(135deg, #34d399 0%, #10b981 50%, #059669 100%)',
    card: '#0f1f18',
    bg: '#08120e'
  },
  {
    id: 'gold-power',
    name: 'Dourado Premium',
    primary: '#f59e0b',
    primaryHover: '#d97706',
    secondary: '#fbbf24',
    primaryGradient: 'linear-gradient(135deg, #fcd34d 0%, #f59e0b 50%, #d97706 100%)',
    card: '#1b1812',
    bg: '#0e0c08'
  },
  {
    id: 'purple-volt',
    name: 'Roxo Cyber Volt',
    primary: '#8b5cf6',
    primaryHover: '#7c3aed',
    secondary: '#a78bfa',
    primaryGradient: 'linear-gradient(135deg, #c084fc 0%, #8b5cf6 50%, #6d28d9 100%)',
    card: '#181424',
    bg: '#0d0914'
  },
  {
    id: 'red-danger',
    name: 'Vermelho Potência',
    primary: '#ef4444',
    primaryHover: '#dc2626',
    secondary: '#f87171',
    primaryGradient: 'linear-gradient(135deg, #f87171 0%, #ef4444 50%, #b91c1c 100%)',
    card: '#1f1313',
    bg: '#120808'
  }
];

interface ThemeContextType {
  theme: PlatformTheme;
  updateTheme: (newTheme: Partial<PlatformTheme>) => void;
  applyPreset: (presetId: string) => void;
  resetTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function hexToRgb(hex: string): string {
  let cleanHex = hex.replace('#', '');
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split('').map(c => c + c).join('');
  }
  const num = parseInt(cleanHex, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `${r}, ${g}, ${b}`;
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session } = useAuth();
  const themeStorageKey = session ? `orcapro_theme_${session.user.id}` : 'orcapro_theme';
  const [theme, setTheme] = useState<PlatformTheme>(() => {
    try {
      const saved = localStorage.getItem(themeStorageKey);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return defaultTheme;
  });

  useEffect(() => {
    try {
      localStorage.setItem(themeStorageKey, JSON.stringify(theme));
    } catch {
      // ignore
    }

    // Apply CSS variables on document root
    const root = document.documentElement;
    root.style.setProperty('--primary-color', theme.primaryColor);
    root.style.setProperty('--primary-hover', theme.primaryHover);
    root.style.setProperty('--primary-rgb', hexToRgb(theme.primaryColor));
    root.style.setProperty('--primary-gradient', theme.primaryGradient || 'linear-gradient(135deg, #ffa114 0%, #ff6b00 50%, #ff3b00 100%)');
    root.style.setProperty('--card-color', theme.cardColor);
    root.style.setProperty('--bg-color', theme.backgroundColor);
  }, [theme]);

  const updateTheme = (newProps: Partial<PlatformTheme>) => {
    setTheme(prev => {
      let gradient = newProps.primaryGradient || prev.primaryGradient;
      // If primaryColor changed without specifying a new gradient, generate a harmonious gradient
      if (newProps.primaryColor && !newProps.primaryGradient) {
        gradient = `linear-gradient(135deg, ${newProps.secondaryColor || '#ffa114'} 0%, ${newProps.primaryColor} 50%, ${newProps.primaryHover || '#ff3b00'} 100%)`;
      }
      return { ...prev, ...newProps, primaryGradient: gradient };
    });
  };

  const applyPreset = (presetId: string) => {
    const preset = THEME_PRESETS.find(p => p.id === presetId);
    if (preset) {
      setTheme(prev => ({
        ...prev,
        primaryColor: preset.primary,
        primaryHover: preset.primaryHover,
        secondaryColor: preset.secondary,
        primaryGradient: preset.primaryGradient,
        cardColor: preset.card,
        backgroundColor: preset.bg
      }));
    }
  };

  const resetTheme = () => {
    setTheme(defaultTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, updateTheme, applyPreset, resetTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
