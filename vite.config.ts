import { resolve } from "node:path";
import dts from "unplugin-dts/vite";
import { defineConfig } from "vite";

export default defineConfig(({ mode }) => {
  if (mode === "lib") {
    return {
      publicDir: false,
      plugins: [dts({ include: ["src"], outDirs: "dist", entryRoot: "src" })],
      build: {
        lib: {
          entry: resolve("./src/index.ts"),
          fileName: "index",
          formats: ["es"],
        },
        sourcemap: "hidden",
      },
    };
  }

  return {
    server: { host: true },
  };
});
