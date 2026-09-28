vi.mock('@/shared/api/fmp/httpClient');

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { fmpGet } from '@/shared/api/fmp/httpClient';
import {
    cryptoLookbackStartDate,
    fetchCryptoDailyBars,
    lastClosedUtcDate,
} from '../../lib/fetchCryptoDailyBars';

const mockFmpGet = vi.mocked(fmpGet);

describe('fetchCryptoDailyBars', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('historical-price-eod/full을 symbol/from/to로 호출하고 close·volume을 매핑한다', async () => {
        mockFmpGet.mockResolvedValue([
            { date: '2026-09-24', close: 63_000, volume: 2.5e10, open: 1 },
        ]);

        const bars = await fetchCryptoDailyBars(
            'BTCUSD',
            '2023-09-25',
            '2026-09-24'
        );

        expect(mockFmpGet).toHaveBeenCalledWith('historical-price-eod/full', {
            symbol: 'BTCUSD',
            from: '2023-09-25',
            to: '2026-09-24',
        });
        expect(bars).toEqual([
            { date: '2026-09-24', close: 63_000, volume: 2.5e10 },
        ]);
    });

    it('종가가 쓸 수 없는 행은 버리고, 거래량이 없으면 0으로 둔다', async () => {
        mockFmpGet.mockResolvedValue([
            { date: '2026-09-22', close: null, volume: 5 },
            { date: '2026-09-23', close: 0, volume: 5 },
            { date: '2026-09-24', close: 10, volume: null },
        ]);

        const bars = await fetchCryptoDailyBars('GCUSD', 'a', 'b');

        expect(bars).toEqual([{ date: '2026-09-24', close: 10, volume: 0 }]);
    });

    // FMP는 없는 심볼에 `200 []`로 답한다. 빈 배열을 그대로 돌려주면 inner join이
    // 통째로 비어 "표본 부족" 화면으로 굳고 로그에는 아무것도 안 남는다.
    it('200 []이면 던진다', async () => {
        mockFmpGet.mockResolvedValue([]);

        await expect(fetchCryptoDailyBars('NOPEUSD', 'a', 'b')).rejects.toThrow(
            /no usable bars for NOPEUSD/
        );
    });

    it('배열이 아닌 응답도 던진다', async () => {
        mockFmpGet.mockResolvedValue({ 'Error Message': 'limit' });

        await expect(
            fetchCryptoDailyBars('BTCUSD', 'a', 'b')
        ).rejects.toThrow();
    });

    it('FMP 실패는 그대로 전파한다', async () => {
        mockFmpGet.mockRejectedValue(new Error('FMP 429'));

        await expect(fetchCryptoDailyBars('BTCUSD', 'a', 'b')).rejects.toThrow(
            'FMP 429'
        );
    });
});

describe('fetchCryptoDailyBars — E2E fixture', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('E2E에서는 FMP를 부르지 않고 결정적 fixture를 돌려준다', async () => {
        vi.stubEnv('E2E_TEST', '1');

        const bars = await fetchCryptoDailyBars('BTCUSD', 'a', 'b');

        expect(mockFmpGet).not.toHaveBeenCalled();
        expect(bars.length).toBeGreaterThan(185);
        expect(bars.every(b => b.volume > 0)).toBe(true);
    });
});

describe('조회 창', () => {
    // 진행 중인 날의 행은 실시간 시세를 종가로 싣는다 — 절대 요청하지 않는다.
    it('상한은 어제(UTC)다 — UTC 자정 직후에도 오늘을 포함하지 않는다', () => {
        expect(lastClosedUtcDate(new Date('2026-09-25T00:00:01Z'))).toBe(
            '2026-09-24'
        );
        expect(lastClosedUtcDate(new Date('2026-09-25T23:59:59Z'))).toBe(
            '2026-09-24'
        );
    });

    it('하한은 1095 달력일 전이다', () => {
        expect(cryptoLookbackStartDate(new Date('2026-09-25T12:00:00Z'))).toBe(
            '2023-09-26'
        );
    });
});
