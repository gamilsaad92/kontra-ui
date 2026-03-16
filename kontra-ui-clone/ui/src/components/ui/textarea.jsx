import React from "react";
import { kontraTheme, cx } from "../../theme/kontraTheme";

export function Textarea({ className = "", ...props }) {
  return (
    <textarea
      className={cx(
        "w-full rounded-xl border px-3 py-2 text-sm outline-none",
        kontraTheme.input,
        kontraTheme.focusRing,
        className
      )}
      {...props}
    />
  );
}
