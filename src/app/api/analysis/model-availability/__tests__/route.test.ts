import { GET } from '@/app/api/analysis/model-availability/route';

describe('GET /api/analysis/model-availability', () => {
    it('스위치가 비어 있으면 빈 목록', async () => {
        vi.stubEnv('SERVER_KEY_DISABLED_PROVIDERS', undefined);
        const response = GET();
        await expect(response.json()).resolves.toEqual({ disabledModels: [] });
    });

    it('anthropic을 끄면 서버 키 Claude 모델을 돌려주고 CDN 캐시 헤더를 단다', async () => {
        vi.stubEnv('SERVER_KEY_DISABLED_PROVIDERS', 'anthropic');
        const response = GET();
        const body = (await response.json()) as { disabledModels: string[] };

        expect(body.disabledModels).toEqual(
            expect.arrayContaining(['claude-haiku-5-5', 'claude-sonnet-5-5'])
        );
        expect(body.disabledModels).not.toContain('claude-opus-5-5');
        expect(response.headers.get('Cache-Control')).toContain('s-maxage=60');
    });
});
