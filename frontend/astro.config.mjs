import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import node from "@astrojs/node";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  integrations: [react()],
  // Magento's Luma theme links to `/checkout/cart/` with a trailing slash.
  // `trailingSlash: 'ignore'` lets `/checkout/cart` and `/checkout/cart/`
  // both resolve to `src/pages/checkout/cart.astro`.
  trailingSlash: "ignore",
  devToolbar: { enabled: false },
  server: { host: "0.0.0.0", port: 4321 },
  vite: {
    plugins: [tailwindcss()],
    server: {
      allowedHosts: ["mage2react.local"],
      hmr: { clientPort: 443, protocol: "wss" },
    },
  },
  security: {
    checkOrigin: true,
  },
});
