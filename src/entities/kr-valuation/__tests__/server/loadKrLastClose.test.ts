const mocks = vi.hoisted(() => ({
    getCachedBarsWithIndicators: vi.fn(),
    getCachedMarketDataProvider: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/entities/bars/server/barsDataCache', () => ({
    getCachedBarsWithIndicators: mocks.getCachedBarsWithIndicators,
}));
vi.mock('@/shared/api/market/getCachedMarketDataProvider', () => ({
    getCachedMarketDataProvider: mocks.getCachedMarketDataProvider,
}));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KR_EQUITY_SESSION } from '@/shared/api/market/sessionSpecFor';
import { loadKrLastClose } from '../../server/loadKrLastClose';

const SECONDS = (iso: string) => Date.parse(iso) / 1000;
/** 2026-11-19·20 일봉(UTC 자정 시각) — 한국 정규장은 11-20 15:30 KST에 끝났다. */
const BARS = [
    { time: SECONDS('2026-11-19T00:00:00Z'), close: 41_700 },
    { time: SECONDS('2026-11-20T00:00:00Z'), close: 41_400 },
];
/** 일요일 — 장이 닫혀 있어 마지막 봉이 곧 완료된 종가다. */
const SUNDAY = new Date('2026-11-22T03:00:00Z');

describe('loadKrLastClose', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.getCachedMarketDataProvider.mockReturnValue({ kind: 'kr' });
        mocks.getCachedBarsWithIndicators.mockResolvedValue({ bars: BARS });
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('한국 세션의 일봉 캐시에서 마지막 완료 종가와 날짜를 읽는다', async () => {
        expect(await loadKrLastClose('029780.KS', SUNDAY)).toEqual({
            close: 41_400,
            date: '2026-11-20',
        });
        expect(mocks.getCachedMarketDataProvider).toHaveBeenCalledWith(
            KR_EQUITY_SESSION
        );
        expect(mocks.getCachedBarsWithIndicators).toHaveBeenCalledWith(
            { kind: 'kr' },
            '029780.KS',
            '1Day',
            undefined,
            KR_EQUITY_SESSION
        );
    });

    it('봉이 없으면 null이다', async () => {
        mocks.getCachedBarsWithIndicators.mockResolvedValue({ bars: [] });
        expect(await loadKrLastClose('029780.KS', SUNDAY)).toBeNull();
    });

    it('봉 조회가 실패하면 던지지 않고 로그 후 null이다', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        mocks.getCachedBarsWithIndicators.mockRejectedValue(
            new Error('yahoo down')
        );
        expect(await loadKrLastClose('029780.KS', SUNDAY)).toBeNull();
        expect(
            warn.mock.calls.some(([message]) =>
                String(message).includes('[kr-valuation]')
            )
        ).toBe(true);
    });

    it('Next 동적 서버 오류(제어 흐름)는 다시 던진다', async () => {
        const control = Object.assign(new Error('Dynamic server usage: x'), {
            digest: 'DYNAMIC_SERVER_USAGE',
        });
        mocks.getCachedBarsWithIndicators.mockRejectedValue(control);
        await expect(loadKrLastClose('029780.KS', SUNDAY)).rejects.toBe(
            control
        );
    });
});
