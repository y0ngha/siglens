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

    // React.cache는 Next.js 요청 컨텍스트(AsyncLocalStorage)에서만 dedup이 활성화된다 —
    // vitest의 node 환경에선 매 호출마다 실행돼 mock count가 증가하므로 단위 테스트에서
    // 직접 검증할 수 없다. 실 환경 dedup은 prod-like 실증(curl/Chrome)으로 확인한다.
    it.skip('React.cache 래핑 — Next.js 요청 컨텍스트 외부(vitest)에선 dedup 미작동', () => {
        // intentionally skipped
    });
});
