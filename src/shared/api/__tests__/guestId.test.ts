import type { MockedFunction } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ cookies: vi.fn() }));
vi.mock('node:crypto', () => ({ randomUUID: vi.fn() }));

import { randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { getOrCreateGuestId } from '../guestId';
import { GUEST_ID_COOKIE_NAME } from '@/shared/config/cookieNames';

const mockCookies = cookies as MockedFunction<typeof cookies>;
const mockRandomUUID = randomUUID as MockedFunction<typeof randomUUID>;

const VALID_UUID = '11111111-1111-1111-1111-111111111111';
const NEW_UUID = '22222222-2222-2222-2222-222222222222';

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
        mockRandomUUID.mockReturnValue(NEW_UUID);
    });

    afterEach(() => {
        (process.env as { NODE_ENV?: string }).NODE_ENV = originalNodeEnv;
    });

    it('유효한 UUID 쿠키가 있으면 그대로 재사용하고 새로 쓰지 않는다', async () => {
        const store = makeStore(VALID_UUID);
        mockCookies.mockResolvedValue(
            store as unknown as Awaited<ReturnType<typeof cookies>>
        );

        const id = await getOrCreateGuestId();

        expect(id).toBe(VALID_UUID);
        expect(store.set).not.toHaveBeenCalled();
    });

    it('쿠키가 없으면 새 UUID를 발급하고 쿠키를 심는다', async () => {
        const store = makeStore(undefined);
        mockCookies.mockResolvedValue(
            store as unknown as Awaited<ReturnType<typeof cookies>>
        );

        const id = await getOrCreateGuestId();

        expect(id).toBe(NEW_UUID);
        expect(store.set).toHaveBeenCalledWith(
            expect.objectContaining({
                name: GUEST_ID_COOKIE_NAME,
                value: NEW_UUID,
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                maxAge: 60 * 60 * 24 * 365,
            })
        );
    });

    it('쿠키 값이 UUID 형식이 아니면(변조) 새로 발급한다', async () => {
        const store = makeStore('not-a-uuid');
        mockCookies.mockResolvedValue(
            store as unknown as Awaited<ReturnType<typeof cookies>>
        );

        const id = await getOrCreateGuestId();

        expect(id).toBe(NEW_UUID);
        expect(store.set).toHaveBeenCalledWith(
            expect.objectContaining({ value: NEW_UUID })
        );
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
