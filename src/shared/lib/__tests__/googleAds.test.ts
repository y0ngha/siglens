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
    ADS_CONVERSION_QUEUED_EVENT,
    consumeSignupConversionFlag,
    createSignupConversionCookie,
    hasAdClickId,
    hasQueuedAdsConversion,
    initAdsCommandQueue,
    trackAdsConversion,
} from '@/shared/lib/googleAds';

/** 큐에 들어간 명령을 `[명령, ...인자]` 배열로 펼친다. */
const queued = () =>
    (window.dataLayer ?? []).map(entry =>
        Array.from(entry as ArrayLike<unknown>)
    );

beforeEach(() => {
    config.GOOGLE_ADS_ID = 'AW-1';
    delete window.dataLayer;
    delete (window as Window & { __siglensAdsInit?: boolean }).__siglensAdsInit;
});
afterEach(() => vi.restoreAllMocks());

describe('trackAdsConversion', () => {
    it('queues the conversion as an Arguments object (gtag.js ignores arrays)', () => {
        trackAdsConversion('signUp');
        const entry = window.dataLayer!.at(-1);
        expect(Object.prototype.toString.call(entry)).toBe(
            '[object Arguments]'
        );
        expect(Array.from(entry as ArrayLike<unknown>)).toEqual([
            'event',
            'conversion',
            { send_to: 'AW-1/L1' },
        ]);
    });

    /**
     * 개인화 끔 설정(`config`)이 전환보다 먼저 큐에 있어야 한다. gtag.js를 늦게 불러오는
     * 지금은 전환이 태그 마운트보다 먼저 일어날 수도 있으므로 전환 쪽에서도 보장한다.
     */
    it('puts the config (personalization off) ahead of the conversion, once', () => {
        trackAdsConversion('signUp');
        trackAdsConversion('chatQuestion');
        const commands = queued().map(entry => entry[0]);
        expect(commands).toEqual(['js', 'config', 'event', 'event']);
        expect(queued()[1]).toEqual([
            'config',
            'AW-1',
            { allow_ad_personalization_signals: false },
        ]);
    });

    it('remembers that a conversion was queued in this document', () => {
        trackAdsConversion('signUp');
        expect(hasQueuedAdsConversion()).toBe(true);
    });

    it('tells the tag to load gtag.js now', () => {
        const listener = vi.fn();
        window.addEventListener(ADS_CONVERSION_QUEUED_EVENT, listener);
        trackAdsConversion('signUp');
        window.removeEventListener(ADS_CONVERSION_QUEUED_EVENT, listener);
        expect(listener).toHaveBeenCalledTimes(1);
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

describe('initAdsCommandQueue', () => {
    it('queues js and config only once per document', () => {
        initAdsCommandQueue('AW-1');
        initAdsCommandQueue('AW-1');
        expect(queued().map(entry => entry[0])).toEqual(['js', 'config']);
    });
});

describe('hasAdClickId', () => {
    it.each(['?gclid=x', '?a=1&gbraid=y', '?wbraid=z'])('%s → true', search => {
        expect(hasAdClickId(search)).toBe(true);
    });

    it.each(['', '?utm_source=google', '?q=gclid'])('%s → false', search => {
        expect(hasAdClickId(search)).toBe(false);
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
