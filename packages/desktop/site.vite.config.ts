import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const siteRoot = resolve(import.meta.dirname, "../../site");
const localeCode = /^(?!en$)[a-z]{2,3}(?:-[A-Z0-9]{2,3})?$/u;

export default defineConfig({
  appType: "mpa",
  base: "/",
  plugins: [
    react(),
    {
      name: "locale-paths",
      configureServer(server) {
        server.middlewares.use((request, _response, next) => {
          const [, code = "", ...rest] = (request.url ?? "").split("/");
          if (localeCode.test(code)) request.url = `/${rest.join("/")}`;
          next();
        });
      },
    },
  ],
  resolve: {
    alias: {
      "@gardendesk/shared": resolve(import.meta.dirname, "../shared/src/index.ts"),
      "flag-icons": resolve(import.meta.dirname, "node_modules/flag-icons"),
      react: resolve(import.meta.dirname, "node_modules/react"),
      "react-dom": resolve(import.meta.dirname, "node_modules/react-dom"),
    },
  },
  publicDir: resolve(siteRoot, "public"),
  root: siteRoot,
  server: {
    host: "127.0.0.1",
    port: 4173,
    strictPort: true,
  },
  build: {
    emptyOutDir: true,
    modulePreload: { polyfill: false },
    outDir: resolve(siteRoot, "dist"),
    rollupOptions: {
      output: {
        assetFileNames: "assets/[name][extname]",
        chunkFileNames: "assets/[name].js",
        entryFileNames: "assets/[name].js",
      },
      input: {
        home: resolve(siteRoot, "index.html"),
        alex: resolve(siteRoot, "alex/index.html"),
        demo: resolve(siteRoot, "demo/index.html"),
        releases: resolve(siteRoot, "releases/index.html"),
        blog: resolve(siteRoot, "blog/index.html"),
        privacy: resolve(siteRoot, "privacy/index.html"),
        terms: resolve(siteRoot, "terms/index.html"),
        security: resolve(siteRoot, "security/index.html"),
        supporters: resolve(siteRoot, "supporters/index.html"),
        "404": resolve(siteRoot, "404.html"),
      },
    },
  },
});
