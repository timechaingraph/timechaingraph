import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DonateAddress } from '../DonateAddress';

// The QR renderer needs no DOM canvas — mock the bundled lib so tests assert
// the PAYLOAD handed to it (the part we own) rather than QR pixel output.
vi.mock('qrcode', () => ({
  default: { toString: vi.fn().mockResolvedValue('<svg xmlns="http://www.w3.org/2000/svg"/>') },
}));

import QRCode from 'qrcode';

const ADDR = 'bc1q2hhsxyuzj4e6wcjegayddjphdry02wdef9v62l';
const toString = vi.mocked(QRCode.toString);

describe('<DonateAddress>', () => {
  it('renders the address and defaults the QR to the bare address', async () => {
    render(<DonateAddress address={ADDR} label="Timechain Graph" />);
    expect(screen.getByText(ADDR)).toBeTruthy();
    expect(screen.getByRole('button', { name: /copy address/i })).toBeTruthy();
    await waitFor(() => expect(toString).toHaveBeenCalled());
    expect(toString).toHaveBeenLastCalledWith(ADDR, expect.anything());
  });

  it('selecting a preset switches the QR payload to a BIP21 URI with amount + label', async () => {
    render(<DonateAddress address={ADDR} label="Timechain Graph" />);
    fireEvent.click(screen.getByRole('button', { name: /10k sats/i }));
    await waitFor(() =>
      expect(toString).toHaveBeenLastCalledWith(
        `bitcoin:${ADDR}?amount=0.0001&label=Timechain%20Graph`,
        expect.anything(),
      ),
    );
    expect(screen.getByRole('button', { name: /copy payment uri/i })).toBeTruthy();
  });

  it('clicking the active preset toggles back to the bare address', async () => {
    render(<DonateAddress address={ADDR} label="Timechain Graph" />);
    const btn = screen.getByRole('button', { name: /50k sats/i });
    fireEvent.click(btn);
    await waitFor(() =>
      expect(toString).toHaveBeenLastCalledWith(
        expect.stringContaining('amount=0.0005'),
        expect.anything(),
      ),
    );
    fireEvent.click(btn);
    await waitFor(() => expect(toString).toHaveBeenLastCalledWith(ADDR, expect.anything()));
    expect(screen.getByRole('button', { name: /copy address/i })).toBeTruthy();
  });

  it('custom amounts below the dust floor fall back to the bare address', async () => {
    render(<DonateAddress address={ADDR} label="Timechain Graph" />);
    fireEvent.click(screen.getByRole('button', { name: /custom/i }));
    const input = screen.getByLabelText(/custom amount in sats/i);
    fireEvent.change(input, { target: { value: '100' } }); // < 546
    await waitFor(() => expect(toString).toHaveBeenLastCalledWith(ADDR, expect.anything()));
    fireEvent.change(input, { target: { value: '2500' } });
    await waitFor(() =>
      expect(toString).toHaveBeenLastCalledWith(
        expect.stringContaining('amount=0.000025'),
        expect.anything(),
      ),
    );
  });
});
