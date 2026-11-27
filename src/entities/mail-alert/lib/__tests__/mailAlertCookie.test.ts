import {
    decodeMailAlertCookie,
    encodeMailAlertCookie,
    isSubscriberId,
    MAIL_ALERT_COOKIE_NAME,
    mailAlertCookieSigningValue,
} from '@/entities/mail-alert/lib/mailAlertCookie';

const ID = '3f2b8a1e-6c4d-4e5f-9a7b-1c2d3e4f5a6b';

describe('mailAlertCookie', () => {
    it('쿠키 이름은 방침 §7이 적는 이름이다', () => {
        expect(MAIL_ALERT_COOKIE_NAME).toBe('siglens_mail_alert');
    });

    it('서명이 덮는 값은 id와 발급 시각이다', () => {
        expect(mailAlertCookieSigningValue(ID, 1700000000)).toBe(
            `${ID}.1700000000`
        );
    });

    it('만든 값을 그대로 풀 수 있다', () => {
        expect(
            decodeMailAlertCookie(
                encodeMailAlertCookie(ID, 1700000000, 'abc_-123')
            )
        ).toEqual({
            subscriberId: ID,
            issuedAtSeconds: 1700000000,
            signature: 'abc_-123',
        });
    });

    it.each([
        undefined,
        '',
        ID,
        `${ID}.1700000000`,
        `${ID}.1700000000.`,
        `${ID}.abc.sig`,
        `${ID}.-5.sig`,
        `${ID}.1.5.sig`.replace('1.5', '1e3'),
        '.1700000000.sig',
        'not-a-uuid.1700000000.sig',
        `${ID.slice(1)}.1700000000.sig`,
    ])('모양이 어긋난 값(%s)은 null이다', raw => {
        expect(decodeMailAlertCookie(raw)).toBeNull();
    });

    it('서명 안의 점은 서명의 일부로 둔다(앞의 두 점만 구분자)', () => {
        expect(decodeMailAlertCookie(`${ID}.1700000000.a.b`)).toEqual({
            subscriberId: ID,
            issuedAtSeconds: 1700000000,
            signature: 'a.b',
        });
    });

    it('isSubscriberId는 UUID만 통과시킨다', () => {
        expect(isSubscriberId(ID)).toBe(true);
        expect(isSubscriberId('x')).toBe(false);
    });
});
