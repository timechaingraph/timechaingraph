import { describe, it, expect } from 'vitest';
import {
  ROLE_COLOR,
  ROLE_CSS,
  ROLE_RADIUS,
  ROLE_LABEL,
} from '../role-visuals';
import type { WalletRole } from '@/types/wallet';

const ALL_ROLES: WalletRole[] = ['satoshi', 'miner', 'whale', 'significant', 'dust'];

describe('role-visuals', () => {
  it('covers every WalletRole in every map', () => {
    for (const role of ALL_ROLES) {
      expect(ROLE_COLOR[role]).toBeDefined();
      expect(ROLE_CSS[role]).toBeDefined();
      expect(ROLE_RADIUS[role]).toBeGreaterThan(0);
      expect(ROLE_LABEL[role]).toBeDefined();
    }
  });

  it('hex colors and CSS strings agree for every role', () => {
    for (const role of ALL_ROLES) {
      const hexNum = ROLE_COLOR[role];
      const cssHex = ROLE_CSS[role].replace('#', '').toLowerCase();
      const hexFromNum = hexNum.toString(16).padStart(6, '0');
      expect(hexFromNum).toBe(cssHex);
    }
  });

  it('uses the project palette: red miner, cyan significant, gold whale, grey dust', () => {
    expect(ROLE_CSS.miner).toBe('#EF4444');
    expect(ROLE_CSS.significant).toBe('#00D4FF');
    expect(ROLE_CSS.whale).toBe('#FFD700');
    expect(ROLE_CSS.dust).toBe('#64748B');
  });

  it('orders radii: satoshi > whale > miner > significant > dust', () => {
    expect(ROLE_RADIUS.satoshi).toBeGreaterThan(ROLE_RADIUS.whale);
    expect(ROLE_RADIUS.whale).toBeGreaterThan(ROLE_RADIUS.miner);
    expect(ROLE_RADIUS.miner).toBeGreaterThan(ROLE_RADIUS.significant);
    expect(ROLE_RADIUS.significant).toBeGreaterThan(ROLE_RADIUS.dust);
  });
});
