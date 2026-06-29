import { randomBytes } from 'node:crypto';

const SHARE_ID_BYTES = 16; // base64url 22자

/** URL 슬러그용 추측 불가 토큰. */
export function generateShareId(): string {
    return randomBytes(SHARE_ID_BYTES).toString('base64url');
}
