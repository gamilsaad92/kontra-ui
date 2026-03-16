import React from "react";

export function Badge({ className = "", variant = "default", ...props }) {
  const variants = {
    default: "bg-gray-900 text-white",
    outline: "border border-gray-300 bg-white text-gray-900",
    info: "bg-blue-600 text-white",
    success: "bg-green-600 text-white",
    warning: "bg-yellow-500 text-white",
    danger: "bg-red-600 text-white",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${variants[variant] || variants.default} ${className}`}
      {...props}
    />
  );
}
