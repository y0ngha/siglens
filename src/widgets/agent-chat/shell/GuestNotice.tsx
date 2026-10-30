'use client';

/**
 * 비회원 안내 한 줄 — 대화가 이 탭에만 남는다는 사실과, 그것을 지키는 유일한 동작(로그인).
 */
import { useTranslations } from 'next-intl';

interface GuestNoticeProps {
    readonly loginHref: string;
}

/** 안내 문구와 로그인 링크를 그린다. */
export function GuestNotice({ loginHref }: GuestNoticeProps) {
    const t = useTranslations('widgets.agent-chat');
    return (
        <p className="mx-auto w-full max-w-3xl px-4 pb-1 text-center text-xs text-secondary-400">
            {t('ChatShell.guestNotice')}{' '}
            <a
                href={loginHref}
                className="font-medium text-primary-400 underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
            >
                {t('ChatShell.loginCta')}
            </a>
        </p>
    );
}
