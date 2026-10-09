// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

const config = vi.hoisted(() => ({
    GOOGLE_ADS_ID: '',
    GOOGLE_ADS_CONVERSION_LABELS: {
        signUp: '',
        chatQuestion: '',
        tickerSelect: '',
    },
    SIGNUP_CONVERSION_COOKIE_DOMAIN: 'siglens.io',
    SIGNUP_CONVERSION_COOKIE_MAX_AGE_SECONDS: 600,
}));
vi.mock('@/shared/config/googleAds', () => config);

import { FUNNEL_SIGNUP_COOKIE_NAME } from '@/shared/config/cookieNames';
import {
    consumeFunnelSignupCookie,
    createFunnelSignupCookie,
} from '@/shared/lib/funnel/signupCookie';

afterEach(() => vi.restoreAllMocks());

describe('createFunnelSignupCookie', () => {
    it('가입 방식을 값으로 담은 10분짜리 상위 도메인 쿠키다(httpOnly 아님)', () => {
        expect(
            createFunnelSignupCookie({ method: 'oauth', secure: true })
        ).toEqual({
            name: 'siglens_funnel_signup',
            value: 'oauth',
            maxAge: 600,
            path: '/',
            domain: 'siglens.io',
            sameSite: 'lax',
            secure: true,
            httpOnly: false,
        });
    });

    it('이름은 Ads 플래그 쿠키와 다르다 — 두 소비자가 한 쿠키를 다투지 않는다', () => {
        expect(FUNNEL_SIGNUP_COOKIE_NAME).not.toBe('siglens_signup_conversion');
    });
});

describe('consumeFunnelSignupCookie', () => {
    it('쿠키가 있으면 방식을 돌려주고 같은 Domain·Path로 만료시킨다', () => {
        vi.spyOn(Document.prototype, 'cookie', 'get').mockReturnValue(
            'a=1; siglens_funnel_signup=email'
        );
        const set = vi
            .spyOn(Document.prototype, 'cookie', 'set')
            .mockImplementation(() => {});
        expect(consumeFunnelSignupCookie()).toBe('email');
        expect(set).toHaveBeenCalledWith(
            'siglens_funnel_signup=; Max-Age=0; Path=/; Domain=siglens.io'
        );
    });

    it('Ads 플래그 쿠키는 건드리지 않는다 — GoogleAdsTag와 독립이다', () => {
        vi.spyOn(Document.prototype, 'cookie', 'get').mockReturnValue(
            'siglens_signup_conversion=1; siglens_funnel_signup=oauth'
        );
        const set = vi
            .spyOn(Document.prototype, 'cookie', 'set')
            .mockImplementation(() => {});
        expect(consumeFunnelSignupCookie()).toBe('oauth');
        expect(set).toHaveBeenCalledTimes(1);
        expect(
            set.mock.calls.some(([value]) =>
                String(value).startsWith('siglens_signup_conversion=')
            )
        ).toBe(false);
    });

    it('쿠키가 없으면 null이고 아무것도 쓰지 않는다', () => {
        vi.spyOn(Document.prototype, 'cookie', 'get').mockReturnValue('a=1');
        const set = vi
            .spyOn(Document.prototype, 'cookie', 'set')
            .mockImplementation(() => {});
        expect(consumeFunnelSignupCookie()).toBeNull();
        expect(set).not.toHaveBeenCalled();
    });

    it('값이 가입 방식이 아니면 지우되 null을 돌려준다', () => {
        vi.spyOn(Document.prototype, 'cookie', 'get').mockReturnValue(
            'siglens_funnel_signup=1'
        );
        const set = vi
            .spyOn(Document.prototype, 'cookie', 'set')
            .mockImplementation(() => {});
        expect(consumeFunnelSignupCookie()).toBeNull();
        expect(set).toHaveBeenCalledTimes(1);
    });
});
