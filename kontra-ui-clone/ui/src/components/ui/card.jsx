import React from "react";
import { kontraTheme, cx } from "../../theme/kontraTheme";

export function Card({ className = "", children, ...props }) {
  return (
    <div className={cx("rounded-2xl", kontraTheme.surfaceCard, className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ className = "", children, ...props }) {
  return (
 <div className={cx("p-5 border-b", kontraTheme.border, className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className = "", children, ...props }) {
  return (
  <h3 className={cx("text-lg font-semibold", kontraTheme.textPrimary, className)} {...props}>
      {children}
    </h3>
  );
}

export function CardContent({ className = "", children, ...props }) {
  return (
 <div className={cx("p-5", className)} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ className = "", children, ...props }) {
  return (
 <div className={cx("p-5 border-t", kontraTheme.border, className)} {...props}>
      {children}
    </div>
  );
}
