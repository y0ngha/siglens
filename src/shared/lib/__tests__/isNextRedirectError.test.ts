import { describe, expect, it } from 'vitest';
import { isNextRedirectError } from '@/shared/lib/isNextRedirectError';

describe('isNextRedirectError', () => {
    it('matches the error Next.js redirect() throws', () => {
        expect(isNextRedirectError(new Error('NEXT_REDIRECT'))).toBe(true);
    });

    it('matches a mocked redirect error carrying the target path', () => {
        expect(isNextRedirectError(new Error('NEXT_REDIRECT:/login'))).toBe(
            true
        );
    });

    it('rejects ordinary errors', () => {
        expect(isNextRedirectError(new Error('db down'))).toBe(false);
    });

    it('rejects non-Error values even with a matching string', () => {
        expect(isNextRedirectError('NEXT_REDIRECT')).toBe(false);
        expect(isNextRedirectError(null)).toBe(false);
    });
});
