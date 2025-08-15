import React from "react";

export function Button({ as: Comp = "button", className = "", variant = "default", size = "md", ...props }) {
  const base = "inline-flex items-center justify-center rounded-2xl font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";
  const variants = {
    default: "bg-black text-white hover:bg-black/90",
    outline: "border border-gray-300 bg-white hover:bg-gray-50",
    ghost: "bg-transparent hover:bg-gray-100",
    secondary: "bg-gray-900 text-white hover:bg-gray-800",
  };
  const sizes = {
    sm: "h-8 px-3 text-sm",
    md: "h-10 px-4 text-sm",
    lg: "h-11 px-5 text-base",
  };
  const cls = `${base} ${variants[variant] || variants.default} ${sizes[size] || sizes.md} ${className}`;
  return <Comp className={cls} {...props} />;
}
