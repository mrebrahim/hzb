import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'منظومة التنظيم',
    short_name: 'التنظيم',
    description: 'مهامك ونقاطك وحضورك في مكان واحد',
    start_url: '/',
    display: 'standalone',
    dir: 'rtl',
    lang: 'ar',
    background_color: '#f9fafb',
    theme_color: '#0f2238',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  };
}
