import { useTranslations } from 'next-intl';
import type { Ref } from 'react';

interface ContactSubmittedNoticeProps {
    /** 마운트 시 포커스를 받을 패널 ref. 라이브 영역은 부모(`ContactForm`)가 소유한다. */
    ref?: Ref<HTMLDivElement>;
}

/**
 * 제출 성공 안내 패널. `role="status"`/`aria-live`를 **여기에 두지 않는다** — 이 패널은
 * 성공 순간에 마운트되므로, 라이브 영역이 내용과 함께 삽입돼 보조기술이 읽지 않는다.
 * 라이브 영역은 `ContactForm`이 제출 전부터 비워 둔 채 렌더한다(ForgotPasswordForm 참고).
 */
export function ContactSubmittedNotice({ ref }: ContactSubmittedNoticeProps) {
    const t = useTranslations('features.contact-form');
    return (
        <div
            ref={ref}
            tabIndex={-1}
            className="space-y-2 rounded-lg border border-secondary-700 bg-secondary-900/60 p-4 text-sm focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
        >
            <p className="font-semibold text-secondary-100">
                {t('ContactSubmittedNotice.820d69')}
            </p>
            <p className="text-secondary-300">
                {t('ContactSubmittedNotice.5483d6')}
            </p>
            <p className="text-secondary-300">
                {t('ContactSubmittedNotice.679be7')}
            </p>
        </div>
    );
}
