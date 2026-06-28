import { describe, it, expect } from 'vitest';

// 실 S3 왕복 통합 테스트. 기본 스킵 — 실행하려면:
//   ISR_CACHE_IT=1 ISR_CACHE_BUCKET=siglens-isr-cache GIT_SHA=it-test \
//   AWS_PROFILE=siglens yarn vitest run cache-handler/__tests__/s3Store.integration.test.mjs
// config.mjs가 모듈 로드 시 env를 읽으므로 위 env를 실행 시점에 설정해야 한다.
const RUN = process.env.ISR_CACHE_IT === '1';

describe.skipIf(!RUN)('s3Store integration (real S3)', () => {
    it('set → get 왕복이 원본과 동치다 (gzip + 키스킴 실검증)', async () => {
        const { setEntry, getEntry } = await import('../s3Store.mjs');
        const key = `/__it__/${process.env.GIT_SHA}/${Date.now()}`;
        const entry = {
            value: { html: 'integration' },
            lastModified: 42,
            tags: ['it:tag'],
        };
        await setEntry(key, 'APP_PAGE', entry);
        expect(await getEntry(key, 'APP_PAGE')).toEqual(entry);
    });

    it('미존재 키는 null을 반환한다 (NoSuchKey 실검증)', async () => {
        const { getEntry } = await import('../s3Store.mjs');
        expect(
            await getEntry(`/__it__/missing/${Date.now()}`, 'APP_PAGE')
        ).toBeNull();
    });
});
