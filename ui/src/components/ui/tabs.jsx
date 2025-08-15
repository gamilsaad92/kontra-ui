import React from 'react';

export function Tabs({ children, className, onValueChange, value }) {
  return (
    <div className={className}>
      {React.Children.map(children, (child) =>
        React.cloneElement(child, { onValueChange, value })
      )}
    </div>
  );
}

export function TabsList({ children, className, onValueChange, value }) {
  return (
    <div className={className}>
      {React.Children.map(children, (child) =>
        React.cloneElement(child, { onValueChange, value })
      )}
    </div>
  );
}

export function TabsTrigger({ children, className, value: itemValue, onValueChange }) {
  return (
    <button className={className} onClick={() => onValueChange && onValueChange(itemValue)}>
      {children}
    </button>
  );
}

export function TabsContent({ children, className }) {
  return <div className={className}>{children}</div>;
}
