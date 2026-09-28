import { createHash } from 'crypto';

/**
 * Stable URL-safe 32-char ID from a news article URL via SHA-256.
 *
 * 이전 구현은 Buffer.from(url).toString('base64url').slice(0, 32) — base64url은
 * 3바이트 → 4자 단위로 인코딩하므로 앞 32자는 URL의 앞 24바이트에만 의존한다.
 * 같은 도메인 기사들(예: globenewswire.com, seekingalpha.com)이 모두 동일한
 * ID를 가져 DB에서 row를 덮어쓰고 엉뚱한 뉴스 내용이 저장되는 버그가 있었다.
 * SHA-256은 URL 전체를 해싱하므로 충돌이 사실상 불가능하다.
 */
export function hashUrlToId(url: string): string {
    return createHash('sha256').update(url).digest('base64url').slice(0, 32);
}
