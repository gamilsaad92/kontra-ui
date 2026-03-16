import React from "react";
import { kontraTheme, cx } from "../../theme/kontraTheme";

export function Button({
  as: Comp = "button",
  className = "",
  variant = "secondary",
  size = "md",
  ...props
}) {
  const base = cx(
    "inline-flex items-center justify-center rounded-xl font-medium transition-colors",
    kontraTheme.focusRing,
    "disabled:opacity-50 disabled:cursor-not-allowed"
  );
  const variants = {
    primary: cx(kontraTheme.kontraRedBg, kontraTheme.kontraRedHover),
    secondary:
      "bg-slate-900 text-white border border-slate-800 hover:bg-slate-800 dark:bg-slate-800 dark:border-slate-700",
    ghost:
      "bg-transparent text-slate-600 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-slate-800/70",
    outline:
      "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100",
  };
  const sizes = {
    sm: "h-8 px-3 text-xs",
    md: "h-10 px-4 text-sm",
    lg: "h-11 px-5 text-base",
  };
 const cls = cx(base, variants[variant] || variants.secondary, sizes[size] || sizes.md, className);
  return <Comp className={cls} {...props} />;
}
