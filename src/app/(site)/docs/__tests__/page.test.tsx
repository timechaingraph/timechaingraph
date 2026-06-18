import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DocsPage from '../page';
import { GITHUB_URL, VIEW_DOMAIN } from '@/lib/site-config';

describe('<DocsPage> — How it works / privacy', () => {
  it('states the observable-privacy promise in the h1', () => {
    render(<DocsPage />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(/private/i);
  });

  it('explains the offline pipeline end to end', () => {
    render(<DocsPage />);
    expect(screen.getByRole('heading', { name: /the pipeline/i })).toBeTruthy();
    expect(screen.getByText('Self-hosted bitcoind')).toBeTruthy();
    expect(screen.getByText('Reduce with DuckDB')).toBeTruthy();
    expect(screen.getByText('Carve a static Parquet bundle')).toBeTruthy();
    expect(screen.getByText('Query locally with DuckDB-Wasm')).toBeTruthy();
  });

  it('is honest about the same-origin residual', () => {
    render(<DocsPage />);
    expect(screen.getByRole('heading', { name: /what your visit reveals/i })).toBeTruthy();
    expect(screen.getByText(/no analytics/i)).toBeTruthy();
    expect(
      screen.getAllByText(new RegExp(VIEW_DOMAIN.replace('.', '\\.'), 'i')).length,
    ).toBeGreaterThan(0);
  });

  it('tells the visitor how to verify the claim', () => {
    render(<DocsPage />);
    expect(screen.getByRole('heading', { name: /verify it yourself/i })).toBeTruthy();
    expect(screen.getByText(/devtools/i)).toBeTruthy();
    expect(screen.getByText(/privacy audit/i)).toBeTruthy();
  });

  it('links out to the canonical repo docs for depth', () => {
    render(<DocsPage />);
    expect(
      screen.getByRole('link', { name: /threat model/i }).getAttribute('href'),
    ).toContain('/docs/THREAT_MODEL.md');
    expect(
      screen.getByRole('link', { name: /full source on github/i }).getAttribute('href'),
    ).toBe(GITHUB_URL);
  });

  it('keeps the API reference as a demoted "coming in v0.4" note', () => {
    render(<DocsPage />);
    expect(screen.getByRole('heading', { name: /api reference/i })).toBeTruthy();
    expect(screen.getByText(/landing in v0\.4/i)).toBeTruthy();
  });
});
