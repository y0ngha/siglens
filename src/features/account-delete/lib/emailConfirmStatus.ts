/**
 * 탈퇴 확인 입력이 본인 이메일과 맞는지 판정하는 순수 함수.
 */
import { normalizeEmail } from '@/shared/lib/auth/validation';

/** 확인 입력 상태. `empty`는 아직 아무것도 입력하지 않은 상태다. */
export type EmailConfirmStatus = 'empty' | 'match' | 'mismatch';

/**
 * 확인 입력을 본인 이메일과 비교한다. 서버(`deleteAccountAction`)와 같은
 * `normalizeEmail`로 앞뒤 공백·대소문자를 무시해야 버튼이 열린 입력을 서버가
 * 거절하지 않는다.
 */
export function getEmailConfirmStatus(
    input: string,
    userEmail: string
): EmailConfirmStatus {
    const normalized = normalizeEmail(input);
    if (normalized.length === 0) return 'empty';
    return normalized === normalizeEmail(userEmail) ? 'match' : 'mismatch';
}
