jest.mock('jose', () => ({
    importPKCS8: jest.fn(),
    decodeJwt: jest.fn(),
    SignJWT: jest.fn(),
}));

import { importPKCS8, decodeJwt, SignJWT } from 'jose';
import { appleOAuthAdapter } from '@/infrastructure/auth/oauth/apple';

const ORIGINAL_FETCH = global.fetch;
const mockImportKey = importPKCS8 as jest.MockedFunction<typeof importPKCS8>;
const mockDecodeJwt = decodeJwt as jest.MockedFunction<typeof decodeJwt>;
const mockSignJWT = SignJWT as unknown as jest.Mock;

function jsonResponse(status: number, body: unknown): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
    });
}

function setupSignJWTSuccess(signed: string = 'signed.jwt'): void {
    const chain = {
        setProtectedHeader: jest.fn().mockReturnThis(),
        setIssuer: jest.fn().mockReturnThis(),
        setAudience: jest.fn().mockReturnThis(),
        setSubject: jest.fn().mockReturnThis(),
        setIssuedAt: jest.fn().mockReturnThis(),
        setExpirationTime: jest.fn().mockReturnThis(),
        sign: jest.fn().mockResolvedValue(signed),
    };
    mockSignJWT.mockImplementation(() => chain);
}

describe('appleOAuthAdapter', () => {
    const REDIRECT_URI = 'https://app.example.com/api/auth/callback/apple';

    beforeEach(() => {
        process.env.APPLE_CLIENT_ID = 'app.client';
        process.env.APPLE_TEAM_ID = 'team';
        process.env.APPLE_KEY_ID = 'key';
        process.env.APPLE_PRIVATE_KEY =
            '-----BEGIN PRIVATE KEY-----\\nABC\\n-----END PRIVATE KEY-----';
        mockImportKey.mockReset();
        mockDecodeJwt.mockReset();
        mockSignJWT.mockReset();
        mockImportKey.mockResolvedValue({} as never);
    });

    afterEach(() => {
        global.fetch = ORIGINAL_FETCH;
    });

    it('Apple env 미설정 시 빈 문자열로 빌드 + JWT 서명 단계 통과한다', async () => {
        delete process.env.APPLE_CLIENT_ID;
        delete process.env.APPLE_TEAM_ID;
        delete process.env.APPLE_KEY_ID;
        delete process.env.APPLE_PRIVATE_KEY;
        setupSignJWTSuccess();
        const url = appleOAuthAdapter.authorizeUrl({
            state: 's',
            redirectUri: REDIRECT_URI,
        });
        expect(new URL(url).searchParams.get('client_id')).toBe('');
        global.fetch = jest.fn(async () => jsonResponse(400, {})) as never;
        await expect(
            appleOAuthAdapter.exchangeCodeForProfile({
                code: 'c',
                redirectUri: REDIRECT_URI,
            })
        ).resolves.toEqual({ ok: false, reason: 'token_exchange_failed' });
    });

    it('authorizeUrl은 client_id/state/scope/response_type 포함', () => {
        const url = appleOAuthAdapter.authorizeUrl({
            state: 'abc',
            redirectUri: REDIRECT_URI,
        });
        const parsed = new URL(url);
        expect(parsed.origin).toBe('https://appleid.apple.com');
        expect(parsed.searchParams.get('client_id')).toBe('app.client');
        expect(parsed.searchParams.get('state')).toBe('abc');
        expect(parsed.searchParams.get('scope')).toBe('email');
    });

    it('client_secret 서명 실패 시 token_exchange_failed', async () => {
        mockImportKey.mockRejectedValue(new Error('bad key'));
        await expect(
            appleOAuthAdapter.exchangeCodeForProfile({
                code: 'c',
                redirectUri: REDIRECT_URI,
            })
        ).resolves.toEqual({ ok: false, reason: 'token_exchange_failed' });
    });

    it('token endpoint 비OK 시 token_exchange_failed', async () => {
        setupSignJWTSuccess();
        global.fetch = jest.fn(async () => jsonResponse(400, {})) as never;
        await expect(
            appleOAuthAdapter.exchangeCodeForProfile({
                code: 'c',
                redirectUri: REDIRECT_URI,
            })
        ).resolves.toEqual({ ok: false, reason: 'token_exchange_failed' });
    });

    it('id_token 누락 시 token_exchange_failed', async () => {
        setupSignJWTSuccess();
        global.fetch = jest.fn(async () => jsonResponse(200, {})) as never;
        await expect(
            appleOAuthAdapter.exchangeCodeForProfile({
                code: 'c',
                redirectUri: REDIRECT_URI,
            })
        ).resolves.toEqual({ ok: false, reason: 'token_exchange_failed' });
    });

    it('token JSON 파싱 실패 시 token_exchange_failed', async () => {
        setupSignJWTSuccess();
        global.fetch = jest.fn(
            async () => new Response('not-json', { status: 200 })
        ) as never;
        await expect(
            appleOAuthAdapter.exchangeCodeForProfile({
                code: 'c',
                redirectUri: REDIRECT_URI,
            })
        ).resolves.toEqual({ ok: false, reason: 'token_exchange_failed' });
    });

    it('id_token 디코드 실패 시 profile_fetch_failed', async () => {
        setupSignJWTSuccess();
        global.fetch = jest.fn(async () =>
            jsonResponse(200, { id_token: 'bad.jwt' })
        ) as never;
        mockDecodeJwt.mockImplementation(() => {
            throw new Error('decode fail');
        });
        await expect(
            appleOAuthAdapter.exchangeCodeForProfile({
                code: 'c',
                redirectUri: REDIRECT_URI,
            })
        ).resolves.toEqual({ ok: false, reason: 'profile_fetch_failed' });
    });

    it('claims에 sub 또는 email 누락 시 email_missing', async () => {
        setupSignJWTSuccess();
        global.fetch = jest.fn(async () =>
            jsonResponse(200, { id_token: 'good.jwt' })
        ) as never;
        mockDecodeJwt.mockReturnValue({ sub: 'apl' } as never);
        await expect(
            appleOAuthAdapter.exchangeCodeForProfile({
                code: 'c',
                redirectUri: REDIRECT_URI,
            })
        ).resolves.toEqual({ ok: false, reason: 'email_missing' });
    });

    it('성공 시 email + providerAccountId 만 채워 반환한다', async () => {
        setupSignJWTSuccess();
        global.fetch = jest.fn(async () =>
            jsonResponse(200, { id_token: 'good.jwt' })
        ) as never;
        mockDecodeJwt.mockReturnValue({
            sub: 'apl',
            email: 'u@e.com',
        } as never);
        await expect(
            appleOAuthAdapter.exchangeCodeForProfile({
                code: 'c',
                redirectUri: REDIRECT_URI,
            })
        ).resolves.toEqual({
            ok: true,
            profile: {
                provider: 'apple',
                providerAccountId: 'apl',
                email: 'u@e.com',
            },
        });
    });
});
