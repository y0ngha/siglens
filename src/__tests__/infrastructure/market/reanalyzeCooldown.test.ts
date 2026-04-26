import {
    getReanalyzeCooldownMs,
    releaseReanalyzeCooldown,
    tryAcquireReanalyzeCooldown,
} from '@/infrastructure/market/reanalyzeCooldown';
import {
    getReanalyzeCooldownMs as coreGetMs,
    releaseReanalyzeCooldown as coreRelease,
    tryAcquireReanalyzeCooldown as coreTryAcquire,
} from '@y0ngha/siglens-core';

jest.mock('@y0ngha/siglens-core', () => ({
    ...jest.requireActual('@y0ngha/siglens-core'),
    tryAcquireReanalyzeCooldown: jest.fn(),
    releaseReanalyzeCooldown: jest.fn(),
    getReanalyzeCooldownMs: jest.fn(),
}));

const mockTryAcquire = coreTryAcquire as jest.MockedFunction<
    typeof coreTryAcquire
>;
const mockRelease = coreRelease as jest.MockedFunction<typeof coreRelease>;
const mockGetMs = coreGetMs as jest.MockedFunction<typeof coreGetMs>;

describe('reanalyzeCooldown wrapper는', () => {
    beforeEach(() => {
        mockTryAcquire.mockReset();
        mockRelease.mockReset();
        mockGetMs.mockReset();
    });

    it('tryAcquireReanalyzeCooldown은 인자를 그대로 위임한다', async () => {
        mockTryAcquire.mockResolvedValueOnce({ ok: true });

        const result = await tryAcquireReanalyzeCooldown('AAPL', '1Day');

        expect(mockTryAcquire).toHaveBeenCalledWith('AAPL', '1Day');
        expect(result).toEqual({ ok: true });
    });

    it('releaseReanalyzeCooldown은 인자를 그대로 위임한다', async () => {
        mockRelease.mockResolvedValueOnce(undefined);

        await releaseReanalyzeCooldown('AAPL', '1Day');

        expect(mockRelease).toHaveBeenCalledWith('AAPL', '1Day');
    });

    it('getReanalyzeCooldownMs는 인자를 위임하고 ms 값을 반환한다', async () => {
        mockGetMs.mockResolvedValueOnce(120_000);

        const result = await getReanalyzeCooldownMs('AAPL', '1Day');

        expect(mockGetMs).toHaveBeenCalledWith('AAPL', '1Day');
        expect(result).toBe(120_000);
    });
});
