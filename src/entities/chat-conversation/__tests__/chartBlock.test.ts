import { describe, expect, it } from 'vitest';
import {
    AGENT_BARS_TIMEFRAMES,
    AGENT_CHART_KINDS,
    AGENT_CHART_PERIODS,
} from '@y0ngha/siglens-core';
import {
    CHAT_ACTION_BLOCK_KINDS,
    CHAT_CHART_MARKET_PROFILES,
    CHAT_CHART_TIMEFRAMES,
    CHAT_COMPARE_PERIODS,
    CHAT_VISUAL_BLOCK_KINDS,
    isActionBlock,
    isChatBlock,
    isChatChartBlock,
    isChatPriceAlertProposalBlock,
    isChatVisualBlock,
    isVisualBlock,
} from '@/entities/chat-conversation/lib/chartBlock';
import { PRICE_ALERT_TOKEN_MAX_LENGTH } from '@/entities/mail-alert/lib/priceAlertProposal';
import { getDescriptor } from '@/shared/config/marketProfile/registry';

const block = {
    version: 1,
    symbol: 'QQQ',
    timeframe: '1Day',
    marketProfile: 'us-equity',
    bars: [{ time: 0, open: 1, high: 1, low: 1, close: 1, volume: 1 }],
    overlays: [],
    overlayColors: {},
    overlayLabels: {},
    analyzedAt: null,
};

describe('isChatChartBlock', () => {
    it('모양·주기·시장이 맞는 블록을 받는다', () => {
        expect(isChatChartBlock(block)).toBe(true);
    });

    it('참고 거리 목록이 없는 옛 블록도 받는다', () => {
        expect(isChatChartBlock(block)).toBe(true);
        expect(
            isChatChartBlock({ ...block, referenceOnlyOverlayKeys: ['p1'] })
        ).toBe(true);
    });

    it.each([
        ['다른 버전', { ...block, version: 2 }],
        [
            '참고 거리 목록이 배열이 아님',
            { ...block, referenceOnlyOverlayKeys: 'p1' },
        ],
        [
            '참고 거리 목록에 문자열이 아닌 값',
            { ...block, referenceOnlyOverlayKeys: [1] },
        ],
        ['모르는 주기', { ...block, timeframe: '2Day' }],
        ['모르는 시장', { ...block, marketProfile: 'jp-equity' }],
        ['빈 봉', { ...block, bars: [] }],
        ['작도 목록 없음', { ...block, overlays: undefined }],
        ['색 맵 없음', { ...block, overlayColors: null }],
        ['null', null],
    ])('%s은 받지 않는다', (_label, value) => {
        expect(isChatChartBlock(value)).toBe(false);
    });
});

describe('차트 블록 값 목록', () => {
    // 클라이언트가 core를 값으로 싣지 않으려고 목록을 옮겨 적었다 — 원본과 같아야 한다.
    it('주기 목록은 core AGENT_BARS_TIMEFRAMES와 같다', () => {
        expect([...CHAT_CHART_TIMEFRAMES]).toEqual([...AGENT_BARS_TIMEFRAMES]);
    });

    it('시각화 종류·비교 기간 목록은 core show_chart와 같다', () => {
        expect([...CHAT_VISUAL_BLOCK_KINDS]).toEqual([...AGENT_CHART_KINDS]);
        expect([...CHAT_COMPARE_PERIODS]).toEqual([...AGENT_CHART_PERIODS]);
    });

    it('시장 목록은 모두 레지스트리에 있는 프로필이다', () => {
        for (const id of CHAT_CHART_MARKET_PROFILES)
            expect(getDescriptor(id)).toBeDefined();
        expect(CHAT_CHART_MARKET_PROFILES).toHaveLength(3);
    });
});

const AS_OF = '2026-11-19T00:00:00.000Z';
const base = { version: 1, asOf: AS_OF };

/** kind별로 정상 블록 하나씩. */
const VISUAL: Record<string, Record<string, unknown>> = {
    compare: {
        ...base,
        kind: 'compare',
        period: '6M',
        series: [
            {
                symbol: 'NVDA',
                points: [
                    [1, 0],
                    [2, 3.2],
                ],
            },
            {
                symbol: 'AMD',
                points: [
                    [1, 0],
                    [2, -1],
                ],
            },
        ],
    },
    financials: {
        ...base,
        kind: 'financials',
        symbol: 'AAPL',
        currency: 'USD',
        quarters: [
            {
                period: '2026 Q2',
                revenue: 1,
                netIncome: 1,
                eps: 1,
                epsActual: null,
                epsEstimated: null,
            },
        ],
    },
    options: {
        ...base,
        kind: 'options',
        symbol: 'TSLA',
        expiry: '2026-12-18',
        underlyingPrice: 100,
        maxPain: null,
        putCallRatio: 0.8,
        strikes: [{ strike: 100, callOI: 1, putOI: 2 }],
    },
    'flows-us': {
        ...base,
        kind: 'flows',
        market: 'us',
        symbol: 'NVDA',
        institutional: [
            {
                period: '2026-06-30',
                complete: true,
                holders: 10,
                netShareChange: -5,
            },
        ],
        insiderNetValue: [],
    },
    'flows-kr': {
        ...base,
        kind: 'flows',
        market: 'kr',
        symbol: '005930.KS',
        days: [
            {
                date: '2026-10-23',
                foreign: 1,
                institution: 2,
                individual: null,
            },
        ],
    },
    portfolio: {
        ...base,
        kind: 'portfolio',
        groups: [
            {
                currency: 'USD',
                holdings: [
                    { symbol: 'A', name: null, weightPct: 100, pnlPct: null },
                ],
            },
        ],
    },
    'heatmap-sectors': {
        ...base,
        kind: 'heatmap',
        scope: 'sectors',
        market: 'us',
        sectors: [{ label: 'IT', changePct: 1 }],
    },
    'heatmap-theme': {
        ...base,
        kind: 'heatmap',
        scope: 'theme',
        theme: 'ai_semis',
        label: 'AI 반도체',
        members: [
            {
                symbol: 'NVDA',
                name: null,
                changePct1d: 1,
                changePct5d: null,
                changePct20d: null,
            },
        ],
    },
    dividends: {
        ...base,
        kind: 'dividends',
        symbol: 'KO',
        currency: 'USD',
        years: [{ year: 2026, amount: 0.5, partial: true }],
    },
};

describe('isChatBlock', () => {
    it('옛 캔들 블록(kind 없음)은 그대로 받는다 — 이미 저장된 행', () => {
        expect(isChatBlock(block)).toBe(true);
        expect(isVisualBlock(block as never)).toBe(false);
    });

    it.each(Object.entries(VISUAL))(
        '시각화 블록 %s을 받는다',
        (_name, value) => {
            expect(isChatBlock(value)).toBe(true);
            expect(isChatVisualBlock(value)).toBe(true);
            expect(isVisualBlock(value as never)).toBe(true);
        }
    );

    it('모르는 kind·버전은 그리지 않는다', () => {
        expect(isChatBlock({ ...VISUAL.dividends, kind: 'treemap' })).toBe(
            false
        );
        expect(isChatBlock({ ...VISUAL.dividends, version: 2 })).toBe(false);
        expect(isChatBlock({ ...VISUAL.dividends, version: undefined })).toBe(
            false
        );
    });

    it('제목용 이름은 없거나(옛 행)·null·문자열만 받는다', () => {
        expect(isChatBlock({ ...VISUAL.dividends, name: '코카콜라' })).toBe(
            true
        );
        expect(isChatBlock({ ...VISUAL.dividends, name: null })).toBe(true);
        expect(isChatBlock({ ...VISUAL.dividends, name: 42 })).toBe(false);
    });

    it('기관 분기의 complete는 없거나(옛 행) boolean만 받는다', () => {
        const withQuarter = (q: Record<string, unknown>) => ({
            ...VISUAL['flows-us'],
            institutional: [{ period: '2026-06-30', holders: 1, ...q }],
        });
        expect(isChatBlock(withQuarter({ netShareChange: 1 }))).toBe(true);
        expect(
            isChatBlock(withQuarter({ netShareChange: 1, complete: false }))
        ).toBe(true);
        expect(
            isChatBlock(withQuarter({ netShareChange: 1, complete: 'no' }))
        ).toBe(false);
    });

    it('kind가 있는 값은 캔들 검사로 통과시키지 않는다', () => {
        expect(isChatBlock({ ...block, kind: 'treemap' })).toBe(false);
    });

    it.each([
        ['compare 기간', { ...VISUAL.compare, period: '2Y' }],
        ['compare 빈 선', { ...VISUAL.compare, series: [] }],
        [
            'compare 점 모양',
            { ...VISUAL.compare, series: [{ symbol: 'A', points: [[1]] }] },
        ],
        [
            'compare NaN',
            {
                ...VISUAL.compare,
                series: [{ symbol: 'A', points: [[1, NaN]] }],
            },
        ],
        ['financials 빈 분기', { ...VISUAL.financials, quarters: [] }],
        ['financials 통화', { ...VISUAL.financials, currency: 1 }],
        ['options 빈 행사가', { ...VISUAL.options, strikes: [] }],
        ['options 가격', { ...VISUAL.options, underlyingPrice: '100' }],
        ['flows 시장', { ...VISUAL['flows-us'], market: 'jp' }],
        ['flows us 둘 다 빔', { ...VISUAL['flows-us'], institutional: [] }],
        ['flows kr 빈 날', { ...VISUAL['flows-kr'], days: [] }],
        ['portfolio 빈 그룹', { ...VISUAL.portfolio, groups: [] }],
        ['heatmap 범위', { ...VISUAL['heatmap-sectors'], scope: 'world' }],
        ['heatmap 시장', { ...VISUAL['heatmap-sectors'], market: 'jp' }],
        ['heatmap 빈 칸', { ...VISUAL['heatmap-theme'], members: [] }],
        ['dividends 빈 연도', { ...VISUAL.dividends, years: [] }],
        [
            'dividends partial',
            { ...VISUAL.dividends, years: [{ year: 2026, amount: 1 }] },
        ],
        ['null', null],
        ['배열', []],
    ])('필드가 틀리면 받지 않는다: %s', (_label, value) => {
        expect(isChatBlock(value)).toBe(false);
    });
});

/** 가격대 알림 제안 카드(`propose_price_alert`) — 차트가 아닌 행동 블록. */
const PROPOSAL_BLOCK = {
    version: 1,
    kind: 'price_alert_proposal',
    token: 'body.signature',
    name: '애플',
    proposal: {
        proposalId: '5b1f7c1e-3d41-4a6a-9a5c-0a3b6f7d9e10',
        subject: 'subject-hash',
        symbol: 'AAPL',
        market: 'us',
        condition: { kind: 'close_below', level: 180 },
        basis: 'price_level',
        analysisAt: null,
        referenceClose: 190,
        quoteAt: null,
        startsAfterSession: '2026-11-24',
        expiresOn: '2026-12-24',
        exp: 1_795_000_000,
    },
};

describe('가격대 알림 제안 블록', () => {
    it('행동 목록과 시각화 목록은 겹치지 않는다', () => {
        for (const kind of CHAT_ACTION_BLOCK_KINDS) {
            expect([...CHAT_VISUAL_BLOCK_KINDS]).not.toContain(kind);
        }
    });

    it('제안 카드는 그릴 수 있는 블록이다', () => {
        expect(isChatPriceAlertProposalBlock(PROPOSAL_BLOCK)).toBe(true);
        expect(isChatBlock(PROPOSAL_BLOCK)).toBe(true);
    });

    it('제안 카드는 시각화 블록이 아니다 — `kind`가 있어도 차트 슬롯으로 가지 않는다', () => {
        expect(isVisualBlock(PROPOSAL_BLOCK as never)).toBe(false);
        expect(isActionBlock(PROPOSAL_BLOCK as never)).toBe(true);
        expect(isChatVisualBlock(PROPOSAL_BLOCK)).toBe(false);
    });

    it('캔들·시각화 블록은 행동 블록이 아니다', () => {
        expect(isActionBlock(block as never)).toBe(false);
        for (const value of Object.values(VISUAL)) {
            expect(isActionBlock(value as never)).toBe(false);
            expect(isVisualBlock(value as never)).toBe(true);
        }
    });

    it('이름은 문자열 또는 null만 받는다', () => {
        expect(isChatBlock({ ...PROPOSAL_BLOCK, name: null })).toBe(true);
        expect(isChatBlock({ ...PROPOSAL_BLOCK, name: 1 })).toBe(false);
        expect(isChatBlock({ ...PROPOSAL_BLOCK, name: undefined })).toBe(false);
    });

    it.each([
        ['다른 버전', { ...PROPOSAL_BLOCK, version: 2 }],
        ['버전 없음', { ...PROPOSAL_BLOCK, version: undefined }],
        ['토큰 없음', { ...PROPOSAL_BLOCK, token: undefined }],
        ['빈 토큰', { ...PROPOSAL_BLOCK, token: '' }],
        [
            '상한을 넘는 토큰',
            {
                ...PROPOSAL_BLOCK,
                token: 'a'.repeat(PRICE_ALERT_TOKEN_MAX_LENGTH + 1),
            },
        ],
        ['제안 없음', { ...PROPOSAL_BLOCK, proposal: undefined }],
        [
            '0 이하 가격',
            {
                ...PROPOSAL_BLOCK,
                proposal: { ...PROPOSAL_BLOCK.proposal, referenceClose: 0 },
            },
        ],
        [
            '실제 없는 날짜',
            {
                ...PROPOSAL_BLOCK,
                proposal: {
                    ...PROPOSAL_BLOCK.proposal,
                    expiresOn: '2026-13-45',
                },
            },
        ],
        [
            '모르는 조건',
            {
                ...PROPOSAL_BLOCK,
                proposal: {
                    ...PROPOSAL_BLOCK.proposal,
                    condition: { kind: 'close_at', level: 1 },
                },
            },
        ],
    ])('%s은 그리지 않는다', (_label, value) => {
        expect(isChatBlock(value)).toBe(false);
        expect(isChatPriceAlertProposalBlock(value)).toBe(false);
    });

    it('모르는 kind는 여전히 그리지 않는다', () => {
        expect(isChatBlock({ ...PROPOSAL_BLOCK, kind: 'order_ticket' })).toBe(
            false
        );
    });
});
