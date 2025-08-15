import React from 'react';

export function DropdownMenu({ children }) {
  return <div>{children}</div>;
}

export function DropdownMenuTrigger({ children }) {
  return <div>{children}</div>;
}

export function DropdownMenuContent({ children, className }) {
  return <div className={className}>{children}</div>;
}

export function DropdownMenuItem({ children, onSelect, className }) {
  return (
    <div className={className} onClick={onSelect}>
      {children}
    </div>
  );
}
