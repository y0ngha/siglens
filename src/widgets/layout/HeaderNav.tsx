'use client';

import { useTranslations } from 'next-intl';
import { useAppPathname } from '@/shared/i18n/useAppPathname';
import { GUIDE_PATH } from '@/shared/lib/guidePaths';
import { HeaderNavMenu } from './HeaderNavMenu';
import { GuideNavLink } from './ui/nav/GuideNavLink';
import type { NavVerticalNode } from './utils/headerNavTree';
import { isPathWithin } from './utils/navActiveState';

interface HeaderNavProps {
    readonly items: ReadonlyArray<NavVerticalNode>;
}

/**
 * 주 내비 클라이언트 섬. 둘러싼 `Header`가 RSC로 남도록 경로 구독을 여기로 가둔다.
 *
 * `NAV_TREE`의 href는 로케일 접두사가 없는 `/market` 형태인데 `usePathname()`은
 * `/en/market`을 그대로 준다. 떼지 않으면 정확 일치가 영영 실패해 비-ko 사용자에게
 * 활성 표시가 통째로 사라지므로 `useAppPathname`(순수 헬퍼)을 쓴다 — next-intl의
 * navigation은 모듈 로드 시점에 `next/navigation`의 `redirect`를 읽어 부분 mock을 쓰는
 * 기존 테스트가 import에서 깨진다.
 */
export function HeaderNav({ items }: HeaderNavProps) {
    const t = useTranslations('widgets.layout');
    const pathname = useAppPathname();
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
            <GuideNavLink active={isPathWithin(GUIDE_PATH, pathname)} />
        </nav>
    );
}
