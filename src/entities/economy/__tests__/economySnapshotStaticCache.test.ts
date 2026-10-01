const mocks = vi.hoisted(() => ({
    markSsrMiss: vi.fn(),
    shouldCacheEconomySnapshot: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({
    unstable_cache: vi.fn((fn: () => Promise<unknown>) => () => fn()),
}));
vi.mock('@/entities/economy/api/economySnapshotCache', () => ({
    getEconomySnapshot: vi.fn(),
    ECONOMY_CONFIG_FINGERPRINT: 'cfg-fingerprint',
}));
vi.mock('@/shared/cache/ssrMissMarker', () => ({
    markSsrMiss: mocks.markSsrMiss,
}));
vi.mock('@/entities/economy/lib/economyCompleteness', () => ({
    shouldCacheEconomySnapshot: mocks.shouldCacheEconomySnapshot,
}));

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { unstable_cache } from 'next/cache';
import type { EconomySnapshot } from '@y0ngha/siglens-core';

import {
    ECONOMY_SNAPSHOT_CACHE_TAG,
    getEconomySnapshotStatic,
} from '@/entities/economy/api/economySnapshotStaticCache';
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
        mocks.shouldCacheEconomySnapshot.mockReturnValue(true);
        mocks.markSsrMiss.mockResolvedValue(undefined);
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

    it('태그 상수는 economy:snapshot이다 — 허브 프리웜이 같은 값으로 턴다', () => {
        expect(ECONOMY_SNAPSHOT_CACHE_TAG).toBe('economy:snapshot');
    });

    it('내부 fetcher가 getEconomySnapshot을 호출', async () => {
        await getEconomySnapshotStatic();
        const fetcher = mockUnstableCache.mock
            .calls[0][0] as () => Promise<unknown>;
        await fetcher();
        expect(mockGetSnapshot).toHaveBeenCalled();
    });

    it('완전한 스냅샷이면 그대로 반환하고 SSR miss를 표시하지 않는다', async () => {
        await expect(getEconomySnapshotStatic()).resolves.toBe(SNAPSHOT);
        expect(mocks.markSsrMiss).not.toHaveBeenCalled();
    });

    /**
     * 미달 스냅샷은 캐시 콜백이 던져 저장을 건너뛴다. 렌더는 그 스냅샷으로 하되
     * (던진 채 전파하면 페이지가 죽는다) 그 HTML이 ISR 동안 남으므로 표시를 남긴다.
     */
    it('quorum 미달이면 던지지 않고 그 스냅샷을 반환하며 SSR miss를 표시한다', async () => {
        mocks.shouldCacheEconomySnapshot.mockReturnValue(false);

        await expect(getEconomySnapshotStatic()).resolves.toBe(SNAPSHOT);

        expect(mocks.markSsrMiss).toHaveBeenCalledWith('economy:snapshot');
    });

    it('미달 스냅샷은 캐시 콜백이 던져서 저장되지 않는다', async () => {
        mocks.shouldCacheEconomySnapshot.mockReturnValue(false);

        await getEconomySnapshotStatic();
        const fetcher = mockUnstableCache.mock
            .calls[0][0] as () => Promise<unknown>;

        await expect(fetcher()).rejects.toThrow('incomplete economy snapshot');
    });

    it('그 밖의 에러는 그대로 던지고 표시하지 않는다', async () => {
        mockGetSnapshot.mockRejectedValue(new Error('redis down'));

        await expect(getEconomySnapshotStatic()).rejects.toThrow('redis down');
        expect(mocks.markSsrMiss).not.toHaveBeenCalled();
    });

    // NOTE: React.cache request-dedup can't be exercised under vitest (needs Next
    // AsyncLocalStorage); covered by ISR runtime behavior instead.
});
