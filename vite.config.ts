import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    exclude: ["backend/**", "node_modules/**", "dist/**"],
  },
  server: {
    port: 5177,
  },
});
