'use client';

import { useTranslations } from 'next-intl';
import { useAppPathname } from '@/shared/i18n/useAppPathname';
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
    return (
        <nav aria-label={t('HeaderNav.5281d7')} className="flex gap-1 sm:gap-4">
            {items.map(vertical => (
                <HeaderNavMenu
                    key={vertical.id}
                    vertical={vertical}
                    pathname={pathname}
                />
            ))}
        </nav>
    );
}
