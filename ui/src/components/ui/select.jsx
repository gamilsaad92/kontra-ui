import React from "react";
import { kontraTheme, cx } from "../../theme/kontraTheme";

export function Select({ className = "", children, ...props }) {
  return (
    <select
      className={cx(
        "h-10 w-full rounded-xl border px-3 py-2 text-sm outline-none",
        kontraTheme.input,
        kontraTheme.focusRing,
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}
