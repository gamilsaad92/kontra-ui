// ui/vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { fileURLToPath, URL } from "node:url";

// Optional: bundle visualizer (run with ANALYZE=1 npm run build)
const withVisualizer = process.env.ANALYZE === "1";
let visualizer = null;
if (withVisualizer) {
  ({ visualizer } = await import("rollup-plugin-visualizer"));
}

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: "generateSW",
      registerType: "autoUpdate",
      workbox: {
        // Keep the precache lean; large files belong in runtime caching
        maximumFileSizeToCacheInBytes: 1024 * 1024, // 1 MB
        globDirectory: "dist",
        globPatterns: [
          "**/*.{js,css,html,ico,png,svg}" // drop wasm from precache to avoid huge sw
        ],
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          // API: network first
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
            handler: "NetworkFirst",
            options: { cacheName: "api-cache", networkTimeoutSeconds: 5 }
          },
          // Images & fonts: stale-while-revalidate
          {
            urlPattern: ({ request }) =>
              request.destination === "image" || request.destination === "font",
            handler: "StaleWhileRevalidate",
            options: { cacheName: "assets-cache" }
          }
        ]
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
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" }
        ]
      }
    }),
    ...(withVisualizer
      ? [visualizer({ filename: "stats.html", gzipSize: true, brotliSize: true })]
      : [])
  ],

  // Prefer default "public" folder name unless you intentionally use "Public"
  publicDir: "Public",

  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) }
  },

  optimizeDeps: {
    include: ["react", "react-dom"]
  },

  build: {
    target: "es2020",
    sourcemap: false,
    cssCodeSplit: true,
    minify: "esbuild",
    chunkSizeWarningLimit: 900, // quiet warning once chunks are actually split
    commonjsOptions: { transformMixedEsModules: true },
    rollupOptions: {
      output: {
        // Create stable, purpose-driven vendor chunks
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
        assetFileNames: "assets/[name]-[hash][extname]"
      },
      treeshake: {
        preset: "recommended",
        moduleSideEffects: "no-external"
      }
    }
  }
});
