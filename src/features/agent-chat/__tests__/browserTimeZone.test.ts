import { afterEach, describe, expect, it, vi } from 'vitest';
import { browserTimeZone } from '../lib/browserTimeZone';

describe('browserTimeZone', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('returns Intl.DateTimeFormat().resolvedOptions().timeZone', () => {
        expect(browserTimeZone()).toBe(
            Intl.DateTimeFormat().resolvedOptions().timeZone
        );
    });

    it("returns '' when resolvedOptions().timeZone is undefined", () => {
        vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
            () =>
                ({
                    resolvedOptions: () => ({}),
                }) as unknown as Intl.DateTimeFormat
        );
        expect(browserTimeZone()).toBe('');
    });

    it("returns '' when Intl.DateTimeFormat throws", () => {
        vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
            throw new Error('unsupported');
        });
        expect(browserTimeZone()).toBe('');
    });
});
