'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/shared/lib/cn';
import { GUIDE_PATH } from '@/shared/lib/guidePaths';
import { LocaleLink } from '@/shared/ui/LocaleLink';

interface GuideNavLinkProps {
    readonly active: boolean;
}

/**
 * 헤더의 차트 가이드 직접 링크. 목적지가 하나라 드롭다운이 아니다.
 *
 * 전 페이지 헤더에 실리므로 가이드 허브로 가는 크롤 가능한 전역 앵커이기도 하다. 헤더 폭이
 * 빠듯해(`lg` 한 줄) 라벨은 "가이드"로 줄이고, 풀 이름은 푸터·드로어가 쓴다.
 */
export function GuideNavLink({ active }: GuideNavLinkProps) {
    const t = useTranslations('widgets.layout');
    return (
        <LocaleLink
            href={GUIDE_PATH}
            prefetch={false}
            aria-current={active ? 'page' : undefined}
            className={cn(
                '-mb-px flex min-h-11 touch-manipulation items-center border-b-2 px-2 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:rounded focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none',
                active
                    ? 'border-primary-500 text-secondary-100'
                    : 'border-transparent text-secondary-400 hover:text-secondary-100'
            )}
        >
            {t('HeaderNav.guideLink')}
        </LocaleLink>
    );
}
