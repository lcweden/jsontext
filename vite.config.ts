import { defineConfig } from "vite";

export default defineConfig({
  publicDir: false,
  build: {
    lib: {
      entry: new URL("src/index.ts", import.meta.url).pathname,
      fileName: "index",
      formats: ["es"],
    },
    sourcemap: "hidden",
  },
});
