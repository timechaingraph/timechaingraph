/**
 * SocialIcons — inline SVG icon set for the footer social link row.
 * All icons use currentColor so a single CSS class controls normal + hover
 * state. No external font or icon library — zero network requests.
 *
 * Sources (all MIT / free-to-use brand assets):
 *   Mail    — custom envelope path
 *   GitHub  — github.com/logos (github.com brand guide)
 *   X       — x.com brand (corp logo path)
 *   Nostr   — node-network "N" representing the relay topology
 */

interface IconProps {
  className?: string;
}

function MailIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M20 4H4C2.897 4 2 4.897 2 6v12c0 1.103.897 2 2 2h16c1.103 0 2-.897 2-2V6c0-1.103-.897-2-2-2zm0 2v.511l-8 5.931-8-5.931V6h16zm0 12H4V8.49l7.386 5.482a1 1 0 0 0 1.228 0L20 8.49V18z" />
    </svg>
  );
}

function GitHubIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.51 11.51 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12.297c0-6.627-5.373-12-12-12" />
    </svg>
  );
}

function XIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function NostrIcon({ className }: IconProps) {
  /* Four nodes at the corners of an "N" connected by lines —
     a minimal representation of the Nostr relay-network topology. */
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <circle cx="4.5" cy="4.5" r="2.5" />
      <circle cx="19.5" cy="4.5" r="2.5" />
      <circle cx="4.5" cy="19.5" r="2.5" />
      <circle cx="19.5" cy="19.5" r="2.5" />
      <rect x="3.5" y="7" width="2" height="10" rx="1" />
      <rect x="18.5" y="7" width="2" height="10" rx="1" />
      {/* Diagonal bar of the N, rendered as a rotated rounded rect */}
      <path d="M5.2 6.5 19.8 17.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export type SocialIconId = 'mail' | 'github' | 'x' | 'nostr';

interface SocialIconProps {
  icon: SocialIconId;
  className?: string;
}

export function SocialIcon({ icon, className }: SocialIconProps) {
  switch (icon) {
    case 'mail':   return <MailIcon className={className} />;
    case 'github': return <GitHubIcon className={className} />;
    case 'x':      return <XIcon className={className} />;
    case 'nostr':  return <NostrIcon className={className} />;
  }
}
