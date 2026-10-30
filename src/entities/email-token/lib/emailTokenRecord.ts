import type { EmailTokenPurpose, EmailTokenValue } from '../types';

const KEY_PREFIX = 'email_token';

/** Redis 키 `email_token:<purpose>:<email>` — 영속 포맷이라 바꾸면 발급된 토큰이 전부 고아가 된다. */
export function buildEmailTokenKey(
    purpose: EmailTokenPurpose,
    email: string
): string {
    return `${KEY_PREFIX}:${purpose}:${email}`;
}

/**
 * Redis에서 읽은 임의의 JSON을 EmailTokenValue로 좁힌다. 모양이 어긋난 값(객체가 아니거나 status가
 * 알 수 없거나 pending에 문자열 tokenHash가 없음)은 null로 돌려 호출자가 "토큰 없음"으로 처리하게 한다.
 * tokenHash의 형식(SHA-256 hex)은 여기서 검사하지 않는다 — 상수 시간 비교 단계(safeCompareTokenHashes)가
 * 비-hex를 거부해 '불일치(invalid)'로 처리하므로, 여기서 거르면 '만료(expired)'로 바뀐다.
 */
export function parseEmailTokenValue(raw: unknown): EmailTokenValue | null {
    if (typeof raw !== 'object' || raw === null) return null;
    if ('status' in raw && raw.status === 'verified') {
        return { status: 'verified' };
    }
    if (
        'status' in raw &&
        raw.status === 'pending' &&
        'tokenHash' in raw &&
        typeof raw.tokenHash === 'string'
    ) {
        return { status: 'pending', tokenHash: raw.tokenHash };
    }
    return null;
}
