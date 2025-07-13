import React, { createContext, useContext, useState } from 'react';
import en from '../locales/en.json';
import es from '../locales/es.json';

const resources = { en, es };

const LocaleContext = createContext({
  locale: 'en',
  setLocale: () => {},
  t: (key) => key
});

export function LocaleProvider({ children, defaultLocale = 'en' }) {
  const [locale, setLocale] = useState(defaultLocale);
  const t = (key) => resources[locale]?.[key] || key;
  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  );
}

export const useLocale = () => useContext(LocaleContext);
