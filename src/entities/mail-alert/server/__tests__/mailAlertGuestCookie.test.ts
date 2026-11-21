const store = vi.hoisted(() => ({
    values: new Map<string, string>(),
    set: vi.fn(),
}));
vi.mock('next/headers', () => ({
    cookies: vi.fn(async () => ({
        get: (name: string) => {
            const value = store.values.get(name);
            return value === undefined ? undefined : { name, value };
        },
        set: store.set,
    })),
}));

import { signReportValue } from '@/entities/email-report/lib/reportSignature';
import { MAIL_ALERT_COOKIE_MAX_AGE_SECONDS } from '@/entities/mail-alert/lib/mailAlertConstants';
import {
    encodeMailAlertCookie,
    MAIL_ALERT_COOKIE_NAME,
    mailAlertCookieSigningValue,
} from '@/entities/mail-alert/lib/mailAlertCookie';
import { createMailAlertGuestCookie } from '@/entities/mail-alert/server/mailAlertGuestCookie';

const SECRET = 'cookie-secret-that-is-long-enough-123456';
const ID = '3f2b8a1e-6c4d-4e5f-9a7b-1c2d3e4f5a6b';
const NOW_MS = Date.UTC(2026, 10, 23);
const NOW_S = NOW_MS / 1000;
const clock = () => NOW_MS;
const cookie = () => createMailAlertGuestCookie(SECRET, clock);

/** 주어진 발급 시각으로 서명한 쿠키 값. */
const issued = (issuedAt: number, id = ID) =>
    encodeMailAlertCookie(
        id,
        issuedAt,
        signReportValue(
            SECRET,
            'alert-session',
            mailAlertCookieSigningValue(id, issuedAt)
        )
    );

beforeEach(() => {
    store.values.clear();
    store.set.mockClear();
});

describe('createMailAlertGuestCookie', () => {
    it('write: 발급 시각을 넣어 서명한 값을 HttpOnly·SameSite=Lax로 최대 수명 동안 심는다', async () => {
        await cookie().write(ID);

        expect(store.set).toHaveBeenCalledWith(
            MAIL_ALERT_COOKIE_NAME,
            issued(NOW_S),
            expect.objectContaining({
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                maxAge: MAIL_ALERT_COOKIE_MAX_AGE_SECONDS,
            })
        );
    });

    it('Secure는 운영에서만 켠다', async () => {
        vi.stubEnv('NODE_ENV', 'production');
        await cookie().write(ID);
        vi.stubEnv('NODE_ENV', 'test');
        await cookie().write(ID);
        vi.unstubAllEnvs();

        const secureFlags = store.set.mock.calls.map(
            call => (call[2] as { secure: boolean }).secure
        );
        expect(secureFlags).toEqual([true, false]);
    });

    it('read: 방금 쓴 값은 구독자 id를 돌려준다', async () => {
        store.values.set(MAIL_ALERT_COOKIE_NAME, issued(NOW_S));

        await expect(cookie().read()).resolves.toBe(ID);
    });

    it('read: 수명 안이면 통하고, 최대 수명을 넘기면 서명이 맞아도 null이다(브라우저가 Max-Age를 어겨도)', async () => {
        store.values.set(
            MAIL_ALERT_COOKIE_NAME,
            issued(NOW_S - MAIL_ALERT_COOKIE_MAX_AGE_SECONDS)
        );
        await expect(cookie().read()).resolves.toBe(ID);

        store.values.set(
            MAIL_ALERT_COOKIE_NAME,
            issued(NOW_S - MAIL_ALERT_COOKIE_MAX_AGE_SECONDS - 1)
        );
        await expect(cookie().read()).resolves.toBeNull();
    });

    it('read: 미래에 발급됐다고 주장하는 값은 시계 여유를 넘으면 null이다', async () => {
        store.values.set(MAIL_ALERT_COOKIE_NAME, issued(NOW_S + 30));
        await expect(cookie().read()).resolves.toBe(ID);

        store.values.set(MAIL_ALERT_COOKIE_NAME, issued(NOW_S + 3600));
        await expect(cookie().read()).resolves.toBeNull();
    });

    it.each([
        ['쿠키가 없다', undefined],
        ['모양이 어긋난다', 'garbage'],
        ['서명이 틀렸다', encodeMailAlertCookie(ID, NOW_S, 'forged')],
        [
            '다른 용도의 서명이다',
            encodeMailAlertCookie(
                ID,
                NOW_S,
                signReportValue(
                    SECRET,
                    'alert-manage',
                    mailAlertCookieSigningValue(ID, NOW_S)
                )
            ),
        ],
        [
            '발급 시각만 바꿨다(서명이 시각을 덮는다)',
            encodeMailAlertCookie(
                ID,
                NOW_S + 5,
                signReportValue(
                    SECRET,
                    'alert-session',
                    mailAlertCookieSigningValue(ID, NOW_S)
                )
            ),
        ],
        [
            '다른 id에 붙은 서명이다',
            encodeMailAlertCookie(
                '00000000-0000-4000-8000-000000000000',
                NOW_S,
                signReportValue(
                    SECRET,
                    'alert-session',
                    mailAlertCookieSigningValue(ID, NOW_S)
                )
            ),
        ],
    ])('read: %s면 null이다', async (_name, value) => {
        if (value !== undefined)
            store.values.set(MAIL_ALERT_COOKIE_NAME, value);

        await expect(cookie().read()).resolves.toBeNull();
    });

    it('clear: 값을 비우고 수명 0으로 지운다', async () => {
        await cookie().clear();

        expect(store.set).toHaveBeenCalledWith(
            MAIL_ALERT_COOKIE_NAME,
            '',
            expect.objectContaining({ maxAge: 0, httpOnly: true, path: '/' })
        );
    });
});
