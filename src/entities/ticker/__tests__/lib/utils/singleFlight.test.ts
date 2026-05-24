import { createSingleFlight } from '../../../lib/utils/singleFlight';

describe('createSingleFlight', () => {
    it('shares a single promise across concurrent calls with the same key', async () => {
        const sf = createSingleFlight<number>();
        let invocations = 0;
        const work = async (): Promise<number> => {
            invocations += 1;
            await new Promise(resolve => setTimeout(resolve, 5));
            return 42;
        };
        const [a, b, c] = await Promise.all([
            sf.run('k', work),
            sf.run('k', work),
            sf.run('k', work),
        ]);
        expect(a).toBe(42);
        expect(b).toBe(42);
        expect(c).toBe(42);
        expect(invocations).toBe(1);
    });

    it('runs new work after a settled call (registry cleared on settle)', async () => {
        const sf = createSingleFlight<string>();
        let invocations = 0;
        const work = async (): Promise<string> => {
            invocations += 1;
            return 'ok';
        };
        await sf.run('k', work);
        await sf.run('k', work);
        expect(invocations).toBe(2);
    });

    it('clears the registry on rejection so retries are not blocked', async () => {
        const sf = createSingleFlight<number>();
        let attempt = 0;
        const work = async (): Promise<number> => {
            attempt += 1;
            if (attempt === 1) throw new Error('boom');
            return 7;
        };
        await expect(sf.run('k', work)).rejects.toThrow('boom');
        await expect(sf.run('k', work)).resolves.toBe(7);
        expect(attempt).toBe(2);
    });

    it('runs different keys independently', async () => {
        const sf = createSingleFlight<string>();
        const a = await sf.run('a', async () => 'A');
        const b = await sf.run('b', async () => 'B');
        expect(a).toBe('A');
        expect(b).toBe('B');
    });

    it('_resetForTest clears in-flight entries', async () => {
        const sf = createSingleFlight<number>();
        let invocations = 0;
        const slow = (): Promise<number> => {
            invocations += 1;
            return new Promise(resolve => setTimeout(() => resolve(1), 10));
        };
        const first = sf.run('k', slow);
        sf._resetForTest();
        const second = sf.run('k', slow);
        await Promise.all([first, second]);
        expect(invocations).toBe(2);
    });
});
