import {
    buildTweetIntentUrl,
    isShareAbort,
    canShareNatively,
} from '@/shared/lib/share';

describe('buildTweetIntentUrl', () => {
    it('includes the share url and encoded text', () => {
        const url = buildTweetIntentUrl({
            text: 'AAPL 강세',
            shareUrl: 'https://siglens.io/share/abc',
        });
        expect(url).toContain('https://twitter.com/intent/tweet');
        expect(url).toContain(
            encodeURIComponent('https://siglens.io/share/abc')
        );
        expect(url).toContain(encodeURIComponent('AAPL 강세'));
    });
});

describe('isShareAbort', () => {
    it('detects AbortError', () => {
        const e = new DOMException('cancelled', 'AbortError');
        expect(isShareAbort(e)).toBe(true);
    });
    it('returns false for other errors', () => {
        expect(isShareAbort(new Error('boom'))).toBe(false);
    });
});

describe('canShareNatively', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('returns true when navigator.share is a function and pointer is coarse', () => {
        vi.stubGlobal('navigator', {
            share: vi.fn(),
        });
        vi.stubGlobal('window', {
            matchMedia: vi.fn().mockReturnValue({ matches: true }),
        });
        expect(canShareNatively()).toBe(true);
    });

    it('returns false when navigator.share is missing', () => {
        vi.stubGlobal('navigator', {});
        vi.stubGlobal('window', {
            matchMedia: vi.fn().mockReturnValue({ matches: true }),
        });
        expect(canShareNatively()).toBe(false);
    });

    it('returns false when pointer is not coarse', () => {
        vi.stubGlobal('navigator', {
            share: vi.fn(),
        });
        vi.stubGlobal('window', {
            matchMedia: vi.fn().mockReturnValue({ matches: false }),
        });
        expect(canShareNatively()).toBe(false);
    });

    // ── T6: SSR branch — navigator.share present but window.matchMedia undefined ──

    it('returns false when navigator.share is present but window.matchMedia is undefined', () => {
        /**
         * This covers the branch in canShareNatively where typeof window !== 'undefined'
         * but typeof window.matchMedia !== 'function'. The function falls through to
         * `return false` rather than evaluating matchMedia().matches.
         * Scenario: some environments expose window without matchMedia (e.g. jsdom
         * without matchMedia polyfill, or certain SSR shims).
         */
        vi.stubGlobal('navigator', { share: vi.fn() });
        vi.stubGlobal('window', {
            // matchMedia intentionally absent to exercise the typeof guard
        });
        expect(canShareNatively()).toBe(false);
    });
});
