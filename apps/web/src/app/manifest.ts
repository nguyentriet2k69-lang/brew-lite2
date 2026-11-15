import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BrewLite - Dat ca phe',
    short_name: 'BrewLite',
    description: 'Xem menu va dat ca phe BrewLite.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f8f5f2',
    theme_color: '#78350f',
    icons: [
      {
        src: '/icon-192.svg',
        sizes: '192x192',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icon-512.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
