import type {
    ChatCompareBlock,
    ChatDividendsBlock,
    ChatFinancialsBlock,
    ChatFlowsKrBlock,
    ChatFlowsUsBlock,
    ChatHeatmapBlock,
    ChatOptionsBlock,
    ChatPortfolioBlock,
} from '@/entities/chat-conversation/types';

const BASE = { version: 1 as const, asOf: '2026-11-19T15:00:00.000Z' };

export const COMPARE: ChatCompareBlock = {
    ...BASE,
    kind: 'compare',
    period: '6M',
    series: [
        {
            symbol: 'NVDA',
            points: [
                [1_760_000_000, 0],
                [1_760_086_400, 12.3],
            ],
        },
        {
            symbol: 'AMD',
            points: [
                [1_760_000_000, 0],
                [1_760_086_400, -4.5],
            ],
        },
    ],
};

export const FINANCIALS: ChatFinancialsBlock = {
    ...BASE,
    kind: 'financials',
    symbol: 'AAPL',
    currency: 'USD',
    quarters: [
        {
            period: '2026 Q1',
            revenue: 90_000_000_000,
            netIncome: 20_000_000_000,
            eps: 1.2,
            epsActual: 1.3,
            epsEstimated: 1.2,
        },
        {
            period: '2026 Q2',
            revenue: 95_000_000_000,
            netIncome: -1_000_000_000,
            eps: -0.1,
            epsActual: null,
            epsEstimated: null,
        },
    ],
};

export const OPTIONS: ChatOptionsBlock = {
    ...BASE,
    kind: 'options',
    symbol: 'TSLA',
    expiry: '2026-12-18',
    underlyingPrice: 101,
    maxPain: 100,
    putCallRatio: 0.85,
    strikes: [
        { strike: 90, callOI: 1000, putOI: 5000 },
        { strike: 100, callOI: 8000, putOI: 6000 },
        { strike: 110, callOI: 9000, putOI: 500 },
    ],
};

export const FLOWS_US: ChatFlowsUsBlock = {
    ...BASE,
    kind: 'flows',
    market: 'us',
    symbol: 'NVDA',
    institutional: [
        {
            period: '2026-03-31',
            complete: true,
            holders: 5000,
            netShareChange: 12_000_000,
        },
        {
            period: '2026-06-30',
            complete: false,
            holders: 5100,
            netShareChange: -3_000_000,
        },
    ],
    insiderNetValue: [
        { month: '2026-10', value: -2_500_000 },
        { month: '2026-11', value: 400_000 },
    ],
};

export const FLOWS_KR: ChatFlowsKrBlock = {
    ...BASE,
    kind: 'flows',
    market: 'kr',
    symbol: '005930.KS',
    days: [
        {
            date: '2026-10-22',
            foreign: 1_000_000,
            institution: -500_000,
            individual: -400_000,
        },
        {
            date: '2026-10-23',
            foreign: -200_000,
            institution: 300_000,
            individual: null,
        },
    ],
};

export const PORTFOLIO: ChatPortfolioBlock = {
    ...BASE,
    kind: 'portfolio',
    groups: [
        {
            currency: 'USD',
            holdings: [
                { symbol: 'AAPL', name: 'Apple', weightPct: 60, pnlPct: 12.5 },
                { symbol: 'KO', name: null, weightPct: 40, pnlPct: -3 },
            ],
        },
        {
            currency: 'KRW',
            holdings: [
                {
                    symbol: '005930.KS',
                    name: '삼성전자',
                    weightPct: null,
                    pnlPct: null,
                },
            ],
        },
    ],
};

export const HEATMAP_SECTORS: ChatHeatmapBlock = {
    ...BASE,
    kind: 'heatmap',
    scope: 'sectors',
    market: 'us',
    sectors: [
        { label: '기술', changePct: 1.8 },
        { label: '에너지', changePct: -2.1 },
    ],
};

export const HEATMAP_THEME: ChatHeatmapBlock = {
    ...BASE,
    kind: 'heatmap',
    scope: 'theme',
    theme: 'ai_semis',
    label: 'AI 반도체',
    members: [
        {
            symbol: 'AMD',
            name: null,
            changePct1d: -1,
            changePct5d: 2,
            changePct20d: null,
        },
        {
            symbol: 'NVDA',
            name: '엔비디아',
            changePct1d: 3,
            changePct5d: 4,
            changePct20d: 5,
        },
    ],
};

export const DIVIDENDS: ChatDividendsBlock = {
    ...BASE,
    kind: 'dividends',
    symbol: 'KO',
    currency: 'USD',
    years: [
        { year: 2025, amount: 2.0, partial: false },
        { year: 2026, amount: 1.5, partial: true },
    ],
};
