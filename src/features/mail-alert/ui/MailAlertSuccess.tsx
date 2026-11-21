'use client';

import { useTranslations } from 'next-intl';
import { useAuthReturnHref } from '@/shared/hooks/useAuthReturnHref';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';

const LINK_CLASS =
    'text-primary-400 underline underline-offset-2 hover:text-primary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

interface MailAlertSuccessProps {
    readonly maskedEmail: string;
    /** 비회원 신청 직후에만 가입 제안을 보인다. 메일에는 홍보를 싣지 않는다(가입 제안은 이 화면에만). */
    readonly offerSignup: boolean;
}

/** 신청 완료. 알림 영역(`role="status"`)이라 나타나면 읽힌다. */
export function MailAlertSuccess({
    maskedEmail,
    offerSignup,
}: MailAlertSuccessProps) {
    const t = useTranslations('features.mail-alert');
    const signupHref = useAuthReturnHref('/signup');
    return (
        <div role="status" className="space-y-3 text-sm text-secondary-200">
            <p>{t('successGuest', { email: maskedEmail })}</p>
            {offerSignup && (
                <p className="text-secondary-400">
                    {t('successSignup')}{' '}
                    <Link href={signupHref} className={LINK_CLASS}>
                        {t('signupLink')}
                    </Link>
                </p>
            )}
            <Link
                href="/email-report/alerts"
                prefetch={false}
                className={LINK_CLASS}
            >
                {t('manage')}
            </Link>
        </div>
    );
}
