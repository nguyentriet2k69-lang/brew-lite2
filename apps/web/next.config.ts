import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cms.vietnamcoracle.com',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'photo.znews.vn',
      },
      {
        protocol: 'https',
        hostname: 'artfultea.com',
      },
    ],
  },
};

export default nextConfig;