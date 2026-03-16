import * as React from "react";

export function Progress({ value = 0, className = "" }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`h-2 w-full overflow-hidden rounded-full bg-slate-800 ${className}`}
    >
      <div
        className="h-full rounded-full bg-slate-300 transition-all"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default Progress;
