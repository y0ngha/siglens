vi.mock('@/shared/api/fmp/httpClient');

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { fmpGet } from '@/shared/api/fmp/httpClient';
import {
    fetchDailyCloses,
    lastPublishedSessionDate,
    lookbackStartDate,
} from '../../lib/fetchDailyCloses';
import { MARKET_FEAR_GREED_LOOKBACK_DAYS } from '../../lib/marketFearGreedSymbols';

const mockFmpGet = vi.mocked(fmpGet);

describe('fetchDailyCloses', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('historical-price-eod/light 엔드포인트를 symbol/from/to 쿼리로 호출한다', async () => {
        mockFmpGet.mockResolvedValue([{ date: '2024-01-02', price: 100 }]);

        await fetchDailyCloses('SPY', '2024-01-01', '2024-01-31');

        expect(mockFmpGet).toHaveBeenCalledWith('historical-price-eod/light', {
            symbol: 'SPY',
            from: '2024-01-01',
            to: '2024-01-31',
        });
    });

    it('row의 price를 close로 매핑한다', async () => {
        mockFmpGet.mockResolvedValue([{ date: '2024-01-02', price: 101.5 }]);

        const result = await fetchDailyCloses(
            'SPY',
            '2024-01-01',
            '2024-01-31'
        );

        expect(result).toEqual([{ date: '2024-01-02', close: 101.5 }]);
    });

    it('date가 문자열이 아니거나 없는 row는 드롭한다', async () => {
        mockFmpGet.mockResolvedValue([
            { date: 20240102, price: 101.5 }, // date가 숫자
            { price: 100 }, // date 자체가 없음
            { date: '2024-01-03', price: 100 },
        ]);

        const result = await fetchDailyCloses(
            'SPY',
            '2024-01-01',
            '2024-01-31'
        );

        expect(result).toEqual([{ date: '2024-01-03', close: 100 }]);
    });

    it('price가 없거나(undefined) 숫자로 변환 불가능한 row는 드롭한다', async () => {
        mockFmpGet.mockResolvedValue([
            { date: '2024-01-02' }, // price 키 자체가 없음 → undefined
            { date: '2024-01-03', price: 'n/a' }, // Number('n/a') = NaN
            { date: '2024-01-04', price: 100 },
        ]);

        const result = await fetchDailyCloses(
            'SPY',
            '2024-01-01',
            '2024-01-31'
        );

        expect(result).toEqual([{ date: '2024-01-04', close: 100 }]);
    });

    // `Number(null) === 0`은 유한값이라, 강제 변환 후 `Number.isFinite`만 보는
    // 가드는 명시적 null을 close: 0으로 통과시킨다. 구현이 `typeof === 'number'`와
    // `> 0`을 함께 보는 이유가 이것 — 그 가드가 풀리면 이 테스트가 깨진다.
    //
    // 이제 usable close가 0개이면 빈 배열이 아니라 reject하므로, 각 값이 실제로
    // "드롭"되는지는 남는 유효 row(2024-01-05)가 살아남는지로, "전부 드롭되면
    // reject"는 별도 테스트로 확인한다.
    it.each([null, undefined, '100', Number.NaN, 0, -5])(
        'price가 %p인 row는 드롭되고, 함께 온 유효 row만 남는다',
        async price => {
            mockFmpGet.mockResolvedValue([
                { date: '2024-01-02', price },
                { date: '2024-01-05', price: 100 },
            ]);

            const result = await fetchDailyCloses(
                'SPY',
                '2024-01-01',
                '2024-01-31'
            );

            expect(result).toEqual([{ date: '2024-01-05', close: 100 }]);
        }
    );

    it('E2E 모드에서는 FMP를 호출하지 않고 결정적 fixture를 반환한다', async () => {
        vi.stubEnv('E2E_TEST', '1');

        const result = await fetchDailyCloses(
            'SPY',
            '2024-01-01',
            '2024-01-31'
        );

        expect(mockFmpGet).not.toHaveBeenCalled();
        expect(result.length).toBeGreaterThan(185);
        expect(result).toEqual(
            await fetchDailyCloses('SPY', '2024-01-01', '2024-01-31')
        );

        vi.unstubAllEnvs();
    });

    // FMP는 알 수 없는/상장폐지 심볼에 에러가 아니라 `200 []`로 답한다. 이를
    // 조용히 흡수해 빈 배열을 반환하면 날짜 inner-join이 비어 "표본이
    // 부족합니다"로 보이고, 업스트림 장애가 정상적인 워밍업 메시지로 위장한다.
    it('FMP가 200 []을 응답하면 reject한다', async () => {
        mockFmpGet.mockResolvedValue([]);

        await expect(
            fetchDailyCloses('SPY', '2024-01-01', '2024-01-31')
        ).rejects.toThrow(
            '[marketFearGreed] no usable closes for SPY (2024-01-01..2024-01-31)'
        );
    });

    it('응답이 배열이 아니면 reject한다', async () => {
        mockFmpGet.mockResolvedValue({ error: 'not an array' });

        await expect(
            fetchDailyCloses('SPY', '2024-01-01', '2024-01-31')
        ).rejects.toThrow('[marketFearGreed] no usable closes for SPY');
    });

    it('모든 row가 price 가드를 통과하지 못하면(usable close 0개) reject한다', async () => {
        mockFmpGet.mockResolvedValue([
            { date: '2024-01-02', price: null },
            { date: '2024-01-03', price: 'n/a' },
            { date: 20240104, price: 100 }, // date가 숫자라 애초에 드롭
        ]);

        await expect(
            fetchDailyCloses('SPY', '2024-01-01', '2024-01-31')
        ).rejects.toThrow(
            '[marketFearGreed] no usable closes for SPY (2024-01-01..2024-01-31)'
        );
    });

    it('fmpGet이 reject하면 흡수하지 않고 그대로 전파한다', async () => {
        mockFmpGet.mockRejectedValue(new Error('FMP down'));

        await expect(
            fetchDailyCloses('SPY', '2024-01-01', '2024-01-31')
        ).rejects.toThrow('FMP down');
    });
});

describe('lookbackStartDate', () => {
    it(`고정 시각 기준 MARKET_FEAR_GREED_LOOKBACK_DAYS(${MARKET_FEAR_GREED_LOOKBACK_DAYS})일 전 ISO 날짜를 반환한다`, () => {
        const now = new Date('2026-08-15T00:00:00Z');

        // 2026-08-15 - 1095일 = 2023-08-16 (실제 clock을 쓰지 않고 고정 시각으로 계산).
        expect(lookbackStartDate(now)).toBe('2023-08-16');
    });
});

// `lastPublishedSessionDate`는 `lastClosedSessionDateEt`의 얇은 wrapper.
// 아래 고정 시각들은 src/shared/lib/__tests__/marketSessionDate.test.ts의
// `lastClosedSessionDateEt — DST-aware key boundary` 스위트에서 이미 검증된
// 값과 동일하다(마감=16:00 ET + 발행버퍼 4h → 20:00 ET에만 롤오버) — 여기서
// 새로 추측하지 않고 그 근거를 그대로 재사용한다.
describe('lastPublishedSessionDate', () => {
    it('평일 장중(2026-07-13 Mon 13:40 UTC = 09:40 EDT)에는 당일을 반환하지 않는다', () => {
        const result = lastPublishedSessionDate(
            new Date('2026-07-13T13:40:00Z')
        );

        expect(result).not.toBe('2026-07-13');
        expect(result).toBe('2026-07-10'); // 직전 금요일
    });

    it('마감+발행버퍼 이후 평일(2026-07-14 00:30 UTC = 20:30 EDT Mon)에는 당일을 반환한다', () => {
        const result = lastPublishedSessionDate(
            new Date('2026-07-14T00:30:00Z')
        );

        expect(result).toBe('2026-07-13');
    });

    it('토요일에는 직전 금요일을 반환한다', () => {
        const result = lastPublishedSessionDate(
            new Date('2026-07-11T12:00:00Z')
        );

        expect(result).toBe('2026-07-10');
    });
});
