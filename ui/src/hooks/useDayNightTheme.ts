// ui/src/hooks/useDayNightTheme.ts
import { useEffect } from "react";

export function useDayNightTheme() {
  useEffect(() => {
    const hour = new Date().getHours();
    const prefersDark = hour >= 18 || hour < 6; // dark at night
    const root = document.documentElement;
    if (prefersDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, []);
}
