import {
    buildTweetIntentUrl,
    isShareAbort,
    canShareNatively,
    buildKakaoSharePayload,
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
});

describe('buildKakaoSharePayload', () => {
    it('returns the input payload object', () => {
        const payload = {
            title: 'AAPL 분석',
            description: '강세 추세',
            url: 'https://siglens.io/share/abc',
        };
        expect(buildKakaoSharePayload(payload)).toEqual(payload);
    });
});
