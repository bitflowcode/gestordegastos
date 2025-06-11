/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // Configuración para PDF.js
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false,
        fs: false,
      }
      
      // Configurar reglas para archivos de worker
      config.module.rules.push({
        test: /\.worker\.(js|ts)$/,
        use: { loader: 'worker-loader' },
      })

      // Configurar alias para pdfjs-dist
      config.resolve.alias = {
        ...config.resolve.alias,
        'pdfjs-dist/build/pdf': 'pdfjs-dist/build/pdf.mjs',
        'pdfjs-dist/build/pdf.worker': 'pdfjs-dist/build/pdf.worker.mjs'
      }
    }
    
    return config
  },
  // Permitir archivos estáticos de PDF.js
  experimental: {
    esmExternals: 'loose'
  },

}

module.exports = nextConfig

