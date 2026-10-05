vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({
    unstable_cache: vi.fn((fn: () => Promise<unknown>) => () => fn()),
}));
vi.mock('@/shared/cache/hubSsrSeed', () => ({
    readHubSsrSeed: vi.fn(),
}));
vi.mock('@/shared/cache/ssrMissMarker', () => ({
    markSsrMiss: vi.fn(),
}));
vi.mock('@y0ngha/siglens-core', async () => {
    const actual = await vi.importActual<typeof import('@y0ngha/siglens-core')>(
        '@y0ngha/siglens-core'
    );
    return { ...actual, peekMacroBriefingCacheEntry: vi.fn() };
});

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { unstable_cache } from 'next/cache';
import { peekMacroBriefingCacheEntry } from '@y0ngha/siglens-core';

import type {
    EconomySnapshot,
    MacroBriefingCacheEntry,
    MacroBriefingResponse,
} from '@y0ngha/siglens-core';

import { readHubSsrSeed } from '@/shared/cache/hubSsrSeed';
import { markSsrMiss } from '@/shared/cache/ssrMissMarker';
import {
    MACRO_BRIEFING_SEED_SURFACE,
    peekMacroBriefingStatic,
} from '@/entities/economy/api/macroBriefingStaticCache';
import { SECONDS_PER_DAY } from '@/shared/config/time';

const mockUnstableCache = vi.mocked(unstable_cache);
const mockPeek = vi.mocked(peekMacroBriefingCacheEntry);
const mockReadSeed = vi.mocked(readHubSsrSeed);
const mockMarkSsrMiss = vi.mocked(markSsrMiss);

const SNAPSHOT: EconomySnapshot = {
    indicators: [],
    treasury: null,
    calendar: [],
};

const GENERATED_AT = '2026-06-17T03:20:00.000Z';

function macro(summary: string): MacroBriefingResponse {
    return { summary, highlights: [], regime: 'neutral' };
}

function entry(summary: string): MacroBriefingCacheEntry {
    return { briefing: macro(summary), generatedAt: GENERATED_AT };
}

describe('peekMacroBriefingStatic', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockPeek.mockResolvedValue(null);
        mockReadSeed.mockResolvedValue(null);
    });

    it('전달받은 UTC 날짜 키로 unstable_cache 키를 일 단위 버킷팅 + 24h revalidate + briefing 태그', async () => {
        await peekMacroBriefingStatic(SNAPSHOT, '2026-06-17');
        const [, key, opts] = mockUnstableCache.mock.calls[0];
        expect(key).toEqual(['economy-briefing-peek-static', '2026-06-17']);
        expect(opts).toEqual({
            revalidate: SECONDS_PER_DAY,
            tags: ['economy:briefing'],
        });
    });

    it('내부 fetcher가 snapshot을 그대로 peekMacroBriefingCacheEntry에 전달', async () => {
        mockPeek.mockResolvedValue(entry('live'));
        await peekMacroBriefingStatic(SNAPSHOT, '2026-06-17');
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
        mockReadSeed.mockResolvedValue(entry('seed'));

        await peekMacroBriefingStatic(SNAPSHOT, '2026-06-17');
        const fetcher = mockUnstableCache.mock
            .calls[0][0] as () => Promise<unknown>;

        await expect(fetcher()).resolves.toEqual(entry('seed'));
        expect(mockReadSeed).toHaveBeenCalledWith(MACRO_BRIEFING_SEED_SURFACE);
    });

    it('core peek이 hit면 seed를 읽지 않는다', async () => {
        mockPeek.mockResolvedValue(entry('live'));

        await peekMacroBriefingStatic(SNAPSHOT, '2026-06-17');
        const fetcher = mockUnstableCache.mock
            .calls[0][0] as () => Promise<unknown>;

        await expect(fetcher()).resolves.toEqual(entry('live'));
        expect(mockReadSeed).not.toHaveBeenCalled();
    });

    /**
     * `null`을 캐시하면 방문자가 곧 값을 생성해도 페이지가 24h 플레이스홀더로 남는다.
     * 그래서 fetcher가 던져 저장을 건너뛰고, 대신 SSR miss를 표시한다.
     */
    it('core·seed 모두 miss면 null을 반환하고 캐시 콜백은 던져 저장을 건너뛰며 SSR miss를 표시한다', async () => {
        const result = await peekMacroBriefingStatic(SNAPSHOT, '2026-06-17');
        const fetcher = mockUnstableCache.mock
            .calls[0][0] as () => Promise<unknown>;

        expect(result).toBeNull();
        await expect(fetcher()).rejects.toThrow();
        expect(mockMarkSsrMiss).toHaveBeenCalledWith('economy:briefing');
    });

    it('값이 있으면 SSR miss를 표시하지 않는다', async () => {
        mockPeek.mockResolvedValue(entry('live'));

        await expect(
            peekMacroBriefingStatic(SNAPSHOT, '2026-06-17')
        ).resolves.toEqual(entry('live'));
        expect(mockMarkSsrMiss).not.toHaveBeenCalled();
    });

    it('다른 날짜 키는 별도 cache 키로 분리', async () => {
        await peekMacroBriefingStatic(SNAPSHOT, '2026-06-17');
        await peekMacroBriefingStatic(SNAPSHOT, '2026-06-18');
        expect(mockUnstableCache.mock.calls[0][1]).not.toEqual(
            mockUnstableCache.mock.calls[1][1]
        );
    });

    it('hit한 core 항목의 생성 시각을 그대로 돌려준다', async () => {
        mockPeek.mockResolvedValue(entry('live'));

        await expect(
            peekMacroBriefingStatic(SNAPSHOT, '2026-06-17')
        ).resolves.toEqual({
            briefing: macro('live'),
            generatedAt: GENERATED_AT,
        });
    });

    it('seed 봉투의 생성 시각도 돌려준다', async () => {
        mockReadSeed.mockResolvedValue(entry('seed'));

        await expect(
            peekMacroBriefingStatic(SNAPSHOT, '2026-06-17')
        ).resolves.toEqual({
            briefing: macro('seed'),
            generatedAt: GENERATED_AT,
        });
    });

    /**
     * 이 변경 이전의 프리웜은 `MacroBriefingResponse`를 그대로 seed에 썼다. TTL 동안
     * 남아 있는 그 옛 형태가 봉투로 오인되면 `briefing`이 undefined로 렌더된다.
     */
    it('봉투가 아닌 옛 seed는 생성 시각 null로 읽는다', async () => {
        mockReadSeed.mockResolvedValue(macro('legacy') as never);

        await expect(
            peekMacroBriefingStatic(SNAPSHOT, '2026-06-17')
        ).resolves.toEqual({ briefing: macro('legacy'), generatedAt: null });
    });

    it('seed 봉투의 generatedAt이 문자열이 아니면 null로 정규화한다', async () => {
        mockReadSeed.mockResolvedValue({
            briefing: macro('seed'),
            generatedAt: 123,
        } as never);

        await expect(
            peekMacroBriefingStatic(SNAPSHOT, '2026-06-17')
        ).resolves.toEqual({ briefing: macro('seed'), generatedAt: null });
    });
});
