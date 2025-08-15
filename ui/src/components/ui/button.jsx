import React from 'react';

export default function Button({ variant = 'primary', className = '', children, ...props }) {
   const base = 'px-md py-xs rounded font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary';
  const variants = {
   primary: 'text-white hover:opacity-90',
    secondary: 'bg-secondary text-white hover:bg-secondary/90',
    ghost: 'bg-transparent text-primary hover:bg-primary/10',
  };
  const classes = `${base} ${variants[variant] || variants.primary} ${className}`;
    const style = variant === 'primary' ? { backgroundColor: 'var(--brand-color)' } : {};
  return (
        <button className={classes} style={style} {...props}>
      {children}
    </button>
  );
}
