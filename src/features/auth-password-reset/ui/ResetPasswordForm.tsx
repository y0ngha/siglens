'use client';

import { AuthErrorAlert } from '@/shared/ui/auth/AuthErrorAlert';
import { PasswordField } from '@/shared/ui/auth/PasswordField';
import { PasswordStrengthHint } from '@/shared/ui/auth/PasswordStrengthHint';
import { SubmitButton } from '@/shared/ui/auth/SubmitButton';
import { useResetPasswordForm } from '../hooks/useResetPasswordForm';
import type { ResetPasswordFormState } from '@/shared/lib/types';
import { useId, useState } from 'react';

interface ResetPasswordFormProps {
    email: string;
    token: string;
}

const INVALID_TOKEN_MESSAGE =
    '재설정 링크가 유효하지 않거나 이미 사용되었습니다. 다시 요청해 주세요.';
const EXPIRED_TOKEN_MESSAGE =
    '재설정 링크가 만료되었습니다. 다시 요청해 주세요.';

/**
 * 필드에 붙지 않는 오류를 폼 상단 알림으로 낸다.
 *
 * **누락 없이 소진해야 한다.** 예전에는 네 코드만 매핑하고 나머지에 `null`을
 * 반환했는데, `unexpected`(필드 없음)와 `invalid_email`(필드가 `email`인데 그
 * 값은 URL에서 오므로 사용자가 고칠 수 없다)이 그 구멍으로 빠졌다. 두 경우
 * 모두 `describePasswordFieldError`도 통과하지 못해 **화면에 아무것도 뜨지
 * 않았다** — 제출해도 반응이 없는 상태였고, 아래에서 입력까지 비우고 있었다.
 *
 * 그래서 기본 분기를 `null`이 아니라 서버 메시지로 둔다. 새 코드가 생겨도
 * 조용히 사라지지 않고 최소한 서버가 준 문장이 나온다.
 */
function describeFormError(state: ResetPasswordFormState): string | null {
    if (state.error === undefined || state.error === null) return null;
    if (state.error.code === 'invalid_token') return INVALID_TOKEN_MESSAGE;
    if (state.error.code === 'expired_token') return EXPIRED_TOKEN_MESSAGE;
    // 비밀번호 필드에 직접 붙는 오류는 필드 쪽에서 낸다 — 여기서 또 내면 중복이다.
    if (state.error.field === 'password') return null;
    return state.error.message;
}

function describePasswordFieldError(
    state: ResetPasswordFormState
): string | null {
    if (state.error?.field === 'password') return state.error.message;
    return null;
}

export function ResetPasswordForm({ email, token }: ResetPasswordFormProps) {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [confirmError, setConfirmError] = useState<string | null>(null);
    const hintId = useId();
    const [state, formAction] = useResetPasswordForm();
    const formError = describeFormError(state);
    const fieldError = describePasswordFieldError(state);

    const handleAction = (formData: FormData) => {
        if (password !== confirmPassword) {
            setConfirmError('비밀번호가 일치하지 않습니다.');
            return;
        }
        setConfirmError(null);
        // 여기서 입력을 비우지 않는다. 성공하면 액션이 리디렉트하므로 비울
        // 필요가 없고, 실패하면(약한 비밀번호·같은 비밀번호·만료 토큰) 빈 칸
        // 아래에 오류만 남아 전부 다시 타이핑해야 했다. 강도 체크리스트도
        // 함께 초기화돼 무엇이 모자랐는지조차 사라졌다.
        formAction(formData);
    };

    return (
        <form action={handleAction} className="space-y-4" noValidate>
            <input type="hidden" name="email" value={email} />
            <input type="hidden" name="token" value={token} />
            {formError ? <AuthErrorAlert message={formError} /> : null}
            <PasswordField
                id="reset-password"
                name="newPassword"
                label="새 비밀번호"
                autoComplete="new-password"
                required
                value={password}
                onChange={value => {
                    setPassword(value);
                    if (confirmError) setConfirmError(null);
                }}
                error={fieldError ?? undefined}
                describedById={hintId}
                hint={
                    <PasswordStrengthHint
                        password={password}
                        descriptionId={hintId}
                    />
                }
            />
            <PasswordField
                id="reset-password-confirm"
                name="confirmPassword"
                label="새 비밀번호 확인"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={value => {
                    setConfirmPassword(value);
                    if (confirmError) setConfirmError(null);
                }}
                error={confirmError ?? undefined}
            />
            <SubmitButton label="비밀번호 변경" pendingLabel="변경 중…" />
        </form>
    );
}
