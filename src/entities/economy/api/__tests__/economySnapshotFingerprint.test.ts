vi.mock('@/shared/api/economy/getEconomyProvider', () => ({
    getEconomyProvider: vi.fn(),
}));

import { describe, expect, it, vi } from 'vitest';
import { ECONOMY_CONFIG_FINGERPRINT } from '@/entities/economy/api/economySnapshotCache';
import { createCacheConfigFingerprint } from '@/shared/cache/configFingerprint';
import { ECONOMY_INDICATORS } from '@/shared/config/economyIndicators';

describe('ECONOMY_CONFIG_FINGERPRINT', () => {
    it('changes when rate-type units enter the snapshot shape, so a unit-less cached snapshot is not reused after deploy', () => {
        const nameOnly = createCacheConfigFingerprint(
            JSON.stringify({ indicators: ECONOMY_INDICATORS.map(i => i.name) })
        );
        expect(ECONOMY_INDICATORS.some(i => i.unit === '%')).toBe(true);
        expect(ECONOMY_CONFIG_FINGERPRINT).not.toBe(nameOnly);
    });
});
