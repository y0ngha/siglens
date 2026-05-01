import {
    createHash,
    randomBytes,
    randomInt,
    timingSafeEqual,
} from 'node:crypto';

const NUMERIC_CODE_RADIX = 10;
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/;

/** @internal Generate a high-entropy URL-safe token for email links. */
export function generateUrlSafeToken(byteLength: number): string {
    return randomBytes(byteLength).toString('base64url');
}

/**
 * @internal Generate a fixed-length numeric verification code for manual entry.
 */
export function generateNumericCode(digits: number): string {
    const upperExclusive = Math.pow(NUMERIC_CODE_RADIX, digits);
    return randomInt(0, upperExclusive)
        .toString(NUMERIC_CODE_RADIX)
        .padStart(digits, '0');
}

/** @internal Hash a raw email token using SHA-256 for storage and lookup. */
export function hashEmailToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
}

/**
 * @internal Compare two SHA-256 hex email-token digests in constant time.
 */
export function safeCompareTokenHashes(a: string, b: string): boolean {
    if (!SHA256_HEX_PATTERN.test(a) || !SHA256_HEX_PATTERN.test(b)) {
        return false;
    }
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}
