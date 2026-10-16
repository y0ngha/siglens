import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('react', async importOriginal => ({
    ...(await importOriginal<typeof import('react')>()),
    // The real `cache` memoizes per request scope; per-test calls must recompute.
    cache: <T extends (...args: never[]) => unknown>(fn: T): T => fn,
}));

const { mockBars, mockFinra, mockRegSho } = vi.hoisted(() => ({
    mockBars: vi.fn(),
    mockFinra: vi.fn(() => true),
    mockRegSho: vi.fn(() => true),
}));
vi.mock('@/entities/bars/lib/sessionBarsStaticCache', () => ({
    getSessionBarsStatic: mockBars,
}));
vi.mock('@/shared/api/finra/finraShortDataEnabled', () => ({
    isFinraShortDataEnabled: mockFinra,
}));
vi.mock('@/shared/api/exchange/regShoThresholdDataEnabled', () => ({
    isRegShoThresholdDataEnabled: mockRegSho,
}));

import { getInvestorFlowsEvaluationOptions } from '../../server/getInvestorFlowsEvaluationOptions';

const BAR = {
    time: Date.parse('2026-10-15T00:00:00Z') / 1000,
    open: 250,
    high: 252,
    low: 249,
    close: 251.2,
    volume: 41_000_000,
};

describe('getInvestorFlowsEvaluationOptions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFinra.mockReturnValue(true);
        mockRegSho.mockReturnValue(true);
        mockBars.mockResolvedValue({ bars: [BAR], indicators: {} });
    });

    it('reads closed daily bars from the session-keyed cache as a US listing and passes both flags', async () => {
        expect(await getInvestorFlowsEvaluationOptions('aapl')).toEqual({
            includeFinraData: true,
            includeExchangeLists: true,
            squeezeContext: {
                dailyBars: [
                    { date: '2026-10-15', close: 251.2, volume: 41_000_000 },
                ],
            },
        });
        expect(mockBars).toHaveBeenCalledWith('AAPL', 'us-equity');
    });

    it('follows the FINRA and Reg SHO flags', async () => {
        mockFinra.mockReturnValue(false);
        mockRegSho.mockReturnValue(false);
        expect(await getInvestorFlowsEvaluationOptions('AAPL')).toMatchObject({
            includeFinraData: false,
            includeExchangeLists: false,
        });
    });

    it('leaves the squeeze context out when there are no bars', async () => {
        mockBars.mockResolvedValue({ bars: [], indicators: {} });
        const options = await getInvestorFlowsEvaluationOptions('AAPL');
        expect('squeezeContext' in options).toBe(false);
    });

    it('scores without price when the bars fail (logs, never throws)', async () => {
        const warn = vi
            .spyOn(console, 'warn')
            .mockImplementation(() => undefined);
        mockBars.mockRejectedValue(new Error('FMP down'));
        const options = await getInvestorFlowsEvaluationOptions('AAPL');
        expect('squeezeContext' in options).toBe(false);
        expect(options.includeFinraData).toBe(true);
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });

    it('rethrows Next static-generation control-flow errors', async () => {
        const dynamicError = Object.assign(new Error('Dynamic server usage'), {
            digest: 'DYNAMIC_SERVER_USAGE',
        });
        mockBars.mockRejectedValue(dynamicError);
        await expect(getInvestorFlowsEvaluationOptions('AAPL')).rejects.toBe(
            dynamicError
        );
    });
});
