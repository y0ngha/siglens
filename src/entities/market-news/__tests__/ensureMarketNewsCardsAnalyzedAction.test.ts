// 1. All vi.mock(...) calls — hoisted by Vitest before any static import
vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));
vi.mock('next/headers', () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: vi.fn(() => ({ db: {} })),
}));
vi.mock('@/shared/lib/sleep', () => ({ sleep: vi.fn() }));
vi.mock('@/shared/api/e2eEnv', () => ({ isE2E: vi.fn(() => false) }));

// Mock runNewsCardAnalysis from core (replaces submit+poll pattern)
vi.mock('@y0ngha/siglens-core', async importOriginal => {
    const original =
        await importOriginal<typeof import('@y0ngha/siglens-core')>();
    return {
        ...original,
        runNewsCardAnalysis: vi.fn(async () => ({
            status: 'done',
            result: {
                titleKo: 'BTC 상승',
                bodyKo: null,
                summaryKo: '요약',
                sentiment: 'bullish',
                category: 'macro',
                priceImpact: 'high',
            },
        })),
    };
});

// vi.mock factories are hoisted — cannot reference outer-scope variables.
// Access all mocked functions via vi.mocked() after static import.
vi.mock('../api', () => ({
    DrizzleMarketNewsRepository: vi.fn(function () {
        return {
            upsertMarketNewsItem: vi.fn(async () => true),
            attachAnalysis: vi.fn(async () => undefined),
            listByCategory: vi.fn(async () => []),
            // 분석 여부 판정은 id 집합만 읽는다(감사: 비용 라운드 15).
            listAnalyzedIds: vi.fn(async () => new Set<string>()),
        };
    }),
    getMarketNewsList: vi.fn(),
    getMarketNewsCards: vi.fn(),
    isRecentlyFetched: vi.fn(async () => false),
    markFetched: vi.fn(async () => undefined),
}));

vi.mock('../lib/getMarketNewsClient', () => ({
    getMarketNewsClient: vi.fn(() => ({
        fetchCategoryNews: vi.fn(async () => [
            {
                id: 'm1',
                symbol: '__NEWS_CRYPTO__',
                source: 'CoinWire',
                url: 'https://x/btc',
                publishedAt: '2026-06-15T10:00:00.000Z',
                titleEn: 'BTC up',
                bodyEn: 'body',
                tickers: ['BTCUSD'],
            },
        ]),
    })),
}));

// 2. Static imports — grouped after all vi.mock() calls
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ensureMarketNewsCardsAnalyzedAction } from '../actions/ensureMarketNewsCardsAnalyzedAction';
import * as api from '../api';
import * as getMarketNewsClientModule from '../lib/getMarketNewsClient';
import * as core from '@y0ngha/siglens-core';
import { MARKET_NEWS_LOOKBACK_MS } from '../lib/marketNewsConstants';

// 3. Item fixtures for majority-failure test
function makeItem(id: string) {
    return {
        id,
        symbol: '__NEWS_CRYPTO__',
        source: 'CoinWire',
        url: `https://x/${id}`,
        publishedAt: '2026-06-15T10:00:00.000Z',
        titleEn: `Headline ${id}`,
        bodyEn: 'body',
        tickers: [] as string[],
    };
}

const ITEMS = ['m1', 'm2', 'm3', 'm4', 'm5'].map(makeItem);

const DEFAULT_ITEM = {
    id: 'm1',
    symbol: '__NEWS_CRYPTO__',
    source: 'CoinWire',
    url: 'https://x/btc',
    publishedAt: '2026-06-15T10:00:00.000Z',
    titleEn: 'BTC up',
    bodyEn: 'body',
    titleKo: null,
    bodyKo: null,
    summaryKo: null,
    sentiment: null,
    category: null,
    priceImpact: null,
    tickers: ['BTCUSD'],
    analyzedAt: null,
};

// 4. Tests
describe('ensureMarketNewsCardsAnalyzedAction은', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset module-level mocks (isRecentlyFetched / markFetched)
        vi.mocked(api.isRecentlyFetched).mockResolvedValue(false);
        vi.mocked(api.markFetched).mockResolvedValue(undefined);
        // Reset core mocks
        vi.mocked(core.runNewsCardAnalysis).mockResolvedValue({
            status: 'done',
            result: {
                titleKo: 'BTC 상승',
                bodyKo: null,
                summaryKo: '요약',
                sentiment: 'bullish',
                category: 'macro',
                priceImpact: 'high',
            },
        });
        // Reset getMarketNewsClient to return fresh client each call
        vi.mocked(
            getMarketNewsClientModule.getMarketNewsClient
        ).mockReturnValue({
            fetchCategoryNews: vi.fn(async () => [
                {
                    id: 'm1',
                    symbol: '__NEWS_CRYPTO__',
                    source: 'CoinWire',
                    url: 'https://x/btc',
                    publishedAt: '2026-06-15T10:00:00.000Z',
                    titleEn: 'BTC up',
                    bodyEn: 'body',
                    tickers: ['BTCUSD'],
                },
            ]),
        });
        // Reset DrizzleMarketNewsRepository to return fresh instance mocks each call
        vi.mocked(api.DrizzleMarketNewsRepository).mockImplementation(
            function (this: unknown) {
                (this as Record<string, unknown>).upsertMarketNewsItem = vi.fn(
                    async () => true
                );
                (this as Record<string, unknown>).attachAnalysis = vi.fn(
                    async () => undefined
                );
                (this as Record<string, unknown>).listByCategory = vi.fn(
                    async () => [DEFAULT_ITEM]
                );
                (this as Record<string, unknown>).listAnalyzedIds = vi.fn(
                    async () => new Set<string>()
                );
                return this;
            }
        );
    });

    it('새 기사를 upsert하면 market-news:<sentinel> 태그를 revalidate한다', async () => {
        const { revalidateTag } = await import('next/cache');
        await ensureMarketNewsCardsAnalyzedAction('crypto');
        expect(revalidateTag).toHaveBeenCalledWith(
            'market-news:__NEWS_CRYPTO__',
            'max'
        );
    });

    it('titleKo·summaryKo가 모두 빈 결과는 persist하지 않는다 — write-once 고착 방지', async () => {
        // 저장하면 analyzedAt이 세팅되어 이 기사는 영구히 재분석에서 빠지고
        // sentiment/category가 기본값으로 굳는다. DeepSeek 어댑터가
        // responseSchema를 무시하므로(json_object만 강제) 실제로 열려 있는
        // 경로다 — 심볼 뉴스·경제 이벤트 경로와 동일하게 skip한다.
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const attachAnalysis = vi.fn(async () => undefined);
        vi.mocked(api.DrizzleMarketNewsRepository).mockImplementation(
            function (this: unknown) {
                (this as Record<string, unknown>).upsertMarketNewsItem = vi.fn(
                    async () => true
                );
                (this as Record<string, unknown>).attachAnalysis =
                    attachAnalysis;
                (this as Record<string, unknown>).listByCategory = vi.fn(
                    async () => [DEFAULT_ITEM]
                );
                (this as Record<string, unknown>).listAnalyzedIds = vi.fn(
                    async () => new Set<string>()
                );
                return this;
            }
        );
        vi.mocked(core.runNewsCardAnalysis).mockResolvedValue({
            status: 'done',
            result: {
                titleKo: '  ',
                bodyKo: null,
                summaryKo: '   ',
                sentiment: 'bullish',
                category: 'macro',
                priceImpact: 'high',
            },
        });

        await ensureMarketNewsCardsAnalyzedAction('crypto');

        expect(core.runNewsCardAnalysis).toHaveBeenCalled();
        expect(attachAnalysis).not.toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('empty card analysis')
        );

        warnSpy.mockRestore();
    });

    it('upsert가 변경 없이 끝나면(false) revalidateTag를 호출하지 않는다', async () => {
        vi.mocked(api.DrizzleMarketNewsRepository).mockImplementation(
            function (this: unknown) {
                (this as Record<string, unknown>).upsertMarketNewsItem = vi.fn(
                    async () => false
                );
                (this as Record<string, unknown>).attachAnalysis = vi.fn(
                    async () => undefined
                );
                (this as Record<string, unknown>).listByCategory = vi.fn(
                    async () => [DEFAULT_ITEM]
                );
                (this as Record<string, unknown>).listAnalyzedIds = vi.fn(
                    async () => new Set<string>()
                );
                return this;
            }
        );
        const { revalidateTag } = await import('next/cache');
        await ensureMarketNewsCardsAnalyzedAction('crypto');
        expect(revalidateTag).not.toHaveBeenCalled();
    });

    it('refresh 플래그가 세팅돼 있으면(isRecentlyFetched=true) FMP fetch를 건너뛴다', async () => {
        vi.mocked(api.isRecentlyFetched).mockResolvedValue(true);

        await ensureMarketNewsCardsAnalyzedAction('crypto');
        expect(
            getMarketNewsClientModule.getMarketNewsClient
        ).not.toHaveBeenCalled();
    });

    it('refresh 플래그가 세팅돼 있으면 두 번째 호출도 FMP fetch를 건너뛴다', async () => {
        vi.mocked(api.isRecentlyFetched).mockResolvedValue(true);

        await ensureMarketNewsCardsAnalyzedAction('crypto');
        expect(
            getMarketNewsClientModule.getMarketNewsClient
        ).not.toHaveBeenCalled();
    });

    it('isRecentlyFetched=false면 markFetched를 fetch 전에 호출한다(dedup sentinel)', async () => {
        await ensureMarketNewsCardsAnalyzedAction('crypto');
        expect(api.markFetched).toHaveBeenCalledWith('__NEWS_CRYPTO__');
        expect(api.markFetched).toHaveBeenCalledTimes(1);
    });

    it('정상 호출 시 FMP fetch와 upsert가 진행되고 LLM 분석도 트리거된다', async () => {
        await ensureMarketNewsCardsAnalyzedAction('crypto');

        // FMP fetch proceeded
        expect(
            getMarketNewsClientModule.getMarketNewsClient
        ).toHaveBeenCalled();
        // LLM analysis was triggered
        expect(core.runNewsCardAnalysis).toHaveBeenCalled();
        // Refresh flag was marked at the start (before fetch)
        expect(api.markFetched).toHaveBeenCalledWith('__NEWS_CRYPTO__');
    });

    /**
     * [회귀] 이 파일의 `listAnalyzedIds` 픽스처가 전부 빈 Set이라 "이미 분석된
     * 기사는 다시 안 보낸다"는 계약을 아무 케이스도 밟지 않았다 — 필터를 통째로
     * 무력화해도 전건 통과한다(감사: 테스트 라운드 16). 종목 뉴스 쌍둥이엔 있는
     * 케이스를 여기에도 둔다.
     */
    it('이미 분석된 기사는 LLM에 다시 보내지 않는다', async () => {
        vi.mocked(
            getMarketNewsClientModule.getMarketNewsClient
        ).mockReturnValue({
            fetchCategoryNews: vi.fn(async () => [
                { ...DEFAULT_ITEM, id: 'm1' },
                { ...DEFAULT_ITEM, id: 'm2' },
            ]),
        } as unknown as ReturnType<
            typeof getMarketNewsClientModule.getMarketNewsClient
        >);
        const listAnalyzedIds = vi.fn(async () => new Set(['m1']));
        vi.mocked(api.DrizzleMarketNewsRepository).mockImplementation(function (
            this: unknown
        ) {
            (this as Record<string, unknown>).upsertMarketNewsItem = vi.fn(
                async () => true
            );
            (this as Record<string, unknown>).attachAnalysis = vi.fn(
                async () => undefined
            );
            (this as Record<string, unknown>).listByCategory = vi.fn(
                async () => []
            );
            (this as Record<string, unknown>).listAnalyzedIds = listAnalyzedIds;
            return this;
        } as never);

        await ensureMarketNewsCardsAnalyzedAction('crypto');

        expect(listAnalyzedIds).toHaveBeenCalledWith(
            '__NEWS_CRYPTO__',
            MARKET_NEWS_LOOKBACK_MS
        );
        const analyzedIdArgs = vi
            .mocked(core.runNewsCardAnalysis)
            .mock.calls.map(
                call => (call[0] as { item: { id: string } }).item.id
            );
        expect(analyzedIdArgs).toEqual(['m2']);
    });

    it('예외가 발생해도 throw하지 않고 void를 반환한다', async () => {
        vi.mocked(
            getMarketNewsClientModule.getMarketNewsClient
        ).mockReturnValue({
            fetchCategoryNews: vi.fn(async () => {
                throw new Error('network error');
            }),
        });
        await expect(
            ensureMarketNewsCardsAnalyzedAction('crypto')
        ).resolves.toBeUndefined();
    });

    it('majority upsert failure이면 console.error 후 early return하고 LLM 분석을 호출하지 않는다', async () => {
        // 5 fresh items, 3 upsert rejections → majority (3 > 5/2 = 2.5)
        vi.mocked(
            getMarketNewsClientModule.getMarketNewsClient
        ).mockReturnValue({
            fetchCategoryNews: vi.fn(async () => ITEMS),
        });
        vi.mocked(api.DrizzleMarketNewsRepository).mockImplementation(
            function (this: unknown) {
                const upsert = vi
                    .fn()
                    .mockResolvedValueOnce(true)
                    .mockRejectedValueOnce(new Error('db write error'))
                    .mockRejectedValueOnce(new Error('db write error'))
                    .mockResolvedValueOnce(true)
                    .mockRejectedValueOnce(new Error('db write error'));
                (this as Record<string, unknown>).upsertMarketNewsItem = upsert;
                (this as Record<string, unknown>).attachAnalysis = vi.fn(
                    async () => undefined
                );
                (this as Record<string, unknown>).listByCategory = vi.fn(
                    async () =>
                        ITEMS.map(i => ({
                            ...i,
                            analyzedAt: null,
                            titleKo: null,
                            bodyKo: null,
                            summaryKo: null,
                            sentiment: null,
                            category: null,
                            priceImpact: null,
                        }))
                );
                (this as Record<string, unknown>).listAnalyzedIds = vi.fn(
                    async () => new Set<string>()
                );
                return this;
            }
        );

        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        await ensureMarketNewsCardsAnalyzedAction('crypto');

        // Majority branch should fire and abort before LLM analysis
        expect(core.runNewsCardAnalysis).not.toHaveBeenCalled();
        // console.error should have been called at least once mentioning majority-failure
        const calls = errorSpy.mock.calls.map(c => String(c[0]));
        expect(calls.some(msg => msg.includes('majority upsert failure'))).toBe(
            true
        );

        errorSpy.mockRestore();
    });

    it('minority upsert failure(2/5)이면 LLM 분석을 계속 진행한다', async () => {
        vi.mocked(
            getMarketNewsClientModule.getMarketNewsClient
        ).mockReturnValue({
            fetchCategoryNews: vi.fn(async () => ITEMS),
        });
        vi.mocked(api.DrizzleMarketNewsRepository).mockImplementation(
            function (this: unknown) {
                const upsert = vi
                    .fn()
                    .mockRejectedValueOnce(new Error('err'))
                    .mockRejectedValueOnce(new Error('err'))
                    .mockResolvedValue(true);
                (this as Record<string, unknown>).upsertMarketNewsItem = upsert;
                (this as Record<string, unknown>).attachAnalysis = vi.fn(
                    async () => undefined
                );
                (this as Record<string, unknown>).listByCategory = vi.fn(
                    async () =>
                        ITEMS.map(i => ({
                            ...i,
                            analyzedAt: null,
                            titleKo: null,
                            bodyKo: null,
                            summaryKo: null,
                            sentiment: null,
                            category: null,
                            priceImpact: null,
                        }))
                );
                (this as Record<string, unknown>).listAnalyzedIds = vi.fn(
                    async () => new Set<string>()
                );
                return this;
            }
        );

        await ensureMarketNewsCardsAnalyzedAction('crypto');
        // minority failure should NOT abort — LLM analysis should still run
        expect(core.runNewsCardAnalysis).toHaveBeenCalled();
    });

    it('upsert 실패 아이템은 LLM 제출에서 제외된다 — 5개 중 1개 upsert 실패 시 runNewsCardAnalysis 4회 호출', async () => {
        vi.mocked(
            getMarketNewsClientModule.getMarketNewsClient
        ).mockReturnValue({
            fetchCategoryNews: vi.fn(async () => ITEMS),
        });
        vi.mocked(api.DrizzleMarketNewsRepository).mockImplementation(
            function (this: unknown) {
                const upsert = vi
                    .fn()
                    .mockResolvedValueOnce(true) // m1
                    .mockResolvedValueOnce(true) // m2
                    .mockRejectedValueOnce(new Error('upsert error')) // m3
                    .mockResolvedValueOnce(true) // m4
                    .mockResolvedValueOnce(true); // m5
                (this as Record<string, unknown>).upsertMarketNewsItem = upsert;
                (this as Record<string, unknown>).attachAnalysis = vi.fn(
                    async () => undefined
                );
                // listByCategory returns all 5 as unanalyzed — upsertedIds filter does the work
                (this as Record<string, unknown>).listByCategory = vi.fn(
                    async () =>
                        ITEMS.map(i => ({
                            ...i,
                            analyzedAt: null,
                            titleKo: null,
                            bodyKo: null,
                            summaryKo: null,
                            sentiment: null,
                            category: null,
                            priceImpact: null,
                        }))
                );
                (this as Record<string, unknown>).listAnalyzedIds = vi.fn(
                    async () => new Set<string>()
                );
                return this;
            }
        );

        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        await ensureMarketNewsCardsAnalyzedAction('crypto');

        // Only the 4 successfully upserted items should be submitted to LLM
        expect(core.runNewsCardAnalysis).toHaveBeenCalledTimes(4);

        errorSpy.mockRestore();
    });

    it('LLM 분석이 chunked-parallel로 호출된다 — N개 아이템에 runNewsCardAnalysis N번 호출', async () => {
        vi.mocked(
            getMarketNewsClientModule.getMarketNewsClient
        ).mockReturnValue({
            fetchCategoryNews: vi.fn(async () => ITEMS),
        });
        vi.mocked(api.DrizzleMarketNewsRepository).mockImplementation(
            function (this: unknown) {
                (this as Record<string, unknown>).upsertMarketNewsItem = vi.fn(
                    async () => true
                );
                (this as Record<string, unknown>).attachAnalysis = vi.fn(
                    async () => undefined
                );
                (this as Record<string, unknown>).listByCategory = vi.fn(
                    async () =>
                        ITEMS.map(i => ({
                            ...i,
                            analyzedAt: null,
                            titleKo: null,
                            bodyKo: null,
                            summaryKo: null,
                            sentiment: null,
                            category: null,
                            priceImpact: null,
                        }))
                );
                (this as Record<string, unknown>).listAnalyzedIds = vi.fn(
                    async () => new Set<string>()
                );
                return this;
            }
        );

        await ensureMarketNewsCardsAnalyzedAction('crypto');
        // All 5 items submitted (within LLM_PARALLEL_LIMIT=8 single chunk for 5 items)
        expect(core.runNewsCardAnalysis).toHaveBeenCalledTimes(5);
    });

    it('LLM 동시 실행은 LLM_PARALLEL_LIMIT=8을 초과하지 않는다 — 20개 중 동시 최대 8개', async () => {
        const BIG_ITEMS = Array.from({ length: 20 }, (_, i) =>
            makeItem(`big-${i}`)
        );
        vi.mocked(
            getMarketNewsClientModule.getMarketNewsClient
        ).mockReturnValue({
            fetchCategoryNews: vi.fn(async () => BIG_ITEMS),
        });

        let maxConcurrent = 0;
        let currentConcurrent = 0;

        vi.mocked(core.runNewsCardAnalysis).mockImplementation(async () => {
            currentConcurrent++;
            if (currentConcurrent > maxConcurrent) {
                maxConcurrent = currentConcurrent;
            }
            // Simulate async work
            await Promise.resolve();
            currentConcurrent--;
            return {
                status: 'done' as const,
                result: {
                    titleKo: 'ok',
                    bodyKo: null,
                    summaryKo: 'ok',
                    sentiment: 'neutral' as const,
                    category: 'other' as const,
                    priceImpact: 'low' as const,
                },
            };
        });

        vi.mocked(api.DrizzleMarketNewsRepository).mockImplementation(
            function (this: unknown) {
                (this as Record<string, unknown>).upsertMarketNewsItem = vi.fn(
                    async () => true
                );
                (this as Record<string, unknown>).attachAnalysis = vi.fn(
                    async () => undefined
                );
                (this as Record<string, unknown>).listByCategory = vi.fn(
                    async () =>
                        BIG_ITEMS.map(i => ({
                            ...i,
                            analyzedAt: null,
                            titleKo: null,
                            bodyKo: null,
                            summaryKo: null,
                            sentiment: null,
                            category: null,
                            priceImpact: null,
                        }))
                );
                (this as Record<string, unknown>).listAnalyzedIds = vi.fn(
                    async () => new Set<string>()
                );
                return this;
            }
        );

        await ensureMarketNewsCardsAnalyzedAction('crypto');

        expect(core.runNewsCardAnalysis).toHaveBeenCalledTimes(20);
        // Each chunk is at most LLM_PARALLEL_LIMIT=8 concurrent
        expect(maxConcurrent).toBeLessThanOrEqual(8);
    });

    it('majority analyze failure이면 console.error를 호출하고 void로 resolve한다', async () => {
        // 3 of 5 analyses fail → majority failure
        let callCount = 0;
        vi.mocked(core.runNewsCardAnalysis).mockImplementation(async () => {
            callCount++;
            if (callCount <= 3) throw new Error('LLM worker error');
            return {
                status: 'done' as const,
                result: {
                    titleKo: 'ok',
                    bodyKo: null,
                    summaryKo: 'ok',
                    sentiment: 'neutral' as const,
                    category: 'other' as const,
                    priceImpact: 'low' as const,
                },
            };
        });

        vi.mocked(
            getMarketNewsClientModule.getMarketNewsClient
        ).mockReturnValue({
            fetchCategoryNews: vi.fn(async () => ITEMS),
        });
        vi.mocked(api.DrizzleMarketNewsRepository).mockImplementation(
            function (this: unknown) {
                (this as Record<string, unknown>).upsertMarketNewsItem = vi.fn(
                    async () => true
                );
                (this as Record<string, unknown>).attachAnalysis = vi.fn(
                    async () => undefined
                );
                (this as Record<string, unknown>).listByCategory = vi.fn(
                    async () =>
                        ITEMS.map(i => ({
                            ...i,
                            analyzedAt: null,
                            titleKo: null,
                            bodyKo: null,
                            summaryKo: null,
                            sentiment: null,
                            category: null,
                            priceImpact: null,
                        }))
                );
                (this as Record<string, unknown>).listAnalyzedIds = vi.fn(
                    async () => new Set<string>()
                );
                return this;
            }
        );

        const errorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        // The outer try/catch catches and logs — action still resolves void
        await expect(
            ensureMarketNewsCardsAnalyzedAction('crypto')
        ).resolves.toBeUndefined();

        // console.error should have been called for majority failure
        expect(errorSpy).toHaveBeenCalled();

        errorSpy.mockRestore();
    });

    it('두 번째 concurrent 호출은 refresh 플래그로 FMP fetch를 건너뛴다', async () => {
        // First call
        await ensureMarketNewsCardsAnalyzedAction('crypto');
        expect(
            getMarketNewsClientModule.getMarketNewsClient
        ).toHaveBeenCalledTimes(1);

        // Simulate flag now set by first call
        vi.mocked(api.isRecentlyFetched).mockResolvedValue(true);

        // Second concurrent-style call
        await ensureMarketNewsCardsAnalyzedAction('crypto');
        // FMP fetch should NOT have been called again
        expect(
            getMarketNewsClientModule.getMarketNewsClient
        ).toHaveBeenCalledTimes(1);
    });
});
