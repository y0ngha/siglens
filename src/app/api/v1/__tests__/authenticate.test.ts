const { mockAuth } = vi.hoisted(() => ({ mockAuth: vi.fn() }));
vi.mock('@/entities/siglens-api-key/server/apiKeyAuth', () => ({
    authenticateApiKey: mockAuth,
}));

import { requireApiKey } from '@/app/api/v1/authenticate';
import type { ApiKeyPrincipal } from '@/entities/siglens-api-key/model';

const principal: ApiKeyPrincipal = {
    keyId: 'k1',
    keyName: 'n',
    keyPrefix: 'slk_abcdef',
    userId: 'u1',
    tier: 'member',
};
const req = (headers: Record<string, string> = {}): Request =>
    new Request('https://siglens.io/api/v1/me', { headers });

describe('requireApiKey', () => {
    it('Authorization 헤더만 인증기에 넘기고 principal을 돌려준다', async () => {
        mockAuth.mockResolvedValue({ status: 'ok', principal });
        const outcome = await requireApiKey(
            req({
                authorization: 'Bearer slk_x',
                cookie: 'siglens_session=abc',
            })
        );
        expect(outcome).toEqual({ ok: true, principal });
        expect(mockAuth).toHaveBeenCalledWith('Bearer slk_x');
    });

    it('세션 쿠키만 있고 키가 없으면 인증되지 않는다(쿠키 인증과 섞지 않는다)', async () => {
        mockAuth.mockResolvedValue({ status: 'invalid' });
        const outcome = await requireApiKey(
            req({ cookie: 'siglens_session=valid-session' })
        );
        expect(mockAuth).toHaveBeenCalledWith(null);
        expect(outcome.ok).toBe(false);
    });

    it('invalid는 401 invalid_api_key + WWW-Authenticate', async () => {
        mockAuth.mockResolvedValue({ status: 'invalid' });
        const outcome = await requireApiKey(req());
        if (outcome.ok) throw new Error('expected failure');
        expect(outcome.response.status).toBe(401);
        expect(outcome.response.headers.get('WWW-Authenticate')).toBe('Bearer');
        expect(outcome.response.headers.get('Cache-Control')).toBe('no-store');
        await expect(outcome.response.json()).resolves.toMatchObject({
            error: { code: 'invalid_api_key' },
        });
    });

    it('401 본문이 항상 같아서 키의 존재 여부를 알려 주지 않는다', async () => {
        mockAuth.mockResolvedValue({ status: 'invalid' });
        const a = await requireApiKey(req({ authorization: 'Bearer nope' }));
        const b = await requireApiKey(req());
        if (a.ok || b.ok) throw new Error('expected failures');
        expect(await a.response.text()).toBe(await b.response.text());
    });

    it('unavailable은 401이 아니라 503 + Retry-After', async () => {
        mockAuth.mockResolvedValue({ status: 'unavailable' });
        const outcome = await requireApiKey(req());
        if (outcome.ok) throw new Error('expected failure');
        expect(outcome.response.status).toBe(503);
        expect(outcome.response.headers.get('Retry-After')).toBe('30');
        await expect(outcome.response.json()).resolves.toMatchObject({
            error: { code: 'service_unavailable' },
        });
    });
});
