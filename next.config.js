const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
})

/** @type {import('next').NextConfig} */
const nextConfig = withPWA({
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // Solo aplicar configuraciones en el cliente
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false,
        fs: false,
      }
    }
    
    return config
  },
  // Configuración experimental para mejor compatibilidad
  experimental: {
    esmExternals: 'loose'
  },
})

module.exports = nextConfig

