import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { mockCache, mockClient, mockE2E, mockResolve } = vi.hoisted(() => ({
    mockCache: vi.fn(),
    mockClient: vi.fn(),
    mockE2E: vi.fn(() => false),
    mockResolve: vi.fn(),
}));
vi.mock('@/shared/cache/staticSymbolCache', () => ({
    staticSymbolCache: mockCache,
}));
vi.mock('@/shared/db/client', () => ({ tryGetDatabaseClient: mockClient }));
vi.mock('@/shared/api/e2eEnv', () => ({ isE2E: mockE2E }));
vi.mock('../../api/investorFlowsDartRepository', () => ({
    DrizzleInvestorFlowsDartRepository: class {
        resolveCorpCode = mockResolve;
    },
}));

import {
    INVESTOR_FLOWS_READINESS_TAG,
    investorFlowsTag,
} from '../../lib/investorFlowsTag';
import { getKrDartCorp } from '../../server/getKrDartCorp';

const CORP = {
    corpCode: '00126380',
    corpName: '삼성전자',
    matchedStockCode: '005930',
    viaCommonShare: true,
};

describe('getKrDartCorp', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockE2E.mockReturnValue(false);
        mockClient.mockReturnValue({ db: {} });
        mockResolve.mockResolvedValue(CORP);
        mockCache.mockImplementation(
            async (_keys: string[], _scope: string, fetcher: () => unknown) =>
                fetcher()
        );
    });

    it('resolves the stock code through the DART repository, cached 12h under the symbol and readiness tags', async () => {
        expect(await getKrDartCorp('005935.ks')).toEqual(CORP);
        expect(mockResolve).toHaveBeenCalledWith('005935');
        expect(mockCache).toHaveBeenCalledWith(
            ['investor-flows:kr-dart-corp-v1', '005935.KS'],
            '005935.KS',
            expect.any(Function),
            [investorFlowsTag('005935.KS'), INVESTOR_FLOWS_READINESS_TAG],
            43_200
        );
    });

    it('degrades a lookup failure to null (the note is optional) and logs it', async () => {
        const warn = vi
            .spyOn(console, 'warn')
            .mockImplementation(() => undefined);
        mockResolve.mockRejectedValue(new Error('db down'));
        expect(await getKrDartCorp('005930.KS')).toBeNull();
        expect(warn).toHaveBeenCalled();
        warn.mockRestore();
    });

    it('treats a missing database as a failure, not as "no mapping"', async () => {
        const warn = vi
            .spyOn(console, 'warn')
            .mockImplementation(() => undefined);
        mockClient.mockReturnValue(null);
        expect(await getKrDartCorp('005930.KS')).toBeNull();
        expect(warn).toHaveBeenCalledWith(
            expect.stringContaining('[getKrDartCorp]'),
            expect.any(Error)
        );
        warn.mockRestore();
    });

    it('rethrows Next control-flow errors', async () => {
        const dynamicError = Object.assign(new Error('Dynamic'), {
            digest: 'DYNAMIC_SERVER_USAGE',
        });
        mockCache.mockRejectedValue(dynamicError);
        await expect(getKrDartCorp('005930.KS')).rejects.toBe(dynamicError);
    });

    it('uses the fake DART mapping under E2E without touching the cache', async () => {
        mockE2E.mockReturnValue(true);
        expect(await getKrDartCorp('005935.KS')).toMatchObject({
            corpCode: '00126380',
            viaCommonShare: true,
        });
        expect(mockCache).not.toHaveBeenCalled();
    });
});
