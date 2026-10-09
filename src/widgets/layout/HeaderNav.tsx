'use client';

import { useTranslations } from 'next-intl';
import { useAppPathname } from '@/shared/i18n/useAppPathname';
import { cn } from '@/shared/lib/cn';
import { GUIDE_PATH } from '@/shared/lib/guidePaths';
import { LocaleLink } from '@/shared/ui/LocaleLink';
import type { NavVerticalNode } from './headerNavTree';
import { HeaderNavMenu } from './HeaderNavMenu';

interface HeaderNavProps {
    readonly items: ReadonlyArray<NavVerticalNode>;
}

/** Client island for the primary nav; isolated so the surrounding Header can stay an RSC while `usePathname()` runs client-side. */
export function HeaderNav({ items }: HeaderNavProps) {
    const t = useTranslations('widgets.layout');
    // `NAV_TREE`의 href는 로케일 접두사가 없는 `/market` 형태다. `usePathname()`은
    // `/en/market`을 그대로 주므로, 떼지 않으면 `isHrefActive`의 정확 일치가 영영
    // 실패해 **비-ko 사용자에게 활성 내비 표시가 통째로 사라진다.**
    // next-intl의 navigation 대신 순수 헬퍼를 쓰는 이유: 그쪽은 모듈 로드 시점에
    // `next/navigation`의 `redirect`를 읽어, 부분 mock을 쓰는 기존 테스트 70여 개가
    // 한꺼번에 import에 실패한다.
    const pathname = useAppPathname();
    const isGuideActive =
        pathname === GUIDE_PATH ||
        pathname?.startsWith(`${GUIDE_PATH}/`) === true;
    return (
        <nav aria-label={t('HeaderNav.5281d7')} className="flex gap-1 sm:gap-4">
            {items.map(vertical => (
                <HeaderNavMenu
                    key={vertical.id}
                    vertical={vertical}
                    idScope="nav"
                    pathname={pathname}
                />
            ))}
            {/* 차트 가이드 — 드롭다운이 아니라 직접 링크다(목적지가 하나). 전 페이지 헤더에
                실리므로 가이드 허브로 가는 크롤 가능한 전역 앵커이기도 하다. 라벨은 헤더 폭이
                빠듯해(`lg` 한 줄) "가이드"로 줄이고, 풀 이름은 푸터·드로어가 쓴다. */}
            <LocaleLink
                href={GUIDE_PATH}
                prefetch={false}
                aria-current={isGuideActive ? 'page' : undefined}
                className={cn(
                    '-mb-px flex min-h-11 touch-manipulation items-center border-b-2 px-2 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:rounded focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none',
                    isGuideActive
                        ? 'border-primary-500 text-secondary-100'
                        : 'border-transparent text-secondary-400 hover:text-secondary-100'
                )}
            >
                {t('HeaderNav.guideLink')}
            </LocaleLink>
        </nav>
    );
}
