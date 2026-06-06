import type { Metadata } from 'next';
import { UnderDevelopment } from '@/components/UnderDevelopment';

export const metadata: Metadata = {
  title: 'API docs',
  description:
    'OpenAPI documentation for the Timechain developer API: endpoints, authentication, rate limits, and examples.',
};

export default function DocsPage() {
  return (
    <div className="py-12 md:py-16">
      <p className="text-mono text-xs uppercase tracking-[0.32em] text-[color:var(--color-accent)]">
        Developer documentation
      </p>
      <h1 className="text-display mt-3 text-4xl font-semibold leading-[1.05] md:text-6xl">
        API
        <br />
        <span className="brass-shimmer">reference.</span>
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-relaxed text-[color:var(--color-text-secondary)] md:text-xl">
        Full OpenAPI specification, getting-started guide, and Prolog
        query cookbook. Render via Scalar (self-hosted, no third-party
        CDN) and mirror at{' '}
        <span className="text-mono text-[color:var(--color-accent)]">
          api.timechaingraph.com/docs
        </span>
        .
      </p>

      <div className="mt-10">
        <UnderDevelopment
          targetVersion="v0.4"
          description="Documentation goes live alongside the API. The first chapters will cover authentication via Google/GitHub OAuth, API-key rotation, the v1 endpoint catalogue, and the sandboxed Prolog query interface."
        />
      </div>
    </div>
  );
}
