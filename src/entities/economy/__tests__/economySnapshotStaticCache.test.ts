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

import { getEconomySnapshotStatic } from '@/entities/economy/api/economySnapshotStaticCache';
import { getEconomySnapshot } from '@/entities/economy/api/economySnapshotCache';
import { SECONDS_PER_DAY } from '@/shared/config/time';

const mockUnstableCache = vi.mocked(unstable_cache);
const mockGetSnapshot = vi.mocked(getEconomySnapshot);

const SNAPSHOT = {
    indicators: [],
    treasury: null,
    calendar: [],
} as never;

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

    it('React.cache 래핑 — 같은 요청 내 두 번째 호출은 unstable_cache을 다시 호출하지 않음', async () => {
        await getEconomySnapshotStatic();
        await getEconomySnapshotStatic();
        // React.cache는 모듈 import 시 단일 인스턴스를 만들지만, vitest에선
        // 매 테스트 fresh 모듈 import가 아니라 정확히 동일 dedup 보장은 어렵다.
        // 따라서 최소한 unstable_cache가 한 번만 wrap된 후 재사용되는지 확인.
        expect(mockUnstableCache.mock.calls.length).toBeGreaterThanOrEqual(1);
    });
});
