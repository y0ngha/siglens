import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQuantize } = vi.hoisted(() => ({ mockQuantize: vi.fn() }));
import type { BarsData } from '@y0ngha/siglens-core';

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

import {
    getBarsStatic,
    getQuantizedBarsStatic,
} from '@/entities/bars/lib/barsStaticCache';
import { getBarsAction } from '@/entities/bars/actions';

const mockBars = vi.mocked(getBarsAction);

describe('getBarsStatic', () => {
    beforeEach(() => vi.clearAllMocks());

    it('delegates to getBarsAction with the same args and returns its data', async () => {
        const data = {
            bars: [{ time: 1, open: 1, high: 1, low: 1, close: 1, volume: 1 }],
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
