import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { newsPlugin } from "./server/news";

export default defineConfig({
  plugins: [react(), newsPlugin()],
  server: { port: 5174, strictPort: true },
});
