import { randomBytes } from 'node:crypto';

const SHARE_ID_BYTES = 16; // base64url 22자

/**
 * 공유 URL 슬러그용 토큰. `/share/[id]` 조회는 인증 없이 이 id만으로 열리므로
 * 128비트 암호학적 난수여야 추측 열거가 불가능하다.
 */
export function generateShareId(): string {
    return randomBytes(SHARE_ID_BYTES).toString('base64url');
}
