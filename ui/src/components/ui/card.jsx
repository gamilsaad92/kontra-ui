import React from 'react';
export default function Card({ title, footer, className = '', children }) {
  return (
    <div className={`bg-white rounded shadow-sm p-md ${className}`}>
      {title && <h3 className="font-semibold mb-sm">{title}</h3>}
      <div>{children}</div>
      {footer && <div className="mt-sm border-t pt-sm">{footer}</div>}
    </div>
  );
}
