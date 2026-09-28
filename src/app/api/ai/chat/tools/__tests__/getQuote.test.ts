import { beforeEach, describe, expect, it, vi } from 'vitest';

const { profile, assetInfo, getQuote, spec } = vi.hoisted(() => ({
    profile: vi.fn(),
    assetInfo: vi.fn(),
    getQuote: vi.fn(),
    spec: vi.fn(),
}));
vi.mock('@/entities/ticker/lib/getAssetInfo', () => ({
    getAssetInfo: assetInfo,
}));
vi.mock('@/entities/ticker/lib/resolveAssetClass', () => ({
    resolveMarketProfile: profile,
}));
vi.mock('@/shared/api/market/getCachedMarketDataProvider', () => ({
    getCachedMarketDataProvider: () => ({ getQuote }),
}));
vi.mock('@/shared/api/market/sessionSpecFor', () => ({ sessionSpecFor: spec }));
vi.mock('@/shared/config/marketProfile', () => ({
    getDescriptor: (id: string) => ({
        priceFormat: { currency: id === 'kr-equity' ? 'KRW' : 'USD' },
        quoteDelayMinutes: id === 'kr-equity' ? 20 : 0,
    }),
}));

import { getQuoteTool } from '@/app/api/ai/chat/tools/getQuote';
import { QUOTE_MAX_AGE_MS } from '@/app/api/ai/chat/tools/freshness';
import { MS_PER_DAY, MS_PER_HOUR, MS_PER_MINUTE } from '@/shared/config/time';

const ctx = {
    userId: 'u',
    tier: 'member' as const,
    locale: 'ko' as const,
    signal: new AbortController().signal,
};
const rt = {
    analysisModel: 'deepseek-v4.1-flash' as const,
    ensureSymbolData: async (): Promise<void> => {},
};

describe('getQuoteTool', () => {
    beforeEach(() => {
        assetInfo.mockReset();
        assetInfo.mockResolvedValue(null);
    });

    it('KR 심볼은 kr-equity 세션 스펙 + KRW + 20분 지연 표기, 3개로 절단', async () => {
        profile.mockImplementation(async (s: string) =>
            s.endsWith('.KS') ? 'kr-equity' : 'us-equity'
        );
        getQuote.mockResolvedValue({
            symbol: 'x',
            price: 71000,
            changesPercentage: 1.2,
        });
        const r = (await getQuoteTool(
            { symbols: ['005930.KS', 'AAPL', 'MSFT', 'NVDA'] },
            ctx,
            rt
        )) as {
            quotes: Array<{ quoteDelayMinutes: number }>;
        };
        expect(r.quotes).toHaveLength(3);
        expect(spec).toHaveBeenCalledWith('kr-equity');
        expect(r.quotes[0]).toMatchObject({
            symbol: '005930.KS',
            currency: 'KRW',
            found: true,
            quoteDelayMinutes: 20,
        });
        expect(r.quotes[1]).toMatchObject({ quoteDelayMinutes: 0 });
    });

    it('fmpSymbol이 있으면 그 값으로 시세를 조회한다', async () => {
        profile.mockResolvedValue('us-equity');
        assetInfo.mockResolvedValue({
            symbol: '^SPX',
            fmpSymbol: '^GSPC',
        });
        getQuote.mockResolvedValue({ price: 5000, changesPercentage: 0.5 });
        await getQuoteTool({ symbols: ['^SPX'] }, ctx, rt);
        expect(getQuote).toHaveBeenCalledWith('^GSPC');
    });

    it('getAssetInfo가 throw해도 canonical 심볼로 조회를 진행한다', async () => {
        profile.mockResolvedValue('us-equity');
        assetInfo.mockRejectedValue(new Error('db down'));
        getQuote.mockResolvedValue({ price: 100, changesPercentage: 0 });
        const r = (await getQuoteTool({ symbols: ['AAPL'] }, ctx, rt)) as {
            quotes: Array<{ found: boolean }>;
        };
        expect(getQuote).toHaveBeenCalledWith('AAPL');
        expect(r.quotes[0]).toMatchObject({ found: true });
    });

    it('provider가 null을 돌려주면 found:false', async () => {
        profile.mockResolvedValue('us-equity');
        getQuote.mockResolvedValue(null);
        const r = (await getQuoteTool({ symbols: ['AAPL'] }, ctx, rt)) as {
            quotes: Array<{ found: boolean }>;
        };
        expect(r.quotes[0]).toEqual({ symbol: 'AAPL', found: false });
    });

    describe('asOf/asOfIsFetchTime (spec §3.8, B10)', () => {
        it('provider quote에 timestamp가 없으면 fetch 시각을 쓰고 asOfIsFetchTime:true를 붙인다', async () => {
            profile.mockResolvedValue('us-equity');
            getQuote.mockResolvedValue({ price: 100, changesPercentage: 0 }); // no `timestamp`
            const r = (await getQuoteTool({ symbols: ['AAPL'] }, ctx, rt)) as {
                quotes: Array<{
                    asOf: string;
                    asOfIsFetchTime?: boolean;
                }>;
            };
            expect(r.quotes[0]!.asOfIsFetchTime).toBe(true);
            expect(typeof r.quotes[0]!.asOf).toBe('string');
            expect(Number.isNaN(Date.parse(r.quotes[0]!.asOf))).toBe(false);
        });

        it('provider quote에 timestamp가 있으면 그 시각을 쓰고 asOfIsFetchTime을 붙이지 않는다', async () => {
            profile.mockResolvedValue('us-equity');
            getQuote.mockResolvedValue({
                price: 100,
                changesPercentage: 0,
                timestamp: 1_700_000_000, // Unix seconds
            });
            const r = (await getQuoteTool({ symbols: ['AAPL'] }, ctx, rt)) as {
                quotes: Array<{ asOf: string; asOfIsFetchTime?: boolean }>;
            };
            expect(r.quotes[0]!.asOf).toBe(
                new Date(1_700_000_000 * 1000).toISOString()
            );
            expect(r.quotes[0]!.asOfIsFetchTime).toBeUndefined();
        });

        /**
         * 실측 회귀 가드(2026-09-21): `SQ`가 `XYZ`로 개명된 뒤에도 FMP `quote`가
         * 2025-02-13자 마지막 시세(83.46달러)를 계속 돌려줬고, 우리는 그걸 그대로
         * "현재가"로 제시했다. 값이 정상 범위라 어떤 오류 처리에도 안 걸린다 —
         * 나이를 싣는 것만이 유일한 방어다.
         */
        it('동결된 시세(개명·폐지 티커)는 freshness.stale로 표시한다', async () => {
            profile.mockResolvedValue('us-equity');
            const frozenSeconds = Math.floor(
                Date.UTC(2025, 1, 13, 16, 8, 53) / 1000
            );
            getQuote.mockResolvedValue({
                price: 83.46,
                changesPercentage: 0.57,
                timestamp: frozenSeconds,
            });
            const r = (await getQuoteTool({ symbols: ['SQ'] }, ctx, rt)) as {
                quotes: Array<{ freshness?: { stale: boolean } }>;
            };
            expect(r.quotes[0]!.freshness?.stale).toBe(true);
        });

        it('정상 시세는 stale이 아니다', async () => {
            profile.mockResolvedValue('us-equity');
            getQuote.mockResolvedValue({
                price: 100,
                changesPercentage: 0,
                timestamp: Math.floor(Date.now() / 1000),
            });
            const r = (await getQuoteTool({ symbols: ['AAPL'] }, ctx, rt)) as {
                quotes: Array<{ freshness?: { stale: boolean } }>;
            };
            expect(r.quotes[0]!.freshness?.stale).toBe(false);
        });

        /**
         * 임계값 양쪽 경계를 **상수 자체로부터** 계산해 고정한다. 값을 리터럴로
         * 복제하면 상수를 줄여도(예: 14d → 1d) 테스트가 같이 줄어들어 아무것도
         * 못 잡는다 — 실제로 첫 버전이 그 상태였고, 7d → 1d 변이가 초록으로
         * 통과했다.
         */
        const staleFor = async (
            ageMs: number
        ): Promise<boolean | undefined> => {
            profile.mockResolvedValue('us-equity');
            getQuote.mockResolvedValue({
                price: 100,
                changesPercentage: 0,
                timestamp: Math.floor((Date.now() - ageMs) / 1000),
            });
            const r = (await getQuoteTool({ symbols: ['AAPL'] }, ctx, rt)) as {
                quotes: Array<{ freshness?: { stale: boolean } }>;
            };
            return r.quotes[0]!.freshness?.stale;
        };

        it('임계값 바로 아래는 stale이 아니다', async () => {
            await expect(
                staleFor(QUOTE_MAX_AGE_MS - MS_PER_MINUTE)
            ).resolves.toBe(false);
        });

        it('임계값 바로 위는 stale이다', async () => {
            await expect(
                staleFor(QUOTE_MAX_AGE_MS + MS_PER_MINUTE)
            ).resolves.toBe(true);
        });

        /**
         * 회귀 가드 — 2025 추석·개천절·한글날 클러스터로 KRX가 약 7일 17시간
         * 쉬었다. 임계값이 그보다 짧으면 정상 종가가 전부 stale로 찍힌다.
         */
        /**
         * 상한도 함께 고정한다. 아래 경계 테스트는 입력을 상수에서 파생하므로
         * 값을 키워도(예: 60일) 전부 초록이다 — 그러면 개명·폐지로 몇 주째 동결된
         * 시세가 정상으로 통과한다. 관측된 동결은 월 단위(SQ는 19개월)라 30일이면
         * 충분히 여유롭다.
         */
        it('임계값은 30일보다 짧게 유지한다', () => {
            expect(QUOTE_MAX_AGE_MS).toBeLessThan(30 * MS_PER_DAY);
        });

        it('KRX 최장 연휴(약 7일 17시간)는 stale로 보지 않는다', async () => {
            const krxLongestClosureMs = 7 * MS_PER_DAY + 17 * MS_PER_HOUR;
            await expect(staleFor(krxLongestClosureMs)).resolves.toBe(false);
        });
    });

    it('일부 심볼 조회가 실패해도 나머지는 정상 반환한다 (Promise.allSettled)', async () => {
        profile.mockResolvedValue('us-equity');
        getQuote.mockImplementation(async (symbol: string) => {
            if (symbol === 'BAD') throw new Error('FMP 429');
            return { symbol, price: 200, changesPercentage: -0.5 };
        });
        const r = (await getQuoteTool(
            { symbols: ['AAPL', 'BAD', 'MSFT'] },
            ctx,
            rt
        )) as {
            quotes: Array<{ symbol: string; found: boolean }>;
        };
        expect(r.quotes).toHaveLength(3);
        expect(r.quotes[0]).toMatchObject({ symbol: 'AAPL', found: true });
        expect(r.quotes[1]).toEqual({ symbol: 'BAD', found: false });
        expect(r.quotes[2]).toMatchObject({ symbol: 'MSFT', found: true });
    });
});
