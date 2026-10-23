import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getCalendar } = vi.hoisted(() => ({ getCalendar: vi.fn() }));
vi.mock('@/shared/api/economy/getEconomyProvider', () => ({
    getEconomyProvider: () => ({
        getIndicator: async (name: string) => ({
            name,
            latest: null,
            previous: null,
            trend: [],
        }),
        getTreasury: async () => null,
        getCalendar,
    }),
}));
// 캐시를 건너뛰고 fetcher를 바로 실행한다 — 여기서 보는 것은 조회 창이다.
vi.mock('@/shared/cache/getOrSetCache', () => ({
    getOrSetCache: (_key: string, _ttl: number, fetcher: () => unknown) =>
        fetcher(),
}));

import { getEconomySnapshot } from '@/entities/economy/api/economySnapshotCache';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('getEconomySnapshot 캘린더 조회 창', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getCalendar.mockResolvedValue([]);
    });

    it('FOMC 회의 최장 간격(56일)보다 긴 60일 창으로 캘린더를 조회한다', async () => {
        // 14일 창에서는 다음 회의가 창 밖이면 에이전트가 금리 결정일을 못 봤다.
        await getEconomySnapshot();
        expect(getCalendar).toHaveBeenCalledTimes(1);
        const [from, to] = getCalendar.mock.calls[0] as [string, string];
        const days = Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);
        expect(days).toBe(60);
    });
});
