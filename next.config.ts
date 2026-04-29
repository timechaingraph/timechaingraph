import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Static export for the in-development landing page. Cloudflare Pages
  // serves the resulting `out/` directory as plain HTML/CSS/JS. Switch to
  // 'standalone' once the canvas + adapter need server features.
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
