/** @type {import('next').NextConfig} */
const nextConfig = {
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
}

module.exports = nextConfig

