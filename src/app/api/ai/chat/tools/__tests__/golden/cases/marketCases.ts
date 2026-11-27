import { buildKrIndicatorCards } from '@/entities/economy/lib/krIndicatorCards';
import { MARKET_INDICES, SECTOR_ETFS } from '@/shared/config/dashboard-tickers';
import {
    KR_MARKET_INDICES,
    KR_SECTOR_ETFS,
} from '@/shared/config/dashboard-tickers-kr';
import { KR_ECONOMY_INDICATORS } from '@/shared/config/economyIndicatorsKr';
import { MS_PER_HOUR } from '@/shared/config/time';
import type { NewsDisplayItem } from '@/shared/lib/types';
import { fakes, repos, world } from '../boundary';
import {
    CLOCKS,
    listCrypto,
    listKrStock,
    listUsStock,
    SYMBOLS,
    type GoldenCase,
} from '../goldenCase';
import { noise } from '../syntheticMarket';

/** 시장 전체 도구 — 시장 개요, 경제, 뉴스. */

const indexRow = (
    i: {
        symbol: string;
        fmpSymbol: string;
        displayName: string;
        koreanName: string;
    },
    n: number
) => ({
    ...i,
    price: Number((4_812.37 * (1 + n * 0.37)).toFixed(2)),
    changesPercentage: Number((0.83 - n * 0.41).toFixed(5)),
});

function listIndexSeries(fmpSymbols: readonly string[]): void {
    fmpSymbols.forEach((symbol, n) => {
        world.series[symbol] = {
            base: 2_900 + n * 900,
            drift: 0.0004,
            seed: 400 + n,
            volume: 0,
            decimals: 2,
        };
    });
}

const sectorRow = (
    s: { symbol: string; sectorName: string; koreanName: string },
    n: number
) => ({
    ...s,
    price: n === 3 ? 0 : Number((48.913 + n * 11.37).toFixed(2)),
    changesPercentage: n === 3 ? 0 : Number((1.94 - n * 0.37).toFixed(6)),
});

export function usOverview(): void {
    listIndexSeries(MARKET_INDICES.map(i => i.fmpSymbol));
    fakes.getMarketFearGreedStatic.mockResolvedValue({
        snapshot: {
            score: 63.48,
            label: 'greed',
            factors: [
                { key: 'momentum', rawValue: 0.0412, percentile: 78.3 },
                { key: 'strength', rawValue: 0.6125, percentile: 69.1 },
                { key: 'breadth', rawValue: 0.1877, percentile: 58.4 },
                { key: 'putCall', rawValue: 0.84, percentile: 61.9 },
                { key: 'volatility', rawValue: 15.62, percentile: 66.7 },
                { key: 'safeHaven', rawValue: 0.0213, percentile: 55.2 },
                { key: 'junkBond', rawValue: 3.11, percentile: 54.9 },
            ],
            confidence: 'normal',
            sampleSize: 1254,
            asOf: '2026-11-17',
        },
        comparisons: [
            { key: 'now', date: '2026-11-17', score: 63, label: 'greed' },
            { key: '1w', date: '2026-11-10', score: 57, label: 'greed' },
            { key: '1m', date: '2026-10-17', score: 41, label: 'fear' },
            { key: '1y', date: '2025-11-17', score: 48, label: 'neutral' },
        ],
    });
    fakes.getMarketSummaryStatic.mockResolvedValue({
        indices: MARKET_INDICES.map(indexRow),
        sectors: SECTOR_ETFS.map(sectorRow),
    });
    fakes.getSectorSignalsStatic.mockResolvedValue({
        computedAt: '2026-11-18T14:05:00.000Z',
        stocks: SECTOR_ETFS.slice(0, 7).map((sector, n) => ({
            symbol: `SIG${String.fromCharCode(65 + n)}Q`,
            koreanName: `신호종목${n + 1}`,
            sectorSymbol: sector.symbol,
            price: 87.31 + n * 4.2,
            changePercent: 1.21 - n * 0.3,
            trend: n % 2 === 0 ? 'uptrend' : 'downtrend',
            signals: [
                { type: 'golden_cross', direction: 'bullish', phase: 'start' },
                {
                    type: n % 2 === 0 ? 'rsi_overbought' : 'rsi_oversold',
                    direction: n % 2 === 0 ? 'bearish' : 'bullish',
                    phase: 'start',
                },
            ],
        })),
    });
    fakes.peekBriefingStatic.mockResolvedValue({
        summary: '기술주가 반등을 이끌며 지수가 고점 부근을 지키고 있습니다.',
        dominantThemes: ['반도체 강세', '금리 인하 기대', '에너지 약세'],
        sectorAnalysis: {
            leadingSectors: ['기술'],
            laggingSectors: ['에너지'],
            description: '기술 우위',
        },
        volatilityAnalysis: { vixLevel: 15.62, description: '변동성 낮음' },
        riskSentiment: 'risk-on',
    });
}

export const marketOverviewCases: GoldenCase[] = [
    {
        tool: 'get_market_overview',
        name: 'us-session-open-full-size',
        now: CLOCKS.usOpen,
        args: { market: 'us' },
        arrange: usOverview,
    },
    {
        tool: 'get_market_overview',
        name: 'kr-session-en-names',
        now: CLOCKS.krSession,
        locale: 'en',
        args: { market: 'kr' },
        arrange: () => {
            listIndexSeries(KR_MARKET_INDICES.map(i => i.fmpSymbol));
            fakes.getMarketFearGreedKrStatic.mockResolvedValue({
                snapshot: {
                    score: 38.2,
                    label: 'fear',
                    factors: [
                        { key: 'momentum', rawValue: -0.021, percentile: 31.4 },
                    ],
                    confidence: 'limited',
                    sampleSize: 402,
                    asOf: '2026-11-18',
                },
                comparisons: [],
            });
            fakes.getMarketSummaryStatic.mockResolvedValue({
                indices: KR_MARKET_INDICES.map(indexRow),
                sectors: KR_SECTOR_ETFS.map(sectorRow),
            });
            fakes.peekBriefingStatic.mockRejectedValue(new Error('redis down'));
        },
    },
    {
        tool: 'get_market_overview',
        name: 'crypto-no-fear-greed-no-briefing',
        now: CLOCKS.crypto,
        args: { market: 'crypto' },
        arrange: () => {
            listCrypto();
            fakes.getMarketSummaryStatic.mockResolvedValue({
                indices: [
                    {
                        symbol: SYMBOLS.crypto,
                        fmpSymbol: SYMBOLS.crypto,
                        displayName: 'Zeta Coin',
                        koreanName: '제타코인',
                        price: 112_840.5,
                        changesPercentage: -2.137,
                    },
                ],
                sectors: [],
            });
        },
    },
    {
        tool: 'get_market_overview',
        name: 'every-source-failed-default-market',
        now: CLOCKS.weekend,
        args: { market: 'mars' },
        arrange: () => {
            fakes.getMarketFearGreedStatic.mockRejectedValue(new Error('x'));
            fakes.getMarketSummaryStatic.mockRejectedValue(new Error('x'));
            fakes.getSectorSignalsStatic.mockRejectedValue(new Error('x'));
        },
    },
];

/** FMP 캘린더 시각 문자열(`YYYY-MM-DD HH:mm:ss`, UTC). */
const fmpDate = (ms: number): string =>
    new Date(ms).toISOString().slice(0, 19).replace('T', ' ');

function calendarRows(nowIso: string, count: number) {
    const now = Date.parse(nowIso);
    const names = [
        'CPI YoY',
        'Initial Jobless Claims',
        'Fed Interest Rate Decision',
        'Retail Sales MoM',
        'Baker Hughes Oil Rig Count',
        'ISM Manufacturing PMI',
        'Nonfarm Payrolls',
    ];
    const impacts = [
        'High',
        'Medium',
        'High',
        'Medium',
        'Low',
        'High',
        'High',
    ] as const;
    return Array.from({ length: count }, (_, i) => ({
        date: fmpDate(now + (i - 3) * 19 * MS_PER_HOUR),
        event: names[i % names.length] ?? 'CPI YoY',
        impact: impacts[i % impacts.length] ?? 'Low',
        actual: i < 3 ? Number((3.1 + 0.1 * noise(9, i, 0)).toFixed(1)) : null,
        estimate: Number((3.0 + 0.1 * noise(9, i, 1)).toFixed(1)),
        previous: Number((2.9 + 0.1 * noise(9, i, 2)).toFixed(1)),
        unit: i % 3 === 1 ? 'K' : '%',
    }));
}

const SNAPSHOT_INDICATORS = [
    ['federalFunds', '%', 4.33, 4.58],
    ['CPI', '%', 3.04, 2.91],
    ['unemploymentRate', '%', 4.2, 4.1],
    ['GDP', '%', 2.71, 3.02],
    ['retailSales', 'M', 712_384, 708_119],
    ['consumerSentiment', '', 71.8, 70.5],
] as const;

function usSnapshot(nowIso: string) {
    return {
        indicators: SNAPSHOT_INDICATORS.map(
            ([name, unit, latest, previous]) => ({
                name,
                unit,
                latest: { date: '2026-10-01', value: latest },
                previous: { date: '2026-09-01', value: previous },
                trend: [],
            })
        ),
        treasury: { date: '2026-11-14', year2: 3.912, year10: 4.318 },
        calendar: calendarRows(nowIso, 12),
    };
}

export const economyCases: GoldenCase[] = [
    {
        tool: 'get_economy',
        name: 'us-default-window-full-size',
        now: CLOCKS.usOpen,
        args: {},
        arrange: () => {
            fakes.getEconomySnapshotStatic.mockResolvedValue(
                usSnapshot(CLOCKS.usOpen)
            );
            fakes.getFreshTreasuryRates.mockResolvedValue({
                treasury: { date: '2026-11-17', year2: 3.947, year10: 4.296 },
                fetchedAt: '2026-11-18T13:00:00.000Z',
                source: 'us-treasury',
                officialAvailable: true,
            });
            fakes.getEconomicCalendarRange.mockResolvedValue(
                calendarRows(CLOCKS.usOpen, 120)
            );
            fakes.peekMacroBriefingStatic.mockResolvedValue({
                briefing: {
                    summary: '완만한 성장세가 이어지고 있습니다.',
                    highlights: [],
                    regime: 'expansion',
                },
                generatedAt: '2026-11-18T10:00:00.000Z',
            });
        },
    },
    {
        tool: 'get_economy',
        name: 'kr-cards-and-db-calendar-fallback',
        now: CLOCKS.krSession,
        args: { country: 'kr' },
        arrange: () => {
            fakes.getKrIndicatorCards.mockResolvedValue(
                buildKrIndicatorCards(
                    KR_ECONOMY_INDICATORS.flatMap((meta, i) => [
                        {
                            dateEt: '2026-09-10 23:00:00',
                            event: meta.event,
                            actual: 2.5 + i * 0.31,
                            previous: null,
                            unit: meta.unit,
                        },
                        {
                            dateEt: '2026-10-12 23:00:00',
                            event: meta.event,
                            actual: 2.5 + i * 0.29,
                            previous: 2.5 + i * 0.31,
                            unit: meta.unit,
                        },
                    ])
                )
            );
            fakes.getEconomicCalendarRange.mockRejectedValue(
                new Error('fmp 429')
            );
            fakes.getCalendarFromDb.mockResolvedValue(
                calendarRows(CLOCKS.krSession, 6).map(row => ({
                    ...row,
                    analysis: null,
                }))
            );
        },
    },
    {
        tool: 'get_economy',
        name: 'range-calendar-only',
        now: CLOCKS.weekend,
        args: { from: '2026-11-23', to: '2026-12-11' },
        arrange: () => {
            fakes.getEconomicCalendarRange.mockResolvedValue(
                calendarRows('2026-11-28T15:00:00.000Z', 30)
            );
        },
    },
    {
        tool: 'get_economy',
        name: 'invalid-country-and-dates',
        now: CLOCKS.weekend,
        args: { country: 'jp', from: '2026-13-01', to: 'tomorrow' },
    },
    {
        tool: 'get_economy',
        name: 'snapshot-unavailable-keeps-calendar',
        now: CLOCKS.usClosed,
        args: {},
        arrange: () => {
            fakes.getEconomySnapshotStatic.mockRejectedValue(
                Object.assign(new Error('redis: secret'), {
                    name: 'UpstashError',
                })
            );
            fakes.getEconomicCalendarRange.mockResolvedValue(
                calendarRows(CLOCKS.usClosed, 8)
            );
        },
    },
];

const HEADLINES = [
    [
        'Goldenrod Systems beats quarterly estimates as controller demand climbs',
        '골든로드, 컨트롤러 수요 증가로 분기 실적 예상치 상회',
    ],
    [
        'Analyst lifts Goldenrod target, citing fab capacity additions',
        '애널리스트, 팹 증설 근거로 골든로드 목표가 상향',
    ],
    [
        'Goldenrod shares slip after supplier warns on lead times',
        '공급사 납기 경고에 골든로드 주가 하락',
    ],
    [
        'Goldenrod announces $2 billion buyback program',
        '골든로드, 20억 달러 자사주 매입 발표',
    ],
    [
        'Regulators open review of Goldenrod export licenses',
        '규제 당국, 골든로드 수출 허가 검토 착수',
    ],
    [
        'Goldenrod CEO outlines AI roadmap at investor day',
        '골든로드 CEO, 투자자의 날에 AI 로드맵 제시',
    ],
] as const;
const SENTIMENTS = [
    'bullish',
    'bullish',
    'bearish',
    'bullish',
    'bearish',
    'neutral',
] as const;

function newsRows(
    nowIso: string,
    count: number,
    withKo: boolean
): NewsDisplayItem[] {
    const now = Date.parse(nowIso);
    return Array.from({ length: count }, (_, i) => {
        const [en, ko] = HEADLINES[i % HEADLINES.length] ?? HEADLINES[0];
        return {
            id: `news-${i}`,
            publishedAt: new Date(
                now - (i * 21 + 3) * MS_PER_HOUR - (i % 4) * 17 * 60_000
            ).toISOString(),
            titleEn: `${en}${i >= HEADLINES.length ? ` (${Math.floor(i / HEADLINES.length) + 1})` : ''}`,
            titleKo: withKo ? ko : null,
            sentiment: SENTIMENTS[i % SENTIMENTS.length] ?? null,
            category: 'earnings',
            summaryKo: withKo
                ? `${ko}. 회사는 이번 분기 매출이 전년 대비 ${(11 + i * 0.4).toFixed(1)}% 늘었다고 밝혔고, 다음 분기 가이던스도 시장 기대를 웃돌았다. 다만 공급망 부담과 환율 변동이 마진에 영향을 줄 수 있다는 지적도 나왔다.`
                : null,
            bodyKo: withKo
                ? `${ko}.\n\n${'회사 측은 컨트롤러 출하가 모든 지역에서 늘었다고 설명했다. 경영진은 컨퍼런스콜에서 설비 증설 일정과 신제품 출시 계획을 공개했다. 시장에서는 "수요가 공급을 앞서는 구간"이라는 평가가 나왔다. '.repeat(6)}`
                : null,
            priceImpact: i % 5 === 0 ? 'high' : 'medium',
            url: `https://news.example.com/markets/goldenrod-${i}`,
            source: i % 2 === 0 ? 'Example Wire' : 'Market Daily',
        };
    });
}

export const newsCases: GoldenCase[] = [
    {
        tool: 'get_news',
        name: 'symbol-twenty-items-with-bodies-truncation',
        now: CLOCKS.usOpen,
        args: { symbol: SYMBOLS.us, limit: 20, includeBody: true },
        arrange: () => {
            listUsStock();
            repos.news.methods.listCardsBySymbol.mockResolvedValue(
                newsRows(CLOCKS.usOpen, 26, true)
            );
        },
    },
    {
        tool: 'get_news',
        name: 'symbol-since-date-query-filter',
        now: CLOCKS.usClosed,
        args: { symbol: SYMBOLS.us, since: '2026-11-12', query: 'target' },
        arrange: () => {
            listUsStock();
            repos.news.methods.listCardsBySymbol.mockResolvedValue(
                newsRows(CLOCKS.usClosed, 14, true)
            );
        },
    },
    {
        tool: 'get_news',
        name: 'kr-symbol-untranslated-no-price-moves',
        now: CLOCKS.krSession,
        locale: 'en',
        args: { symbol: SYMBOLS.kr },
        arrange: () => {
            listKrStock();
            world.failing.add(SYMBOLS.kr);
            repos.news.methods.listCardsBySymbol.mockResolvedValue(
                newsRows(CLOCKS.krSession, 4, false)
            );
        },
    },
    {
        tool: 'get_news',
        name: 'category-with-digest',
        now: CLOCKS.weekend,
        args: { category: 'stock', limit: 3 },
        arrange: () => {
            repos.marketNews.methods.listCardsByCategory.mockResolvedValue(
                newsRows(CLOCKS.weekend, 9, true)
            );
            fakes.peekMarketNewsDigestStatic.mockResolvedValue({
                currentDriverKo:
                    '금리 인하 기대가 기술주 매수를 이끌고 있습니다.',
                keyEventsKo: ['반도체 실적 호조', '국채 금리 하락'],
                upcomingEventsKo: ['다음 주 FOMC 의사록'],
                overallSentiment: 'bullish',
            });
        },
    },
    {
        tool: 'get_news',
        name: 'invalid-args-unknown-category-and-since',
        now: CLOCKS.weekend,
        args: { category: 'gossip' },
    },
    {
        tool: 'get_news',
        name: 'empty-coverage',
        now: CLOCKS.usOpen,
        caller: 'guest',
        args: { symbol: SYMBOLS.us2 },
    },
];
