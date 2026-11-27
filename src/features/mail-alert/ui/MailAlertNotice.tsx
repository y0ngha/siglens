'use client';

import { useTranslations } from 'next-intl';
import { LocaleLink as Link } from '@/shared/ui/LocaleLink';

const LINK_CLASS =
    'text-primary-400 underline underline-offset-2 hover:text-primary-300 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

interface MailAlertNoticeProps {
    /**
     * 방침 페이지의 절대 주소. 방침이 없는 호스트(시그렌즈 AI의 ai 호스트)에서는 메인 사이트의 방침으로 새 탭을 연다.
     * 생략하면 이 호스트의 `/privacy`다.
     */
    readonly privacyHref?: string;
}

/**
 * 주소를 받는 칸 옆의 고지: 수집 목적(알림 메일 발송), 삭제 시점(수신 거부 즉시), 방침 링크.
 * 별도 동의 체크박스는 두지 않는다 — 신청한 서비스 제공에 필요한 최소 수집이라 고지와 코드 확인으로 갈음한다.
 */
export function MailAlertNotice({ privacyHref }: MailAlertNoticeProps) {
    const t = useTranslations('features.mail-alert');
    return (
        <p className="text-xs leading-relaxed text-secondary-400">
            {t('notice')}{' '}
            {privacyHref === undefined ? (
                <Link href="/privacy" prefetch={false} className={LINK_CLASS}>
                    {t('privacyLink')}
                </Link>
            ) : (
                <a
                    href={privacyHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={LINK_CLASS}
                >
                    {t('privacyLink')}
                </a>
            )}
        </p>
    );
}
