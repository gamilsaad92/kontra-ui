import React from "react";

interface CardProps {
  title: React.ReactNode;
  children: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}

export default function Card({
  title,
  children,
  right,
  className = "",
}: CardProps) {
  return (
    <div className={"bg-white rounded-xl border border-slate-200 p-6 " + className}>
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-sm font-medium text-slate-600">{title}</h3>
        {right}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}
