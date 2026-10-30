import 'server-only';
import {
    createHash,
    randomBytes,
    randomInt,
    timingSafeEqual,
} from 'node:crypto';

const NUMERIC_CODE_RADIX = 10;
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

/** @internal 메일 링크용 URL-safe 고엔트로피 토큰(base64url). `byteLength`가 엔트로피 바이트 수다. */
export function generateUrlSafeToken(byteLength: number): string {
    return randomBytes(byteLength).toString('base64url');
}

/** @internal 수동 입력용 고정 자릿수 숫자 코드. 앞자리 0을 보존하려고 `padStart`한다. */
export function generateNumericCode(digits: number): string {
    const upperExclusive = Math.pow(NUMERIC_CODE_RADIX, digits);
    return randomInt(0, upperExclusive)
        .toString(NUMERIC_CODE_RADIX)
        .padStart(digits, '0');
}

/** @internal 이메일 토큰·코드의 SHA-256 hex. 저장소에는 원문 대신 이 해시만 둔다. */
export function hashEmailToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
}

/** @internal 두 SHA-256 hex 다이제스트를 상수 시간으로 비교한다. 형식이 틀린 입력은 비교 없이 false. */
export function safeCompareTokenHashes(a: string, b: string): boolean {
    if (!SHA256_HEX_PATTERN.test(a) || !SHA256_HEX_PATTERN.test(b)) {
        return false;
    }
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}
