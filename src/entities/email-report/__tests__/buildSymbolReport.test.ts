import type { OptionsExpirationMetrics } from '@y0ngha/siglens-core';
import {
    buildSymbolReport,
    pickReportNews,
    selectReportSymbols,
    type BuildSymbolReportInput,
} from '@/entities/email-report/lib/buildSymbolReport';
import {
    REPORT_MAX_NEWS,
    REPORT_MAX_PATTERNS,
} from '@/entities/email-report/reportModel';
import type { NewsDisplayItem } from '@/shared/lib/types';

function news(overrides: Partial<NewsDisplayItem> = {}): NewsDisplayItem {
    return {
        id: 'n1',
        publishedAt: '2026-10-01T00:00:00.000Z',
        titleEn: 'English title',
        titleKo: null,
        sentiment: null,
        category: null,
        bodyKo: null,
        summaryKo: null,
        priceImpact: null,
        url: 'https://example.com/a',
        source: 'Reuters',
        ...overrides,
    };
}

const METRICS = {
    expirationDate: '2026-10-16',
    daysToExpiration: 8,
    maxPain: 180,
    maxPainDistancePct: -2,
    putCallRatio: 0.82,
    atmImpliedVolatility: 0.31,
    topOpenInterestStrikes: [],
    impliedMovePercent: 4.4,
    impliedMoveRange: null,
    topVolumeStrikes: [],
} as unknown as OptionsExpirationMetrics;

const BASE: BuildSymbolReportInput = {
    symbol: 'AAPL',
    technical: {
        summary: '상승 추세가 이어진다.',
        trend: 'bullish',
        patternSummaries: [
            { summary: '컵앤핸들 형성 중' },
            { summary: '' },
            { summary: '상승 깃발' },
            { summary: '삼중 바닥' },
        ],
    },
    plain: '쉽게 말하면 오르는 중이에요.',
    analyzedAt: new Date('2026-10-07T21:00:00.000Z'),
    news: [],
    optionsMetrics: METRICS,
    optionsProse: { summary: '콜 쪽 수요가 우세하다.' },
};

describe('buildSymbolReport', () => {
    it('기술적 분석·쉽게보기·옵션을 조립하고 빈 패턴은 버린 뒤 상한까지만 싣는다', () => {
        const report = buildSymbolReport(BASE);

        expect(report.technical).toEqual({
            summary: '상승 추세가 이어진다.',
            trend: 'bullish',
            patterns: ['컵앤핸들 형성 중', '상승 깃발'],
        });
        expect(report.technical?.patterns).toHaveLength(REPORT_MAX_PATTERNS);
        expect(report.plain).toBe('쉽게 말하면 오르는 중이에요.');
        expect(report.analyzedAt).toBe('2026-10-07T21:00:00.000Z');
        expect(report.options).toEqual({
            expirationDate: '2026-10-16',
            putCallRatio: 0.82,
            atmImpliedVolatility: 0.31,
            impliedMovePercent: 4.4,
            summary: '콜 쪽 수요가 우세하다.',
        });
    });

    it('기술적 분석이 없으면 analyzedAt도 null이다', () => {
        const report = buildSymbolReport({ ...BASE, technical: null });

        expect(report.technical).toBeNull();
        expect(report.analyzedAt).toBeNull();
    });

    it('옵션 지표와 산문이 모두 없으면 options는 null이다', () => {
        const report = buildSymbolReport({
            ...BASE,
            optionsMetrics: null,
            optionsProse: null,
        });

        expect(report.options).toBeNull();
    });

    it('옵션 산문만 있으면 지표 칸은 null로 두고 요약만 싣는다', () => {
        const report = buildSymbolReport({ ...BASE, optionsMetrics: null });

        expect(report.options).toEqual({
            expirationDate: '',
            putCallRatio: null,
            atmImpliedVolatility: null,
            impliedMovePercent: null,
            summary: '콜 쪽 수요가 우세하다.',
        });
    });

    it('결과에 매매 지시성 수치 필드가 없다', () => {
        const report = buildSymbolReport(BASE);
        const keys = JSON.stringify(report);

        expect(keys).not.toMatch(
            /stopLoss|entryPrices|takeProfit|priceTargets/
        );
    });
});

describe('pickReportNews', () => {
    it('AI 요약이 있는 기사를 먼저, 그 안에서는 최신순으로 상한까지 고른다', () => {
        const items = [
            news({
                id: 'old-sum',
                publishedAt: '2026-09-01T00:00:00Z',
                summaryKo: '요약 A',
            }),
            news({ id: 'new-raw', publishedAt: '2026-10-05T00:00:00Z' }),
            news({
                id: 'new-sum',
                publishedAt: '2026-10-04T00:00:00Z',
                summaryKo: '요약 B',
            }),
            news({ id: 'mid-raw', publishedAt: '2026-09-15T00:00:00Z' }),
        ];

        const picked = pickReportNews(items);

        expect(picked).toHaveLength(REPORT_MAX_NEWS);
        expect(picked.map(p => p.summary)).toEqual(['요약 B', '요약 A', null]);
        expect(picked[2]?.publishedAt).toBe('2026-10-05T00:00:00Z');
    });

    it('현지화된 제목·요약을 원문보다 우선한다', () => {
        const [item] = pickReportNews([
            news({
                titleKo: '한국어 제목',
                titleLocalized: '日本語タイトル',
                summaryKo: '한국어 요약',
                summaryLocalized: '日本語の要約',
            }),
        ]);

        expect(item).toMatchObject({
            title: '日本語タイトル',
            summary: '日本語の要約',
        });
    });

    it('한국어 제목이 없으면 영문 제목으로 떨어진다', () => {
        const [item] = pickReportNews([news()]);

        expect(item?.title).toBe('English title');
    });
});

describe('selectReportSymbols', () => {
    it('해외 종목을 먼저, 그룹 안에서는 매입 원가가 큰 순으로 상한까지 고른다', () => {
        const picked = selectReportSymbols(
            [
                { symbol: '005930.KS', quantity: '100', averagePrice: '70000' },
                { symbol: 'AAPL', quantity: '10', averagePrice: '150' },
                { symbol: 'NVDA', quantity: '20', averagePrice: '100' },
                { symbol: 'MSFT', quantity: '1', averagePrice: '400' },
            ],
            3
        );

        expect(picked).toEqual(['NVDA', 'AAPL', 'MSFT']);
    });

    it('원가가 같으면 심볼 순이다', () => {
        expect(
            selectReportSymbols(
                [
                    { symbol: 'TSLA', quantity: '1', averagePrice: '10' },
                    { symbol: 'AMD', quantity: '1', averagePrice: '10' },
                ],
                5
            )
        ).toEqual(['AMD', 'TSLA']);
    });

    it('숫자로 읽을 수 없는 원가는 0으로 친다', () => {
        expect(
            selectReportSymbols(
                [
                    { symbol: 'BAD', quantity: 'x', averagePrice: '10' },
                    { symbol: 'OK', quantity: '1', averagePrice: '1' },
                ],
                5
            )
        ).toEqual(['OK', 'BAD']);
    });
});
