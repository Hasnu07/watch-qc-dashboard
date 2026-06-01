/** @type {import('next').NextConfig} */
const path = require('path')

const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
      {
        protocol: 'http',
        hostname: '**',
      },
    ],
  },
  experimental: {
    instrumentationHook: true,
  },
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@': path.resolve(__dirname),
    }
    // Prevent Prisma from ever being bundled into client JS (crashes React on load).
    if (!isServer) {
      config.resolve.alias['@prisma/client'] = false
      config.resolve.alias['.prisma/client'] = false
    }
    return config
  },
}

module.exports = nextConfig
