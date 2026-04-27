import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';

const LanguageContext = createContext();

/**
 * YeePOS Internationalization Provider
 * Optimized with Dynamic Loading (Lazy Load) to minimize initial bundle size.
 */
export function LanguageProvider({ children, initialLanguage = 'en', onLanguageChange }) {
  const [language, setLanguage] = useState(initialLanguage);
  const [translations, setTranslations] = useState({});
  const [isLoaded, setIsLoaded] = useState(false);

  // Languages that require Right-to-Left (RTL) layout
  const RTL_LANGUAGES = ['ar'];
  const isRTL = RTL_LANGUAGES.includes(language);

  // Update HTML direction attribute whenever language changes
  useEffect(() => {
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language, isRTL]);

  // Dynamic language loader
  const loadLanguage = useCallback(async (lang) => {
    if (translations[lang]) return true; // Already cached

    try {
      // Dynamic import pattern for Vite/Webpack
      const data = await import(`../locales/${lang}.json`);
      setTranslations(prev => ({
        ...prev,
        [lang]: data.default
      }));
      return true;
    } catch (error) {
      console.error(`[YeePOS] Failed to load language module: ${lang}`, error);
      return false;
    }
  }, [translations]);

  // Initial loading and English fallback
  useEffect(() => {
    const initI18n = async () => {
      // Always load English as safety fallback
      await loadLanguage('en');
      
      // Load selected language if it's not English
      if (initialLanguage !== 'en') {
        await loadLanguage(initialLanguage);
      }
      
      setIsLoaded(true);
    };

    initI18n();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const t = useCallback((key, data = {}) => {
    // Lookup order: Selected Lang -> English Fallback -> Key string
    let text = translations[language]?.[key] || translations['en']?.[key] || key;
    
    if (typeof text === 'string') {
      Object.keys(data).forEach(k => {
        text = text.replace(new RegExp(`{{${k}}}`, 'g'), data[k]);
      });
    }
    return text;
  }, [language, translations]);

  const changeLanguage = async (newLang) => {
    if (!translations[newLang]) {
      const success = await loadLanguage(newLang);
      if (!success) return;
    }
    
    setLanguage(newLang);
    if (onLanguageChange) onLanguageChange(newLang);
  };

  const value = useMemo(() => ({
    language,
    t,
    changeLanguage,
    languages: [
      'en', 'vi', 'zh', 'es', 'fr', 
      'th', 'id', 'ms', 'ja', 'ko', 
      'de', 'pt', 'it', 'ar', 'hi', 
      'tr', 'ru', 'nl', 'pl', 'el'
    ], // List of 20 officially supported languages
    isLoaded,
    isRTL
  }), [language, t, isLoaded, isRTL]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useTranslation must be used within a LanguageProvider');
  }
  return context;
}
