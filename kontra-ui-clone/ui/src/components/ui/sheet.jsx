import React from 'react';

export function Sheet({ children }) {
  return <div>{children}</div>;
}

export function SheetTrigger({ children }) {
  return <div>{children}</div>;
}

export function SheetContent({ children, className }) {
  return <div className={className}>{children}</div>;
}

export function SheetHeader({ children }) {
  return <div>{children}</div>;
}

export function SheetTitle({ children }) {
  return <div>{children}</div>;
}
