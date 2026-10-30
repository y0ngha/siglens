import type { ResetPasswordFormState } from '@/shared/lib/auth/formTypes';

type ResetPasswordError = NonNullable<ResetPasswordFormState['error']>;

/** 재설정 폼에서 액션 오류가 표시되는 자리: 폼 상단 배너 또는 새 비밀번호 칸 아래. */
export type ResetPasswordErrorSlot = 'form' | 'password';

/**
 * 재설정 액션 오류를 어디에 띄울지 고른다.
 *
 * 화면에 입력칸이 있는 필드는 새 비밀번호뿐이라 `field: 'password'`만 그 칸
 * 아래로 보내고, 나머지(토큰·이메일처럼 숨은 필드, 필드 없는 오류)는 전부 폼
 * 상단 배너로 보낸다. 배너에 띄울 코드를 허용 목록으로 고르면 목록에 없는
 * 코드(`unexpected` 등)는 어디에도 표시되지 않아 제출이 아무 반응 없이 끝난다.
 */
export function resetPasswordErrorSlot(
    error: ResetPasswordError
): ResetPasswordErrorSlot {
    return error.field === 'password' ? 'password' : 'form';
}
