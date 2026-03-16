import React from "react";

interface PillProps {
  children: React.ReactNode;
  tone?: "green" | "sky" | "rose" | "slate";
}

export default function Pill({ children, tone = "slate" }: PillProps) {
  const toneClass =
    tone === "green"
      ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
      : tone === "sky"
      ? "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200"
      : tone === "rose"
      ? "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200"
      : "bg-slate-50 text-slate-700 ring-1 ring-inset ring-slate-200";

  return (
    <span
      className={
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium " +
        toneClass
      }
    >
      {children}
    </span>
  );
}
