import { describe, expect, it } from 'vitest';
import {
    EMPTY_INDICATOR_RESULT,
    type BarsData,
    type IndicatorResult,
} from '@y0ngha/siglens-core';
import { buildTechnicalFacts } from '../../lib/technicalFacts';
import { keepLastNonNull, toSeedBarsData } from '../../lib/seedBars';

/**
 * seed 축소 계약. 이게 풀리면 RSC 페이로드에 아무도 읽지 않는 지표 약 478KB가
 * 되돌아온다 — 그런데 화면은 멀쩡해서 눈으로는 절대 못 잡는다(클라이언트가 30초 뒤
 * 전체를 다시 받아 덮어쓰기 때문). 그래서 여기서 고정한다.
 */

// rsi·macd는 워밍업 구간이 null이고 뒤로 갈수록 값이 찬다 — 실제 모양을 흉내낸다.
const FULL = {
    // `buildTechnicalFacts`는 MIN_BARS_FOR_FACTS=2 미만이면 null을 반환하고,
    // prev.close === 0이어도 null이다 — 둘 다 피해야 출력 비교가 공허해지지 않는다.
    bars: [
        { time: 1, open: 1, high: 2, low: 0.5, close: 1.5, volume: 100 },
        { time: 2, open: 1.5, high: 2.5, low: 1, close: 2, volume: 120 },
    ],
    indicators: {
        rsi: [null, 1, 2, 3],
        // core의 `calculateMACD`는 signal-EMA 워밍업 구간에서 `macd`만 채우고
        // `signal`·`histogram`은 null로 둔다. 마지막 항목이 바로 그 모양이라,
        // 술어를 `m.macd !== null`로 잘못 잡으면 histogram이 null인 항목을 남겨
        // `lastNonNull(macd.map(m => m.histogram))`이 달라진다 — 이 픽스처가 그걸 잡는다.
        macd: [
            { macd: null, signal: null, histogram: null },
            { macd: 1, signal: 1, histogram: 1 },
            { macd: 2, signal: 2, histogram: 2 },
            { macd: 5, signal: null, histogram: null },
        ],
        buySellVolume: [{ buyVolume: 10, sellVolume: 5 }],
        // 첫 페인트가 읽지 않는 것들 — 전부 떨어져야 한다.
        bollinger: [{ upper: 3, middle: 2, lower: 1 }],
        ichimoku: [{ tenkan: 1, kijun: 2 }],
        supertrend: [{ trend: 1 }],
        dmi: [{ plusDi: 20, minusDi: 10, adx: 15 }],
    },
} as unknown as BarsData;

describe('keepLastNonNull', () => {
    it('undefined는 빈 배열로 정규화한다', () => {
        expect(keepLastNonNull(undefined, v => v !== null)).toEqual([]);
    });

    it('non-null이 없으면 빈 배열', () => {
        expect(keepLastNonNull([null, null], v => v !== null)).toEqual([]);
    });

    it('마지막 non-null부터 끝까지 남긴다 — 후행 null이 위치를 보존한다', () => {
        expect(keepLastNonNull([null, 1, 2, null], v => v !== null)).toEqual([
            2,
            null,
        ]);
    });

    it('술어가 가리키는 마지막 원소를 고른다', () => {
        expect(keepLastNonNull([1, 2, 3, 4], v => v % 2 === 1)).toEqual([3, 4]);
    });
});

describe('toSeedBarsData', () => {
    it('buySellVolume·bars는 원본 참조 그대로 남긴다', () => {
        const seed = toSeedBarsData(FULL);

        // 전 구간을 쓰는 소비자가 있다(거래량 차트·공포탐욕 지수).
        expect(seed.indicators.buySellVolume).toBe(
            FULL.indicators.buySellVolume
        );
        // bars는 축소 대상이 아니다(차트가 501봉 전부 그린다).
        expect(seed.bars).toBe(FULL.bars);
    });

    it('rsi·macd를 접어도 buildTechnicalFacts 출력이 원본과 동일하다', () => {
        // **실제 소비자를 호출한다.** 로컬에 lastNonNull을 재구현하면 tautological이 된다
        // (TESTING.md#TE-10). 이 단언이 이 변경의 안전성 근거 전부다.
        const seed = toSeedBarsData(FULL);

        // rsi는 후행 null이 없어 1개로 접힌다.
        expect(seed.indicators.rsi).toHaveLength(1);
        // macd는 픽스처 마지막이 `{macd:5, signal:null, histogram:null}`(core의 signal-EMA
        // 워밍업 모양)이라 **후행 null이 있다**. `keepLastNonNull`은 `[arr[k]]`가 아니라
        // `slice(k)`를 돌려주므로 그 후행 null까지 남긴다 — 소비 측(tail 정렬)이 배열의
        // 마지막 원소를 마지막 봉으로 보기 때문에, 잘라내면 값이 하루 뒤로 밀린다.
        expect(seed.indicators.macd).toHaveLength(2);
        expect(seed.indicators.macd.at(-1)?.histogram).toBeNull();

        const fromSeed = buildTechnicalFacts(seed.bars, seed.indicators);
        const fromFull = buildTechnicalFacts(
            FULL.bars,
            FULL.indicators as unknown as IndicatorResult
        );
        expect(fromSeed).toEqual(fromFull);
        // 접기가 실제로 값을 보존했는지 직접 확인(둘 다 null이면 위 단언이 공허해진다).
        expect(fromSeed?.rsi).toBe(3);
        expect(fromSeed?.macdHistogram).toBe(2);
    });

    it('지표 키가 아예 없는 응답도 빈 배열로 정규화한다(undefined를 seed에 싣지 않는다)', () => {
        // provider·픽스처가 일부 키를 누락한 객체를 흘려보낸다. undefined를 그대로
        // 통과시키면 소비자(`lastNonNull`, `.map`)가 터질 수 있다.
        const MISSING = {
            bars: FULL.bars,
            indicators: { buySellVolume: FULL.indicators.buySellVolume },
        } as unknown as BarsData;

        const seed = toSeedBarsData(MISSING);

        expect(seed.indicators.rsi).toEqual([]);
        expect(seed.indicators.macd).toEqual([]);
        expect(() => seed.indicators.macd.map(m => m.histogram)).not.toThrow();
    });

    it('buySellVolume이 없는 응답도 빈 배열로 정규화한다(SSR 크래시 방지)', () => {
        // `FearGreedFactsSummary`는 SSR 본문에서 `computeFearGreedIndex(bars, buySellVolume)`를
        // **동기** 호출하고 근처 ErrorBoundary 바깥이라, undefined가 오면 페이지가 죽는다.
        // `useVolumeChartData`도 `buySellVolume.length`를 옵셔널 체이닝 없이 읽는다.
        const NO_BSV = {
            bars: FULL.bars,
            indicators: { rsi: FULL.indicators.rsi },
        } as unknown as BarsData;

        const seed = toSeedBarsData(NO_BSV);

        expect(seed.indicators.buySellVolume).toEqual([]);
    });

    it('워밍업 뒤쪽이 전부 null이면 빈 배열이 되고 lastNonNull은 null로 일치한다', () => {
        const ALL_NULL = {
            ...FULL,
            indicators: {
                ...FULL.indicators,
                rsi: [null, null],
                macd: [{ macd: null, signal: null, histogram: null }],
            },
        } as unknown as BarsData;

        const seed = toSeedBarsData(ALL_NULL);

        expect(seed.indicators.rsi).toEqual([]);
        expect(seed.indicators.macd).toEqual([]);
        const facts = buildTechnicalFacts(seed.bars, seed.indicators);
        expect(facts?.rsi).toBeNull();
        expect(facts?.macdHistogram).toBeNull();
    });

    it('오버레이 전용 지표는 EMPTY_INDICATOR_RESULT의 빈 값으로 대체한다', () => {
        const seed = toSeedBarsData(FULL);

        const shrunk = seed.indicators as unknown as Record<string, unknown>;
        for (const key of ['bollinger', 'ichimoku', 'supertrend', 'dmi']) {
            // 참조만 다른 게 아니라 EMPTY_INDICATOR_RESULT의 빈 값이어야 한다.
            expect(shrunk[key]).toEqual(
                (EMPTY_INDICATOR_RESULT as unknown as Record<string, unknown>)[
                    key
                ]
            );
        }
    });

    it('키는 하나도 빠뜨리지 않는다 — 없는 키를 읽어 터지는 소비자가 없어야 한다', () => {
        const seed = toSeedBarsData(FULL);

        for (const key of Object.keys(EMPTY_INDICATOR_RESULT)) {
            // toHaveProperty는 `{rsi: undefined}`도 통과한다(경로 존재만 확인).
            // undefined가 실려 소비자가 터지는 게 정확히 막으려는 것이라 definedness를 본다.
            expect(
                (seed.indicators as unknown as Record<string, unknown>)[key]
            ).toBeDefined();
        }
    });

    it('fearGreedBars 등 지표 밖 필드는 싣지 않는다', () => {
        const seed = toSeedBarsData({
            ...FULL,
            fearGreedBars: FULL.bars,
        });

        expect(Object.keys(seed).sort()).toEqual(['bars', 'indicators']);
    });
});
