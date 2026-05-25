import { vi, type MockInstance, type Mock } from 'vitest';
/**
 * Unit tests for YahooOptionsAdapter.
 *
 * yahoo-finance2 is mocked entirely — no network calls are made.
 * sanitizeOptionsChain is mocked to act as a passthrough (identity) so that
 * we can test normalization and adapter logic independently from domain
 * sanitization rules.
 */

const { mockOptionsMethod } = vi.hoisted(() => ({
    mockOptionsMethod: vi.fn(),
}));

vi.mock('yahoo-finance2', () => ({
    __esModule: true,
    default: vi.fn().mockImplementation(function() { return {
        options: mockOptionsMethod,
    }; }),
}));

vi.mock('@y0ngha/siglens-core', async () => {
    const actual = (await vi.importActual('@y0ngha/siglens-core')) as Record<
        string,
        unknown
    >;
    return {
        ...actual,
        // Passthrough: return the chain as-is so adapter logic is isolated
        sanitizeOptionsChain: vi.fn((chain: unknown) => chain),
        // adapter는 `mapExpirationsToSlots`로 추가 fetch 대상을 결정하는데,
        // 실제 구현을 그대로 호출하면 `new Date()`에 의존해 테스트가
        // 실행 시점 날짜에 따라 분기가 달라진다(flaky). 각 it()에서 의도한
        // 슬롯 매핑을 직접 주입해 격리한다.
        mapExpirationsToSlots: vi.fn(),
    };
});

import {
    mapExpirationsToSlots,
    sanitizeOptionsChain,
} from '@y0ngha/siglens-core';
import { YahooOptionsAdapter } from '../lib/YahooOptionsAdapter';

/** A minimal but complete CallOrPut fixture matching the live API shape. */
const makeContract = (
    strike: number,
    type: 'C' | 'P',
    overrides: Partial<{
        volume: number;
        openInterest: number;
        bid: number;
        ask: number;
        lastPrice: number;
        impliedVolatility: number;
        inTheMoney: boolean;
    }> = {}
) => ({
    contractSymbol: `AAPL260515${type}${String(strike * 1000).padStart(8, '0')}`,
    strike,
    currency: 'USD',
    lastPrice: overrides.lastPrice ?? 2.5,
    change: 0,
    percentChange: 0,
    volume: overrides.volume ?? 100,
    openInterest: overrides.openInterest ?? 200,
    bid: overrides.bid ?? 2.4,
    ask: overrides.ask ?? 2.6,
    contractSize: 'REGULAR' as const,
    expiration: new Date('2026-05-15T00:00:00.000Z'),
    lastTradeDate: new Date('2026-05-13T19:00:00.000Z'),
    impliedVolatility: overrides.impliedVolatility ?? 0.3,
    inTheMoney: overrides.inTheMoney ?? false,
});

/** Two expirations, each with 2 calls + 2 puts. Calls deliberately out of order to test sorting. */
const FULL_FIXTURE = {
    underlyingSymbol: 'AAPL',
    expirationDates: [
        new Date('2026-05-15T00:00:00.000Z'),
        new Date('2026-05-22T00:00:00.000Z'),
    ],
    strikes: [190, 195, 200, 205],
    hasMiniOptions: false,
    quote: { regularMarketPrice: 195 },
    options: [
        {
            expirationDate: new Date('2026-05-15T00:00:00.000Z'),
            hasMiniOptions: false,
            // Intentionally reverse order — adapter must sort ascending by strike
            calls: [makeContract(200, 'C'), makeContract(190, 'C')],
            puts: [makeContract(200, 'P'), makeContract(190, 'P')],
        },
        {
            expirationDate: new Date('2026-05-22T00:00:00.000Z'),
            hasMiniOptions: false,
            calls: [makeContract(195, 'C'), makeContract(205, 'C')],
            puts: [makeContract(195, 'P'), makeContract(205, 'P')],
        },
    ],
};

const EMPTY_OPTIONS_FIXTURE = {
    ...FULL_FIXTURE,
    options: [],
};

function makeAdapter(): YahooOptionsAdapter {
    return new YahooOptionsAdapter();
}

describe('YahooOptionsAdapter.fetchSnapshot', () => {
    let consoleErrorSpy: MockInstance;

    beforeEach(() => {
        vi.clearAllMocks();
        (sanitizeOptionsChain as Mock).mockImplementation(c => c);
        // 기본값: 슬롯 매핑이 비어 있어 추가 fetch 분기가 트리거되지 않음.
        // 추가 fetch 시나리오를 검증하는 it()는 각자 mockReturnValue로 덮어쓴다.
        (mapExpirationsToSlots as Mock).mockReturnValue([]);
        consoleErrorSpy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    it('returns an OptionsSnapshot with chains sorted by expirationDate', async () => {
        mockOptionsMethod.mockResolvedValue(FULL_FIXTURE);
        const adapter = makeAdapter();

        const snapshot = await adapter.fetchSnapshot('AAPL');

        expect(snapshot).not.toBeNull();
        expect(snapshot!.symbol).toBe('AAPL');
        expect(snapshot!.underlyingPrice).toBe(195);
        expect(snapshot!.chains).toHaveLength(2);
        expect(snapshot!.chains[0].expirationDate).toBe('2026-05-15');
        expect(snapshot!.chains[1].expirationDate).toBe('2026-05-22');
    });

    it('sorts calls and puts ascending by strike within each chain', async () => {
        mockOptionsMethod.mockResolvedValue(FULL_FIXTURE);
        const adapter = makeAdapter();

        const snapshot = await adapter.fetchSnapshot('AAPL');

        const firstChain = snapshot!.chains[0];
        expect(firstChain.calls[0].strike).toBe(190);
        expect(firstChain.calls[1].strike).toBe(200);
        expect(firstChain.puts[0].strike).toBe(190);
        expect(firstChain.puts[1].strike).toBe(200);
    });

    it('defaults volume and openInterest to 0 when undefined', async () => {
        const contractWithNulls = {
            ...makeContract(190, 'C'),
            volume: undefined,
            openInterest: undefined,
        };
        const fixture = {
            ...FULL_FIXTURE,
            options: [
                {
                    ...FULL_FIXTURE.options[0],
                    calls: [contractWithNulls],
                    puts: [],
                },
            ],
        };
        mockOptionsMethod.mockResolvedValue(fixture);
        const adapter = makeAdapter();

        const snapshot = await adapter.fetchSnapshot('AAPL');

        const contract = snapshot!.chains[0].calls[0];
        expect(contract.volume).toBe(0);
        expect(contract.openInterest).toBe(0);
    });

    it('returns null when options array is empty', async () => {
        mockOptionsMethod.mockResolvedValue(EMPTY_OPTIONS_FIXTURE);
        const adapter = makeAdapter();

        const result = await adapter.fetchSnapshot('AAPL');

        expect(result).toBeNull();
    });

    it('returns null when underlyingPrice is missing (regularMarketPrice undefined)', async () => {
        // Yahoo가 quote.regularMarketPrice를 누락하면 normalize가 0으로 폴백한다.
        // 이 경우 underlyingPrice=0 인 채로 통과되면 차트 가이드라인이 최저
        // strike에 그려지는 등 잘못된 시각을 노출하므로 adapter에서 reject한다.
        const consoleWarnSpy = vi
            .spyOn(console, 'warn')
            .mockImplementation(() => {});
        // try/finally — assertion 실패 시에도 console.warn spy를 반드시 복구해
        // 후속 테스트 간 spy leak을 막는다 (formatAnalyzedAt.test.ts 패턴 일치).
        try {
            const fixtureNoQuote = {
                ...FULL_FIXTURE,
                quote: {} as { regularMarketPrice?: number },
            };
            mockOptionsMethod.mockResolvedValue(fixtureNoQuote);
            const adapter = makeAdapter();

            const result = await adapter.fetchSnapshot('AAPL');

            expect(result).toBeNull();
            expect(consoleWarnSpy).toHaveBeenCalledWith(
                '[YahooOptionsAdapter] missing underlyingPrice — treating snapshot as unavailable',
                'AAPL'
            );
        } finally {
            consoleWarnSpy.mockRestore();
        }
    });

    it('returns null when all chains are rejected by sanitizeOptionsChain', async () => {
        mockOptionsMethod.mockResolvedValue(FULL_FIXTURE);
        (sanitizeOptionsChain as Mock).mockReturnValue(null);
        const adapter = makeAdapter();

        const result = await adapter.fetchSnapshot('AAPL');

        expect(result).toBeNull();
    });

    it('catches library errors and returns null without throwing', async () => {
        mockOptionsMethod.mockRejectedValue(new Error('network timeout'));
        const adapter = makeAdapter();

        const result = await adapter.fetchSnapshot('AAPL');

        expect(result).toBeNull();
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            '[YahooOptionsAdapter] fetchSnapshot failed',
            expect.any(Error)
        );
    });

    it('calls sanitizeOptionsChain for each chain', async () => {
        mockOptionsMethod.mockResolvedValue(FULL_FIXTURE);
        const adapter = makeAdapter();

        await adapter.fetchSnapshot('AAPL');

        expect(sanitizeOptionsChain).toHaveBeenCalledTimes(2);
    });

    it('초기 응답에 없는 슬롯 만기는 병렬로 추가 fetch 후 병합한다', async () => {
        // mapExpirationsToSlots → 2026-07-18(2M)이 슬롯에 매핑됐다고 가정.
        // 초기 응답에는 2026-05-15만 있으므로 2026-07-18은 추가 fetch 대상이다.
        (mapExpirationsToSlots as Mock).mockReturnValue([
            {
                slot: { key: '2M', label: '2개월', targetDays: 60 },
                expirationDate: '2026-07-18',
            },
        ]);

        const initialFixture = {
            ...FULL_FIXTURE,
            options: [FULL_FIXTURE.options[0]],
        };
        const additionalExpDate = new Date('2026-07-18T00:00:00.000Z');
        const additionalFixture = {
            ...FULL_FIXTURE,
            options: [
                {
                    expirationDate: additionalExpDate,
                    hasMiniOptions: false,
                    calls: [
                        {
                            ...makeContract(195, 'C'),
                            expiration: additionalExpDate,
                        },
                    ],
                    puts: [
                        {
                            ...makeContract(195, 'P'),
                            expiration: additionalExpDate,
                        },
                    ],
                },
            ],
        };
        mockOptionsMethod
            .mockResolvedValueOnce(initialFixture)
            .mockResolvedValueOnce(additionalFixture);

        const adapter = makeAdapter();
        const snapshot = await adapter.fetchSnapshot('AAPL');

        expect(mockOptionsMethod).toHaveBeenCalledTimes(2);
        expect(mockOptionsMethod).toHaveBeenNthCalledWith(2, 'AAPL', {
            date: new Date('2026-07-18T00:00:00.000Z'),
        });
        expect(snapshot).not.toBeNull();
        expect(snapshot!.chains.map(c => c.expirationDate)).toEqual([
            '2026-05-15',
            '2026-07-18',
        ]);
    });

    it('추가 만기 fetch가 실패해도 그 만기만 누락된 채 스냅샷을 반환한다', async () => {
        const warnSpy = vi
            .spyOn(console, 'warn')
            .mockImplementation(() => {});
        (mapExpirationsToSlots as Mock).mockReturnValue([
            {
                slot: { key: '2M', label: '2개월', targetDays: 60 },
                expirationDate: '2026-07-18',
            },
        ]);
        const initialFixture = {
            ...FULL_FIXTURE,
            options: [FULL_FIXTURE.options[0]],
        };
        mockOptionsMethod
            .mockResolvedValueOnce(initialFixture)
            .mockRejectedValueOnce(new Error('yahoo rate limit'));

        const adapter = makeAdapter();
        const snapshot = await adapter.fetchSnapshot('AAPL');

        expect(snapshot).not.toBeNull();
        expect(snapshot!.chains).toHaveLength(1);
        expect(snapshot!.chains[0].expirationDate).toBe('2026-05-15');
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('fetch expiration failed'),
            'AAPL',
            '2026-07-18',
            expect.any(Error)
        );
        warnSpy.mockRestore();
    });

    it('초기 응답 안에 동일 만기 항목이 중복될 경우 Map이 마지막 항목으로 dedupe한다', async () => {
        // 초기 응답에 동일 만기가 두 항목으로 들어오는 코너 케이스를 가정.
        // missingIsos는 비어 있어 추가 fetch는 일어나지 않지만,
        // mergedByIso Map이 ISO 키 기반으로 마지막 값만 유지해야 한다.
        (mapExpirationsToSlots as Mock).mockReturnValue([
            {
                slot: { key: '1W', label: '1주', targetDays: 7 },
                expirationDate: '2026-05-15',
            },
        ]);
        const dupExpDate = new Date('2026-05-15T00:00:00.000Z');
        const fixture = {
            ...FULL_FIXTURE,
            options: [
                {
                    expirationDate: dupExpDate,
                    hasMiniOptions: false,
                    calls: [{ ...makeContract(190, 'C'), openInterest: 100 }],
                    puts: [],
                },
                {
                    expirationDate: dupExpDate,
                    hasMiniOptions: false,
                    calls: [{ ...makeContract(190, 'C'), openInterest: 999 }],
                    puts: [],
                },
            ],
        };
        mockOptionsMethod.mockResolvedValue(fixture);

        const adapter = makeAdapter();
        const snapshot = await adapter.fetchSnapshot('AAPL');

        // 동일 만기 두 항목이 들어와도 결과는 1개여야 한다(마지막 항목 우선).
        expect(snapshot!.chains).toHaveLength(1);
        expect(snapshot!.chains[0].calls[0].openInterest).toBe(999);
    });
});

describe('YahooOptionsAdapter.hasOptionsMarket', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('returns true when expirationDates is non-empty', async () => {
        mockOptionsMethod.mockResolvedValue(FULL_FIXTURE);
        const adapter = makeAdapter();

        const result = await adapter.hasOptionsMarket('AAPL');

        expect(result).toBe(true);
    });

    it('returns false when expirationDates is empty', async () => {
        mockOptionsMethod.mockResolvedValue({
            ...FULL_FIXTURE,
            expirationDates: [],
        });
        const adapter = makeAdapter();

        const result = await adapter.hasOptionsMarket('AAPL');

        expect(result).toBe(false);
    });

    it('returns false on any library error and logs the failure for diagnostics', async () => {
        // Errors must surface to console.warn so production failures don't
        // hide silently behind the boolean false return (MISTAKES.md §0.5).
        const warnSpy = vi
            .spyOn(console, 'warn')
            .mockImplementation(() => {});
        mockOptionsMethod.mockRejectedValue(new Error('unknown symbol'));
        const adapter = makeAdapter();

        const result = await adapter.hasOptionsMarket('INVALID');

        expect(result).toBe(false);
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining('hasOptionsMarket failed'),
            'INVALID',
            expect.any(Error)
        );
        warnSpy.mockRestore();
    });
});
