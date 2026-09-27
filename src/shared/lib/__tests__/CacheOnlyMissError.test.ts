import { CacheOnlyMissError } from '@/shared/lib/CacheOnlyMissError';

describe('CacheOnlyMissError', () => {
    it('extends Error', () => {
        const error = new CacheOnlyMissError();
        expect(error).toBeInstanceOf(Error);
    });

    it('has name "CacheOnlyMissError"', () => {
        const error = new CacheOnlyMissError();
        expect(error.name).toBe('CacheOnlyMissError');
    });

    it('has message "cache_miss"', () => {
        const error = new CacheOnlyMissError();
        expect(error.message).toBe('cache_miss');
    });

    it('has isCacheOnlyMiss set to true', () => {
        const error = new CacheOnlyMissError();
        expect(error.isCacheOnlyMiss).toBe(true);
    });

    it('can be caught with instanceof check', () => {
        try {
            throw new CacheOnlyMissError();
        } catch (e) {
            expect(e).toBeInstanceOf(CacheOnlyMissError);
            expect((e as CacheOnlyMissError).isCacheOnlyMiss).toBe(true);
        }
    });
});
