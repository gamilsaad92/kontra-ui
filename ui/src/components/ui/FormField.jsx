import React from 'react';
import Input from './Input.jsx';

export default function FormField({ label, children, className = '', ...props }) {
  return (
    <div className={`mb-md ${className}`}> 
      {label && <label className="block mb-xs font-medium">{label}</label>}
      {children || <Input {...props} />}
    </div>
  );
}
