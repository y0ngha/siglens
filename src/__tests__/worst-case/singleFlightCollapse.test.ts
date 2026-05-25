import { createSingleFlight } from '@/entities/ticker/lib/utils/singleFlight';

describe('SingleFlight collapse and failure propagation', () => {
    it('collapses 100 concurrent calls for same key into one execution', async () => {
        const sf = createSingleFlight<string>();
        let callCount = 0;

        const work = async (): Promise<string> => {
            callCount++;
            await new Promise(r => setTimeout(r, 10));
            return 'result';
        };

        const promises = Array.from({ length: 100 }, () =>
            sf.run('same-key', work)
        );

        const results = await Promise.all(promises);

        expect(callCount).toBe(1);
        expect(results.every(r => r === 'result')).toBe(true);
    });

    it('runs separate executions for different keys', async () => {
        const sf = createSingleFlight<string>();
        let callCount = 0;

        const work = async (): Promise<string> => {
            callCount++;
            return 'result';
        };

        await Promise.all([
            sf.run('key-a', work),
            sf.run('key-b', work),
            sf.run('key-c', work),
        ]);

        expect(callCount).toBe(3);
    });

    it('propagates failure to all waiting callers', async () => {
        const sf = createSingleFlight<string>();
        const error = new Error('Gemini API failed');

        const work = async (): Promise<string> => {
            throw error;
        };

        const promises = Array.from({ length: 5 }, () =>
            sf.run('fail-key', work)
        );

        const results = await Promise.allSettled(promises);

        expect(results.every(r => r.status === 'rejected')).toBe(true);
    });

    it('allows fresh execution after failure clears in-flight entry', async () => {
        const sf = createSingleFlight<string>();
        let attempt = 0;

        const work = async (): Promise<string> => {
            attempt++;
            if (attempt === 1) throw new Error('first fail');
            return 'success';
        };

        await expect(sf.run('retry-key', work)).rejects.toThrow('first fail');

        const result = await sf.run('retry-key', work);
        expect(result).toBe('success');
        expect(attempt).toBe(2);
    });

    it('clears entries after _resetForTest', async () => {
        const sf = createSingleFlight<string>();
        let callCount = 0;

        const longWork = async (): Promise<string> => {
            callCount++;
            await new Promise(r => setTimeout(r, 50));
            return 'done';
        };

        const promise1 = sf.run('key', longWork);
        sf._resetForTest();

        const promise2 = sf.run('key', longWork);

        await Promise.all([promise1, promise2]);

        expect(callCount).toBe(2);
    });
});
