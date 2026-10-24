import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { getOrSetCache, fetchIndexConstituents } = vi.hoisted(() => ({
    getOrSetCache: vi.fn(),
    fetchIndexConstituents: vi.fn(),
}));
vi.mock('@/shared/cache/getOrSetCache', () => ({ getOrSetCache }));
vi.mock('@/shared/api/wikipedia/indexConstituents', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@/shared/api/wikipedia/indexConstituents')
    >()),
    fetchIndexConstituents,
}));

import {
    INDEX_FAILURE_CACHE_TTL_SECONDS,
    loadIndexMemberships,
} from '@/app/api/ai/chat/tools/indexMembership';
import { SECONDS_PER_DAY } from '@/shared/config/time';

const LISTS: Record<string, string[]> = {
    sp500: ['AAPL', 'EXC', 'BRK.B'],
    nasdaq100: ['AAPL', 'EXC', 'GOOGL'],
    dowJones: ['AAPL'],
};
const NOW = new Date('2026-10-24T15:00:00Z');

describe('loadIndexMemberships', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        fetchIndexConstituents.mockImplementation(
            async (index: string) => LISTS[index]
        );
        // 캐시 미스: fetcher를 그대로 실행한다.
        getOrSetCache.mockImplementation(
            async (
                _key: string,
                _ttl: number,
                fetcher: () => Promise<unknown>
            ) => fetcher()
        );
    });

    it('지수별 편입 여부와 조회 날짜(ET)를 낸다', async () => {
        expect(await loadIndexMemberships('EXC', NOW)).toEqual({
            sp500: true,
            nasdaq100: true,
            dowJones: false,
            asOf: '2026-10-24',
            source: 'wikipedia',
        });
    });

    it('클래스 주식은 BRK-B·brk.b 어느 표기로 와도 BRK.B와 맞는다', async () => {
        const dash = await loadIndexMemberships('BRK-B', NOW);
        const lower = await loadIndexMemberships('brk.b', NOW);
        expect(dash?.sp500).toBe(true);
        expect(lower?.sp500).toBe(true);
    });

    it('어느 목록에도 없으면 모두 false다', async () => {
        const r = await loadIndexMemberships('ZZZZ', NOW);
        expect(r).toMatchObject({
            sp500: false,
            nasdaq100: false,
            dowJones: false,
        });
    });

    it('한국 종목은 null이고 Wikipedia를 읽지 않는다', async () => {
        expect(await loadIndexMemberships('005930.KS', NOW)).toBeNull();
        expect(getOrSetCache).not.toHaveBeenCalled();
    });

    it('지수당 키 하나를 하루 TTL로 쓴다(종목별 키 아님)', async () => {
        await loadIndexMemberships('AAPL', NOW);
        await loadIndexMemberships('EXC', NOW);
        const keys = getOrSetCache.mock.calls.map(c => c[0]);
        expect(new Set(keys)).toEqual(
            new Set([
                'index-constituents:v1:sp500',
                'index-constituents:v1:nasdaq100',
                'index-constituents:v1:dowJones',
            ])
        );
        expect(
            getOrSetCache.mock.calls.every(
                c =>
                    (c[1] as (v: string[]) => number)(['AAPL']) ===
                    SECONDS_PER_DAY
            )
        ).toBe(true);
    });

    it('목록 하나라도 실패하면 던진다(일부만 false로 내보내지 않는다)', async () => {
        fetchIndexConstituents.mockImplementation(async (index: string) => {
            if (index === 'dowJones') throw new Error('boom');
            return LISTS[index];
        });
        await expect(loadIndexMemberships('EXC', NOW)).rejects.toThrow(
            'unavailable'
        );
    });

    it('실패한 지수는 null sentinel을 짧은 TTL로 캐시한다(성공 목록은 하루)', async () => {
        fetchIndexConstituents.mockRejectedValue(new Error('429'));
        await expect(loadIndexMemberships('EXC', NOW)).rejects.toThrow();
        const ttl = getOrSetCache.mock.calls[0]?.[1] as (
            v: string[] | null
        ) => number;
        expect(ttl(null)).toBe(INDEX_FAILURE_CACHE_TTL_SECONDS);
        expect(ttl(['AAPL'])).toBe(SECONDS_PER_DAY);
        expect(INDEX_FAILURE_CACHE_TTL_SECONDS).toBeLessThanOrEqual(120);
    });

    it('캐시된 실패 sentinel을 읽으면 다시 fetch하지 않고 던진다', async () => {
        getOrSetCache.mockResolvedValue(null);
        await expect(loadIndexMemberships('EXC', NOW)).rejects.toThrow(
            'unavailable'
        );
        expect(fetchIndexConstituents).not.toHaveBeenCalled();
    });
});
