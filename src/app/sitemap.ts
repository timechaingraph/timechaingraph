import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site-config';

// Required for `output: 'export'` — sitemap is generated at build
// time and emitted as a static file in out/.
export const dynamic = 'force-static';

/**
 * sitemap.xml — declares every public route to crawlers. Updated
 * automatically when routes are added/removed; the lastModified
 * stamp reflects build time so the search engines pick up changes
 * promptly.
 *
 * The graph view (`/graph`) is the most important route — primary
 * priority. Document pages get medium priority. The /api route is a
 * placeholder (in-development), marked low priority until it ships
 * real content in v0.4; /docs is live (How it works / privacy).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${SITE_URL}/graph`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${SITE_URL}/about`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/donate`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/status`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/api`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${SITE_URL}/docs`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
  ];
}
