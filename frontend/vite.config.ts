import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import path from 'path'

/** Set by `npm run dev:https`: HTTPS dev + /api proxied (avoids mixed content with Cashfree return_url HTTPS). */
const devHttpsCashfree = process.env.DEV_HTTPS_CASHFREE === '1'

export default defineConfig({
  plugins: [react(), ...(devHttpsCashfree ? [basicSsl()] : [])],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: {
    port: 5173,
    strictPort: false,
    ...(devHttpsCashfree
      ? {
          proxy: {
            '/api': {
              target: 'http://127.0.0.1:5001',
              changeOrigin: true,
            },
          },
        }
      : {}),
  },
})
