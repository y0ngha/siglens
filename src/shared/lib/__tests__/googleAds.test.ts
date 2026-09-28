// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const config = vi.hoisted(() => ({
    GOOGLE_ADS_ID: 'AW-1',
    GOOGLE_ADS_CONVERSION_LABELS: {
        signUp: 'L1',
        chatQuestion: 'L2',
        tickerSelect: '',
    },
    SIGNUP_CONVERSION_COOKIE_DOMAIN: 'siglens.io',
    SIGNUP_CONVERSION_COOKIE_MAX_AGE_SECONDS: 600,
}));
vi.mock('@/shared/config/googleAds', () => config);

import {
    consumeSignupConversionFlag,
    createSignupConversionCookie,
    trackAdsConversion,
} from '@/shared/lib/googleAds';

beforeEach(() => {
    config.GOOGLE_ADS_ID = 'AW-1';
    delete window.dataLayer;
});
afterEach(() => vi.restoreAllMocks());

describe('trackAdsConversion', () => {
    it('queues the conversion as an Arguments object (gtag.js ignores arrays)', () => {
        trackAdsConversion('signUp');
        expect(window.dataLayer).toHaveLength(1);
        const entry = window.dataLayer![0];
        expect(Object.prototype.toString.call(entry)).toBe(
            '[object Arguments]'
        );
        expect(Array.from(entry as ArrayLike<unknown>)).toEqual([
            'event',
            'conversion',
            { send_to: 'AW-1/L1' },
        ]);
    });

    it('does nothing for a conversion without a label', () => {
        trackAdsConversion('tickerSelect');
        expect(window.dataLayer).toBeUndefined();
    });

    it('does nothing when the tag id is empty (dev, e2e, not configured)', () => {
        config.GOOGLE_ADS_ID = '';
        trackAdsConversion('signUp');
        expect(window.dataLayer).toBeUndefined();
    });
});

describe('createSignupConversionCookie', () => {
    it('is a 10-minute, client-readable flag on the parent domain', () => {
        expect(createSignupConversionCookie({ secure: true })).toEqual({
            name: 'siglens_signup_conversion',
            value: '1',
            maxAge: 600,
            path: '/',
            domain: 'siglens.io',
            sameSite: 'lax',
            secure: true,
            httpOnly: false,
        });
    });
});

describe('consumeSignupConversionFlag', () => {
    it('returns true and expires the flag with the same domain and path', () => {
        vi.spyOn(Document.prototype, 'cookie', 'get').mockReturnValue(
            'a=1; siglens_signup_conversion=1'
        );
        const set = vi
            .spyOn(Document.prototype, 'cookie', 'set')
            .mockImplementation(() => {});
        expect(consumeSignupConversionFlag()).toBe(true);
        expect(set).toHaveBeenCalledWith(
            'siglens_signup_conversion=; Max-Age=0; Path=/; Domain=siglens.io'
        );
    });

    it('returns false and writes nothing without the flag', () => {
        vi.spyOn(Document.prototype, 'cookie', 'get').mockReturnValue('a=1');
        const set = vi
            .spyOn(Document.prototype, 'cookie', 'set')
            .mockImplementation(() => {});
        expect(consumeSignupConversionFlag()).toBe(false);
        expect(set).not.toHaveBeenCalled();
    });
});
