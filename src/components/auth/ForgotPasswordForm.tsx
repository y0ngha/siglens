'use client';

import { useForgotPasswordForm } from '@/components/hooks/useForgotPasswordForm';
import { AuthFieldGroup } from '@/components/auth/AuthFieldGroup';
import { SubmitButton } from '@/components/auth/SubmitButton';

const SUCCESS_TITLE = '메일을 확인해 주세요';
const SUCCESS_DESCRIPTION =
    '입력하신 이메일이 등록된 계정이라면 비밀번호 재설정 링크를 보내드렸습니다. 메일이 도착하지 않은 경우 스팸함도 확인해 주세요.';

export function ForgotPasswordForm() {
    const [state, formAction] = useForgotPasswordForm();
    if (state.submitted) {
        return (
            <div
                role="status"
                aria-live="polite"
                className="border-secondary-800 bg-secondary-900/60 space-y-2 rounded-md border p-4 text-sm"
            >
                <p className="text-secondary-100 font-semibold">
                    {SUCCESS_TITLE}
                </p>
                <p className="text-secondary-300">{SUCCESS_DESCRIPTION}</p>
            </div>
        );
    }
    return (
        <form action={formAction} className="space-y-4" noValidate>
            <AuthFieldGroup
                id="forgot-email"
                name="email"
                label="이메일"
                type="email"
                autoComplete="email"
                required
            />
            <SubmitButton label="재설정 링크 보내기" pendingLabel="발송 중…" />
        </form>
    );
}
