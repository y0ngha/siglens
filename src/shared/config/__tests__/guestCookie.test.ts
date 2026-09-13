import {
    GUEST_ID_MAX_AGE_SECONDS,
    GuestCookieSecretMisconfiguredError,
    guestIdCookieOptions,
    isValidGuestId,
    mintGuestCookieValue,
    signGuestId,
    verifyGuestCookie,
} from '@/shared/config/guestCookie';

const SECRET = 'a'.repeat(32);
const VALID_UUID = '11111111-1111-1111-1111-111111111111';
const OTHER_UUID = '22222222-2222-2222-2222-222222222222';

describe('isValidGuestId', () => {
    it('유효한 UUID면 true', () => {
        expect(isValidGuestId('11111111-1111-1111-1111-111111111111')).toBe(
            true
        );
    });
    it('undefined면 false', () => {
        expect(isValidGuestId(undefined)).toBe(false);
    });
    it('UUID 형식이 아니면 false', () => {
        expect(isValidGuestId('not-a-uuid')).toBe(false);
    });
});

describe('guestIdCookieOptions', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    afterEach(() => {
        (process.env as { NODE_ENV?: string }).NODE_ENV = originalNodeEnv;
    });

    it('production에서는 secure: true', () => {
        (process.env as { NODE_ENV?: string }).NODE_ENV = 'production';
        expect(guestIdCookieOptions()).toEqual({
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            path: '/',
            maxAge: GUEST_ID_MAX_AGE_SECONDS,
        });
    });

    it('production이 아니면 secure: false', () => {
        (process.env as { NODE_ENV?: string }).NODE_ENV = 'test';
        expect(guestIdCookieOptions().secure).toBe(false);
    });

    it('maxAge는 1년(초)', () => {
        expect(GUEST_ID_MAX_AGE_SECONDS).toBe(60 * 60 * 24 * 365);
    });
});

describe('signGuestId / verifyGuestCookie', () => {
    beforeEach(() => {
        vi.stubEnv('OAUTH_STATE_HMAC_SECRET', SECRET);
    });

    it('서명 후 검증하면 같은 uuid를 반환한다 (roundtrip)', async () => {
        const value = await signGuestId(VALID_UUID);
        await expect(verifyGuestCookie(value)).resolves.toBe(VALID_UUID);
    });

    it('값 형식은 <uuid>.<서명>', async () => {
        const value = await signGuestId(VALID_UUID);
        expect(value).toMatch(/^[0-9a-f-]{36}\.[\w-]+$/);
        expect(value.startsWith(`${VALID_UUID}.`)).toBe(true);
    });

    it('서명이 변조되면 null', async () => {
        const [uuid, signature] = (await signGuestId(VALID_UUID)).split('.');
        const tampered = `${uuid}.${signature!.slice(0, -1)}${signature!.at(-1) === 'A' ? 'B' : 'A'}`;
        await expect(verifyGuestCookie(tampered)).resolves.toBeNull();
    });

    it('다른 uuid에 남의 서명을 붙이면 null — 뮤테이션 체크: 서명 검증을 건너뛰면 이 테스트가 실패해야 한다', async () => {
        const [, signature] = (await signGuestId(VALID_UUID)).split('.');
        const forged = `${OTHER_UUID}.${signature}`;
        await expect(verifyGuestCookie(forged)).resolves.toBeNull();
    });

    it('서명 없는(레거시) uuid만 있으면 null', async () => {
        await expect(verifyGuestCookie(VALID_UUID)).resolves.toBeNull();
    });

    it('undefined면 null', async () => {
        await expect(verifyGuestCookie(undefined)).resolves.toBeNull();
    });

    it('UUID 형식이 아닌 값이면 null', async () => {
        await expect(verifyGuestCookie('not-a-uuid.sig')).resolves.toBeNull();
    });

    it('시크릿이 없으면 서명은 throw, 검증은 null (fail closed)', async () => {
        vi.stubEnv('OAUTH_STATE_HMAC_SECRET', '');
        await expect(signGuestId(VALID_UUID)).rejects.toBeInstanceOf(
            GuestCookieSecretMisconfiguredError
        );
        const signed = await (async () => {
            vi.stubEnv('OAUTH_STATE_HMAC_SECRET', SECRET);
            return signGuestId(VALID_UUID);
        })();
        vi.stubEnv('OAUTH_STATE_HMAC_SECRET', '');
        await expect(verifyGuestCookie(signed)).resolves.toBeNull();
    });

    it('메시지는 도메인 분리 접두사를 쓴다 — 같은 uuid라도 다른 목적의 서명은 통과하지 않는다', async () => {
        // signGuestId가 접두사 없이 uuid만 서명했다면, 우연히 같은 원문을 서명하는
        // 다른 용도의 HMAC과 값이 충돌할 수 있다. 여기서는 접두사를 생략한 서명이
        // verifyGuestCookie를 통과하지 않음을 확인해 접두사가 실제로 검증에
        // 반영되는지 본다.
        const key = await crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(SECRET),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        const rawSignature = await crypto.subtle.sign(
            'HMAC',
            key,
            new TextEncoder().encode(VALID_UUID) // no domain prefix
        );
        const bytes = new Uint8Array(rawSignature);
        let binary = '';
        for (const b of bytes) binary += String.fromCharCode(b);
        const b64url = btoa(binary)
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
        await expect(
            verifyGuestCookie(`${VALID_UUID}.${b64url}`)
        ).resolves.toBeNull();
    });
});

describe('mintGuestCookieValue', () => {
    beforeEach(() => {
        vi.stubEnv('OAUTH_STATE_HMAC_SECRET', SECRET);
    });

    it('새로 발급한 값은 검증을 통과한다', async () => {
        const value = await mintGuestCookieValue();
        const uuid = value.split('.')[0]!;
        expect(isValidGuestId(uuid)).toBe(true);
        await expect(verifyGuestCookie(value)).resolves.toBe(uuid);
    });

    it('시크릿이 없으면 throw', async () => {
        vi.stubEnv('OAUTH_STATE_HMAC_SECRET', '');
        await expect(mintGuestCookieValue()).rejects.toBeInstanceOf(
            GuestCookieSecretMisconfiguredError
        );
    });
});
