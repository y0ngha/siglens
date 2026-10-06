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
        vi.stubEnv('ISR_CACHE_BUCKET', '');
        const { config } = await import('../config.mjs');
        expect(config.region).toBe('ap-northeast-2');
        expect(config.buildId).toBe('dev');
        expect(config.keyPrefix).toBe('siglens-isr');
        expect(config.disabled).toBe(false);
        expect(config.buildPhase).toBe(false);
        expect(config.bucket).toBe('');
    });

    it('NEXT_PHASE=phase-production-build면 buildPhase가 켜진다', async () => {
        vi.stubEnv('NEXT_PHASE', 'phase-production-build');
        const { config } = await import('../config.mjs');
        expect(config.buildPhase).toBe(true);
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

    // 데이터 캐시 prefix가 GIT_SHA를 따라가면 배포마다 데이터 캐시가 통째로 비워진다.
    it('dataScope는 GIT_SHA와 무관하고 DATA_CACHE_VERSION·Next 버전으로 정해진다', async () => {
        vi.stubEnv('GIT_SHA', 'v1.0.0');
        const first = await import('../config.mjs');
        vi.resetModules();
        vi.stubEnv('GIT_SHA', 'v1.0.1');
        const second = await import('../config.mjs');
        const { version: nextVersion } = await import('next/package.json', {
            with: { type: 'json' },
        }).then(m => m.default);

        expect(first.config.dataScope).toBe(second.config.dataScope);
        expect(first.config.dataScope).toBe(
            `data-v${first.DATA_CACHE_VERSION}-next${nextVersion}`
        );
        expect(first.config.dataScope).not.toContain('v1.0.0');
    });

    it('dataScopeFor는 버전이나 Next 버전이 바뀌면 다른 scope를 만든다', async () => {
        const { dataScopeFor } = await import('../config.mjs');
        expect(dataScopeFor(1, '16.3.6')).toBe('data-v1-next16.3.6');
        expect(dataScopeFor(2, '16.3.6')).not.toBe(dataScopeFor(1, '16.3.6'));
        expect(dataScopeFor(1, '16.4.0')).not.toBe(dataScopeFor(1, '16.3.6'));
    });

    it("ISR_CACHE_DISABLED='true'를 boolean true로 파싱한다", async () => {
        vi.stubEnv('ISR_CACHE_DISABLED', 'true');
        const { config } = await import('../config.mjs');
        expect(config.disabled).toBe(true);
    });
});
