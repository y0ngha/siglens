import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockGetQuote = vi.fn();
const mockResolveMarketProfile = vi.fn();
const mockSessionSpecFor = vi.fn();
const mockBuildPriceAsOf = vi.fn();
const mockBuildDataAsOfLabel = vi.fn();

vi.mock('@/entities/ticker/lib/resolveMarketProfile', () => ({
    resolveMarketProfile: (symbol: string) => mockResolveMarketProfile(symbol),
}));
vi.mock('@/shared/api/market/getCachedMarketDataProvider', () => ({
    getCachedMarketDataProvider: () => ({ getQuote: mockGetQuote }),
}));
vi.mock('@/shared/api/market/sessionSpecFor', () => ({
    sessionSpecFor: (profile: string) => mockSessionSpecFor(profile),
}));
vi.mock('../lib/priceAsOf', () => ({
    buildPriceAsOf: (...args: unknown[]) => mockBuildPriceAsOf(...args),
    buildDataAsOfLabel: (...args: unknown[]) => mockBuildDataAsOfLabel(...args),
}));

const { resolveCurrentPrice, resolvePriceAsOf } =
    await import('../lib/currentPrice');

/**
 * 이 분기는 한때 SSE 라우트 안에만 있었고, 그래서 프리웜은 현재가 없이 평이화를
 * 구웠다 — 그 결과가 `"현재 주가가 어느 수준인지는 제시된 자료에 명시되어 있지
 * 않지만"`으로 시작하는 산문이었고 그대로 검색 스니펫에 실린다. 두 경로가 공유하는
 * 지금은 여기서 검증한다.
 */
describe('resolveCurrentPrice', () => {
    beforeEach(() => {
        mockGetQuote.mockReset();
        mockResolveMarketProfile.mockReset();
        mockResolveMarketProfile.mockResolvedValue('us-equity');
        mockSessionSpecFor.mockReset();
        mockSessionSpecFor.mockReturnValue({});
    });

    it('payload에 숫자가 있으면 시세를 조회하지 않는다', async () => {
        const price = await resolveCurrentPrice('AAPL', {
            planCheck: { currentPrice: 316.85 },
        });

        expect(price).toBeUndefined();
        expect(mockGetQuote).not.toHaveBeenCalled();
    });

    /**
     * `fundamental`·`news`·`financials` payload에는 숫자 필드가 하나도 없다.
     * 이 경로가 살아 있어야 그 세 탭이 현재가를 얻는다.
     */
    it('숫자가 없으면 시세를 조회해 현재가를 돌려준다', async () => {
        mockGetQuote.mockResolvedValue({ price: 316.85 });

        const price = await resolveCurrentPrice('AAPL', {
            summaryKo: '숫자 없는 산문입니다',
        });

        expect(price).toBe(316.85);
        expect(mockGetQuote).toHaveBeenCalledWith('AAPL');
    });

    it.each([
        ['시세 없음', null],
        ['가격이 0', { price: 0 }],
        ['가격이 숫자가 아님', { price: '316.85' }],
    ])('%s이면 undefined다 — 평이화를 막지 않는다', async (_label, quote) => {
        mockGetQuote.mockResolvedValue(quote);

        expect(
            await resolveCurrentPrice('AAPL', { summaryKo: '산문' })
        ).toBeUndefined();
    });

    it('조회가 던져도 평이화를 막지 않는다', async () => {
        mockGetQuote.mockRejectedValue(new Error('provider down'));

        expect(
            await resolveCurrentPrice('AAPL', { summaryKo: '산문' })
        ).toBeUndefined();
    });
});

describe('resolvePriceAsOf', () => {
    const NOW = new Date('2026-10-05T15:00:00.000Z');

    beforeEach(() => {
        mockResolveMarketProfile.mockReset();
        mockSessionSpecFor.mockReset();
        mockBuildPriceAsOf.mockReset();
        mockBuildPriceAsOf.mockReturnValue('9월 29일 종가');
        mockBuildDataAsOfLabel.mockReset();
        mockBuildDataAsOfLabel.mockReturnValue(null);
    });

    it('시장 프로필 → 세션 스펙 → 기준 시점 문구 순으로 만든다', async () => {
        const spec = { kind: 'scheduled' };
        mockResolveMarketProfile.mockResolvedValue('kr-equity');
        mockSessionSpecFor.mockReturnValue(spec);

        const asOf = await resolvePriceAsOf('005930.KS', 'ko', undefined, NOW);

        expect(asOf).toBe('9월 29일 종가');
        expect(mockSessionSpecFor).toHaveBeenCalledWith('kr-equity');
        expect(mockBuildPriceAsOf).toHaveBeenCalledWith(spec, NOW, 'ko');
    });

    it('프로필 조회가 던지면 심볼 형상으로 한국 종목을 가려 계속한다', async () => {
        mockResolveMarketProfile.mockRejectedValue(new Error('db down'));
        mockSessionSpecFor.mockReturnValue({});

        await expect(
            resolvePriceAsOf('005930.KS', 'ko', undefined, NOW)
        ).resolves.toBe('9월 29일 종가');
        expect(mockSessionSpecFor).toHaveBeenCalledWith('kr-equity');

        await resolvePriceAsOf('AAPL', 'ko', undefined, NOW);
        expect(mockSessionSpecFor).toHaveBeenLastCalledWith('us-equity');
    });

    describe('분석이 밝힌 마지막 봉(dataAsOf)', () => {
        const SPEC = { kind: 'scheduled' };
        const analysis = {
            dataAsOf: { barTime: 1_790_000_000, close: 321.5 },
            analyzedAt: '2026-10-05T15:00:00.000Z',
        };

        beforeEach(() => {
            mockResolveMarketProfile.mockResolvedValue('us-equity');
            mockSessionSpecFor.mockReturnValue(SPEC);
        });

        it('dataAsOf.barTime이 있으면 그 봉에서 만든 문구를 쓰고 세션 기준은 부르지 않는다', async () => {
            mockBuildDataAsOfLabel.mockReturnValue('9월 28일 종가');

            const asOf = await resolvePriceAsOf('AAPL', 'ko', analysis, NOW);

            expect(asOf).toBe('9월 28일 종가');
            expect(mockBuildDataAsOfLabel).toHaveBeenCalledWith(
                SPEC,
                1_790_000_000,
                NOW,
                'ko',
                '2026-10-05T15:00:00.000Z'
            );
            expect(mockBuildPriceAsOf).not.toHaveBeenCalled();
        });

        it('봉 문구를 만들 수 없으면 세션 기준으로 물러난다', async () => {
            mockBuildDataAsOfLabel.mockReturnValue(null);

            await expect(
                resolvePriceAsOf('AAPL', 'ko', analysis, NOW)
            ).resolves.toBe('9월 29일 종가');
            expect(mockBuildPriceAsOf).toHaveBeenCalledWith(SPEC, NOW, 'ko');
        });

        it.each([
            ['필드 없음(옛 캐시 항목)', { summary: 's' }],
            ['dataAsOf가 객체가 아님', { dataAsOf: 5 }],
            ['analysis가 null', null],
            ['analysis가 문자열', 'text'],
        ])('%s이면 barTime 없이 호출한다', async (_label, value) => {
            await resolvePriceAsOf('AAPL', 'ko', value, NOW);

            expect(mockBuildDataAsOfLabel).toHaveBeenCalledWith(
                SPEC,
                undefined,
                NOW,
                'ko',
                undefined
            );
        });
    });
});

describe('resolveCurrentPrice — dataAsOf 메타데이터', () => {
    beforeEach(() => {
        mockGetQuote.mockReset();
        mockResolveMarketProfile.mockReset();
        mockResolveMarketProfile.mockResolvedValue('us-equity');
        mockSessionSpecFor.mockReset();
        mockSessionSpecFor.mockReturnValue({});
    });

    it('숫자가 dataAsOf에만 있으면 본문에 숫자가 없는 것으로 보고 시세를 조회한다', async () => {
        mockGetQuote.mockResolvedValue({ price: 316.85 });

        const price = await resolveCurrentPrice('AAPL', {
            summaryKo: '숫자 없는 산문입니다',
            dataAsOf: { barTime: 1_790_000_000, close: 321.5 },
        });

        expect(price).toBe(316.85);
        expect(mockGetQuote).toHaveBeenCalledWith('AAPL');
    });

    it('본문에 숫자가 있으면 dataAsOf가 있어도 조회하지 않는다', async () => {
        const price = await resolveCurrentPrice('AAPL', {
            planCheck: { currentPrice: 316.85 },
            dataAsOf: { barTime: 1_790_000_000, close: 321.5 },
        });

        expect(price).toBeUndefined();
        expect(mockGetQuote).not.toHaveBeenCalled();
    });
});
