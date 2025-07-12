import React from 'react';

export default function Button({ variant = 'primary', className = '', children, ...props }) {
  const base = 'px-md py-xs rounded font-semibold focus:outline-none';
  const variants = {
    primary: 'bg-primary text-white hover:bg-primary/90',
    secondary: 'bg-secondary text-white hover:bg-secondary/90',
    ghost: 'bg-transparent text-primary hover:bg-primary/10',
  };
  const classes = `${base} ${variants[variant] || variants.primary} ${className}`;
  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
}
