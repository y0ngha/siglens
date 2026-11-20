import { describe, expect, it } from 'vitest';
import { entrySourceOf } from '@/app/api/presence/_shared/entrySourceOf';
import type { PresenceBody } from '@/app/api/presence/_shared/readPresenceBody';

const EMPTY: PresenceBody = {
    referrerHost: null,
    utmSource: null,
    utmMedium: null,
    adClick: false,
    visit: null,
};

describe('entrySourceOf', () => {
    it('본문이 없으면 출처가 없다', () => {
        expect(entrySourceOf(null, '/ko/AAPL')).toBeNull();
    });

    it('본문이 없어도 공유 링크 경로면 share다(경로는 Referer에서 온다)', () => {
        expect(entrySourceOf(null, '/share/abc')).toBe('share');
    });

    it('외부 Referer 호스트를 분류값으로 바꾼다', () => {
        expect(
            entrySourceOf({ ...EMPTY, referrerHost: 'chatgpt.com' }, '/')
        ).toBe('chatgpt');
    });

    it('광고 클릭 식별자가 있으면 구글 Referer여도 paid다', () => {
        expect(
            entrySourceOf(
                { ...EMPTY, referrerHost: 'www.google.com', adClick: true },
                '/lp/stock-analysis'
            )
        ).toBe('paid');
    });

    it('utm_source=email은 email이다', () => {
        expect(entrySourceOf({ ...EMPTY, utmSource: 'email' }, '/market')).toBe(
            'email'
        );
    });

    it('utm_medium=cpc는 paid다', () => {
        expect(entrySourceOf({ ...EMPTY, utmMedium: 'cpc' }, '/')).toBe('paid');
    });

    it('같은 사이트 Referer는 출처가 없다', () => {
        expect(
            entrySourceOf({ ...EMPTY, referrerHost: 'siglens.io' }, '/AAPL')
        ).toBeNull();
    });
});
