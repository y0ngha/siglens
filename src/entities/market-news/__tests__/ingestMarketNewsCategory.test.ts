// 1. All vi.mock(...) calls — hoisted by Vitest before any static import
vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {} })),
}));
vi.mock('@/shared/api/e2eEnv', () => ({ isE2E: vi.fn(() => false) }));
vi.mock('@y0ngha/siglens-core', async importOriginal => ({
    ...(await importOriginal<typeof import('@y0ngha/siglens-core')>()),
    runNewsCardAnalysis: vi.fn(),
}));
vi.mock('@/entities/market-news/api/marketNewsRepository', () => ({
    DrizzleMarketNewsRepository: vi.fn(),
    isRecentlyFetched: vi.fn(),
    markFetched: vi.fn(),
}));
vi.mock('../lib/getMarketNewsClient', () => ({
    getMarketNewsClient: vi.fn(),
}));

// 2. Static imports
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { revalidateTag } from 'next/cache';
import * as core from '@y0ngha/siglens-core';
import { ingestMarketNewsCategory } from '../api/ingestMarketNewsCategory';
import * as repoModule from '../api/marketNewsRepository';
import * as clientModule from '../lib/getMarketNewsClient';

function makeItem(id: string) {
    return {
        id,
        symbol: '__NEWS_FOREX__',
        source: 'FxWire',
        url: `https://x/${id}`,
        publishedAt: '2026-09-30T10:00:00.000Z',
        titleEn: `Headline ${id}`,
        bodyEn: 'body',
        tickers: [] as string[],
    };
}

const DONE = {
    status: 'done' as const,
    result: {
        titleKo: '달러 강세',
        bodyKo: null,
        summaryKo: '요약',
        sentiment: 'bullish' as const,
        category: 'macro' as const,
        priceImpact: 'high' as const,
    },
};

let attachAnalysis: ReturnType<typeof vi.fn>;

function setupFeed(
    items: ReturnType<typeof makeItem>[],
    analyzed: string[] = []
) {
    vi.mocked(clientModule.getMarketNewsClient).mockReturnValue({
        fetchCategoryNews: vi.fn(async () => items),
    } as never);
    attachAnalysis = vi.fn(async () => undefined);
    vi.mocked(repoModule.DrizzleMarketNewsRepository).mockImplementation(
        function (this: unknown) {
            Object.assign(this as object, {
                upsertMarketNewsItem: vi.fn(async () => true),
                attachAnalysis,
                listAnalyzedIds: vi.fn(async () => new Set(analyzed)),
            });
            return this;
        } as never
    );
}

describe('ingestMarketNewsCategory', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(repoModule.isRecentlyFetched).mockResolvedValue(false);
        vi.mocked(repoModule.markFetched).mockResolvedValue(undefined);
        vi.mocked(core.runNewsCardAnalysis).mockResolvedValue(DONE as never);
    });

    it('analyzeLimit만큼만 보강한다 — 나머지는 다음 적재 때 후보로 남는다', async () => {
        setupFeed(['a', 'b', 'c', 'd', 'e'].map(makeItem));

        const result = await ingestMarketNewsCategory('forex', {
            analyzeLimit: 2,
            logLabel: 'test',
        });

        expect(core.runNewsCardAnalysis).toHaveBeenCalledTimes(2);
        expect(result).toEqual({
            status: 'ok',
            fetched: 5,
            changed: 5,
            analyzed: 2,
            pending: 3,
            enriched: 2,
        });
    });

    it('analyzeLimit이 없으면 미보강 기사 전부를 보강한다(방문자 경로)', async () => {
        setupFeed(['a', 'b', 'c'].map(makeItem), ['b']);

        const result = await ingestMarketNewsCategory('forex', {
            logLabel: 'test',
        });

        expect(core.runNewsCardAnalysis).toHaveBeenCalledTimes(2);
        // 창 안에 이미 보강된 1건(b) + 이번에 보강한 2건.
        expect(result).toMatchObject({
            status: 'ok',
            analyzed: 2,
            pending: 0,
            enriched: 3,
        });
    });

    it('행 변경과 보강 저장 뒤에 목록 태그를 각각 턴다', async () => {
        setupFeed([makeItem('a')]);

        await ingestMarketNewsCategory('forex', { logLabel: 'test' });

        expect(revalidateTag).toHaveBeenCalledTimes(2);
        expect(revalidateTag).toHaveBeenCalledWith(
            'market-news:__NEWS_FOREX__',
            'max'
        );
    });

    it('빈 분석은 저장하지 않고 analyzed로 세지 않는다', async () => {
        setupFeed([makeItem('a')]);
        vi.mocked(core.runNewsCardAnalysis).mockResolvedValue({
            ...DONE,
            result: { ...DONE.result, titleKo: ' ', summaryKo: '' },
        } as never);
        const warnSpy = vi
            .spyOn(console, 'warn')
            .mockImplementation(() => undefined);

        const result = await ingestMarketNewsCategory('forex', {
            logLabel: 'test',
        });

        expect(attachAnalysis).not.toHaveBeenCalled();
        expect(result).toMatchObject({ status: 'ok', analyzed: 0 });
        // 행 변경 무효화 한 번만 — 보강 저장이 없으니 두 번째는 없다.
        expect(revalidateTag).toHaveBeenCalledTimes(1);
        warnSpy.mockRestore();
    });

    it('10분 플래그가 서 있으면 피드를 부르지 않고 recently-fetched를 돌려준다', async () => {
        vi.mocked(repoModule.isRecentlyFetched).mockResolvedValue(true);

        const result = await ingestMarketNewsCategory('forex', {
            logLabel: 'test',
        });

        expect(result).toEqual({ status: 'recently-fetched' });
        expect(clientModule.getMarketNewsClient).not.toHaveBeenCalled();
    });

    it('피드가 실패하면 fetch-failed를 돌려준다(던지지 않는다)', async () => {
        vi.mocked(clientModule.getMarketNewsClient).mockReturnValue({
            fetchCategoryNews: vi.fn(async () => {
                throw new Error('402');
            }),
        } as never);
        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);

        const result = await ingestMarketNewsCategory('forex', {
            logLabel: 'test',
        });

        expect(result).toEqual({ status: 'fetch-failed' });
        errorSpy.mockRestore();
    });
});
