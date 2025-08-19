import { useEffect } from "react";

export function useDayNightTheme() {
  useEffect(() => {
    const root = document.documentElement;
    const saved = localStorage.getItem("theme"); // "dark" | "light" | null
    const apply = (mode: "dark"|"light") => {
      if (mode === "dark") { root.classList.add("dark"); }
      else { root.classList.remove("dark"); }
    };

    if (saved === "dark" || saved === "light") {
      apply(saved);
      return;
    }
    const hour = new Date().getHours();
    const night = hour >= 19 || hour < 7;
    apply(night ? "dark" : "light");

    // Optional: re-check at next top-of-hour
    const msToNextHour = (60 - new Date().getMinutes())*60*1000;
    const id = setTimeout(() => {
      const h = new Date().getHours();
      const n = h >= 19 || h < 7;
      apply(n ? "dark" : "light");
    }, msToNextHour);
    return () => clearTimeout(id);
  }, []);
}
