import type { MockedFunction } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ cookies: vi.fn() }));

import { cookies } from 'next/headers';
import { getOrCreateGuestId, readGuestId } from '../guestId';
import { GUEST_ID_COOKIE_NAME } from '@/shared/config/cookieNames';
import { signGuestId } from '@/shared/config/guestCookie';

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

describe('getOrCreateGuestId', () => {
    const originalNodeEnv = process.env.NODE_ENV;

    beforeEach(() => {
        vi.stubEnv('OAUTH_STATE_HMAC_SECRET', SECRET);
    });

    afterEach(() => {
        (process.env as { NODE_ENV?: string }).NODE_ENV = originalNodeEnv;
    });

    it('유효하게 서명된 쿠키가 있으면 그대로 재사용하고 새로 쓰지 않는다', async () => {
        const signed = await signGuestId(VALID_UUID);
        const store = makeStore(signed);
        mockCookies.mockResolvedValue(
            store as unknown as Awaited<ReturnType<typeof cookies>>
        );

        const id = await getOrCreateGuestId();

        expect(id).toBe(VALID_UUID);
        expect(store.set).not.toHaveBeenCalled();
    });

    it('쿠키가 없으면 새 uuid를 서명해 발급하고 쿠키를 심는다', async () => {
        const store = makeStore(undefined);
        mockCookies.mockResolvedValue(
            store as unknown as Awaited<ReturnType<typeof cookies>>
        );

        const id = await getOrCreateGuestId();

        expect(store.set).toHaveBeenCalledTimes(1);
        const call = store.set.mock.calls[0]![0] as {
            name: string;
            value: string;
            httpOnly: boolean;
            sameSite: string;
            path: string;
            maxAge: number;
        };
        expect(call.name).toBe(GUEST_ID_COOKIE_NAME);
        expect(call.value.startsWith(`${id}.`)).toBe(true);
        expect(call).toMatchObject({
            httpOnly: true,
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 365,
        });
    });

    /** 서명 도입 이전 배포가 심은 값 — 다음 페이지 뷰에서 조용히 새 서명값으로 교체된다. */
    it('레거시(서명 없는) 쿠키 값이면 새로 발급한다', async () => {
        const store = makeStore(VALID_UUID);
        mockCookies.mockResolvedValue(
            store as unknown as Awaited<ReturnType<typeof cookies>>
        );

        const id = await getOrCreateGuestId();

        expect(id).not.toBe(VALID_UUID);
        expect(store.set).toHaveBeenCalledTimes(1);
    });

    it('쿠키 값이 UUID 형식이 아니면(변조) 새로 발급한다', async () => {
        const store = makeStore('not-a-uuid');
        mockCookies.mockResolvedValue(
            store as unknown as Awaited<ReturnType<typeof cookies>>
        );

        const id = await getOrCreateGuestId();

        expect(store.set).toHaveBeenCalledTimes(1);
        const call = store.set.mock.calls[0]![0] as { value: string };
        expect(call.value.startsWith(`${id}.`)).toBe(true);
    });

    it('production에서는 secure: true로 심는다', async () => {
        (process.env as { NODE_ENV?: string }).NODE_ENV = 'production';
        const store = makeStore(undefined);
        mockCookies.mockResolvedValue(
            store as unknown as Awaited<ReturnType<typeof cookies>>
        );

        await getOrCreateGuestId();

        expect(store.set).toHaveBeenCalledWith(
            expect.objectContaining({ secure: true })
        );
    });

    it('production이 아니면 secure: false로 심는다', async () => {
        (process.env as { NODE_ENV?: string }).NODE_ENV = 'test';
        const store = makeStore(undefined);
        mockCookies.mockResolvedValue(
            store as unknown as Awaited<ReturnType<typeof cookies>>
        );

        await getOrCreateGuestId();

        expect(store.set).toHaveBeenCalledWith(
            expect.objectContaining({ secure: false })
        );
    });
});

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
