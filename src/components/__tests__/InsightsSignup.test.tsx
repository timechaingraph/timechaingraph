import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { InsightsSignup } from '../InsightsSignup';

describe('<InsightsSignup> — coming soon (no subscribeUrl)', () => {
  it('renders coming-soon callout with a pre-capture form', () => {
    render(<InsightsSignup subscribeUrl="" />);
    expect(screen.getByText(/coming soon/i)).toBeTruthy();
    expect(screen.getByLabelText(/notify me/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /notify me/i })).toBeTruthy();
  });

  it('disables the notify button when the pre-capture field is empty', () => {
    render(<InsightsSignup subscribeUrl="" />);
    const btn = screen.getByRole('button', { name: /notify me/i });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it('shows confirmation after valid email is submitted', () => {
    render(<InsightsSignup subscribeUrl="" />);
    fireEvent.change(screen.getByLabelText(/notify me/i), {
      target: { value: 'early@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /notify me/i }));
    expect(screen.getByText(/got it/i)).toBeTruthy();
    expect(screen.getByText('early@example.com')).toBeTruthy();
  });

  it('does not submit on invalid email', () => {
    render(<InsightsSignup subscribeUrl="" />);
    fireEvent.change(screen.getByLabelText(/notify me/i), {
      target: { value: 'not-an-email' },
    });
    fireEvent.click(screen.getByRole('button', { name: /notify me/i }));
    expect(screen.queryByText(/got it/i)).toBeNull();
  });

  it('mentions self-hosted listmonk', () => {
    render(<InsightsSignup subscribeUrl="" />);
    expect(screen.getByText(/listmonk/i)).toBeTruthy();
  });
});

describe('<InsightsSignup> — live form', () => {
  const SUBSCRIBE_URL = '/api/subscribe';

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the email input and subscribe button', () => {
    render(<InsightsSignup subscribeUrl={SUBSCRIBE_URL} />);
    expect(screen.getByLabelText(/your email/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: /subscribe free/i })).toBeTruthy();
  });

  it('disables the submit button when the email field is empty', () => {
    render(<InsightsSignup subscribeUrl={SUBSCRIBE_URL} />);
    const btn = screen.getByRole('button', { name: /subscribe free/i });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it('enables the submit button once a non-empty email is entered', () => {
    render(<InsightsSignup subscribeUrl={SUBSCRIBE_URL} />);
    const input = screen.getByLabelText(/your email/i);
    fireEvent.change(input, { target: { value: 'test@example.com' } });
    const btn = screen.getByRole('button', { name: /subscribe free/i });
    expect((btn as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows success state after a 200 response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
    render(<InsightsSignup subscribeUrl={SUBSCRIBE_URL} />);
    fireEvent.change(screen.getByLabelText(/your email/i), {
      target: { value: 'reader@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /subscribe free/i }));
    await waitFor(() => expect(screen.getByText(/check your inbox/i)).toBeTruthy());
    expect(screen.getByText('reader@example.com')).toBeTruthy();
  });

  it('shows an error message after a non-OK response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ message: 'List not found.' }),
      }),
    );
    render(<InsightsSignup subscribeUrl={SUBSCRIBE_URL} />);
    fireEvent.change(screen.getByLabelText(/your email/i), {
      target: { value: 'reader@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /subscribe free/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.getByText(/list not found/i)).toBeTruthy();
  });

  it('shows a generic error message on a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')));
    render(<InsightsSignup subscribeUrl={SUBSCRIBE_URL} />);
    fireEvent.change(screen.getByLabelText(/your email/i), {
      target: { value: 'reader@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /subscribe free/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.getByText(/network error/i)).toBeTruthy();
  });

  it('POSTs JSON with the email to the subscribeUrl', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', mockFetch);
    render(<InsightsSignup subscribeUrl={SUBSCRIBE_URL} />);
    fireEvent.change(screen.getByLabelText(/your email/i), {
      target: { value: '  trimmed@example.com  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /subscribe free/i }));
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(mockFetch).toHaveBeenCalledWith(
      SUBSCRIBE_URL,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'trimmed@example.com' }),
      }),
    );
  });

  it('mentions double opt-in and no-tracking in the privacy note', () => {
    render(<InsightsSignup subscribeUrl={SUBSCRIBE_URL} />);
    const note = screen.getByText(/double opt-in/i);
    expect(note.textContent).toMatch(/no tracking/i);
  });
});
