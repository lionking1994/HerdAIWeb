import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [darkMode, setDarkMode] = useState(localStorage.getItem('darkMode') === 'true');

  useEffect(() => {
    // document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    // localStorage.setItem('darkMode', darkMode);
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode(prev => !prev);
  };

  return (
    <>
      <ThemeContext.Provider value={{ darkMode, toggleDarkMode }}>
      {children}
      </ThemeContext.Provider>
    </>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
} 