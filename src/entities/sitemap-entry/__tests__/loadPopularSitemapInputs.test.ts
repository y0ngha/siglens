/**
 * 종목 sitemap의 산문 게이트 입력 로더.
 *
 * 계약 두 가지: (1) 페이지 게이트와 같은 신선도 상한으로 `(symbol, tab)`을 읽는다,
 * (2) DB가 죽으면 필터를 끈다(`{}`) — 스냅샷을 못 읽었다고 sitemap에서 수백 URL을
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
import { SNAPSHOT_MAX_AGE_MS } from '@/entities/seo-snapshot';
import { loadPopularSitemapInputs } from '../server';

describe('loadPopularSitemapInputs', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('congress·overall 스냅샷이 있는 조합을 "SYMBOL:tab" 집합으로 돌려준다', async () => {
        mockListFreshSymbolTabs.mockResolvedValue([
            { symbol: 'AAPL', tab: 'overall' },
            { symbol: 'AAPL', tab: 'congress' },
        ]);
        const before = Date.now();

        const inputs = await loadPopularSitemapInputs();

        expect(inputs.symbolTabsWithProse).toEqual(
            new Set(['AAPL:overall', 'AAPL:congress'])
        );
        const [tabs, locale, since] = mockListFreshSymbolTabs.mock.calls.find(
            call => Array.isArray(call[0])
        )!;
        expect(tabs).toEqual(['congress', 'overall']);
        expect(locale).toBe('ko');
        // 페이지 읽기 경로(getSeoSnapshotsStatic)와 같은 신선도 상한이어야 한다.
        expect((since as Date).getTime()).toBeGreaterThanOrEqual(
            before - SNAPSHOT_MAX_AGE_MS
        );
        expect((since as Date).getTime()).toBeLessThanOrEqual(
            Date.now() - SNAPSHOT_MAX_AGE_MS
        );
    });

    it('DB가 실패하면 필터를 끈다(빈 옵션)', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockListFreshSymbolTabs.mockRejectedValue(new Error('neon down'));

        await expect(loadPopularSitemapInputs()).resolves.toEqual({});
        spy.mockRestore();
    });
});
