import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  allowedDevOrigins: ['*.dev.coze.site'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*',
        pathname: '/**',
      },
    ],
    unoptimized: true,
  },
};

export default nextConfig;
