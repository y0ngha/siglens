import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQuantize } = vi.hoisted(() => ({ mockQuantize: vi.fn() }));
import type { BarsData, IndicatorResult } from '@y0ngha/siglens-core';
import { buildTechnicalFacts } from '@/views/symbol/utils/technicalFacts';

vi.mock('next/cache', () => ({
    unstable_cache: (fn: (...a: unknown[]) => unknown) => fn, // identity로 통과 검증
}));
vi.mock('@/entities/bars/actions', () => ({
    getBarsAction: vi.fn(),
}));
vi.mock('@/entities/bars/lib/quantizeBars', () => ({
    quantizeBarsDataToLastClosed: (
        data: unknown,
        now: Date,
        session?: unknown
    ) => mockQuantize(data, now, session),
}));

import { EMPTY_INDICATOR_RESULT } from '@y0ngha/siglens-core';
import {
    getBarsStatic,
    getQuantizedBarsStatic,
    getSeedBarsStatic,
} from '@/entities/bars/lib/barsStaticCache';
import { getBarsAction } from '@/entities/bars/actions';

const mockBars = vi.mocked(getBarsAction);

describe('getBarsStatic', () => {
    beforeEach(() => vi.clearAllMocks());

    it('delegates to getBarsAction with the same args and returns its data', async () => {
        const data = {
            // `buildTechnicalFacts`는 MIN_BARS_FOR_FACTS=2 미만이면 null을 반환하고,
            // prev.close === 0이어도 null이다 — 둘 다 피해야 출력 비교가 공허해지지 않는다.
            bars: [
                {
                    time: 1,
                    open: 1,
                    high: 2,
                    low: 0.5,
                    close: 1.5,
                    volume: 100,
                },
                {
                    time: 2,
                    open: 1.5,
                    high: 2.5,
                    low: 1,
                    close: 2,
                    volume: 120,
                },
            ],
            indicators: {},
        } as unknown as BarsData;
        mockBars.mockResolvedValue(data);

        const result = await getBarsStatic('AAPL', '1Day', 'AAPL');

        expect(result).toBe(data);
        expect(mockBars).toHaveBeenCalledWith('AAPL', '1Day', 'AAPL');
    });

    it('fmpSymbol 없을 때 getBarsAction을 undefined로 호출하고 캐시 키는 빈 문자열 사용', async () => {
        const data = { bars: [], indicators: {} } as unknown as BarsData;
        mockBars.mockResolvedValue(data);

        // fmpSymbol 미제공 — ?? '' 분기 커버리지
        const result = await getBarsStatic('AAPL', '1Day');

        expect(result).toBe(data);
        expect(mockBars).toHaveBeenCalledWith('AAPL', '1Day', undefined);
    });

    it('대소문자 정규화: 소문자 symbol을 대문자로 canonical화해 getBarsAction에 전달 (캐시 키 분기 방지)', async () => {
        const data = { bars: [], indicators: {} } as unknown as BarsData;
        mockBars.mockResolvedValue(data);

        await getBarsStatic('aapl', '1Day', 'aapl');

        // symbol은 대문자화, fmpSymbol(FMP 고유 심볼)은 보존
        expect(mockBars).toHaveBeenCalledWith('AAPL', '1Day', 'aapl');
    });
});

/**
 * `getQuantizedBarsStatic`은 `getBarsStatic` + `quantizeBarsDataToLastClosed`를 한 번에
 * 수행해, layout·page가 **같은 객체**를 받게 하는 것이 존재 이유다(RSC 페이로드에 지표가
 * 두 벌 실리는 회귀 차단). 참조 동일성 자체는 `React.cache`가 서버 렌더 컨텍스트에서만
 * 메모이즈하므로 단위 테스트로 검증할 수 없다 — 프로덕션 빌드 RSC 페이로드에서
 * `"indicators"` 등장 횟수가 1회인지로 확인한다. 여기서는 합성 계약(위임 인자·세션 매핑)을
 * 고정한다.
 */
describe('getQuantizedBarsStatic', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockQuantize.mockImplementation((data: unknown) => data);
    });

    it('getBarsAction에 대문자 ticker를 위임하고 quantize 결과를 돌려준다', async () => {
        const raw = { bars: [{ time: 1 }], indicators: {} } as never;
        const quantized = { bars: [], indicators: {} } as never;
        mockBars.mockResolvedValue(raw);
        mockQuantize.mockReturnValue(quantized);

        const out = await getQuantizedBarsStatic(
            'AAPL',
            '1Day',
            'us-equity',
            'AAPL'
        );

        expect(mockBars).toHaveBeenCalledWith('AAPL', '1Day', 'AAPL');
        expect(out).toBe(quantized);
    });

    it('crypto marketProfile → quantize에 always-open 세션을 넘긴다', async () => {
        mockBars.mockResolvedValue({ bars: [], indicators: {} } as never);

        await getQuantizedBarsStatic('BTCUSD', '1Day', 'crypto', 'BTCUSD');

        expect(mockQuantize).toHaveBeenCalledWith(
            expect.anything(),
            expect.any(Date),
            { kind: 'always-open' }
        );
    });

    it('us-equity marketProfile → quantize에 정규장 스케줄 세션을 넘긴다', async () => {
        mockBars.mockResolvedValue({ bars: [], indicators: {} } as never);

        await getQuantizedBarsStatic('AAPL', '1Day', 'us-equity', 'AAPL');

        expect(mockQuantize).toHaveBeenCalledWith(
            expect.anything(),
            expect.any(Date),
            expect.objectContaining({ kind: 'scheduled' })
        );
    });

    it('getBarsAction이 throw하면 그대로 전파한다 (호출부가 catch해 seed를 건너뛴다)', async () => {
        mockBars.mockRejectedValue(new Error('FMP down'));

        await expect(
            getQuantizedBarsStatic('AAPL', '1Day', 'us-equity', 'AAPL')
        ).rejects.toThrow('FMP down');
    });
});

/**
 * seed 축소 계약. 이게 풀리면 RSC 페이로드에 아무도 읽지 않는 지표 약 478KB가
 * 되돌아온다 — 그런데 화면은 멀쩡해서 눈으로는 절대 못 잡는다(클라이언트가 30초 뒤
 * 전체를 다시 받아 덮어쓰기 때문). 그래서 여기서 고정한다.
 */
describe('getSeedBarsStatic (RSC seed 축소)', () => {
    beforeEach(() => vi.clearAllMocks());

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

    it('buySellVolume·bars는 원본 참조 그대로 남긴다', async () => {
        mockBars.mockResolvedValue(FULL);
        mockQuantize.mockImplementation((d: unknown) => d);

        const seed = await getSeedBarsStatic('AAPL', '1Day', 'us-equity', 'A1');

        // 전 구간을 쓰는 소비자가 있다(거래량 차트·공포탐욕 지수).
        expect(seed.indicators.buySellVolume).toBe(
            FULL.indicators.buySellVolume
        );
        // bars는 축소 대상이 아니다(차트가 501봉 전부 그린다).
        expect(seed.bars).toBe(FULL.bars);
    });

    it('rsi·macd를 접어도 buildTechnicalFacts 출력이 원본과 동일하다', async () => {
        // **실제 소비자를 호출한다.** 로컬에 lastNonNull을 재구현하면 tautological이 된다
        // (MISTAKES.md §13.5). 이 단언이 이 변경의 안전성 근거 전부다.
        mockBars.mockResolvedValue(FULL);
        mockQuantize.mockImplementation((d: unknown) => d);

        const seed = await getSeedBarsStatic('AAPL', '1Day', 'us-equity', 'A1');

        // rsi는 후행 null이 없어 1개로 접힌다.
        expect(seed.indicators.rsi).toHaveLength(1);
        // macd는 픽스처 마지막이 `{macd:5, signal:null, histogram:null}`(core의 signal-EMA
        // 워밍업 모양)이라 **후행 null이 있다**. `keepLastNonNull`은 `[arr[k]]`가 아니라
        // `slice(k)`를 돌려주므로 그 후행 null까지 남긴다 — 소비 측(tail 정렬)이 배열의
        // 마지막 원소를 마지막 봉으로 보기 때문에, 잘라내면 값이 하루 뒤로 밀린다.
        expect(seed.indicators.macd).toHaveLength(2);
        expect(seed.indicators.macd.at(-1)?.histogram).toBeNull();

        // quantize를 건너뛰는 리팩터가 들어오면 forming 봉이 seed로 돌아와
        // ISR HTML 비결정성(write churn)이 재발한다 — 여섯 테스트가 전부 통과하며 지나간다.
        expect(mockQuantize).toHaveBeenCalled();

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

    it('지표 키가 아예 없는 응답도 빈 배열로 정규화한다(undefined를 seed에 싣지 않는다)', async () => {
        // provider·픽스처가 일부 키를 누락한 객체를 흘려보낸다. 이전 구현은 undefined를
        // 그대로 통과시켜 소비자(`lastNonNull`, `.map`)가 터질 수 있었다.
        const MISSING = {
            bars: FULL.bars,
            indicators: { buySellVolume: FULL.indicators.buySellVolume },
        } as unknown as BarsData;
        mockBars.mockResolvedValue(MISSING);
        mockQuantize.mockImplementation((d: unknown) => d);

        const seed = await getSeedBarsStatic('AAPL', '1Day', 'us-equity', 'A1');

        expect(seed.indicators.rsi).toEqual([]);
        expect(seed.indicators.macd).toEqual([]);
        expect(() => seed.indicators.macd.map(m => m.histogram)).not.toThrow();
    });

    it('buySellVolume이 없는 응답도 빈 배열로 정규화한다(SSR 크래시 방지)', async () => {
        // `FearGreedFactsSummary`는 SSR 본문에서 `computeFearGreedIndex(bars, buySellVolume)`를
        // **동기** 호출하고 근처 ErrorBoundary 바깥이라, undefined가 오면 페이지가 죽는다.
        // `useVolumeChartData`도 `buySellVolume.length`를 옵셔널 체이닝 없이 읽는다.
        const NO_BSV = {
            bars: FULL.bars,
            indicators: { rsi: FULL.indicators.rsi },
        } as unknown as BarsData;
        mockBars.mockResolvedValue(NO_BSV);
        mockQuantize.mockImplementation((d: unknown) => d);

        const seed = await getSeedBarsStatic('AAPL', '1Day', 'us-equity', 'A1');

        expect(seed.indicators.buySellVolume).toEqual([]);
        expect(() => seed.indicators.buySellVolume.length).not.toThrow();
    });

    it('워밍업 뒤쪽이 전부 null이면 빈 배열이 되고 lastNonNull은 null로 일치한다', async () => {
        const ALL_NULL = {
            ...FULL,
            indicators: {
                ...FULL.indicators,
                rsi: [null, null],
                macd: [{ macd: null, signal: null, histogram: null }],
            },
        } as unknown as BarsData;
        mockBars.mockResolvedValue(ALL_NULL);
        mockQuantize.mockImplementation((d: unknown) => d);

        const seed = await getSeedBarsStatic('AAPL', '1Day', 'us-equity', 'A1');

        expect(seed.indicators.rsi).toEqual([]);
        expect(seed.indicators.macd).toEqual([]);
        const facts = buildTechnicalFacts(seed.bars, seed.indicators);
        expect(facts?.rsi).toBeNull();
        expect(facts?.macdHistogram).toBeNull();
    });

    it('오버레이 전용 지표는 EMPTY_INDICATOR_RESULT의 빈 값으로 대체한다', async () => {
        mockBars.mockResolvedValue(FULL);
        mockQuantize.mockImplementation((d: unknown) => d);

        const seed = await getSeedBarsStatic('AAPL', '1Day', 'us-equity', 'A1');

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

    it('키는 하나도 빠뜨리지 않는다 — 없는 키를 읽어 터지는 소비자가 없어야 한다', async () => {
        mockBars.mockResolvedValue(FULL);
        mockQuantize.mockImplementation((d: unknown) => d);

        const seed = await getSeedBarsStatic('AAPL', '1Day', 'us-equity', 'A1');

        for (const key of Object.keys(EMPTY_INDICATOR_RESULT)) {
            // toHaveProperty는 `{rsi: undefined}`도 통과한다(경로 존재만 확인).
            // undefined가 실려 소비자가 터지는 게 정확히 막으려는 것이라 definedness를 본다.
            expect(
                (seed.indicators as unknown as Record<string, unknown>)[key]
            ).toBeDefined();
        }
    });

    // 참조 동일성(layout·page 이중 seed가 한 벌로 접히는가)은 여기서 검증할 수 없다 —
    // `React.cache`는 React 렌더 스코프 밖에서 메모이제이션하지 않으므로 vitest에서는
    // 매번 새 객체가 나온다(같은 이유로 getQuantizedBarsStatic도 검증하지 못한다).
    // 프로덕션 빌드에서 확인할 것:
    //   curl -H 'RSC: 1' https://siglens.io/AAPL | grep -o '"buySellVolume"' | wc -l  → 1
});
