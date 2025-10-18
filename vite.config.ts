import { defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  // targets modern Chrome for MV3
  build: {
    target: "chrome120",
    outDir: "dist",
    rollupOptions: {
      input: {
        worker: "src/bg/worker.ts",
        injector: "src/content/injector.ts",
        panel: "src/ui/panel.ts",
        options: "src/ui/options.ts",
      },
      output: {
        entryFileNames: (chunk) => {
          const n = chunk.name || "";
          if (n.includes("worker"))   return "bg/[name].js";        // bg/worker.js
          if (n.includes("injector")) return "content/[name].js";   // content/injector.js
          if (n.includes("panel"))    return "ui/[name].js";        // ui/panel.js
          if (n.includes("options"))  return "ui/[name].js";        // ui/options.js
          return "[name].js";
        },
      },
    },
  },
  plugins: [
    viteStaticCopy({
      targets: [
        // manifest + html
        { src: "static/manifest.json", dest: "." },
        { src: "static/ui/*.html", dest: "ui" },

        // icons
        { src: "static/icons/*", dest: "icons" },

        // ✅ PDF.js worker for Attachment Q&A
        { src: "node_modules/pdfjs-dist/build/pdf.worker.min.js", dest: "." },
      ],
    }),
  ],
});
