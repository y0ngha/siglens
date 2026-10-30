'use client';

/**
 * 비회원 레일 — 목록이 없으므로 빈 검색창 대신 로그인하면 무엇을 얻는지 안내한다.
 */
import { useTranslations } from 'next-intl';
import { RailFooter } from './RailFooter';

interface GuestRailProps {
    readonly loginHref: string;
    readonly siteUrl: string;
    readonly localePrefix: string;
}

/** 로그인 안내 카드와 레일 푸터를 그린다. */
export function GuestRail({
    loginHref,
    siteUrl,
    localePrefix,
}: GuestRailProps) {
    const t = useTranslations('widgets.agent-chat');
    return (
        <nav
            aria-label={t('Sidebar.9a7569')}
            className="flex h-full flex-col gap-3 p-3"
        >
            <div className="surface-raised rounded-lg p-4">
                <p className="text-sm font-medium text-secondary-100">
                    {t('Sidebar.guestTitle')}
                </p>
                <p className="mt-1.5 text-xs leading-5 text-secondary-400">
                    {t('Sidebar.guestBody')}
                </p>
                <a
                    href={loginHref}
                    className="surface-accent mt-3 inline-flex min-h-9 items-center rounded-lg bg-primary-600 px-3 text-xs font-medium text-white focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                >
                    {t('Sidebar.guestCta')}
                </a>
            </div>
            <div className="flex-1" />
            <RailFooter siteUrl={siteUrl} localePrefix={localePrefix} />
        </nav>
    );
}
