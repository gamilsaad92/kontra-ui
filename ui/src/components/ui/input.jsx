import React from "react";

export function Input({ className = "", ...props }) {
  return (
    <input
     className={`h-10 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-black/30 ${className}`}      {...props}
    />
  );
}
