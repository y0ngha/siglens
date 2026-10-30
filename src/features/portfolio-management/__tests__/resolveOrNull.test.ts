import { resolveOrNull } from '@/features/portfolio-management/lib/resolveOrNull';

describe('resolveOrNull', () => {
    it('passes the input through and returns the resolved value', async () => {
        const run = vi.fn().mockResolvedValue({ status: 'ok' });

        await expect(resolveOrNull(run, 'AAPL')).resolves.toEqual({
            status: 'ok',
        });
        expect(run).toHaveBeenCalledWith('AAPL');
    });

    it('returns null when the callee rejects', async () => {
        const run = vi.fn().mockRejectedValue(new Error('session outage'));

        await expect(resolveOrNull(run, 'AAPL')).resolves.toBeNull();
    });
});
