import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import InsightsPage from '../page';

describe('/insights page', () => {
  it('renders the Insights heading', () => {
    render(<InsightsPage />);
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
    // The tag line <p> contains "Timechain Insights · free"
    expect(screen.getByText(/timechain insights · free/i)).toBeTruthy();
  });

  it('renders "decoded" in the headline', () => {
    render(<InsightsPage />);
    expect(screen.getByText(/decoded/i)).toBeTruthy();
  });

  it('renders the four content-promise bullets', () => {
    render(<InsightsPage />);
    // Query for the <strong> labels specifically to avoid ambiguous parent elements
    expect(screen.getByText(/wallet-graph topology/i, { selector: 'strong' })).toBeTruthy();
    expect(screen.getByText(/epoch stats/i, { selector: 'strong' })).toBeTruthy();
    expect(screen.getByText(/geographic shifts/i, { selector: 'strong' })).toBeTruthy();
    expect(screen.getByText(/honesty/i, { selector: 'strong' })).toBeTruthy();
  });

  it('renders the Archive section', () => {
    render(<InsightsPage />);
    expect(screen.getByRole('heading', { name: /archive/i })).toBeTruthy();
  });

  it('renders the privacy disclaimer mentioning listmonk', () => {
    render(<InsightsPage />);
    // Use getAllByText — listmonk appears in both the signup coming-soon callout and the disclaimer
    expect(screen.getAllByText(/listmonk/i).length).toBeGreaterThan(0);
  });

  it('renders the InsightsSignup component (coming-soon state when URL is unset)', () => {
    render(<InsightsPage />);
    expect(screen.getByText(/coming soon/i)).toBeTruthy();
  });
});
