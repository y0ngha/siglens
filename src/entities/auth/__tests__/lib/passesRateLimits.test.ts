import { passesRateLimits } from '@/entities/auth/lib/passesRateLimits';

const rule = (key: string) => ({ key, limit: 1, windowSeconds: 60 });

describe('passesRateLimits', () => {
    it('counts every rule in order when all pass', async () => {
        const seen: string[] = [];
        const rateLimit = vi.fn(async (r: { key: string }) => {
            seen.push(r.key);
            return true;
        });

        const result = await passesRateLimits(rateLimit, [
            rule('a'),
            rule('b'),
            rule('c'),
        ]);

        expect(result).toBe(true);
        expect(seen).toEqual(['a', 'b', 'c']);
    });

    it('stops at the first refusal and does not count the later rules', async () => {
        const seen: string[] = [];
        const rateLimit = vi.fn(async (r: { key: string }) => {
            seen.push(r.key);
            return r.key !== 'b';
        });

        const result = await passesRateLimits(rateLimit, [
            rule('a'),
            rule('b'),
            rule('c'),
        ]);

        expect(result).toBe(false);
        expect(seen).toEqual(['a', 'b']);
    });

    it('passes an empty rule list', async () => {
        await expect(passesRateLimits(vi.fn(), [])).resolves.toBe(true);
    });
});
