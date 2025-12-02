// ui/vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: "generateSW",
      registerType: "autoUpdate",
      devOptions: {
        enabled: process.env.NODE_ENV === "development",
      },
      workbox: {
        globDirectory: "dist",
        globPatterns: [
            "**/*.{js,css,html,ico,png,svg,wasm}"
        ],
        navigateFallback: "/index.html",
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api"),
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              networkTimeoutSeconds: 5,
            },
          },
          {
            urlPattern: ({ request }) => request.destination === "document",
            handler: "NetworkFirst",
            options: {
              cacheName: "html-cache",
            },
          },
          {
            urlPattern: ({ request }) => ["style", "script", "image"].includes(request.destination),
            handler: "StaleWhileRevalidate",
            options: { cacheName: "asset-cache" },
          },
        ],
      },
      manifest: {
        name: "Kontra",
        short_name: "Kontra",
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#1e40af",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        ],
      },
    }),
  ],

  publicDir: "Public",

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
