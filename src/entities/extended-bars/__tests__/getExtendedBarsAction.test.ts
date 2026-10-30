vi.mock('@/entities/extended-bars/api', () => ({
    loadExtendedBars: vi.fn(),
}));
vi.mock('@/entities/auth/server/resolveCallerTier', () => ({
    resolveCallerTier: vi.fn(),
}));

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Bar, Tier } from '@y0ngha/siglens-core';
import { getExtendedBarsAction } from '@/entities/extended-bars/actions/getExtendedBarsAction';
import { loadExtendedBars } from '@/entities/extended-bars/api';
import { resolveCallerTier } from '@/entities/auth/server/resolveCallerTier';

const mockedLoad = vi.mocked(loadExtendedBars);
const mockedTier = vi.mocked(resolveCallerTier);

const BARS: Bar[] = [
    { time: 1, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 },
];

describe('getExtendedBarsAction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        mockedLoad.mockResolvedValue(BARS);
        mockedTier.mockResolvedValue('pro' as Tier);
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllEnvs();
    });

    it('검증된 입력과 티어가 통과하면 로더 결과를 그대로 돌려준다', async () => {
        await expect(getExtendedBarsAction('aapl', '5Min')).resolves.toEqual(
            BARS
        );
        expect(mockedLoad).toHaveBeenCalledWith('AAPL', '5Min');
    });

    describe('게이트 — 로더(FMP) 호출 없이 null', () => {
        it('E2E는 티어 조회도 하지 않는다', async () => {
            vi.stubEnv('E2E_TEST', '1');
            await expect(
                getExtendedBarsAction('AAPL', '5Min')
            ).resolves.toBeNull();
            expect(mockedTier).not.toHaveBeenCalled();
            expect(mockedLoad).not.toHaveBeenCalled();
        });

        it('1Day', async () => {
            await expect(
                getExtendedBarsAction('AAPL', '1Day')
            ).resolves.toBeNull();
            expect(mockedLoad).not.toHaveBeenCalled();
        });

        it('형식이 어긋난 입력은 티어 조회 전에 걸러진다', async () => {
            await expect(
                getExtendedBarsAction('A B', '5Min')
            ).resolves.toBeNull();
            await expect(
                getExtendedBarsAction('AAPL', 'nope' as never)
            ).resolves.toBeNull();
            expect(mockedTier).not.toHaveBeenCalled();
            expect(mockedLoad).not.toHaveBeenCalled();
        });

        it.each(['5Min', '15Min', '30Min', '1Hour', '4Hour'] as const)(
            'free 티어는 %s를 쓸 수 없다(getBarsAction과 같은 규칙)',
            async timeframe => {
                mockedTier.mockResolvedValue('free' as Tier);
                await expect(
                    getExtendedBarsAction('AAPL', timeframe)
                ).resolves.toBeNull();
                expect(mockedTier).toHaveBeenCalledWith(
                    'getExtendedBarsAction'
                );
                expect(mockedLoad).not.toHaveBeenCalled();
            }
        );

        it('member 티어는 인트라데이를 쓸 수 있다', async () => {
            mockedTier.mockResolvedValue('member' as Tier);
            await expect(
                getExtendedBarsAction('AAPL', '5Min')
            ).resolves.toEqual(BARS);
        });
    });

    it('로더가 던져도 던지지 않고 이름만 로그한 뒤 null이다', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockedLoad.mockRejectedValue(new TypeError('secret detail'));

        await expect(getExtendedBarsAction('AAPL', '5Min')).resolves.toBeNull();
        expect(error).toHaveBeenCalledWith(
            '[getExtendedBarsAction] degraded to null:',
            { errorName: 'TypeError' }
        );
    });

    it('던져진 값이 Error가 아니어도 null이다', async () => {
        mockedLoad.mockRejectedValue('boom');
        await expect(getExtendedBarsAction('AAPL', '5Min')).resolves.toBeNull();
    });
});
