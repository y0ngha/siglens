/**
 * 종목 sitemap의 산문 게이트 입력 로더.
 *
 * 계약 세 가지: (1) 페이지 게이트와 같은 신선도 상한으로 `(symbol, tab)`과
 * `generatedAt`을 **한 번의 쿼리로** 읽는다(게이트·lastmod가 같은 데이터),
 * (2) 캐시 경계(JSON)를 지나도 `generatedAt`이 `Date`로 복원된다,
 * (3) DB가 죽으면 필터를 끈다(`{}`) — 스냅샷을 못 읽었다고 sitemap에서 수백 URL을
 * 빼면 안 된다.
 */
const { mockListFreshSymbolTabs, mockGetDatabaseClient } = vi.hoisted(() => ({
    mockListFreshSymbolTabs: vi.fn(),
    mockGetDatabaseClient: vi.fn(() => ({ db: {} })),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({
    // 실제 `unstable_cache`처럼 JSON 왕복을 시킨다 — Set을 그대로 캐시하면 `{}`로 깨진다.
    unstable_cache: (fn: () => Promise<unknown>) => async () =>
        JSON.parse(JSON.stringify(await fn())),
}));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: mockGetDatabaseClient,
}));
vi.mock('@/entities/seo-snapshot/api', () => ({
    DrizzleSeoSnapshotRepository: class {
        listFreshSymbolTabs = mockListFreshSymbolTabs;
    },
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SNAPSHOT_MAX_AGE_MS } from '@/entities/seo-snapshot/model';
import { loadPopularSitemapInputs } from '../server';

describe('loadPopularSitemapInputs', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('스냅샷이 있는 조합을 "SYMBOL:tab" → generatedAt 맵으로 돌려준다', async () => {
        mockListFreshSymbolTabs.mockResolvedValue([
            {
                symbol: 'AAPL',
                tab: 'news',
                generatedAt: new Date('2026-10-03T02:00:00.000Z'),
                hasProse: true,
            },
            {
                symbol: 'AAPL',
                tab: 'technical',
                generatedAt: new Date('2026-10-03T23:30:00.000Z'),
                hasProse: true,
            },
        ]);
        const before = Date.now();

        const inputs = await loadPopularSitemapInputs();

        expect(inputs.snapshotGeneratedAt).toEqual(
            new Map([
                ['AAPL:news', new Date('2026-10-03T02:00:00.000Z')],
                ['AAPL:technical', new Date('2026-10-03T23:30:00.000Z')],
            ])
        );
        const [tabs, locale, since] = mockListFreshSymbolTabs.mock.calls.find(
            call => Array.isArray(call[0])
        )!;
        // 게이트 탭(차트·뉴스)을 한 번에 읽는다 — lastmod도 같은 행에서 나온다.
        expect(tabs).toEqual(['technical', 'news']);
        expect(mockListFreshSymbolTabs).toHaveBeenCalledTimes(1);
        expect(locale).toBe('ko');
        // 페이지 읽기 경로(getSeoSnapshotsStatic)와 같은 신선도 상한이어야 한다.
        expect((since as Date).getTime()).toBeGreaterThanOrEqual(
            before - SNAPSHOT_MAX_AGE_MS
        );
        expect((since as Date).getTime()).toBeLessThanOrEqual(
            Date.now() - SNAPSHOT_MAX_AGE_MS
        );
    });

    it('렌더 가능한 산문이 없는 행(hasProse=false)은 맵에 넣지 않는다 — 키가 곧 페이지가 색인 대상이라는 뜻이다', async () => {
        mockListFreshSymbolTabs.mockResolvedValue([
            {
                symbol: 'AAPL',
                tab: 'news',
                generatedAt: new Date('2026-10-03T02:00:00.000Z'),
                hasProse: false,
            },
            {
                symbol: 'AAPL',
                tab: 'technical',
                generatedAt: new Date('2026-10-03T23:30:00.000Z'),
                hasProse: true,
            },
        ]);

        const inputs = await loadPopularSitemapInputs();

        expect([...(inputs.snapshotGeneratedAt?.keys() ?? [])]).toEqual([
            'AAPL:technical',
        ]);
    });

    it('캐시 경계(JSON 직렬화)를 지나도 값은 Date 인스턴스로 복원된다', async () => {
        // 이 모듈의 `unstable_cache` 목은 JSON 왕복을 한다 — 복원하지 않으면 값이 ISO
        // 문자열이라 빌더가 `.getTime()`에서 죽는다.
        mockListFreshSymbolTabs.mockResolvedValue([
            {
                symbol: 'AAPL',
                tab: 'news',
                generatedAt: new Date('2026-10-03T02:00:00.000Z'),
                hasProse: true,
            },
        ]);

        const inputs = await loadPopularSitemapInputs();

        const value = inputs.snapshotGeneratedAt?.get('AAPL:news');
        expect(value).toBeInstanceOf(Date);
        expect(value?.getTime()).toBe(
            new Date('2026-10-03T02:00:00.000Z').getTime()
        );
    });

    it('DB가 실패하면 필터를 끈다(빈 옵션)', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockListFreshSymbolTabs.mockRejectedValue(new Error('neon down'));

        await expect(loadPopularSitemapInputs()).resolves.toEqual({});
        spy.mockRestore();
    });
});
