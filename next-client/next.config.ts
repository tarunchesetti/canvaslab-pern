import type { NextConfig } from 'next'

const apiOrigin = process.env.CANVASLAB_API_ORIGIN ?? 'https://canvaslab-api.onrender.com'

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiOrigin}/api/:path*`,
      },
    ]
  },
}

export default nextConfig
