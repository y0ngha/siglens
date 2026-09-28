import { describe, expect, it } from 'vitest';
import nextConfig from '../../../next.config';

/**
 * CloudFlare 엣지 압축 전제 가드.
 *
 * CloudFlare는 강한 ETag가 붙은 응답을 압축하지 않는다. Next 기본값(`generateEtags: true`)으로
 * 되돌아가면, 압축을 요청하지 않은 첫 요청이 엣지 캐시를 비압축 본문으로 채우고 이후
 * gzip/br 요청에도 그 본문이 5배 크기로 나간다(2026-09-26 실측, `next.config.ts` 주석).
 * 설정 한 줄로 조용히 되살아나는 회귀라 값을 고정한다.
 */
describe('next.config — edge compression invariants', () => {
    it('HTML/RSC 응답에 ETag를 붙이지 않는다', () => {
        expect(nextConfig.generateEtags).toBe(false);
    });

    it('오리진 gzip은 유지한다(오리진 → 원거리 엣지 구간 전송량)', () => {
        expect(nextConfig.compress).toBe(true);
    });
});
