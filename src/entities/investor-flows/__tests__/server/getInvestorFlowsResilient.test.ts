import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getInvestorFlowsResilient } from '../../server/getInvestorFlowsResilient';

vi.mock('server-only', () => ({}));

const { mockGetSnapshot, mockIsDynamic, mockIsE2E } = vi.hoisted(() => ({
    mockGetSnapshot: vi.fn(),
    mockIsDynamic: vi.fn(() => false),
    mockIsE2E: vi.fn(() => false),
}));
vi.mock('../../server/getInvestorFlowsSnapshot', () => ({
    getInvestorFlowsSnapshot: mockGetSnapshot,
}));
vi.mock('@/shared/lib/isDynamicServerError', () => ({
    isDynamicServerError: mockIsDynamic,
}));
vi.mock('@/shared/api/e2eEnv', () => ({ isE2E: mockIsE2E }));

describe('getInvestorFlowsResilient', () => {
    beforeEach(() => {
        mockGetSnapshot.mockReset();
        mockIsDynamic.mockReturnValue(false);
        mockIsE2E.mockReturnValue(false);
    });

    it('returns the snapshot, not degraded', async () => {
        const snapshot = { asOf: 'x' };
        mockGetSnapshot.mockResolvedValue(snapshot);
        expect(await getInvestorFlowsResilient('AAPL')).toEqual({
            snapshot,
            degraded: false,
        });
    });

    it('treats "no data" (null) as a normal, non-degraded result', async () => {
        mockGetSnapshot.mockResolvedValue(null);
        expect(await getInvestorFlowsResilient('ZZZZ')).toEqual({
            snapshot: null,
            degraded: false,
        });
    });

    it('degrades (and logs) on an infrastructure failure', async () => {
        const error = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);
        mockGetSnapshot.mockRejectedValue(new Error('db down'));
        expect(await getInvestorFlowsResilient('MSFT')).toEqual({
            snapshot: null,
            degraded: true,
        });
        expect(error).toHaveBeenCalledTimes(1);
        error.mockRestore();
    });

    it('stays silent about the expected degrade under E2E', async () => {
        const error = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);
        mockIsE2E.mockReturnValue(true);
        mockGetSnapshot.mockRejectedValue(new Error('no key'));
        await getInvestorFlowsResilient('NVDA');
        expect(error).not.toHaveBeenCalled();
        error.mockRestore();
    });

    it('re-throws Next’s dynamic-server control-flow error untouched', async () => {
        const dynamic = new Error('DYNAMIC_SERVER_USAGE');
        mockIsDynamic.mockReturnValue(true);
        mockGetSnapshot.mockRejectedValue(dynamic);
        await expect(getInvestorFlowsResilient('TSLA')).rejects.toBe(dynamic);
    });
});
