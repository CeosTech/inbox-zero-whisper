import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  build: {
    outDir: "dist",
    rollupOptions: {
      input: {
        worker: "src/bg/worker.ts",          // <-- renommé (au lieu de "background")
        injector: "src/content/injector.ts",
        panel: "src/ui/panel.ts",
        options: "src/ui/options.ts"
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name.includes("worker"))   return "bg/[name].js";       // => bg/worker.js
          if (chunk.name.includes("injector")) return "content/[name].js";  // => content/injector.js
          if (chunk.name.includes("panel"))    return "ui/[name].js";       // => ui/panel.js
          if (chunk.name.includes("options"))  return "ui/[name].js";       // => ui/options.js
          return "[name].js";
        }
      }
    }
  },
  plugins: [
    viteStaticCopy({
      targets: [
        { src: "static/manifest.json", dest: "." },
        { src: "static/ui/*.html", dest: "ui" },
        { src: "static/icons/*", dest: "icons" }
      ]
    })
  ]
});
