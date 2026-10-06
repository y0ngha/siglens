import type { MockedFunction } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ cookies: vi.fn() }));

import { cookies } from 'next/headers';
import { mintGuestIdOnResponse, readGuestId } from '../guestId';
import { GUEST_ID_COOKIE_NAME } from '@/shared/config/cookieNames';
import {
    GUEST_ID_MAX_AGE_SECONDS,
    signGuestId,
    verifyGuestCookie,
} from '@/shared/config/guestCookie';
import { MS_PER_MINUTE } from '@/shared/config/time';

const mockCookies = cookies as MockedFunction<typeof cookies>;

const VALID_UUID = '11111111-1111-1111-1111-111111111111';
const SECRET = 'a'.repeat(32);

function makeStore(existing?: string) {
    const set = vi.fn();
    return {
        set,
        get: vi.fn((name: string) =>
            name === GUEST_ID_COOKIE_NAME && existing
                ? { name, value: existing }
                : undefined
        ),
    };
}

describe('readGuestId', () => {
    beforeEach(() => {
        vi.stubEnv('OAUTH_STATE_HMAC_SECRET', SECRET);
    });

    it('유효하게 서명된 쿠키면 uuid를 반환한다', async () => {
        const signed = await signGuestId(VALID_UUID);
        const store = makeStore(signed);
        mockCookies.mockResolvedValue(
            store as unknown as Awaited<ReturnType<typeof cookies>>
        );

        await expect(readGuestId()).resolves.toBe(VALID_UUID);
    });

    it('쿠키가 없으면 null — 스스로 발급하지 않는다', async () => {
        const store = makeStore(undefined);
        mockCookies.mockResolvedValue(
            store as unknown as Awaited<ReturnType<typeof cookies>>
        );

        await expect(readGuestId()).resolves.toBeNull();
        expect(store.set).not.toHaveBeenCalled();
    });

    it('위조된(서명이 안 맞는) 쿠키면 null', async () => {
        const otherSigned = await signGuestId(
            '22222222-2222-2222-2222-222222222222'
        );
        const forgedSignature = otherSigned.split('.')[1];
        const forged = `${VALID_UUID}.${forgedSignature}`;
        const store = makeStore(forged);
        mockCookies.mockResolvedValue(
            store as unknown as Awaited<ReturnType<typeof cookies>>
        );

        await expect(readGuestId()).resolves.toBeNull();
    });
});

describe('mintGuestIdOnResponse', () => {
    /**
     * 실패 로그 억제 상태가 모듈 수명이라, 테스트끼리 시계를 충분히 벌려 둔다
     * (각 테스트가 앞 테스트의 억제 창 밖에서 시작한다).
     */
    let clock = Date.parse('2026-10-06T00:00:00.000Z');

    beforeEach(() => {
        vi.useFakeTimers();
        clock += 10 * MS_PER_MINUTE;
        vi.setSystemTime(clock);
        vi.stubEnv('OAUTH_STATE_HMAC_SECRET', SECRET);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
    });

    it('sets a signed, host-only, httpOnly, sameSite=lax guest cookie with the guest max-age', async () => {
        const store = makeStore(undefined);
        mockCookies.mockResolvedValue(
            store as unknown as Awaited<ReturnType<typeof cookies>>
        );

        await mintGuestIdOnResponse();

        expect(store.set).toHaveBeenCalledOnce();
        const [name, value, options] = store.set.mock.calls[0];
        expect(name).toBe(GUEST_ID_COOKIE_NAME);
        // 우리가 서명한 값이어야 다음 요청의 readGuestId가 받아들인다.
        expect(await verifyGuestCookie(value)).toMatch(/^[0-9a-f-]{36}$/);
        expect(options).toEqual({
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: GUEST_ID_MAX_AGE_SECONDS,
        });
        // 호스트 전용 — Domain을 지정하지 않는다.
        expect(options).not.toHaveProperty('domain');
    });

    it('does not throw when the signing secret is missing, and sets nothing', async () => {
        vi.stubEnv('OAUTH_STATE_HMAC_SECRET', '');
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const store = makeStore(undefined);
        mockCookies.mockResolvedValue(
            store as unknown as Awaited<ReturnType<typeof cookies>>
        );

        await expect(mintGuestIdOnResponse()).resolves.toBeUndefined();
        expect(store.set).not.toHaveBeenCalled();
    });

    it('does not throw when cookies() itself fails', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
        mockCookies.mockRejectedValue(new Error('outside request scope'));

        await expect(mintGuestIdOnResponse()).resolves.toBeUndefined();
    });

    it('logs a repeating failure at most once per minute', async () => {
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockCookies.mockRejectedValue(new Error('outside request scope'));

        await mintGuestIdOnResponse();
        await mintGuestIdOnResponse();
        vi.setSystemTime(clock + MS_PER_MINUTE - 1);
        await mintGuestIdOnResponse();
        expect(error).toHaveBeenCalledOnce();

        vi.setSystemTime(clock + MS_PER_MINUTE);
        await mintGuestIdOnResponse();
        expect(error).toHaveBeenCalledTimes(2);
    });
});
