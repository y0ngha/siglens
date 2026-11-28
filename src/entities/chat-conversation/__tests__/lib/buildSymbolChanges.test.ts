import {
    changeReferenceOf,
    TREND_EMA_PERIOD,
    type Bar,
} from '@y0ngha/siglens-core';
import { describe, expect, it } from 'vitest';
import { buildSymbolChanges } from '@/entities/chat-conversation/lib/buildSymbolChanges';
import { CHAT_CHANGE_SIGNAL_TYPES } from '@/entities/chat-conversation/lib/chatChangeSignalTypes';
import { sessionSpecFor } from '@/shared/api/market/sessionSpecFor';
import { SECONDS_PER_DAY } from '@/shared/config/time';

// 2026-01-03 시작이라 index 59가 화요일(2026-03-03), 휴장일 아님.
const START = Date.UTC(2026, 0, 3) / 1000;

/** 일봉은 거래일의 UTC 자정에 찍힌다. 종가 배열로 봉을 만든다(고저 ±1, 거래량 고정). */
function barsFrom(closes: readonly number[]): Bar[] {
    return closes.map((close, i) => ({
        time: START + i * SECONDS_PER_DAY,
        open: close,
        high: close + 1,
        low: close - 1,
        close,
        volume: 1_000,
    }));
}

/** 봉(index)의 거래일 `hourUtc`시(기본 22시 = 미국·한국 모두 마감 뒤)에 분석했다고 본다. */
const analyzedAtBar = (index: number, hourUtc = 22): string =>
    new Date(
        (START + index * SECONDS_PER_DAY + hourUtc * 3600) * 1000
    ).toISOString();

const dateOfBar = (index: number): string =>
    new Date((START + index * SECONDS_PER_DAY) * 1000)
        .toISOString()
        .slice(0, 10);

/** 100에서 시작해 `len`개의 봉이 천천히 오르는 시리즈 — 추세 판정이 읽히는 길이(40봉 이상). */
const flat = (len: number, level = 100): number[] =>
    Array.from({ length: len }, () => level);

const shown = (analysis: Record<string, unknown>, analyzedAt: string) => {
    const reference = changeReferenceOf(analysis, 'as_shown', { analyzedAt });
    if (reference === null) throw new Error('reference expected');
    return reference;
};

const SUPPORT_ANALYSIS = {
    keyLevels: {
        support: [{ price: 95, strength: 'strong', reason: 's' }],
        resistance: [{ price: 120, strength: 'strong', reason: 'r' }],
    },
};

describe('buildSymbolChanges', () => {
    const base = {
        symbol: 'NVDA',
        marketProfile: 'us-equity' as const,
        session: sessionSpecFor('us-equity'),
    };

    it('분석 뒤 종가가 지지선 아래로 내려가면 그 날짜와 가격이 담긴 줄을 만든다', () => {
        const closes = [...flat(60), 94, 93];
        const analyzedAt = analyzedAtBar(59);
        const result = buildSymbolChanges({
            ...base,
            analyzedAt,
            reference: shown(SUPPORT_ANALYSIS, analyzedAt),
            bars: barsFrom(closes),
        });
        expect(result).toMatchObject({
            status: 'changes',
            analyzedDate: dateOfBar(59),
            closeThen: 100,
            closeNow: 93,
            latestDate: dateOfBar(61),
            hasLevels: true,
        });
        expect(result?.status === 'changes' && result.items).toContainEqual({
            kind: 'level',
            side: 'support',
            direction: 'down',
            price: 95,
            close: 94,
            date: dateOfBar(60),
        });
    });

    it('아무것도 달라지지 않았고 전부 읽었으면 빈 목록이다(카드가 "없음"을 말해도 되는 경우)', () => {
        const analyzedAt = analyzedAtBar(59);
        const result = buildSymbolChanges({
            ...base,
            analyzedAt,
            reference: shown(SUPPORT_ANALYSIS, analyzedAt),
            bars: barsFrom([...flat(60), 100]),
        });
        expect(result).toMatchObject({
            status: 'changes',
            items: [],
            trendMeasured: true,
            unreadDays: 0,
            hasLevels: true,
        });
    });

    it('봉이 모자라 추세를 못 읽으면 trendMeasured가 거짓이다(없다고 말하지 못하게)', () => {
        const analyzedAt = analyzedAtBar(10);
        const result = buildSymbolChanges({
            ...base,
            analyzedAt,
            reference: shown(SUPPORT_ANALYSIS, analyzedAt),
            bars: barsFrom([...flat(11), 100]),
        });
        expect(result).toMatchObject({
            status: 'changes',
            items: [],
            trendMeasured: false,
        });
    });

    it('종가를 못 읽은 날이 있으면 unreadDays가 그 수만큼이다', () => {
        const analyzedAt = analyzedAtBar(59);
        const closes = [...flat(60), Number.NaN, 100, 100];
        const result = buildSymbolChanges({
            ...base,
            analyzedAt,
            reference: shown(SUPPORT_ANALYSIS, analyzedAt),
            bars: barsFrom(closes),
        });
        expect(
            result?.status === 'changes' && result.unreadDays
        ).toBeGreaterThan(0);
    });

    it('가격대도 계획도 없는 분석은 hasLevels가 거짓이다', () => {
        const analyzedAt = analyzedAtBar(59);
        const result = buildSymbolChanges({
            ...base,
            analyzedAt,
            reference: shown({ summary: '요약' }, analyzedAt),
            bars: barsFrom([...flat(60), 100]),
        });
        expect(result).toMatchObject({ status: 'changes', hasLevels: false });
    });

    it('분석일이 마지막 봉이면 same_session이다', () => {
        const analyzedAt = analyzedAtBar(59);
        const result = buildSymbolChanges({
            ...base,
            analyzedAt,
            reference: shown(SUPPORT_ANALYSIS, analyzedAt),
            bars: barsFrom(flat(60)),
        });
        expect(result).toMatchObject({ status: 'same_session' });
    });

    it('받은 일봉보다 앞선 분석은 too_old이고 날짜는 분석 시각의 날짜다', () => {
        const result = buildSymbolChanges({
            ...base,
            analyzedAt: '2025-01-05T12:00:00.000Z',
            reference: shown(SUPPORT_ANALYSIS, '2025-01-05T12:00:00.000Z'),
            bars: barsFrom(flat(60)),
        });
        expect(result).toMatchObject({
            status: 'too_old',
            analyzedDate: '2025-01-05',
        });
    });

    it('기준 봉이 250거래일 넘게 뒤이면 too_old이다', () => {
        const analyzedAt = analyzedAtBar(0);
        const result = buildSymbolChanges({
            ...base,
            analyzedAt,
            reference: shown(SUPPORT_ANALYSIS, analyzedAt),
            bars: barsFrom(flat(300)),
        });
        expect(result).toMatchObject({ status: 'too_old' });
    });

    it('봉이 하나도 없으면 null이다(카드에서 뺀다)', () => {
        expect(
            buildSymbolChanges({
                ...base,
                analyzedAt: analyzedAtBar(1),
                reference: shown(SUPPORT_ANALYSIS, analyzedAtBar(1)),
                bars: [],
            })
        ).toBeNull();
    });

    it('신호는 허브 8종만 이름과 일봉 날짜로 담는다', () => {
        const analyzedAt = analyzedAtBar(258);
        const result = buildSymbolChanges({
            ...base,
            analyzedAt,
            reference: shown({ summary: '요약' }, analyzedAt),
            bars: barsFrom([...flat(259), 130]),
        });
        const items = result?.status === 'changes' ? result.items : [];
        expect(items).toContainEqual({
            kind: 'signal',
            type: 'golden_cross',
            date: dateOfBar(259),
        });
        const types = items.flatMap(item =>
            item.kind === 'signal' ? [item.type] : []
        );
        expect(types.length).toBeGreaterThan(0);
        for (const type of types)
            expect(CHAT_CHANGE_SIGNAL_TYPES).toContain(type);
    });

    describe('계획과 추세', () => {
        const PLAN_ANALYSIS = {
            actionRecommendation: {
                positionAnalysis: '',
                entry: '',
                exit: '',
                riskReward: '',
                entryPrices: [98, 102],
                stopLoss: 90,
                takeProfitPrices: [200],
            },
        };

        it('종가가 진입 구간 위로 올라서면 구간 숫자가 담긴 plan 줄을 만든다', () => {
            const analyzedAt = analyzedAtBar(59);
            const result = buildSymbolChanges({
                ...base,
                analyzedAt,
                reference: shown(PLAN_ANALYSIS, analyzedAt),
                bars: barsFrom([...flat(60), 110, 115]),
            });
            expect(result?.status === 'changes' && result.items).toContainEqual(
                {
                    kind: 'plan',
                    position: 'above_zone',
                    zoneLow: 98,
                    zoneHigh: 102,
                    date: dateOfBar(61),
                }
            );
        });

        it('종가가 무효화 기준 이하로 내려가면 plan_stopped 줄에 그 기준이 담긴다', () => {
            const analyzedAt = analyzedAtBar(59);
            const result = buildSymbolChanges({
                ...base,
                analyzedAt,
                reference: shown(PLAN_ANALYSIS, analyzedAt),
                bars: barsFrom([...flat(60), 95, 89]),
            });
            expect(result?.status === 'changes' && result.items).toContainEqual(
                {
                    kind: 'plan_stopped',
                    stop: 90,
                    date: dateOfBar(61),
                }
            );
        });

        it('무효화 기준 아래로 마감했다가 돌아오면 plan_stop_recovered 줄을 만든다', () => {
            const analyzedAt = analyzedAtBar(59);
            const result = buildSymbolChanges({
                ...base,
                analyzedAt,
                reference: shown(PLAN_ANALYSIS, analyzedAt),
                bars: barsFrom([...flat(60), 95, 89, 100]),
            });
            const items = result?.status === 'changes' ? result.items : [];
            expect(items.filter(i => i.kind === 'plan_stop_recovered')).toEqual(
                [
                    {
                        kind: 'plan_stop_recovered',
                        stop: 90,
                        date: dateOfBar(61),
                        close: 89,
                    },
                ]
            );
            expect(items.some(i => i.kind === 'plan_stopped')).toBe(false);
        });

        it('분석 시점에 이미 무효화 기준 이하였다가 위로 올라선 경우는 plan_stop_recovered를 만들지 않는다', () => {
            const analyzedAt = analyzedAtBar(59);
            const result = buildSymbolChanges({
                ...base,
                analyzedAt,
                reference: shown(PLAN_ANALYSIS, analyzedAt),
                bars: barsFrom([...flat(60, 85), 95]),
            });
            expect(
                result?.status === 'changes' &&
                    result.items.some(i => i.kind === 'plan_stop_recovered')
            ).toBe(false);
        });

        it('지금도 기준 아래면 plan_stopped만 말하고 plan_stop_recovered는 없다', () => {
            const analyzedAt = analyzedAtBar(59);
            const result = buildSymbolChanges({
                ...base,
                analyzedAt,
                reference: shown(PLAN_ANALYSIS, analyzedAt),
                bars: barsFrom([...flat(60), 95, 89]),
            });
            expect(
                result?.status === 'changes' &&
                    result.items.some(i => i.kind === 'plan_stop_recovered')
            ).toBe(false);
        });

        it('추세 판정이 바뀌면 마지막 종가의 날짜로 trend 줄을 만든다', () => {
            const analyzedAt = analyzedAtBar(59);
            const rising = Array.from(
                { length: 25 },
                (_, i) => 100 + (i + 1) * 3
            );
            const result = buildSymbolChanges({
                ...base,
                analyzedAt,
                reference: shown({ summary: '요약' }, analyzedAt),
                bars: barsFrom([...flat(60), ...rising]),
            });
            expect(result?.status === 'changes' && result.items).toContainEqual(
                {
                    kind: 'trend',
                    from: 'neutral',
                    to: 'bullish',
                    date: dateOfBar(84),
                }
            );
            expect(result).toMatchObject({ trendEmaPeriod: TREND_EMA_PERIOD });
        });
    });

    describe('가격 스케일 가드(액면분할)', () => {
        const analyzedAt = analyzedAtBar(59);
        const run = (closes: number[], analysis: Record<string, unknown>) =>
            buildSymbolChanges({
                ...base,
                analyzedAt,
                reference: shown(analysis, analyzedAt),
                bars: barsFrom(closes),
            });

        it('가격대가 분석일 종가와 같은 스케일이면 가격대 줄을 만든다', () => {
            const result = run([...flat(60), 94], SUPPORT_ANALYSIS);
            expect(result?.status === 'changes' && result.items).toContainEqual(
                expect.objectContaining({ kind: 'level', side: 'support' })
            );
        });

        it.each([
            [59, false],
            [61, true],
            [166, true],
            [168, false],
        ])(
            '경계: 가격대 하나가 종가의 %s%%이면 가격대를 쓴다 = %s',
            (price, kept) => {
                const result = run([...flat(60), 94], {
                    keyLevels: {
                        support: [{ price, strength: 'strong', reason: 's' }],
                        resistance: [],
                    },
                });
                expect(result).toMatchObject({ hasLevels: kept });
            }
        );

        it('가격대 중앙값이 종가의 0.6배 미만이면 가격대·계획 줄을 빼고 hasLevels를 거짓으로 둔다', () => {
            // 저장된 가격대는 분할 전 값(1/4), 봉은 분할 보정된 값.
            const result = run([...flat(60), 94], {
                keyLevels: {
                    support: [{ price: 24, strength: 'strong', reason: 's' }],
                    resistance: [
                        { price: 30, strength: 'strong', reason: 'r' },
                    ],
                },
            });
            expect(result).toMatchObject({
                status: 'changes',
                hasLevels: false,
            });
            expect(
                result?.status === 'changes' &&
                    result.items.some(i => i.kind === 'level')
            ).toBe(false);
        });

        it('가격대 중앙값이 종가의 1.67배를 넘으면(병합) 마찬가지로 뺀다', () => {
            const result = run([...flat(60), 94], {
                keyLevels: {
                    support: [{ price: 380, strength: 'strong', reason: 's' }],
                    resistance: [
                        { price: 420, strength: 'strong', reason: 'r' },
                    ],
                },
            });
            expect(result).toMatchObject({ hasLevels: false });
        });

        it('계획 가격도 같은 기준으로 뺀다', () => {
            const result = run([...flat(60), 130], {
                actionRecommendation: {
                    positionAnalysis: '',
                    entry: '',
                    exit: '',
                    riskReward: '',
                    entryPrices: [24, 26],
                    stopLoss: 22,
                    takeProfitPrices: [50],
                },
            });
            expect(
                result?.status === 'changes' &&
                    result.items.some(
                        i => i.kind === 'plan' || i.kind === 'plan_stopped'
                    )
            ).toBe(false);
            expect(result).toMatchObject({ hasLevels: false });
        });

        it('가드가 가격대를 비워도 추세 줄은 남는다', () => {
            const rising = Array.from(
                { length: 25 },
                (_, i) => 100 + (i + 1) * 3
            );
            const result = run([...flat(60), ...rising], {
                keyLevels: {
                    support: [{ price: 24, strength: 'strong', reason: 's' }],
                    resistance: [],
                },
            });
            expect(result?.status === 'changes' && result.items).toContainEqual(
                expect.objectContaining({ kind: 'trend', to: 'bullish' })
            );
        });
    });

    describe('기준 봉은 분석 시각에 이미 마감돼 있던 거래일이다', () => {
        const closes = [...flat(61), 94];
        const run = (analyzedAt: string, profile: 'us-equity' | 'kr-equity') =>
            buildSymbolChanges({
                ...base,
                marketProfile: profile,
                session: sessionSpecFor(profile),
                analyzedAt,
                reference: shown(SUPPORT_ANALYSIS, analyzedAt),
                bars: barsFrom(closes),
            });

        // index 59 = 2026-03-03(화), 58 = 03-02(월).
        it('미국 개장 전(ET 아침) 분석은 전 거래일 봉에 붙는다', () => {
            expect(run(analyzedAtBar(59, 12), 'us-equity')).toMatchObject({
                analyzedDate: dateOfBar(58),
            });
        });

        it('미국 정규장 중 분석도 그날 봉이 아니라 전 거래일 봉에 붙는다', () => {
            expect(run(analyzedAtBar(59, 17), 'us-equity')).toMatchObject({
                analyzedDate: dateOfBar(58),
            });
        });

        it('미국 마감 뒤 분석은 그날 봉에 붙는다', () => {
            expect(run(analyzedAtBar(59, 22), 'us-equity')).toMatchObject({
                analyzedDate: dateOfBar(59),
            });
        });

        it('한국 개장 전·장중(KST)은 전 거래일, 마감 뒤는 그날 봉이다', () => {
            // index 60 = 03-04(수). 00:30Z = 09:30 KST 장중, 05:00Z = 14:00 KST 장중, 08:00Z = 17:00 KST 마감 뒤.
            expect(run(analyzedAtBar(60, 0.5), 'kr-equity')).toMatchObject({
                analyzedDate: dateOfBar(59),
            });
            expect(run(analyzedAtBar(60, 5), 'kr-equity')).toMatchObject({
                analyzedDate: dateOfBar(59),
            });
            expect(run(analyzedAtBar(60, 8), 'kr-equity')).toMatchObject({
                analyzedDate: dateOfBar(60),
            });
        });

        it('같은 시각이라도 한국 마감 뒤(08Z)는 미국에서는 아직 개장 전이다', () => {
            expect(run(analyzedAtBar(59, 8), 'us-equity')).toMatchObject({
                analyzedDate: dateOfBar(58),
            });
        });

        it('주말 분석은 금요일 봉에 붙는다', () => {
            // index 57 = 03-01(일), 55 = 02-27(금).
            expect(run(analyzedAtBar(57, 12), 'us-equity')).toMatchObject({
                analyzedDate: dateOfBar(55),
            });
        });
    });
});
