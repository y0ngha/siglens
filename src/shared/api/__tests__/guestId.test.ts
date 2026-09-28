import type { MockedFunction } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ cookies: vi.fn() }));

import { cookies } from 'next/headers';
import { readGuestId } from '../guestId';
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
