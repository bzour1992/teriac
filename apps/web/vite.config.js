import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
        },
    },
    server: {
        port: 5173,
        strictPort: true,
        proxy: {
            "/v1": {
                target: process.env.VITE_API_BASE_URL?.replace("/v1", "") ?? "http://localhost:3001",
                changeOrigin: true,
            },
        },
    },
});
//# sourceMappingURL=vite.config.js.map