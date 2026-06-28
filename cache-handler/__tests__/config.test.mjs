import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// config.mjs는 모듈 로드 시점에 env를 읽으므로, env를 stub한 뒤
// resetModules + dynamic import로 매번 새로 평가해야 한다.
describe('config (real module, env defaults)', () => {
    beforeEach(() => vi.resetModules());
    afterEach(() => vi.unstubAllEnvs());

    it('env 미설정 시 region 기본값 ap-northeast-2, buildId 기본값 dev', async () => {
        vi.stubEnv('AWS_REGION', '');
        vi.stubEnv('GIT_SHA', '');
        vi.stubEnv('ISR_CACHE_DISABLED', '');
        const { config } = await import('../config.mjs');
        expect(config.region).toBe('ap-northeast-2');
        expect(config.buildId).toBe('dev');
        expect(config.keyPrefix).toBe('siglens-isr');
        expect(config.disabled).toBe(false);
    });

    it('env가 설정되면 그 값을 사용한다', async () => {
        vi.stubEnv('AWS_REGION', 'us-east-1');
        vi.stubEnv('GIT_SHA', 'abc123');
        vi.stubEnv('ISR_CACHE_BUCKET', 'my-bucket');
        const { config } = await import('../config.mjs');
        expect(config.region).toBe('us-east-1');
        expect(config.buildId).toBe('abc123');
        expect(config.bucket).toBe('my-bucket');
    });

    it("ISR_CACHE_DISABLED='true'를 boolean true로 파싱한다", async () => {
        vi.stubEnv('ISR_CACHE_DISABLED', 'true');
        const { config } = await import('../config.mjs');
        expect(config.disabled).toBe(true);
    });
});
