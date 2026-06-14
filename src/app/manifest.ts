import type { MetadataRoute } from 'next';
import { SITE_TITLE, SITE_TITLE_FULL, SITE_DESCRIPTION } from '@/lib/site-config';

// Required for `output: 'export'` — emitted as a static manifest.webmanifest
// in out/. Next auto-links it from <head>.
export const dynamic = 'force-static';

/**
 * Web app manifest — lets the site be installed (Add to Home Screen),
 * gives Android/Chrome the right name, theme, and icon, and is a small
 * SEO/mobile-polish signal. Brand values come from site-config so the
 * Graph/Grid siblings stay in sync. Icon points at the app/icon.svg
 * served at /icon.svg.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE_TITLE_FULL,
    short_name: SITE_TITLE,
    description: SITE_DESCRIPTION,
    start_url: '/',
    display: 'standalone',
    background_color: '#08080c',
    theme_color: '#08080c',
    icons: [
      { src: '/icon.svg', type: 'image/svg+xml', sizes: 'any', purpose: 'any' },
    ],
  };
}
