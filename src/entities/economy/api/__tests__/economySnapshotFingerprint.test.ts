import { describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/api/economy/getEconomyProvider', () => ({
    getEconomyProvider: vi.fn(),
}));

import { ECONOMY_CONFIG_FINGERPRINT } from '@/entities/economy/api/economySnapshotCache';
import { ECONOMY_INDICATORS } from '@/shared/config/economyIndicators';
import { createCacheConfigFingerprint } from '@/shared/cache/configFingerprint';

describe('ECONOMY_CONFIG_FINGERPRINT', () => {
    it('changes when rate-type units enter the snapshot shape, so a unit-less cached snapshot is not reused after deploy', () => {
        const nameOnly = createCacheConfigFingerprint(
            JSON.stringify({ indicators: ECONOMY_INDICATORS.map(i => i.name) })
        );
        expect(ECONOMY_INDICATORS.some(i => i.unit === '%')).toBe(true);
        expect(ECONOMY_CONFIG_FINGERPRINT).not.toBe(nameOnly);
    });

    it('includes the calendar window, so a widened window does not reuse the shorter cached calendar after deploy', () => {
        const withoutWindow = createCacheConfigFingerprint(
            JSON.stringify({
                indicators: ECONOMY_INDICATORS.map(i => ({
                    name: i.name,
                    unit: i.unit === '%' ? '%' : null,
                })),
            })
        );
        expect(ECONOMY_CONFIG_FINGERPRINT).not.toBe(withoutWindow);
    });
});
