import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    sourcemap: mode === "development",
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-tabs'],
          charts: ['recharts', 'three', '@react-three/fiber', '@react-three/drei'],
          utils: ['lucide-react', 'date-fns', 'clsx', 'tailwind-merge']
        }
      }
    }
  },
  define: {
    // Ensure environment variables are available at build time
    'process.env.NODE_ENV': JSON.stringify(mode)
  }
}));
