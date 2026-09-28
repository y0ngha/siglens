import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * `CF_BEACON_TOKEN`은 모듈 로드 시점에 `process.env.E2E_TEST`를 한 번 읽어 고정한다
 * (layout이 `{CF_BEACON_TOKEN && <Script .../>}`로 렌더 여부를 가르는 값). E2E
 * 픽스처는 localhost:4300 밖 호스트 요청을 금지하므로, 이 값이 E2E에서 truthy가
 * 되면 beacon 스크립트 요청이 여러 스펙을 "Unstubbed external requests"로 깨뜨린다.
 */
describe('CF_BEACON_TOKEN', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.resetModules();
    });

    it('is empty under E2E_TEST=1 (no beacon requests during E2E)', async () => {
        vi.stubEnv('E2E_TEST', '1');
        const { CF_BEACON_TOKEN } = await import('../cloudflareAnalytics');
        expect(CF_BEACON_TOKEN).toBe('');
    });

    it('is a non-empty public beacon token outside E2E', async () => {
        vi.stubEnv('E2E_TEST', undefined);
        const { CF_BEACON_TOKEN } = await import('../cloudflareAnalytics');
        expect(CF_BEACON_TOKEN).toBe('24c85b35acb0491297ff6cfe470bdc99');
    });
});
