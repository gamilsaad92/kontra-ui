export const kontraTheme = {
  surfaceBg: "bg-slate-50 dark:bg-slate-950",
  surfaceCard:
    "bg-white/90 dark:bg-slate-900/80 border border-slate-200/70 dark:border-slate-800 shadow-sm",
  border: "border-slate-200/70 dark:border-slate-800",
  textPrimary: "text-slate-900 dark:text-slate-100",
  textMuted: "text-slate-600 dark:text-slate-400",
  kontraRed: "text-red-500",
  kontraRedBg: "bg-red-600 text-white",
  kontraRedHover: "hover:bg-red-500",
  focusRing:
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 dark:focus-visible:ring-offset-slate-950",
  input:
    "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 border-slate-200 dark:border-slate-700",
  mutedSurface: "bg-slate-100/70 dark:bg-slate-800/60",
};

export const cx = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");
