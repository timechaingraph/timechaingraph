/**
 * UnderDevelopment — amber brass-panel banner for unfinished routes.
 *
 * Used during the progressive public rollout: every route that has not yet
 * shipped its full feature renders this banner above any preview content,
 * with a target version string so visitors know when to expect it.
 */

interface UnderDevelopmentProps {
  /** Version this route is expected to ship in (e.g. "v0.1", "v0.2"). */
  targetVersion?: string;
  /** Optional headline override. */
  title?: string;
  /** Optional supplementary body copy under the headline. */
  description?: string;
}

export function UnderDevelopment({
  targetVersion,
  title = 'Under development',
  description,
}: UnderDevelopmentProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="brass-panel rounded-lg p-6 md:p-7"
      style={{
        borderColor: 'var(--color-amber)',
        boxShadow: 'var(--shadow-glow-amber), var(--shadow-inset-brass)',
      }}
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-baseline md:justify-between">
        <div className="flex items-baseline gap-3">
          <span
            className="status-dot"
            style={{ background: 'var(--color-amber)', boxShadow: '0 0 8px rgba(245, 166, 35, 0.7)' }}
            aria-hidden
          />
          <span className="text-mono text-xs uppercase tracking-[0.24em] text-[color:var(--color-amber)]">
            {title}
          </span>
        </div>
        {targetVersion && (
          <span className="text-mono text-[10px] uppercase tracking-wider text-[color:var(--color-text-muted)]">
            landing in {targetVersion}
          </span>
        )}
      </div>
      {description && (
        <p className="mt-4 text-sm leading-relaxed text-[color:var(--color-text-secondary)]">
          {description}
        </p>
      )}
    </div>
  );
}
