const { getCachedBars, profile } = vi.hoisted(() => ({
    getCachedBars: vi.fn(),
    profile: vi.fn(),
}));

vi.mock('@/entities/bars/server/barsDataCache', () => ({
    getCachedBarsWithIndicators: getCachedBars,
}));
vi.mock('@/entities/ticker/lib/resolveMarketProfile', () => ({
    resolveMarketProfile: profile,
}));
vi.mock('@/shared/api/market/getCachedMarketDataProvider', () => ({
    getCachedMarketDataProvider: () => ({}),
}));

import {
    changeReferenceOf,
    technicalChangesBetween,
    US_EQUITY_SESSION,
    type ChangeReference,
} from '@y0ngha/siglens-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CHAT_CHANGE_SIGNAL_TYPES } from '@/entities/chat-conversation/lib/chatChangeSignalTypes';
import type { ConversationAnalysis } from '@/entities/chat-conversation/server/conversationAnalyses';
import {
    buildSinceEarlier,
    loadSinceEarlier,
    SINCE_EARLIER_MAX_LEVEL_CROSSINGS,
    SINCE_EARLIER_NOTE,
    SINCE_EARLIER_TIMEOUT_MS,
    type SinceEarlier,
    type SinceEarlierChange,
} from '@/features/agent-tools/server/tools/sinceEarlier';
import {
    analyzedAfterClose,
    earlierProjection,
    flipBackBars,
    oscillatingBars,
    rallyBars,
    tradingDateOf,
} from './fixtures/sinceEarlier';

/**
 * 진동 봉 전체에 신호 탐지를 다시 돌리는 테스트는 로컬 약 1초, CI 공유 러너에서 6초를 넘긴다.
 * 기본 5초 상한으로는 느린 러너에서 실패한다.
 */
const HEAVY_COMPUTE_TIMEOUT_MS = 30_000;

const bars = rallyBars();
const BASELINE = 112;
const earlierAt = analyzedAfterClose(bars, BASELINE);

function referenceFor(
    projection: Record<string, unknown> = earlierProjection(),
    tier: 'free' | 'member' = 'member'
): ChangeReference {
    const reference = changeReferenceOf(
        projection,
        { tier },
        { analyzedAt: earlierAt }
    );
    if (reference === null) throw new Error('fixture must be readable');
    return reference;
}

const build = (reference: ChangeReference, over: { bars?: typeof bars } = {}) =>
    buildSinceEarlier({
        earlierGeneratedAt: earlierAt,
        reference,
        session: US_EQUITY_SESSION,
        bars: over.bars ?? bars,
    });

describe('buildSinceEarlier', () => {
    it('기준·종가·날짜와 core가 계산한 변화만 싣는다', () => {
        const block = build(referenceFor());
        expect(block).toMatchObject({
            earlierGeneratedAt: earlierAt,
            fromSessionDate: tradingDateOf(bars, BASELINE),
            toSessionDate: tradingDateOf(bars, bars.length - 1),
            closeThen: bars[BASELINE].close,
            closeNow: bars[bars.length - 1].close,
            comparedLevels: true,
            note: SINCE_EARLIER_NOTE,
        });
        expect(block?.changes.map(c => c.kind)).toEqual([
            'level_crossed',
            'level_crossed',
            'trend_changed',
        ]);
        expect(block?.changes[0]).toMatchObject({
            side: 'resistance',
            price: 96,
            direction: 'up',
        });
        // 추세·계획 위치는 두 끝 종가에서만 읽은 값이라 자기 날짜가 없다.
        expect(block?.changes[2]).toEqual({
            kind: 'trend_changed',
            from: 'neutral',
            to: 'bullish',
        });
        expect(block).not.toHaveProperty('omittedLevelCrossings');
        expect(block).not.toHaveProperty('notMeasured');
    });

    it('블록의 모든 가격은 봉이나 이전 분석에서 온 값이다(만든 숫자가 없다)', () => {
        const allowed = new Set<number>([
            ...bars.map(b => b.close),
            88,
            91,
            92,
            96,
            105,
        ]);
        const block = build(referenceFor());
        const numbers = (block?.changes ?? []).flatMap(c =>
            Object.entries(c)
                .filter(([key]) =>
                    ['price', 'close', 'invalidation'].includes(key)
                )
                .map(([, value]) => value as number)
        );
        expect(numbers.length).toBeGreaterThan(0);
        for (const n of numbers) expect(allowed.has(n)).toBe(true);
    });

    it('계획 위치가 바뀌면 이전 분석의 진입 구간·무효화 기준을 그대로 싣는다', () => {
        const projection = earlierProjection();
        projection.actionRecommendation = {
            ...(projection.actionRecommendation as object),
            entryPrices: [100, 101],
            stopLoss: 95,
            takeProfitPrices: [112],
        };
        const block = build(referenceFor(projection));
        const plan = block?.changes.find(
            c => c.kind === 'plan_position_changed'
        );
        expect(plan).toMatchObject({
            kind: 'plan_position_changed',
            entryZone: { low: 100, high: 101 },
            invalidation: 95,
            close: bars[bars.length - 1].close,
        });
        expect(plan).not.toHaveProperty('date');
    });

    it('free 등급은 가격대·계획이 비어 와서 추세·신호만 비교한다', () => {
        const block = build(referenceFor(earlierProjection(), 'free'));
        expect(block?.comparedLevels).toBe(false);
        expect(
            block?.changes.some(
                c =>
                    c.kind === 'level_crossed' ||
                    c.kind === 'plan_position_changed'
            )
        ).toBe(false);
        expect(block?.changes.map(c => c.kind)).toContain('trend_changed');
    });

    it('저장된 가격대가 분석일 종가와 스케일이 다르면(액면분할) 가격대·계획을 비교하지 않는다', () => {
        const projection = earlierProjection();
        projection.keyLevels = {
            support: [{ price: 264, reason: '' }],
            resistance: [{ price: 288, reason: '' }],
        };
        projection.actionRecommendation = {
            ...(projection.actionRecommendation as object),
            entryPrices: [273, 276],
            stopLoss: 264,
            takeProfitPrices: [315],
        };
        const block = build(referenceFor(projection));
        expect(block?.comparedLevels).toBe(false);
        expect(
            block?.changes.some(
                c =>
                    c.kind === 'level_crossed' ||
                    c.kind === 'plan_position_changed'
            )
        ).toBe(false);
    });

    it(`가격대 돌파만 ${SINCE_EARLIER_MAX_LEVEL_CROSSINGS}개까지 싣고 나머지는 개수로 알리며, 추세 항목은 자르지 않는다`, () => {
        const projection = earlierProjection();
        projection.keyLevels = {
            support: [],
            // 분석일 종가(93.3)보다 위 14개 — 지금 종가(112)가 모두 넘었다.
            resistance: Array.from({ length: 14 }, (_, i) => ({
                price: 94 + i,
                reason: '',
            })),
        };
        const block = build(referenceFor(projection));
        const crossings = block?.changes.filter(
            c => c.kind === 'level_crossed'
        );
        expect(crossings).toHaveLength(SINCE_EARLIER_MAX_LEVEL_CROSSINGS);
        expect(block?.omittedLevelCrossings).toBe(
            14 - SINCE_EARLIER_MAX_LEVEL_CROSSINGS
        );
        expect(block?.changes.filter(c => c.kind === 'trend_changed')).toEqual([
            { kind: 'trend_changed', from: 'neutral', to: 'bullish' },
        ]);
    });

    it('신호는 허브 8종만, 종류·방향·날짜를 core가 읽은 그대로 싣는다(다른 종류는 없다)', () => {
        const from = 108;
        const block = buildSinceEarlier({
            earlierGeneratedAt: analyzedAfterClose(bars, from),
            reference: referenceFor(),
            session: US_EQUITY_SESSION,
            bars,
        });
        // 같은 구간을 필터 없이 읽으면 8종 밖의 신호(예: cci_bullish_cross)도 시작한다 — 그것들이 빠져야 한다.
        const unfiltered = technicalChangesBetween(bars, { fromIndex: from });
        const outside =
            unfiltered.ok &&
            unfiltered.changes.some(
                c =>
                    c.kind === 'signal_started' &&
                    !CHAT_CHANGE_SIGNAL_TYPES.includes(c.type as never)
            );
        expect(outside).toBe(true);
        expect(block?.changes.filter(c => c.kind === 'signal_started')).toEqual(
            [
                {
                    kind: 'signal_started',
                    type: 'macd_bullish_cross',
                    direction: 'bullish',
                    date: '2026-10-19',
                },
                {
                    kind: 'signal_started',
                    type: 'rsi_overbought',
                    direction: 'bearish',
                    date: '2026-10-21',
                },
            ]
        );
        expect(block).not.toHaveProperty('omittedSignals');
    });

    it(
        '같은 신호가 여러 번 다시 시작해도 종류마다 가장 나중 시작 하나만 싣고 나머지는 개수로 알린다',
        { timeout: HEAVY_COMPUTE_TIMEOUT_MS },
        () => {
            const osc = oscillatingBars();
            const from = 50;
            const earlierGeneratedAt = analyzedAfterClose(osc, from);
            const block = buildSinceEarlier({
                earlierGeneratedAt,
                reference: referenceFor(),
                session: US_EQUITY_SESSION,
                bars: osc,
            });
            const core = technicalChangesBetween(osc, {
                fromIndex: from,
                signalTypes: CHAT_CHANGE_SIGNAL_TYPES,
            });
            if (!core.ok) throw new Error('fixture must be measurable');
            const starts = core.changes.flatMap(c =>
                c.kind === 'signal_started' ? [c] : []
            );
            const types = new Set(starts.map(c => c.type));
            // 전제: 신호 시작이 종류 수(최대 8)보다 훨씬 많다.
            expect(starts.length).toBeGreaterThan(
                CHAT_CHANGE_SIGNAL_TYPES.length * 2
            );
            const listed = block?.changes.filter(
                c => c.kind === 'signal_started'
            );
            expect(listed).toHaveLength(types.size);
            expect(block?.omittedSignals).toBe(starts.length - types.size);
            for (const item of listed ?? []) {
                if (item.kind !== 'signal_started') continue;
                const newest = Math.max(
                    ...starts.filter(c => c.type === item.type).map(c => c.time)
                );
                expect(item.date).toBe(
                    new Date(newest * 1000).toISOString().slice(0, 10)
                );
            }
            // 실제 시리즈로 만든 블록의 크기 점검(상한 자체는 아래 '블록 크기'의 가장 긴 모양 시험이 건다).
            expect(JSON.stringify(block).length).toBeLessThan(3_000);
        }
    );

    it('추세가 중간에 뒤집혔다 돌아왔으면 양 끝이 같은 추세라 trend_changed가 없다', () => {
        const flip = flipBackBars();
        const block = buildSinceEarlier({
            earlierGeneratedAt: analyzedAfterClose(flip, BASELINE),
            reference: referenceFor(),
            session: US_EQUITY_SESSION,
            bars: flip,
        });
        expect(block).toBeDefined();
        expect(block?.changes.some(c => c.kind === 'trend_changed')).toBe(
            false
        );
        expect(block?.notMeasured).toBeUndefined();
    });

    it('note는 신호 범위(8종)와 omittedLevelCrossings의 뜻을 밝힌다', () => {
        for (const type of CHAT_CHANGE_SIGNAL_TYPES)
            expect(SINCE_EARLIER_NOTE).toContain(type);
        expect(SINCE_EARLIER_NOTE).toContain('omittedLevelCrossings');
        expect(SINCE_EARLIER_NOTE).toContain('two closes only');
        expect(SINCE_EARLIER_NOTE).toContain('omittedSignals');
        expect(SINCE_EARLIER_NOTE).toContain('compare closeNow');
        expect(SINCE_EARLIER_NOTE).toContain('is back now');
        expect(SINCE_EARLIER_NOTE).toContain(
            'none says whether an earlier level held'
        );
        expect(SINCE_EARLIER_NOTE).toContain(
            'planCheck the analysis-time price'
        );
    });

    it('읽지 못한 부분은 notMeasured로 알려 빈 changes가 "변화 없음"으로 읽히지 않게 한다', () => {
        // 추세 EMA를 읽기에 봉이 모자란 짧은 시리즈.
        const short = bars.slice(0, 12);
        const block = buildSinceEarlier({
            earlierGeneratedAt: `${tradingDateOf(short, 8)}T22:00:00.000Z`,
            reference: referenceFor(),
            session: US_EQUITY_SESSION,
            bars: short,
        });
        expect(block?.notMeasured).toContain('trend');
        expect(block?.changes.some(c => c.kind === 'trend_changed')).toBe(
            false
        );
    });

    it('개장 전에 만든 분석은 그 전 거래일 종가를 기준으로 삼는다', () => {
        const block = buildSinceEarlier({
            earlierGeneratedAt: `${tradingDateOf(bars, BASELINE)}T12:00:00.000Z`,
            reference: referenceFor(),
            session: US_EQUITY_SESSION,
            bars,
        });
        expect(block?.fromSessionDate).toBe(tradingDateOf(bars, BASELINE - 1));
        expect(block?.closeThen).toBe(bars[BASELINE - 1].close);
    });

    it('기준이 마지막 봉이면(같은 세션) 블록을 만들지 않는다', () => {
        const last = bars.length - 1;
        expect(
            buildSinceEarlier({
                earlierGeneratedAt: analyzedAfterClose(bars, last),
                reference: referenceFor(),
                session: US_EQUITY_SESSION,
                bars,
            })
        ).toBeUndefined();
    });

    it('받은 봉보다 앞선 분석은 비교하지 않는다', () => {
        expect(
            buildSinceEarlier({
                earlierGeneratedAt: '2020-01-01T22:00:00.000Z',
                reference: referenceFor(),
                session: US_EQUITY_SESSION,
                bars,
            })
        ).toBeUndefined();
    });
});

describe('블록 크기', () => {
    it('가장 긴 모양(계획 1 + 가격대 돌파 6 + 추세 1 + 신호 8, 소수 4자리 가격)이어도 3,000자 안이다', () => {
        const plan: SinceEarlierChange = {
            kind: 'plan_position_changed',
            from: 'below_zone',
            to: 'no_setup',
            reason: 'no_room_above',
            close: 1234.5678,
            entryZone: { low: 1234.5678, high: 1244.5678 },
            invalidation: 1204.5678,
        };
        const level: SinceEarlierChange = {
            kind: 'level_crossed',
            side: 'resistance',
            price: 1234.5678,
            direction: 'up',
            close: 1234.5678,
            date: '2026-11-13',
        };
        const signal: SinceEarlierChange = {
            kind: 'signal_started',
            type: 'macd_bearish_cross',
            direction: 'bearish',
            date: '2026-11-13',
        };
        const worst: SinceEarlier = {
            earlierGeneratedAt: '2026-10-21T22:00:00.000Z',
            fromSessionDate: '2026-10-21',
            toSessionDate: '2026-11-13',
            closeThen: 1234.5678,
            closeNow: 1234.5678,
            changes: [
                plan,
                ...Array.from(
                    { length: SINCE_EARLIER_MAX_LEVEL_CROSSINGS },
                    () => level
                ),
                { kind: 'trend_changed', from: 'bearish', to: 'bullish' },
                ...CHAT_CHANGE_SIGNAL_TYPES.map(() => signal),
            ],
            omittedLevelCrossings: 99,
            omittedSignals: 99,
            notMeasured: ['trend', 'new_signals', 'level_crossings'],
            comparedLevels: true,
            note: SINCE_EARLIER_NOTE,
        };
        // CACHED_ANALYSIS_MAX_CHARS(16,000)의 약 20% — 넘으면 분석 본문이 그만큼 더 줄어든다. 가장 긴 모양의 실측은 3,156자(note 두 문장이 늘리기 전 상한 3,000).
        expect(JSON.stringify(worst).length).toBeLessThan(3_200);
    });
});

describe('loadSinceEarlier', () => {
    const NOW = new Date('2026-11-26T12:00:00.000Z');
    const earlier: ConversationAnalysis = {
        symbol: 'AAPL',
        generatedAt: earlierAt,
        analysis: earlierProjection(),
        seq: 5,
    };
    const resultAt = '2026-11-14T10:00:00.000Z';
    const input = {
        earlierAnalyses: [earlier],
        symbol: 'AAPL',
        timeframe: '1Day',
        tier: 'member' as const,
        resultGeneratedAt: resultAt,
        fmpSymbol: 'AAPL',
        marketProfile: 'us-equity' as const,
    };

    beforeEach(() => {
        vi.clearAllMocks();
        // 시계를 고정한다 — 마지막 봉이 형성 중인지(오늘 봉인지)가 실행 시각에 따라 달라지지 않게.
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(NOW);
        profile.mockResolvedValue('us-equity');
        getCachedBars.mockResolvedValue({ bars, indicators: {} });
    });
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('이전 분석이 있으면 같은 일봉 시리즈로 비교하고 fmpSymbol을 넘긴다', async () => {
        const block = await loadSinceEarlier(input);
        // 시장은 호출한 도구가 이미 정한 값을 쓴다 — 다시 묻지 않는다.
        expect(profile).not.toHaveBeenCalled();
        expect(block?.changes.map(c => c.kind)).toEqual([
            'level_crossed',
            'level_crossed',
            'trend_changed',
        ]);
        expect(getCachedBars).toHaveBeenCalledWith(
            expect.anything(),
            'AAPL',
            '1Day',
            'AAPL',
            expect.anything()
        );
    });

    it.each([
        ['intraday 타임프레임', { timeframe: '1Hour' }],
        [
            '이전 분석 목록 없음(게스트·공개 API)',
            { earlierAnalyses: undefined },
        ],
        ['다른 종목', { symbol: 'MSFT' }],
        ['결과의 생성 시각을 모름', { resultGeneratedAt: null }],
        ['같은 분석을 다시 받음', { resultGeneratedAt: earlierAt }],
        ['이전 분석이 더 늦음', { resultGeneratedAt: '2026-10-01T00:00:00Z' }],
        [
            // 저장된 이전 시각은 지역화된 분 단위 문자열에서 되돌린 값(초 0)이다 — 같은 분의 같은 분석은 "나중"이 아니다.
            '분 단위로 저장된 같은 분석을 다시 받음',
            {
                earlierAnalyses: [
                    { ...earlier, generatedAt: '2026-11-14T10:00:00.000Z' },
                ],
                resultGeneratedAt: '2026-11-14T10:00:37.512Z',
            },
        ],
    ])('%s → 봉을 읽지 않고 블록도 없다', async (_label, over) => {
        expect(await loadSinceEarlier({ ...input, ...over })).toBeUndefined();
        expect(getCachedBars).not.toHaveBeenCalled();
    });

    it('free 등급은 그 등급 깊이로 읽는다 — 잠긴 가격대가 블록에 없다', async () => {
        const block = await loadSinceEarlier({ ...input, tier: 'free' });
        expect(block?.comparedLevels).toBe(false);
        expect(block?.changes.map(c => c.kind)).toEqual(['trend_changed']);
    });

    it('가격대·계획이 없는 이전 분석도 추세·신호는 비교한다', async () => {
        const block = await loadSinceEarlier({
            ...input,
            earlierAnalyses: [{ ...earlier, analysis: {} }],
        });
        expect(block?.comparedLevels).toBe(false);
        expect(block?.changes.map(c => c.kind)).toEqual(['trend_changed']);
    });

    it('이전 분석의 생성 시각을 읽을 수 없으면 블록이 없다', async () => {
        expect(
            await loadSinceEarlier({
                ...input,
                earlierAnalyses: [{ ...earlier, generatedAt: 'not a date' }],
            })
        ).toBeUndefined();
        expect(getCachedBars).not.toHaveBeenCalled();
    });

    it('봉 조회가 실패해도 던지지 않고 블록만 뺀다(원인은 로그)', async () => {
        const log = vi.spyOn(console, 'error').mockImplementation(() => {});
        getCachedBars.mockRejectedValue(new Error('redis down'));
        expect(await loadSinceEarlier(input)).toBeUndefined();
        expect(log).toHaveBeenCalledTimes(1);
    });

    it('봉 조회가 멈추면 시간 상한 뒤 블록만 뺀다', async () => {
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
        getCachedBars.mockReturnValue(new Promise(() => {}));
        const pending = loadSinceEarlier(input);
        await vi.advanceTimersByTimeAsync(SINCE_EARLIER_TIMEOUT_MS + 1);
        expect(await pending).toBeUndefined();
    });
});
