import type { MockedFunction } from 'vitest';
import {
    getReanalyzeCooldownMs,
    tryAcquireReanalyzeCooldown,
} from '../lib/reanalyzeCooldown';
import {
    getReanalyzeCooldownMs as coreGetMs,
    tryAcquireReanalyzeCooldown as coreTryAcquire,
} from '@y0ngha/siglens-core';

vi.mock('@y0ngha/siglens-core', async () => ({
    ...(await vi.importActual('@y0ngha/siglens-core')),
    tryAcquireReanalyzeCooldown: vi.fn(),
    getReanalyzeCooldownMs: vi.fn(),
}));

const mockTryAcquire = coreTryAcquire as MockedFunction<typeof coreTryAcquire>;
const mockGetMs = coreGetMs as MockedFunction<typeof coreGetMs>;

describe('reanalyzeCooldown wrapper는', () => {
    beforeEach(() => {
        mockTryAcquire.mockReset();
        mockGetMs.mockReset();
    });

    it('tryAcquireReanalyzeCooldown은 인자를 그대로 위임한다', async () => {
        mockTryAcquire.mockResolvedValueOnce({ ok: true });

        const result = await tryAcquireReanalyzeCooldown('AAPL', '1Day');

        expect(mockTryAcquire).toHaveBeenCalledWith('AAPL', '1Day');
        expect(result).toEqual({ ok: true });
    });

    it('tryAcquireReanalyzeCooldown은 core가 예외를 던지면 { ok: true }를 반환한다', async () => {
        mockTryAcquire.mockRejectedValueOnce(
            new Error('Redis connection failed')
        );

        const result = await tryAcquireReanalyzeCooldown('AAPL', '1Day');

        expect(result).toEqual({ ok: true });
    });

    it('getReanalyzeCooldownMs는 인자를 위임하고 ms 값을 반환한다', async () => {
        mockGetMs.mockResolvedValueOnce(120_000);

        const result = await getReanalyzeCooldownMs('AAPL', '1Day');

        expect(mockGetMs).toHaveBeenCalledWith('AAPL', '1Day');
        expect(result).toBe(120_000);
    });

    it('getReanalyzeCooldownMs는 core가 예외를 던지면 0을 반환한다', async () => {
        mockGetMs.mockRejectedValueOnce(new Error('Redis connection failed'));

        const result = await getReanalyzeCooldownMs('AAPL', '1Day');

        expect(result).toBe(0);
    });
});
