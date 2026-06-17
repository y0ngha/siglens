vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({
    unstable_cache: vi.fn((fn: () => Promise<unknown>) => () => fn()),
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

import type { EconomySnapshot } from '@y0ngha/siglens-core';

import { peekMacroBriefingStatic } from '@/entities/economy/api/macroBriefingStaticCache';
import { SECONDS_PER_HOUR } from '@/shared/config/time';

const mockUnstableCache = vi.mocked(unstable_cache);
const mockPeek = vi.mocked(peekMacroBriefingCache);

const SNAPSHOT: EconomySnapshot = {
    indicators: [],
    treasury: null,
    calendar: [],
};

describe('peekMacroBriefingStatic', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPeek.mockResolvedValue(null);
    });

    it('전달받은 dateHour로 unstable_cache 키를 hourly 버킷팅 + 1h revalidate + briefing 태그', async () => {
        await peekMacroBriefingStatic(SNAPSHOT, '2026-06-17T05');
        const [, key, opts] = mockUnstableCache.mock.calls[0];
        expect(key).toEqual(['economy-briefing-peek-static', '2026-06-17T05']);
        expect(opts).toEqual({
            revalidate: SECONDS_PER_HOUR,
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

    it('서로 다른 dateHour는 별도 cache 키로 분리', async () => {
        await peekMacroBriefingStatic(SNAPSHOT, '2026-06-17T05');
        await peekMacroBriefingStatic(SNAPSHOT, '2026-06-17T06');
        expect(mockUnstableCache.mock.calls[0][1]).not.toEqual(
            mockUnstableCache.mock.calls[1][1]
        );
    });
});
