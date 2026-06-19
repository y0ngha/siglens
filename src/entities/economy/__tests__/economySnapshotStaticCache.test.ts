vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({
    unstable_cache: vi.fn((fn: () => Promise<unknown>) => () => fn()),
}));
vi.mock('@/entities/economy/api/economySnapshotCache', () => ({
    getEconomySnapshot: vi.fn(),
    ECONOMY_CONFIG_FINGERPRINT: 'cfg-fingerprint',
}));

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { unstable_cache } from 'next/cache';
import type { EconomySnapshot } from '@y0ngha/siglens-core';

import { getEconomySnapshotStatic } from '@/entities/economy/api/economySnapshotStaticCache';
import { getEconomySnapshot } from '@/entities/economy/api/economySnapshotCache';
import { SECONDS_PER_DAY } from '@/shared/config/time';

const mockUnstableCache = vi.mocked(unstable_cache);
const mockGetSnapshot = vi.mocked(getEconomySnapshot);

const SNAPSHOT: EconomySnapshot = {
    indicators: [],
    treasury: null,
    calendar: [],
};

describe('getEconomySnapshotStatic', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetSnapshot.mockResolvedValue(SNAPSHOT);
    });

    it('unstable_cache를 economy-snapshot-static + fingerprint 키와 24h revalidate로 호출', async () => {
        await getEconomySnapshotStatic();
        const [, key, opts] = mockUnstableCache.mock.calls[0];
        expect(key).toEqual(['economy-snapshot-static', 'cfg-fingerprint']);
        expect(opts).toEqual({
            revalidate: SECONDS_PER_DAY,
            tags: ['economy:snapshot'],
        });
    });

    it('내부 fetcher가 getEconomySnapshot을 호출', async () => {
        await getEconomySnapshotStatic();
        const fetcher = mockUnstableCache.mock
            .calls[0][0] as () => Promise<unknown>;
        await fetcher();
        expect(mockGetSnapshot).toHaveBeenCalled();
    });

    // NOTE: React.cache request-dedup can't be exercised under vitest (needs Next
    // AsyncLocalStorage); covered by ISR runtime behavior instead.
});
