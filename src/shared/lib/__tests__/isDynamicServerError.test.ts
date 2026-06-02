import { describe, it, expect } from 'vitest';
import { isDynamicServerError } from '@/shared/lib/isDynamicServerError';

describe('isDynamicServerError', () => {
    it('true when digest === DYNAMIC_SERVER_USAGE', () => {
        const e = Object.assign(new Error('anything'), {
            digest: 'DYNAMIC_SERVER_USAGE',
        });
        expect(isDynamicServerError(e)).toBe(true);
    });

    it('true when the message carries "Dynamic server usage" (digest absent)', () => {
        const e = new Error(
            "Dynamic server usage: Route /AAPL couldn't be rendered statically"
        );
        expect(isDynamicServerError(e)).toBe(true);
    });

    it('false for an unrelated infra Error', () => {
        expect(isDynamicServerError(new Error('FMP request timed out'))).toBe(
            false
        );
    });

    it('false for an Error with a different digest and unrelated message', () => {
        const e = Object.assign(new Error('not found'), {
            digest: 'NEXT_NOT_FOUND',
        });
        expect(isDynamicServerError(e)).toBe(false);
    });

    it('false for non-Error values, even if they look like the signal', () => {
        expect(isDynamicServerError('Dynamic server usage')).toBe(false);
        expect(isDynamicServerError({ digest: 'DYNAMIC_SERVER_USAGE' })).toBe(
            false
        );
        expect(isDynamicServerError(null)).toBe(false);
        expect(isDynamicServerError(undefined)).toBe(false);
    });
});
