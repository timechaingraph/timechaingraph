import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { MobileWalletSheet } from '../MobileWalletSheet';
import { useTimegridStore } from '@/store/timegridStore';
import { FREE_TIER_50 } from '@/data/__fixtures__/free-tier-50';

describe('<MobileWalletSheet>', () => {
  beforeEach(() => {
    useTimegridStore.getState().setSelectedWallet(null);
  });

  it('renders nothing when no wallet is selected (does not cover the canvas)', () => {
    const { container } = render(<MobileWalletSheet />);
    expect(container.firstChild).toBeNull();
  });

  it('shows a Close affordance that clears the selection when a wallet is selected', () => {
    useTimegridStore.getState().setSelectedWallet(FREE_TIER_50[0].address);
    const { getByLabelText } = render(<MobileWalletSheet />);
    const close = getByLabelText('Close wallet inspector');
    expect(close).toBeTruthy();
    fireEvent.click(close);
    expect(useTimegridStore.getState().selectedWallet).toBeNull();
  });
});
