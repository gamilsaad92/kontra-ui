// ui/vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

const analyze = process.env.ANALYZE === "1";
const visualizerPlugin = (() => {
  if (!analyze) return null;
  try {
    const { visualizer } = require("rollup-plugin-visualizer");
    return visualizer({ filename: "stats.html", gzipSize: true, brotliSize: true });
  } catch {
    // visualizer not installed in prod — ignore
    return null;
  }
})();

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: "generateSW",
      registerType: "autoUpdate",
      workbox: {
        // keep the SW small; big assets should be runtime-cached instead
        maximumFileSizeToCacheInBytes: 1024 * 1024,
        globDirectory: "dist",
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
            handler: "NetworkFirst",
            options: { cacheName: "api-cache", networkTimeoutSeconds: 5 },
          },
          {
            urlPattern: ({ request }) =>
              request.destination === "image" || request.destination === "font",
            handler: "StaleWhileRevalidate",
            options: { cacheName: "assets-cache" },
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
    ...(visualizerPlugin ? [visualizerPlugin] : []),
  ],

  publicDir: "Public",

  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },

  optimizeDeps: {
    include: ["react", "react-dom"],
  },

  build: {
    target: "es2020",
    sourcemap: false,
    cssCodeSplit: true,
    minify: "esbuild",
    chunkSizeWarningLimit: 900,
    commonjsOptions: { transformMixedEsModules: true },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("/react/") || id.includes("react-dom") || id.includes("scheduler"))
            return "vendor-react";
          if (id.includes("react-router")) return "vendor-router";
          if (id.includes("@clerk")) return "vendor-auth";
          if (
            id.includes("@radix-ui") ||
            id.includes("class-variance-authority") ||
            id.includes("tailwind-merge") ||
            id.includes("@shadcn")
          )
            return "vendor-ui";
          if (id.includes("lucide-react")) return "vendor-icons";
          if (id.includes("@supabase")) return "vendor-supabase";
          if (id.includes("recharts") || id.includes("chart.js") || id.includes("d3"))
            return "vendor-charts";
          if (id.includes("date-fns") || id.includes("dayjs")) return "vendor-dates";
          if (id.includes("@sentry")) return "vendor-sentry";
          return "vendor";
        },
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
      treeshake: { preset: "recommended", moduleSideEffects: "no-external" },
    },
  },
});
