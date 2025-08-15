// ui/vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
        globIgnores: ["**/sw.js", "**/workbox-*.js"],
      },
      manifest: {
        name: "Kontra",
        short_name: "Kontra",
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#1e40af",
        icons: [
          { src: "/logo.png", sizes: "192x192", type: "image/png" },
          { src: "/logo.png", sizes: "512x512", type: "image/png" },
        ],
      },
    }),
  ],

  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },

  optimizeDeps: {
    include: ["react", "react-dom"],
  },

  // Optional: bring this back if you want custom chunks
  // build: {
  //   rollupOptions: {
  //     output: {
  //       manualChunks(id) {
  //         if (id.includes("node_modules")) {
  //           const reactPkgs = ["react", "react-dom", "react-router-dom"];
  //           const clerkPkgs = ["@clerk"];
  //           const shadcnPkgs = [
  //             "@shadcn/ui",
  //             "class-variance-authority",
  //             "tailwind-merge",
  //             "lucide-react",
  //           ];
  //           const utilPkgs = [
  //             "@heroicons",
  //             "@sentry",
  //             "@supabase",
  //             "chart.js",
  //             "recharts",
  //             "clsx",
  //             "react-spinners",
  //             "morgan",
  //           ];
  //           if (reactPkgs.some((p) => id.includes(p))) return "react";
  //           if (clerkPkgs.some((p) => id.includes(p))) return "clerk";
  //           if (shadcnPkgs.some((p) => id.includes(p))) return "shadcn";
  //           if (utilPkgs.some((p) => id.includes(p))) return "utils";
  //           return "vendor";
  //         }
  //       },
  //     },
  //   },
  // },
});
