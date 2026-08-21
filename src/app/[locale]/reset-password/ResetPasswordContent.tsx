'use client';

import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { ResetPasswordForm } from '@/features/auth-password-reset';

// useSearchParams를 읽어 이 subtree만 CSR로 떨군다(라우트는 static 유지).
// token은 원래도 URL(client 가시) 값이라 client-read로 인한 신규 노출 없음.
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
            className="rounded-md border border-ui-danger/30 bg-ui-danger/5 p-3 text-sm text-ui-danger"
        >
            {tAuth('invalidResetLink')}
        </div>
    );
}
