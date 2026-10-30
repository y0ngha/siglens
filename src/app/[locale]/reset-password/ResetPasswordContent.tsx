'use client';

import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { ResetPasswordForm } from '@/features/auth-password-reset/ui/ResetPasswordForm';

/**
 * 재설정 링크의 `email`·`token`으로 새 비밀번호 폼을 그리고, 둘 중 하나라도 없으면 잘못된 링크
 * 안내를 띄운다. `useSearchParams`를 읽어 이 서브트리만 CSR로 떨구고 라우트는 정적으로 남는다 —
 * token은 원래 URL(클라이언트에 보이는) 값이라 클라이언트에서 읽어도 새로 노출되는 것은 없다.
 */
export function ResetPasswordContent() {
    const tAuth = useTranslations('entities.auth.error');
    const params = useSearchParams();
    const email = params.get('email') ?? '';
    const token = params.get('token') ?? '';
    const ready = email.length > 0 && token.length > 0;
    return ready ? (
        <ResetPasswordForm email={email} token={token} />
    ) : (
        <div
            role="alert"
            className="rounded-lg border border-ui-danger/30 bg-ui-danger/5 p-3 text-sm text-ui-danger-text"
        >
            {tAuth('invalidResetLink')}
        </div>
    );
}
