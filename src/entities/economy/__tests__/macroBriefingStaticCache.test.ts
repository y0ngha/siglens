vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({
    unstable_cache: vi.fn((fn: () => Promise<unknown>) => () => fn()),
}));
vi.mock('@/shared/cache/hubSsrSeed', () => ({
    readHubSsrSeed: vi.fn(),
}));
vi.mock('@y0ngha/siglens-core', async () => {
    const actual = await vi.importActual<typeof import('@y0ngha/siglens-core')>(
        '@y0ngha/siglens-core'
    );
    return { ...actual, peekMacroBriefingCache: vi.fn() };
});

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { unstable_cache } from 'next/cache';
import { peekMacroBriefingCache } from '@y0ngha/siglens-core';

import type {
    EconomySnapshot,
    MacroBriefingResponse,
} from '@y0ngha/siglens-core';

import { readHubSsrSeed } from '@/shared/cache/hubSsrSeed';
import { peekMacroBriefingStatic } from '@/entities/economy/api/macroBriefingStaticCache';
import { SECONDS_PER_DAY } from '@/shared/config/time';

const mockUnstableCache = vi.mocked(unstable_cache);
const mockPeek = vi.mocked(peekMacroBriefingCache);
const mockReadSeed = vi.mocked(readHubSsrSeed);

const SNAPSHOT: EconomySnapshot = {
    indicators: [],
    treasury: null,
    calendar: [],
};

function macro(summary: string): MacroBriefingResponse {
    return { summary, highlights: [], regime: 'neutral' };
}

describe('peekMacroBriefingStatic', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPeek.mockResolvedValue(null);
        mockReadSeed.mockResolvedValue(null);
    });

    it('전달받은 dateHour로 unstable_cache 키를 hourly 버킷팅 + 24h revalidate + briefing 태그', async () => {
        await peekMacroBriefingStatic(SNAPSHOT, '2026-06-17T05');
        const [, key, opts] = mockUnstableCache.mock.calls[0];
        expect(key).toEqual(['economy-briefing-peek-static', '2026-06-17T05']);
        expect(opts).toEqual({
            revalidate: SECONDS_PER_DAY,
            tags: ['economy:briefing'],
        });
    });

    it('내부 fetcher가 snapshot을 그대로 peekMacroBriefingCache에 전달', async () => {
        await peekMacroBriefingStatic(SNAPSHOT, '2026-06-17T05');
        const fetcher = mockUnstableCache.mock
            .calls[0][0] as () => Promise<unknown>;
        await fetcher();
        expect(mockPeek).toHaveBeenCalledWith(SNAPSHOT);
    });

    /**
     * core 캐시 키는 입력(스냅샷)에서 파생돼 입력이 갱신되면 프리웜이 쓴 값을 더는
     * 읽지 못한다. 그때 페이지가 빈 채로 남지 않도록 프리웜이 따로 보관한 seed로 간다.
     */
    it('core peek이 miss면 SSR seed로 물러난다', async () => {
        mockReadSeed.mockResolvedValue(macro('seed'));

        await peekMacroBriefingStatic(SNAPSHOT, '2026-06-17T05');
        const fetcher = mockUnstableCache.mock
            .calls[0][0] as () => Promise<unknown>;

        await expect(fetcher()).resolves.toEqual(macro('seed'));
        expect(mockReadSeed).toHaveBeenCalledWith('macro-briefing');
    });

    it('core peek이 hit면 seed를 읽지 않는다', async () => {
        mockPeek.mockResolvedValue(macro('live'));

        await peekMacroBriefingStatic(SNAPSHOT, '2026-06-17T05');
        const fetcher = mockUnstableCache.mock
            .calls[0][0] as () => Promise<unknown>;

        await expect(fetcher()).resolves.toEqual(macro('live'));
        expect(mockReadSeed).not.toHaveBeenCalled();
    });

    it('서로 다른 dateHour는 별도 cache 키로 분리', async () => {
        await peekMacroBriefingStatic(SNAPSHOT, '2026-06-17T05');
        await peekMacroBriefingStatic(SNAPSHOT, '2026-06-17T06');
        expect(mockUnstableCache.mock.calls[0][1]).not.toEqual(
            mockUnstableCache.mock.calls[1][1]
        );
    });
});
