import { createHash } from 'node:crypto';

const SHA_256_ALGORITHM = 'sha256';
const HEX_DIGEST_ENCODING = 'hex';

/**
 * 방문자 식별용 가명 해시.
 *
 * `hashUsageIp`(core)를 쓰지 않는 이유: 그쪽은 salt에 UTC 날짜를 섞어 같은 IP도
 * 매일 다른 해시가 된다. 일일 rate limit에는 맞지만 MAU는 원리적으로 불가능하다 —
 * 한 사람이 30일 방문하면 30명으로 세어진다.
 *
 * `pepper`가 비면 던진다. IPv4 공간은 2^32뿐이라 무염 SHA-256은 전수 대입으로
 * 즉시 역산된다 — 빈 문자열 폴백은 "해시했으니 안전하다"는 거짓 안전감만 준다.
 * pepper를 교체하면 그 시점에 MAU 연속성이 끊기므로 고정해서 쓴다.
 *
 * User-Agent를 함께 섞는다. IP만 쓰면 통신사 NAT·CGNAT 뒤의 수백 명이 1명으로
 * 뭉쳐 과소집계된다. 반대급부로 한 사람이 폰과 PC를 쓰면 2명이 되지만, 모바일
 * 비중이 큰 서비스에서는 NAT 뭉침 쪽이 훨씬 크다.
 */
export function buildVisitorHash(
    pepper: string,
    clientIp: string,
    userAgent: string
): string {
    if (pepper === '') {
        throw new Error(
            'VISITOR_HASH_PEPPER is required — refusing to build an unsalted visitor hash'
        );
    }
    return createHash(SHA_256_ALGORITHM)
        .update(`${pepper}:${clientIp}:${userAgent}`)
        .digest(HEX_DIGEST_ENCODING);
}
