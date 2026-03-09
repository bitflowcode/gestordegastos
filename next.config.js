const withSerwist = require('@serwist/next').default({
  swSrc: 'src/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  reloadOnOnline: true,
})

/** @type {import('next').NextConfig} */
const nextConfig = withSerwist({
  reactStrictMode: true,
  output: 'standalone',
  trailingSlash: true,
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
  // Configuración para Turbopack (Next.js 16+)
  turbopack: {
    root: __dirname,
    resolveAlias: {
      canvas: './empty-module.js',
      fs: './empty-module.js',
    },
  },
})

module.exports = nextConfig

