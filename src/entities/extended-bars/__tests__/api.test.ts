vi.mock('@/entities/ticker/lib/getAssetInfoStatic', () => ({
    getAssetInfoStatic: vi.fn(),
}));
vi.mock('@/shared/api/market/getCachedMarketDataProvider', () => ({
    getCachedExtendedBarsProvider: vi.fn(),
}));

import {
    describe,
    it,
    expect,
    vi,
    beforeEach,
    afterEach,
    type Mock,
} from 'vitest';
import type { Bar, GetBarsOptions } from '@y0ngha/siglens-core';
import { loadExtendedBars } from '@/entities/extended-bars/api';
import { getAssetInfoStatic } from '@/entities/ticker/lib/getAssetInfoStatic';
import { getCachedExtendedBarsProvider } from '@/shared/api/market/getCachedMarketDataProvider';
import type { AssetInfo } from '@/shared/lib/types';

const mockedAsset = vi.mocked(getAssetInfoStatic);
const mockedProvider = vi.mocked(getCachedExtendedBarsProvider);

const NOW = new Date('2026-10-15T15:00:00Z');
const AAPL: AssetInfo = { symbol: 'AAPL', name: 'Apple Inc.' };
const BARS: Bar[] = [
    { time: 1, open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 },
];

describe('loadExtendedBars', () => {
    let getExtendedBars: Mock<(o: GetBarsOptions) => Promise<Bar[]>>;
    let fetchSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        vi.clearAllMocks();
        // 거부형 기본값 — 모듈 목을 우회한 실제 네트워크 요청은 즉시 실패한다.
        fetchSpy = vi
            .fn()
            .mockRejectedValue(new Error('network must not be used'));
        vi.stubGlobal('fetch', fetchSpy);
        getExtendedBars = vi.fn(async (_o: GetBarsOptions) => BARS);
        mockedProvider.mockReturnValue({ getExtendedBars });
        mockedAsset.mockResolvedValue(AAPL);
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
    });

    it('미국 주식이면 정규장 봉과 같은 창으로 확장 봉을 조회한다', async () => {
        await expect(loadExtendedBars('AAPL', '5Min', NOW)).resolves.toEqual(
            BARS
        );
        expect(getExtendedBars).toHaveBeenCalledWith({
            symbol: 'AAPL',
            timeframe: '5Min',
            from: '2026-10-05T00:00:00Z',
        });
    });

    it('조회 심볼은 서버가 푼 자산의 fmpSymbol, 없으면 티커다', async () => {
        mockedAsset.mockResolvedValue({
            ...AAPL,
            symbol: 'BRKB',
            fmpSymbol: 'BRK-B',
        });
        await loadExtendedBars('BRKB', '5Min', NOW);
        expect(getExtendedBars.mock.calls.at(-1)![0].symbol).toBe('BRK-B');

        mockedAsset.mockResolvedValue(AAPL);
        await loadExtendedBars('AAPL', '5Min', NOW);
        expect(getExtendedBars.mock.calls.at(-1)![0].symbol).toBe('AAPL');
    });

    describe('게이트 — 확장 봉용 FMP 호출 없이 null', () => {
        function expectNoUpstream(): void {
            expect(getExtendedBars).not.toHaveBeenCalled();
            expect(fetchSpy).not.toHaveBeenCalled();
        }

        it('E2E는 자산 조회도 하지 않는다(E2E는 FMP 키가 없다는 전제)', async () => {
            vi.stubEnv('E2E_TEST', '1');
            await expect(
                loadExtendedBars('AAPL', '5Min', NOW)
            ).resolves.toBeNull();
            expect(mockedAsset).not.toHaveBeenCalled();
            expect(mockedProvider).not.toHaveBeenCalled();
            expectNoUpstream();
        });

        it('자산 정보가 없으면', async () => {
            mockedAsset.mockResolvedValue(null);
            await expect(
                loadExtendedBars('ZZZZ', '5Min', NOW)
            ).resolves.toBeNull();
            expectNoUpstream();
        });

        it('한국 주식', async () => {
            mockedAsset.mockResolvedValue({
                symbol: '005930',
                name: 'Samsung',
                marketProfile: 'kr-equity',
            });
            await expect(
                loadExtendedBars('005930', '5Min', NOW)
            ).resolves.toBeNull();
            expectNoUpstream();
        });

        it('크립토', async () => {
            mockedAsset.mockResolvedValue({
                symbol: 'BTCUSD',
                name: 'Bitcoin',
                marketProfile: 'crypto',
            });
            await expect(
                loadExtendedBars('BTCUSD', '5Min', NOW)
            ).resolves.toBeNull();
            expectNoUpstream();
        });

        it('지수(^ 심볼)', async () => {
            mockedAsset.mockResolvedValue({
                symbol: 'SPX',
                name: 'S&P 500',
                fmpSymbol: '^SPX',
            });
            await expect(
                loadExtendedBars('SPX', '5Min', NOW)
            ).resolves.toBeNull();
            expectNoUpstream();
        });

        it('확장 provider가 없을 때(E2E Fake 등)', async () => {
            mockedProvider.mockReturnValue(null);
            await expect(
                loadExtendedBars('AAPL', '5Min', NOW)
            ).resolves.toBeNull();
            expectNoUpstream();
        });
    });

    it('provider 오류는 전파된다(Server Action이 null로 접는다)', async () => {
        getExtendedBars.mockRejectedValue(new Error('FMP 502'));
        await expect(loadExtendedBars('AAPL', '5Min', NOW)).rejects.toThrow(
            'FMP 502'
        );
    });
});
