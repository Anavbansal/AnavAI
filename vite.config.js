import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: "dist",
    sourcemap: false,
    minify: "esbuild",
    target: "es2020",
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          // Heavy components — lazy loaded
          "chunk-chart":   ["./src/components/CandleChart.jsx"],
          "chunk-fo":      ["./src/components/FOGreeks.jsx"],
          "chunk-finance": ["./src/components/PersonalFinance.jsx"],
          "chunk-scanner": ["./src/components/MarketScanner.jsx",
                            "./src/components/EconomicCalendar.jsx",
                            "./src/components/RiskCalculator.jsx"],
          "chunk-delivery":["./src/components/Delivery.jsx",
                            "./src/components/Intraday.jsx"],
          "chunk-symbols": ["./src/data/symbols.js"],
          "chunk-mf":      ["./src/components/MutualFunds.jsx"],
          "vendor-recharts":["recharts"],
        },
      },
    },
    chunkSizeWarningLimit: 600,
  },
  server: {
    port: 5173,
    proxy: {
      "/api":          { target: "http://127.0.0.1:3002", changeOrigin: true },
      "/analyze":      { target: "http://127.0.0.1:3002", changeOrigin: true },
      "/session":      { target: "http://127.0.0.1:3002", changeOrigin: true },
      "/auth":         { target: "http://127.0.0.1:3002", changeOrigin: true },
      "/fundamentals": { target: "http://127.0.0.1:3002", changeOrigin: true },
      "/news":         { target: "http://127.0.0.1:3002", changeOrigin: true },
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom", "react-router-dom"],
  },
});
