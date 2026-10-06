vi.mock('server-only', () => ({}));

const { mockLoadBarsData, mockResolveMarketProfile } = vi.hoisted(() => ({
    mockLoadBarsData: vi.fn(),
    mockResolveMarketProfile: vi.fn(),
}));

vi.mock('@/entities/bars/lib/loadBarsData', () => ({
    loadBarsData: mockLoadBarsData,
}));
vi.mock('@/entities/ticker/lib/resolveMarketProfile', () => ({
    resolveMarketProfile: mockResolveMarketProfile,
}));

import { EMPTY_INDICATOR_RESULT, type Bar } from '@y0ngha/siglens-core';
import { fetchPageLastClose } from '../lastClose';

function bar(time: number, close: number): Bar {
    return { time, open: close, high: close, low: close, close, volume: 1 };
}

function barsData(...closes: number[]) {
    return {
        bars: closes.map((close, i) => bar(1_790_000_000 + i * 86_400, close)),
        indicators: EMPTY_INDICATOR_RESULT,
    };
}

/** 일 단위로 이어지는 봉 — 마지막 봉이 `lastDate`(UTC 자정)다. */
function barsEndingOn(lastDate: string, ...closes: number[]) {
    const lastSec = Date.parse(`${lastDate}T00:00:00Z`) / 1000;
    return {
        bars: closes.map((close, i) =>
            bar(lastSec - (closes.length - 1 - i) * 86_400, close)
        ),
        indicators: EMPTY_INDICATOR_RESULT,
    };
}

describe('fetchPageLastClose', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useFakeTimers();
        // 월요일 2026-10-05 09:00Z — NYSE(13:30Z 개장 전)·KRX(06:30Z 마감 후) 모두 장 밖.
        vi.setSystemTime(new Date('2026-10-05T09:00:00Z'));
        mockResolveMarketProfile.mockResolvedValue('us-equity');
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    });
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('장이 닫혀 있으면 마지막 봉의 종가를 돌려준다(US)', async () => {
        mockLoadBarsData.mockResolvedValue(barsData(100, 101.5));

        await expect(fetchPageLastClose('aapl', undefined)).resolves.toBe(
            101.5
        );
    });

    it('심볼을 대문자로 정규화해 1Day 봉을 로드하고 fmpSymbol을 넘긴다', async () => {
        mockLoadBarsData.mockResolvedValue(barsData(100));

        await fetchPageLastClose('aapl', 'AAPL.X');

        const call = mockLoadBarsData.mock.calls.find(
            ([symbol]) => symbol === 'AAPL'
        );
        expect(call).toEqual(['AAPL', '1Day', 'AAPL.X']);
        expect(mockResolveMarketProfile).toHaveBeenCalledWith('AAPL');
    });

    it('KR: 장이 닫혀 있으면 마지막 봉의 종가', async () => {
        mockResolveMarketProfile.mockResolvedValue('kr-equity');
        mockLoadBarsData.mockResolvedValue(barsData(70_000, 71_000));

        await expect(fetchPageLastClose('005930.KS', undefined)).resolves.toBe(
            71_000
        );
    });

    it('US 정규장 중이면 형성 중인 마지막 봉을 빼고 직전 완료 봉의 종가를 돌려준다', async () => {
        // 월요일 15:00Z = 11:00 ET(정규장).
        vi.setSystemTime(new Date('2026-10-05T15:00:00Z'));
        mockLoadBarsData.mockResolvedValue(
            barsEndingOn('2026-10-05', 100, 101, 999)
        );

        await expect(fetchPageLastClose('AAPL', undefined)).resolves.toBe(101);
    });

    it('KR 정규장 중이면 형성 중인 마지막 봉을 뺀다', async () => {
        // 화요일 2026-10-06 02:00Z = 11:00 KST(정규장). 10-05는 대체공휴일이라 피한다.
        vi.setSystemTime(new Date('2026-10-06T02:00:00Z'));
        mockResolveMarketProfile.mockResolvedValue('kr-equity');
        mockLoadBarsData.mockResolvedValue(
            barsEndingOn('2026-10-06', 70_000, 71_000, 1)
        );

        await expect(fetchPageLastClose('005930.KS', undefined)).resolves.toBe(
            71_000
        );
    });

    it('KR 정규장 중이어도 오늘 봉이 아직 없으면 직전 거래일 봉을 떼지 않고 그 종가를 돌려준다', async () => {
        // 2026-10-06 11:00 KST. 시리즈는 10-02(확정)에서 끝난다 — 휴장 직후 오늘 봉이 없는 상태.
        vi.setSystemTime(new Date('2026-10-06T02:00:00Z'));
        mockResolveMarketProfile.mockResolvedValue('kr-equity');
        mockLoadBarsData.mockResolvedValue(
            barsEndingOn('2026-10-02', 357_000, 360_000, 371_000)
        );

        await expect(fetchPageLastClose('373220.KS', undefined)).resolves.toBe(
            371_000
        );
    });

    it('크립토는 24/7이라 항상 마지막(형성 중) 봉을 뺀다', async () => {
        mockResolveMarketProfile.mockResolvedValue('crypto');
        mockLoadBarsData.mockResolvedValue(
            barsEndingOn('2026-10-05', 50_000, 51_000, 52_000)
        );

        await expect(fetchPageLastClose('BTCUSD', undefined)).resolves.toBe(
            51_000
        );
    });

    it.each([
        ['0', 0],
        ['NaN', Number.NaN],
        ['음수', -5],
        ['Infinity', Number.POSITIVE_INFINITY],
    ])('종가가 %s면 null', async (_label, close) => {
        mockLoadBarsData.mockResolvedValue(barsData(100, close));

        await expect(fetchPageLastClose('AAPL', undefined)).resolves.toBeNull();
    });

    it('봉이 없으면 null', async () => {
        mockLoadBarsData.mockResolvedValue({
            bars: [],
            indicators: EMPTY_INDICATOR_RESULT,
        });

        await expect(fetchPageLastClose('AAPL', undefined)).resolves.toBeNull();
    });

    it('로더가 던지면 던지지 않고 null — 보조 검사가 배치를 막지 않는다', async () => {
        mockLoadBarsData.mockRejectedValue(new Error('fmp 402'));

        await expect(fetchPageLastClose('AAPL', undefined)).resolves.toBeNull();
        expect(console.warn).toHaveBeenCalled();
    });

    it('시장 프로필 조회가 던져도 null', async () => {
        mockLoadBarsData.mockResolvedValue(barsData(100));
        mockResolveMarketProfile.mockRejectedValue(new Error('db down'));

        await expect(fetchPageLastClose('AAPL', undefined)).resolves.toBeNull();
    });
});
