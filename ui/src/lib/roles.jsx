import React, { createContext, useContext } from 'react';

const RoleContext = createContext('lender');

export function RoleProvider({ children }) {
  return <RoleContext.Provider value={'lender'}>{children}</RoleContext.Provider>;
}

export function useRole() {
  return useContext(RoleContext);
}
