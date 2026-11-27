'use client';

import { useTranslations } from 'next-intl';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';

/**
 * 주소를 받는 칸 옆의 고지: 수집 목적(알림 메일 발송), 삭제 시점(수신 거부 즉시), 방침 링크.
 * 별도 동의 체크박스는 두지 않는다 — 신청한 서비스 제공에 필요한 최소 수집이라 고지와 코드 확인으로 갈음한다.
 */
export function MailAlertNotice() {
    const t = useTranslations('features.mail-alert');
    return (
        <p className="text-xs leading-relaxed text-secondary-400">
            {t('notice')}{' '}
            <Link
                href="/privacy"
                prefetch={false}
                className="text-primary-400 underline underline-offset-2 hover:text-primary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
            >
                {t('privacyLink')}
            </Link>
        </p>
    );
}
