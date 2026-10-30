import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQuantize, mockShortenRevalidate, memoStores } = vi.hoisted(() => ({
    mockQuantize: vi.fn(),
    mockShortenRevalidate: vi.fn(async () => undefined),
    // React.cache는 서버 렌더 컨텍스트 밖에서는 메모이즈하지 않는다 — 요청 스코프 메모를
    // 인자 키 Map으로 흉내 내고, 테스트마다 비운다.
    memoStores: [] as Map<string, unknown>[],
}));
vi.mock('react', async importOriginal => ({
    ...(await importOriginal<typeof import('react')>()),
    cache: <A extends unknown[], R>(fn: (...args: A) => R) => {
        const store = new Map<string, unknown>();
        memoStores.push(store);
        return (...args: A): R => {
            const key = JSON.stringify(args);
            if (!store.has(key)) store.set(key, fn(...args));
            return store.get(key) as R;
        };
    },
}));
import type { BarsData } from '@y0ngha/siglens-core';

vi.mock('next/cache', () => ({
    unstable_cache: (fn: (...a: unknown[]) => unknown) => fn, // identity로 통과 검증
}));
vi.mock('@/shared/cache/buildDegradedRevalidate', () => ({
    shortenRevalidateForRuntimeDegrade: mockShortenRevalidate,
}));
vi.mock('@/entities/bars/server/loadBarsData', () => ({
    loadBarsData: vi.fn(),
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
} from '@/entities/bars/server/barsStaticCache';
import { loadBarsData } from '@/entities/bars/server/loadBarsData';

const mockBars = vi.mocked(loadBarsData);

beforeEach(() => {
    for (const store of memoStores) store.clear();
});

describe('getBarsStatic', () => {
    beforeEach(() => vi.clearAllMocks());

    // 2026-10-05: 빈 봉·실패를 장기 캐시에 넣지 않는다 — 콜백 안에서 throw, 바깥에서 구분 처리.
    describe('빈 봉·실패 (장기 캐시에 넣지 않는다)', () => {
        const EMPTY = { bars: [], indicators: {} } as unknown as BarsData;

        it('봉이 0개면 에러가 아니라 빈 BarsData를 돌려준다 — 호출부가 no-price-data로 판정하게', async () => {
            mockBars.mockResolvedValue(EMPTY);

            await expect(getBarsStatic('AAPL', '1Day')).resolves.toBe(EMPTY);
        });

        it('빈 결과도 큐레이션 종목이면 revalidate를 300초로 낮춘다(장기 캐시에 안 들어가므로 재생성이 다시 읽는다)', async () => {
            mockBars.mockResolvedValue(EMPTY);

            await getBarsStatic('AAPL', '1Day');

            expect(mockShortenRevalidate).toHaveBeenCalledTimes(1);
        });

        it('provider 예외는 그대로 던진다 — degraded 경로(.catch → null)', async () => {
            mockBars.mockRejectedValue(new Error('FMP 402'));

            await expect(getBarsStatic('AAPL', '1Day')).rejects.toThrow(
                'FMP 402'
            );
            expect(mockShortenRevalidate).toHaveBeenCalledTimes(1);
        });

        it('빈 결과와 provider 예외는 서로 다른 결과다(복원 vs 던짐)', async () => {
            mockBars.mockResolvedValueOnce(EMPTY);
            const empty = await getBarsStatic('MSFT', '1Day');
            mockBars.mockRejectedValueOnce(new Error('boom'));
            const failure = await getBarsStatic('MSFT', '1Day').then(
                () => 'resolved',
                () => 'rejected'
            );

            expect(empty.bars).toHaveLength(0);
            expect(failure).toBe('rejected');
        });

        it('롱테일(큐레이션 밖) 실패·빈 결과는 재생성 비용을 쓰지 않는다', async () => {
            mockBars.mockResolvedValueOnce(EMPTY);
            await getBarsStatic('ZZZZQ', '1Day');
            mockBars.mockRejectedValueOnce(new Error('boom'));
            await expect(getBarsStatic('ZZZZQ', '1Day')).rejects.toThrow();

            expect(mockShortenRevalidate).not.toHaveBeenCalled();
        });

        it('Next 제어 흐름 에러(DYNAMIC_SERVER_USAGE)는 degrade 처리 없이 그대로 던진다', async () => {
            mockBars.mockRejectedValue(
                Object.assign(new Error('Dynamic server usage'), {
                    digest: 'DYNAMIC_SERVER_USAGE',
                })
            );

            await expect(getBarsStatic('AAPL', '1Day')).rejects.toThrow(
                'Dynamic server usage'
            );
            expect(mockShortenRevalidate).not.toHaveBeenCalled();
        });

        it('정상 봉이면 degrade 처리를 하지 않는다', async () => {
            mockBars.mockResolvedValue({
                bars: [{ time: 1 }],
                indicators: {},
            } as unknown as BarsData);

            await getBarsStatic('AAPL', '1Day');

            expect(mockShortenRevalidate).not.toHaveBeenCalled();
        });
    });

    it('delegates to loadBarsData with the same args and returns its data', async () => {
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

    it('fmpSymbol 없을 때 loadBarsData을 undefined로 호출하고 캐시 키는 빈 문자열 사용', async () => {
        const data = {
            bars: [{ time: 1 }],
            indicators: {},
        } as unknown as BarsData;
        mockBars.mockResolvedValue(data);

        // fmpSymbol 미제공 — ?? '' 분기 커버리지
        const result = await getBarsStatic('AAPL', '1Day');

        expect(result).toBe(data);
        expect(mockBars).toHaveBeenCalledWith('AAPL', '1Day', undefined);
    });

    it('대소문자 정규화: 소문자 symbol을 대문자로 canonical화해 loadBarsData에 전달 (캐시 키 분기 방지)', async () => {
        const data = {
            bars: [{ time: 1 }],
            indicators: {},
        } as unknown as BarsData;
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

    it('loadBarsData에 대문자 ticker를 위임하고 quantize 결과를 돌려준다', async () => {
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
        mockBars.mockResolvedValue({
            bars: [{ time: 1 }],
            indicators: {},
        } as never);

        await getQuantizedBarsStatic('BTCUSD', '1Day', 'crypto', 'BTCUSD');

        expect(mockQuantize).toHaveBeenCalledWith(
            expect.anything(),
            expect.any(Date),
            { kind: 'always-open' }
        );
    });

    it('us-equity marketProfile → quantize에 정규장 스케줄 세션을 넘긴다', async () => {
        mockBars.mockResolvedValue({
            bars: [{ time: 1 }],
            indicators: {},
        } as never);

        await getQuantizedBarsStatic('AAPL', '1Day', 'us-equity', 'AAPL');

        expect(mockQuantize).toHaveBeenCalledWith(
            expect.anything(),
            expect.any(Date),
            expect.objectContaining({ kind: 'scheduled' })
        );
    });

    it('loadBarsData이 throw하면 그대로 전파한다 (호출부가 catch해 seed를 건너뛴다)', async () => {
        mockBars.mockRejectedValue(new Error('FMP down'));

        await expect(
            getQuantizedBarsStatic('AAPL', '1Day', 'us-equity', 'AAPL')
        ).rejects.toThrow('FMP down');
    });
});

/**
 * 요청 스코프 메모 계약 — layout과 page가 같은 인자로 부르면 로드·quantize는 한 번이고 **같은 객체**를
 * 받는다(Flight 직렬화기가 참조 동일성으로 접는다, `getQuantizedBarsStatic` JSDoc). quantize가
 * 매번 새 객체를 만드는 구현이어도(장중) 메모가 그 참조를 고정해야 한다.
 */
describe('getQuantizedBarsStatic 요청 스코프 메모', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockBars.mockResolvedValue({
            bars: [{ time: 1 }, { time: 2 }],
            indicators: {},
        } as never);
        // 장중 quantize처럼 호출마다 새 객체를 할당한다.
        mockQuantize.mockImplementation((data: BarsData) => ({
            ...data,
            bars: data.bars.slice(0, -1),
        }));
    });

    it('같은 인자로 반복 호출하면 loadBarsData·quantize는 한 번이고 같은 객체를 돌려준다', async () => {
        const first = await getQuantizedBarsStatic(
            'AAPL',
            '1Day',
            'us-equity',
            'AAPL'
        );
        const second = await getQuantizedBarsStatic(
            'AAPL',
            '1Day',
            'us-equity',
            'AAPL'
        );

        expect(second).toBe(first);
        expect(mockBars).toHaveBeenCalledTimes(1);
        expect(mockQuantize).toHaveBeenCalledTimes(1);
    });

    it('인자가 다르면(다른 종목) 따로 계산한다', async () => {
        const aapl = await getQuantizedBarsStatic(
            'AAPL',
            '1Day',
            'us-equity',
            'AAPL'
        );
        const msft = await getQuantizedBarsStatic(
            'MSFT',
            '1Day',
            'us-equity',
            'MSFT'
        );

        expect(msft).not.toBe(aapl);
        expect(mockBars).toHaveBeenCalledTimes(2);
        expect(mockQuantize).toHaveBeenCalledTimes(2);
    });
});
/**
 * seed 축소 규칙 자체는 `lib/seedBars.test.ts`가 고정한다. 여기서는 정적 캐시 → quantize → 축소
 * 배선만 확인한다.
 */
describe('getSeedBarsStatic (RSC seed 축소)', () => {
    beforeEach(() => vi.clearAllMocks());

    const FULL = {
        bars: [
            { time: 1, open: 1, high: 2, low: 0.5, close: 1.5, volume: 100 },
            { time: 2, open: 1.5, high: 2.5, low: 1, close: 2, volume: 120 },
        ],
        indicators: {
            rsi: [null, 1, 2, 3],
            macd: [{ macd: 1, signal: 1, histogram: 1 }],
            buySellVolume: [{ buyVolume: 10, sellVolume: 5 }],
            bollinger: [{ upper: 3, middle: 2, lower: 1 }],
        },
    } as unknown as BarsData;

    it('quantize 결과를 축소해 돌려준다 — rsi는 마지막 값 하나로 접힌다', async () => {
        mockBars.mockResolvedValue(FULL);
        mockQuantize.mockImplementation((d: unknown) => d);

        const seed = await getSeedBarsStatic('AAPL', '1Day', 'us-equity', 'A1');

        expect(seed.indicators.rsi).toEqual([3]);
        expect(seed.indicators.bollinger).toEqual(
            EMPTY_INDICATOR_RESULT.bollinger
        );
    });

    it('quantize를 건너뛰지 않는다 — forming 봉이 seed로 돌아오면 ISR HTML 비결정성이 재발한다', async () => {
        mockBars.mockResolvedValue(FULL);
        mockQuantize.mockImplementation((d: unknown) => d);

        await getSeedBarsStatic('AAPL', '1Day', 'us-equity', 'A1');

        expect(mockQuantize).toHaveBeenCalledTimes(1);
    });

    // 참조 동일성(layout·page 이중 seed가 한 벌로 접히는가)은 여기서 검증할 수 없다 —
    // `React.cache`는 React 렌더 스코프 밖에서 메모이제이션하지 않으므로 vitest에서는
    // 매번 새 객체가 나온다(같은 이유로 getQuantizedBarsStatic도 검증하지 못한다).
    // 프로덕션 빌드에서 확인할 것:
    //   curl -H 'RSC: 1' https://siglens.io/AAPL | grep -o '"buySellVolume"' | wc -l  → 1
});
