import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    proxy: {
      // Proxy para endpoints CON /api prefix (la mayoría) - DEBE IR PRIMERO
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('🔀 [/api] Proxy request:', req.method, req.url, '→', proxyReq.path);
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            // Solo mostrar errores que no sean 400 en presupuestos (timing issues conocidos)
            const isPresupuestoError400 = req.url.includes('presupuestos-no-cliente') && proxyRes.statusCode === 400;
            // Ocultar errores de endpoints no implementados
            const isEndpointNoImplementado = (req.url.includes('/proveedores') || req.url.includes('/usuarios')) && proxyRes.statusCode === 500;
            
            if (proxyRes.statusCode >= 400 && !isPresupuestoError400 && !isEndpointNoImplementado) {
              console.log('❌ [/api] Proxy error details for:', req.url, '→', proxyRes.statusCode);
            } else if (isPresupuestoError400) {
              console.warn('⚠️ [/api] Timing error 400 (known issue) for:', req.url);
            } else if (!isEndpointNoImplementado) {
              console.log('🔀 [/api] Proxy response:', req.url, '→', proxyRes.statusCode);
            }
          });
          proxy.on('error', (err, req, res) => {
            console.error('❌ [/api] Proxy error:', req.url, '→', err.message);
          });
        }
      }
      // ⚠️ ELIMINADOS los proxies /profesionales, /profesionales-obras, /proveedores
      // Estas son rutas del FRONTEND (React Router), NO del backend
      // Solo /api/* debe ir al backend (incluyendo /api/etapas-diarias)
    }
  }
})