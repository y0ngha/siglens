import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getInvestorFlowsDataProvider } from '../../server/getInvestorFlowsDataProvider';

vi.mock('server-only', () => ({}));

const { mockClient, mockFmp, mockEnabled, mockRegSho } = vi.hoisted(() => ({
    mockClient: vi.fn(),
    mockFmp: vi.fn(),
    mockEnabled: vi.fn(() => true),
    mockRegSho: vi.fn(() => true),
}));
vi.mock('@/shared/db/client', () => ({ tryGetDatabaseClient: mockClient }));
vi.mock('@/shared/api/fmp/getInvestorFlowsFmpProvider', () => ({
    getInvestorFlowsFmpProvider: mockFmp,
}));
const { mockE2E } = vi.hoisted(() => ({ mockE2E: vi.fn(() => false) }));
vi.mock('@/shared/api/e2eEnv', () => ({ isE2E: mockE2E }));
vi.mock('@/shared/api/finra/finraShortDataEnabled', () => ({
    isFinraShortDataEnabled: mockEnabled,
}));
vi.mock('@/shared/api/exchange/regShoThresholdDataEnabled', () => ({
    isRegShoThresholdDataEnabled: mockRegSho,
}));

/** 모든 쿼리가 자기 select 열을 기록하고 빈 결과를 돌려주는 db. raw `execute`(FTD)도 빈 결과다. */
function recordingDb(executed: string[]) {
    const chain: unknown = new Proxy(() => undefined, {
        get(_t, prop) {
            if (prop === 'then')
                return (resolve: (v: unknown) => unknown) => resolve([]);
            return () => chain;
        },
        apply: () => chain,
    });
    return {
        select: (cols: unknown) => {
            executed.push(JSON.stringify(Object.keys((cols ?? {}) as object)));
            return chain;
        },
        execute: async () => {
            executed.push('execute');
            return [];
        },
    };
}

const EMPTY_FMP = {
    getInsiderTrades: async () => [],
    getInsiderStatistics: async () => [],
    getBeneficialOwnership: async () => [],
    getSharesFloat: async () => null,
};

describe('getInvestorFlowsDataProvider', () => {
    beforeEach(() => {
        mockClient.mockReset();
        mockFmp.mockReset();
        mockEnabled.mockReturnValue(true);
        mockRegSho.mockReturnValue(true);
        mockE2E.mockReturnValue(false);
    });

    // NOTE: the E2E branch (`require('./FakeInvestorFlowsDataProvider')`) is not unit-tested: vitest cannot
    // resolve the synchronous require (same limitation as getInvestorFlowsFmpProvider.test.ts). The fake itself is
    // covered by investorFlowsCachedProviderAndFake.test.ts; the e2e specs exercise the gate end to end.

    it('throws when the database is unavailable instead of faking an empty snapshot', () => {
        mockClient.mockReturnValue(null);
        expect(() => getInvestorFlowsDataProvider()).toThrow(
            '[investor-flows] database unavailable'
        );
    });

    it('returns a provider exposing the port method', () => {
        mockClient.mockReturnValue({ db: {} });
        mockFmp.mockReturnValue({});
        expect(
            getInvestorFlowsDataProvider().getInvestorFlowsSnapshot
        ).toBeTypeOf('function');
    });

    it('does not touch FINRA or Reg SHO tables when both flags are off (end to end through the real reads wiring)', async () => {
        mockEnabled.mockReturnValue(false);
        mockRegSho.mockReturnValue(false);
        const executed: string[] = [];
        mockClient.mockReturnValue({ db: recordingDb(executed) });
        mockFmp.mockReturnValue(EMPTY_FMP);
        const snapshot =
            await getInvestorFlowsDataProvider().getInvestorFlowsSnapshot(
                'AAPL'
            );
        expect(snapshot).toBeNull();
        // FINRA(settlementDate·shortQty / tradeDate·shortVolume)와 Reg SHO(tradeDate·market, 상태 키) select가 없다.
        expect(executed.some(cols => cols.includes('shortQty'))).toBe(false);
        expect(executed.some(cols => cols.includes('tradeDate'))).toBe(false);
        expect(executed.some(cols => cols.includes('value'))).toBe(false);
        // cusip 조회·FTD(raw execute)·Form 144(전체 열)·증자 공시는 플래그와 무관하게 읽는다.
        expect(executed).toContain('["cusip"]');
        expect(executed).toContain('execute');
    });

    it('reads the Reg SHO listings and the ingested-dates state while that flag is on', async () => {
        mockEnabled.mockReturnValue(false);
        const executed: string[] = [];
        mockClient.mockReturnValue({ db: recordingDb(executed) });
        mockFmp.mockReturnValue(EMPTY_FMP);
        await getInvestorFlowsDataProvider().getInvestorFlowsSnapshot('AAPL');
        expect(executed).toContain('["tradeDate","market"]');
        expect(executed).toContain('["value"]');
    });

    it('routes a Korean symbol to the DART tables only — no FMP provider, no 13F/FINRA/SEC reads', async () => {
        const executed: string[] = [];
        mockClient.mockReturnValue({ db: recordingDb(executed) });
        const snapshot =
            await getInvestorFlowsDataProvider().getInvestorFlowsSnapshot(
                '005930.KS'
            );
        expect(snapshot).toBeNull();
        expect(mockFmp).not.toHaveBeenCalled();
        // dart_corp_code 조회(stockCode·corpCode·corpName)만 일어나고, 매핑이 없으니 공시 조회도 없다.
        expect(executed).toEqual(['["stockCode","corpCode","corpName"]']);
        expect(executed).not.toContain('["cusip"]');
        expect(executed).not.toContain('execute');
    });
});
