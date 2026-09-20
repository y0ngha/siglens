import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    fgUs,
    fgKr,
    summary,
    sectorSignals,
    peekBriefing,
    getTranslationsMock,
} = vi.hoisted(() => ({
    fgUs: vi.fn(),
    fgKr: vi.fn(),
    summary: vi.fn(),
    sectorSignals: vi.fn(),
    peekBriefing: vi.fn(),
    getTranslationsMock: vi.fn(),
}));
vi.mock('@/entities/market-fear-greed/api/marketFearGreedStaticCache', () => ({
    getMarketFearGreedStatic: fgUs,
}));
vi.mock(
    '@/entities/market-fear-greed/api/marketFearGreedKrStaticCache',
    () => ({ getMarketFearGreedKrStatic: fgKr })
);
vi.mock('@/entities/market-summary/api/marketSummaryStaticCache', () => ({
    getMarketSummaryStatic: summary,
}));
vi.mock('@/entities/sector-signal/api/sectorSignalsStaticCache', () => ({
    getSectorSignalsStatic: sectorSignals,
}));
vi.mock('@/entities/market-summary/api/briefingStaticCache', () => ({
    peekBriefingStatic: peekBriefing,
}));
// `getTranslations` is a controllable mock (not the fixed `nextIntlServerStub`
// export) so ONE test below can swap in a translator that mimics real
// next-intl's actual "missing key returns the key path, never throws"
// behavior — the exact gap a `try { t(key) } catch {}` fallback misses.
vi.mock('next-intl/server', () => ({
    getTranslations: getTranslationsMock,
}));

import { getMarketOverviewTool } from '@/app/api/ai/chat/tools/getMarketOverview';
import { catalogTranslator } from '@/shared/test-utils/catalogTranslator';

const ctx = {
    userId: 'u',
    tier: 'member' as const,
    locale: 'ko' as const,
    signal: new AbortController().signal,
};
const rt = { analysisModel: 'deepseek-v4.1-flash' as const };

describe('getMarketOverviewTool', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        peekBriefing.mockResolvedValue(null);
        getTranslationsMock.mockImplementation(
            async ({
                namespace,
                locale,
            }: {
                namespace: string;
                locale: string;
            }) => catalogTranslator(namespace, locale)
        );
        summary.mockResolvedValue({
            indices: [{ symbol: 'SPY', price: 500, changesPercentage: 0.5 }],
            sectors: [
                {
                    symbol: 'XLK',
                    sectorName: 'Technology',
                    koreanName: '기술',
                    price: 200,
                    changesPercentage: -0.2,
                },
                {
                    symbol: 'XLE',
                    sectorName: 'Energy',
                    koreanName: '에너지',
                    price: 90,
                    changesPercentage: 1.4,
                },
                {
                    symbol: 'XLF',
                    sectorName: 'Financials',
                    koreanName: '금융',
                    price: 45,
                    changesPercentage: 0,
                },
            ],
        });
    });

    it('us는 fear-greed(미국판)·지수·섹터신호를 모두 채운다', async () => {
        fgUs.mockResolvedValue({
            snapshot: {
                score: 62,
                label: 'greed',
                factors: [{ key: 'momentum', rawValue: 1, percentile: 70 }],
            },
            comparisons: [],
        });
        sectorSignals.mockResolvedValue({
            computedAt: '2026-09-14T00:00:00.000Z',
            stocks: [
                {
                    symbol: 'AAPL',
                    koreanName: '애플',
                    sectorSymbol: 'XLK',
                    price: 200,
                    changePercent: 1,
                    trend: 'uptrend',
                    signals: [
                        { type: 'golden_cross', direction: 'bullish' },
                        { type: 'rsi_oversold', direction: 'bullish' },
                    ],
                },
            ],
        });
        const r = (await getMarketOverviewTool({ market: 'us' }, ctx, rt)) as {
            market: string;
            fearGreed: { score: number };
            sectorSignals: {
                countsBySector: Record<string, number>;
                topSignals: unknown[];
            };
        };
        expect(fgKr).not.toHaveBeenCalled();
        expect(r.market).toBe('us');
        expect(r.fearGreed.score).toBe(62);
        expect(r.sectorSignals.countsBySector).toEqual({ XLK: 1 });
        expect(r.sectorSignals.topSignals).toHaveLength(2);
    });

    it('kr도 KR fear-greed와 함께 KR 스코프의 섹터신호를 채운다', async () => {
        fgKr.mockResolvedValue({
            snapshot: { score: 40, label: 'fear', factors: [] },
            comparisons: [],
        });
        sectorSignals.mockResolvedValue({
            computedAt: '2026-09-19T00:00:00.000Z',
            stocks: [
                {
                    symbol: '005930.KS',
                    koreanName: '삼성전자',
                    sectorSymbol: '091160.KS',
                    price: 74000,
                    changePercent: 1.2,
                    trend: 'uptrend',
                    signals: [{ type: 'golden_cross', direction: 'bullish' }],
                },
            ],
        });
        const r = (await getMarketOverviewTool({ market: 'kr' }, ctx, rt)) as {
            market: string;
            sectorSignals: {
                countsBySector: Record<string, number>;
                topSignals: { symbol: string }[];
            };
        };
        expect(fgUs).not.toHaveBeenCalled();
        expect(r.market).toBe('kr');
        // 미국 종목 목록으로 한국 스캔이 돌면 결과는 조용히 엉뚱해진다 —
        // 넘어간 스코프가 kr인지까지 확인한다.
        expect(sectorSignals).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'kr' }),
            expect.anything()
        );
        expect(r.sectorSignals.countsBySector).toEqual({ '091160.KS': 1 });
        expect(r.sectorSignals.topSignals[0]?.symbol).toBe('005930.KS');
    });

    it('crypto는 공포·탐욕 없이 크립토 스코프로 스캔하고, 지수 자리엔 메이저 코인이 온다', async () => {
        summary.mockResolvedValue({
            indices: [
                { symbol: 'BTCUSD', price: 64000, changesPercentage: 2.4 },
            ],
            // 크립토에는 섹터 ETF가 없다.
            sectors: [],
        });
        sectorSignals.mockResolvedValue({
            computedAt: '2026-09-19T00:00:00.000Z',
            stocks: [
                {
                    symbol: 'SOLUSD',
                    koreanName: '솔라나',
                    sectorSymbol: 'major',
                    price: 180,
                    changePercent: 3.1,
                    trend: 'uptrend',
                    signals: [{ type: 'golden_cross', direction: 'bullish' }],
                },
            ],
        });
        const r = (await getMarketOverviewTool(
            { market: 'crypto' },
            ctx,
            rt
        )) as {
            market: string;
            fearGreed: unknown;
            sectorBreadth: unknown;
            bestWorstSpreadPp: unknown;
            indices: { symbol: string }[];
            sectorSignals: { countsBySector: Record<string, number> };
        };
        expect(r.market).toBe('crypto');
        expect(fgUs).not.toHaveBeenCalled();
        expect(fgKr).not.toHaveBeenCalled();
        // 미국·한국 지수를 빌려 오면 다른 시장 숫자가 라벨 없이 섞인다.
        expect(r.fearGreed).toBeNull();
        expect(r.sectorBreadth).toBeNull();
        expect(r.bestWorstSpreadPp).toBeNull();
        expect(r.indices[0]?.symbol).toBe('BTCUSD');
        expect(sectorSignals).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'crypto' }),
            expect.anything()
        );
        expect(r.sectorSignals.countsBySector).toEqual({ major: 1 });
        // 크립토 브리핑은 프리웜이 굽지 않아 확정 미스다 — 물어보는 것 자체가 낭비.
        expect(peekBriefing).not.toHaveBeenCalled();
    });

    it('캐시된 시장 브리핑과 공포·탐욕 과거 대비 점수를 함께 싣는다', async () => {
        fgUs.mockResolvedValue({
            snapshot: { score: 62, label: 'greed', factors: [] },
            comparisons: [
                {
                    key: 'weekAgo',
                    date: '2026-09-12',
                    score: 44,
                    label: 'fear',
                },
            ],
        });
        sectorSignals.mockResolvedValue({ computedAt: '', stocks: [] });
        peekBriefing.mockResolvedValue({
            summary: '기술주가 지수를 끌어올렸다',
            dominantThemes: ['AI 설비투자'],
            riskSentiment: 'risk-on',
            sectorAnalysis: { leaders: [], laggards: [], narrative: '' },
            volatilityAnalysis: { vixLevel: 15, description: '' },
        });
        const r = (await getMarketOverviewTool({ market: 'us' }, ctx, rt)) as {
            fearGreed: { comparisons: { key: string; score: number }[] };
            briefing: { summary: string; riskSentiment: string } | null;
        };
        expect(r.fearGreed.comparisons).toEqual([
            { key: 'weekAgo', date: '2026-09-12', score: 44, label: 'fear' },
        ]);
        expect(r.briefing).toEqual({
            summary: '기술주가 지수를 끌어올렸다',
            dominantThemes: ['AI 설비투자'],
            riskSentiment: 'risk-on',
        });
    });

    it('브리핑 peek이 실패해도 나머지 시장 데이터는 그대로 나간다', async () => {
        fgUs.mockResolvedValue({
            snapshot: { score: 50, label: 'neutral', factors: [] },
            comparisons: [],
        });
        sectorSignals.mockResolvedValue({ computedAt: '', stocks: [] });
        peekBriefing.mockRejectedValue(new Error('cache down'));
        const r = (await getMarketOverviewTool({ market: 'us' }, ctx, rt)) as {
            briefing: unknown;
            fearGreed: { score: number };
        };
        expect(r.briefing).toBeNull();
        expect(r.fearGreed.score).toBe(50);
    });

    it('fear-greed 조회가 실패해도(allSettled) 지수·섹터 데이터는 살아남는다', async () => {
        fgUs.mockRejectedValue(new Error('redis down'));
        sectorSignals.mockResolvedValue({ computedAt: 'x', stocks: [] });
        const r = (await getMarketOverviewTool({ market: 'us' }, ctx, rt)) as {
            fearGreed: unknown;
            indices: unknown[];
        };
        expect(r.fearGreed).toBeNull();
        expect(r.indices).toEqual([
            { symbol: 'SPY', price: 500, changesPercentage: 0.5 },
        ]);
    });

    it('섹터 이름 번역 로드가 throw하면 koreanName으로 폴백하고 degrade가 로그된다', async () => {
        const consoleErrorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
        try {
            fgUs.mockResolvedValue({ snapshot: null, comparisons: [] });
            sectorSignals.mockResolvedValue({ computedAt: 'x', stocks: [] });
            getTranslationsMock.mockRejectedValue(new Error('catalog down'));

            const r = (await getMarketOverviewTool(
                { market: 'us' },
                ctx,
                rt
            )) as { sectors: Array<{ symbol: string; name: string }> };

            expect(r.sectors).toContainEqual(
                expect.objectContaining({ symbol: 'XLK', name: '기술' })
            );
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                '[AgentTool]',
                'get_market_overview',
                'sector name translation failed, degrading',
                { errorName: 'Error', code: undefined }
            );
        } finally {
            consoleErrorSpy.mockRestore();
        }
    });

    it('알 수 없는 market 값은 us로 취급한다', async () => {
        fgUs.mockResolvedValue({ snapshot: null, comparisons: [] });
        sectorSignals.mockResolvedValue({ computedAt: 'x', stocks: [] });
        const r = (await getMarketOverviewTool({ market: 'jp' }, ctx, rt)) as {
            market: string;
        };
        expect(r.market).toBe('us');
        expect(fgUs).toHaveBeenCalled();
    });

    describe('sectors 정렬·이름·sectorBreadth·spread (spec §3.5, B7)', () => {
        it('changesPercentage 내림차순으로 정렬되고 rank·카탈로그 이름이 붙는다', async () => {
            fgUs.mockResolvedValue({ snapshot: null, comparisons: [] });
            sectorSignals.mockResolvedValue({ computedAt: 'x', stocks: [] });
            const r = (await getMarketOverviewTool(
                { market: 'us' },
                ctx,
                rt
            )) as {
                sectors: Array<{
                    symbol: string;
                    name: string;
                    rank: number;
                    changesPercentage: number;
                }>;
            };
            expect(r.sectors.map(s => s.symbol)).toEqual([
                'XLE', // 1.4
                'XLF', // 0
                'XLK', // -0.2
            ]);
            expect(r.sectors.map(s => s.rank)).toEqual([1, 2, 3]);
            // Catalog-backed display name — same source as the dashboard's
            // `useAssetLabel` (ko catalog has XLK → '기술' etc).
            expect(r.sectors.find(s => s.symbol === 'XLK')!.name).toBe('기술');
        });

        it('카탈로그에 없는 심볼은 koreanName으로 폴백한다 (useAssetLabel과 동일)', async () => {
            fgUs.mockResolvedValue({ snapshot: null, comparisons: [] });
            sectorSignals.mockResolvedValue({ computedAt: 'x', stocks: [] });
            summary.mockResolvedValue({
                indices: [],
                sectors: [
                    {
                        symbol: 'XX-NOT-IN-CATALOG',
                        sectorName: 'Unknown',
                        koreanName: '알수없음',
                        price: 1,
                        changesPercentage: 0,
                    },
                ],
            });
            const r = (await getMarketOverviewTool(
                { market: 'us' },
                ctx,
                rt
            )) as { sectors: Array<{ name: string }> };
            expect(r.sectors[0]!.name).toBe('알수없음');
        });

        it('sectorBreadth: up/down/flat 섹터 개수를 센다 (breadth → sectorBreadth)', async () => {
            fgUs.mockResolvedValue({ snapshot: null, comparisons: [] });
            sectorSignals.mockResolvedValue({ computedAt: 'x', stocks: [] });
            const r = (await getMarketOverviewTool(
                { market: 'us' },
                ctx,
                rt
            )) as {
                sectorBreadth: { up: number; down: number; flat: number };
            };
            // XLE +1.4 (up), XLF 0 (flat), XLK -0.2 (down)
            expect(r.sectorBreadth).toEqual({ up: 1, down: 1, flat: 1 });
        });

        it('bestWorstSpreadPp: 1등-꼴찌 changesPercentage 차이(pp)', async () => {
            fgUs.mockResolvedValue({ snapshot: null, comparisons: [] });
            sectorSignals.mockResolvedValue({ computedAt: 'x', stocks: [] });
            const r = (await getMarketOverviewTool(
                { market: 'us' },
                ctx,
                rt
            )) as { bestWorstSpreadPp: number | null };
            expect(r.bestWorstSpreadPp).toBeCloseTo(1.4 - -0.2, 6);
        });

        it('실제 next-intl처럼 없는 키에서 throw하지 않고 키 경로를 반환하는 번역자에서도 koreanName 폴백이 동작한다 (t.has 사용)', async () => {
            fgUs.mockResolvedValue({ snapshot: null, comparisons: [] });
            sectorSignals.mockResolvedValue({ computedAt: 'x', stocks: [] });
            // Mimics real next-intl: `t(key)` on a missing key returns the
            // key path itself (never throws); only `t.has(key)` tells you
            // it was missing. A `try { t(key) } catch {}` fallback never
            // fires against this shape — only `t.has()` does.
            const nonThrowingTranslator = Object.assign(
                (key: string) => key, // "returns the key path" — never throws
                { has: (_key: string) => false }
            );
            getTranslationsMock.mockResolvedValue(nonThrowingTranslator);
            summary.mockResolvedValue({
                indices: [],
                sectors: [
                    {
                        symbol: 'XLK',
                        sectorName: 'Technology',
                        koreanName: '기술',
                        price: 200,
                        changesPercentage: -0.2,
                    },
                ],
            });
            const r = (await getMarketOverviewTool(
                { market: 'us' },
                ctx,
                rt
            )) as { sectors: Array<{ name: string }> };
            expect(r.sectors[0]!.name).toBe('기술');
        });

        it('changesPercentage가 비유한값이거나 price<=0인 섹터는 순위·sectorBreadth·spread에서 제외되고 rank:null로 뒤에 붙는다', async () => {
            fgUs.mockResolvedValue({ snapshot: null, comparisons: [] });
            sectorSignals.mockResolvedValue({ computedAt: 'x', stocks: [] });
            summary.mockResolvedValue({
                indices: [],
                sectors: [
                    {
                        symbol: 'XLK',
                        sectorName: 'Technology',
                        koreanName: '기술',
                        price: 200,
                        changesPercentage: 1,
                    },
                    {
                        symbol: 'XLE',
                        sectorName: 'Energy',
                        koreanName: '에너지',
                        price: 0, // failed quote → unrankable
                        changesPercentage: 2,
                    },
                    {
                        symbol: 'XLF',
                        sectorName: 'Financials',
                        koreanName: '금융',
                        price: -5, // corrupt → unrankable
                        changesPercentage: 0.5,
                    },
                    {
                        symbol: 'XLY',
                        sectorName: 'Consumer',
                        koreanName: '소비재',
                        price: 50,
                        changesPercentage: Number.NaN, // unrankable
                    },
                ],
            });
            const r = (await getMarketOverviewTool(
                { market: 'us' },
                ctx,
                rt
            )) as {
                sectors: Array<{ symbol: string; rank: number | null }>;
                sectorBreadth: { up: number; down: number; flat: number };
                bestWorstSpreadPp: number | null;
            };
            // Only XLK is rankable — sole ranked row.
            const ranked = r.sectors.filter(s => s.rank !== null);
            expect(
                ranked.map(s => ({ symbol: s.symbol, rank: s.rank }))
            ).toEqual([{ symbol: 'XLK', rank: 1 }]);
            // The unrankable rows still exist in the output, with rank:null —
            // not silently dropped.
            expect(
                r.sectors
                    .filter(s => s.rank === null)
                    .map(s => s.symbol)
                    .toSorted()
            ).toEqual(['XLE', 'XLF', 'XLY']);
            expect(r.sectors).toHaveLength(4);
            // sectorBreadth/spread only ever see the one rankable sector.
            expect(r.sectorBreadth).toEqual({ up: 1, down: 0, flat: 0 });
            expect(r.bestWorstSpreadPp).toBe(0); // single rankable sector → spread 0
        });

        it('섹터가 없으면 sectorBreadth/bestWorstSpreadPp는 null', async () => {
            fgUs.mockResolvedValue({ snapshot: null, comparisons: [] });
            sectorSignals.mockResolvedValue({ computedAt: 'x', stocks: [] });
            summary.mockResolvedValue({ indices: [], sectors: [] });
            const r = (await getMarketOverviewTool(
                { market: 'us' },
                ctx,
                rt
            )) as {
                sectorBreadth: unknown;
                bestWorstSpreadPp: unknown;
                sectors: unknown[];
            };
            expect(r.sectorBreadth).toBeNull();
            expect(r.bestWorstSpreadPp).toBeNull();
            expect(r.sectors).toEqual([]);
        });
    });
});
