'use client';

/**
 * 레일 맨 아래 — ai 호스트엔 사이트 푸터가 없어서 이용약관·개인정보처리방침·siglens.io로
 * 돌아가는 링크를 여기 둔다.
 */
import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import { ArrowUpRightIcon } from '@/shared/ui/StrokeIcons';

const LINK =
    'rounded px-1 py-1 hover:text-secondary-200 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none';

interface RailFooterProps {
    readonly siteUrl: string;
    readonly localePrefix: string;
}

/** 메인 사이트로 가는 링크 셋을 그린다. */
export function RailFooter({ siteUrl, localePrefix }: RailFooterProps) {
    const t = useTranslations('widgets.agent-chat');
    return (
        <div className="px-1 pt-3 text-xs text-secondary-400">
            <a
                href={`${siteUrl}${localePrefix}/`}
                className={cn(LINK, 'inline-flex items-center gap-1')}
            >
                {t('Sidebar.backToSiglens')}
                <ArrowUpRightIcon className="size-3" />
            </a>
            <p className="mt-1 flex flex-wrap gap-x-2">
                <a href={`${siteUrl}${localePrefix}/terms`} className={LINK}>
                    {t('Sidebar.terms')}
                </a>
                <a href={`${siteUrl}${localePrefix}/privacy`} className={LINK}>
                    {t('Sidebar.privacy')}
                </a>
            </p>
        </div>
    );
}
