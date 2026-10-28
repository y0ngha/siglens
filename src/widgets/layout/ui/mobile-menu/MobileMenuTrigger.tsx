'use client';

import type { Ref } from 'react';
import { useTranslations } from 'next-intl';
import { MenuIcon } from '@/shared/ui/StrokeIcons';

/** 드로어 `id`. 햄버거의 `aria-controls`와 드로어 요소가 같은 값을 써야 한다. */
export const MOBILE_NAV_DRAWER_ID = 'mobile-nav-drawer';

interface MobileMenuTriggerProps {
    readonly ref: Ref<HTMLButtonElement>;
    readonly isOpen: boolean;
    readonly onClick: () => void;
}

/** 햄버거 버튼. 이름이 열림 상태에 따라 "메뉴 열기"/"메뉴 닫기"로 바뀐다. */
export function MobileMenuTrigger({
    ref,
    isOpen,
    onClick,
}: MobileMenuTriggerProps) {
    const t = useTranslations('widgets.layout');
    return (
        <button
            ref={ref}
            type="button"
            aria-label={
                isOpen
                    ? t('HeaderMobileMenu.923b26')
                    : t('HeaderMobileMenu.195da6')
            }
            aria-expanded={isOpen}
            aria-controls={MOBILE_NAV_DRAWER_ID}
            onClick={onClick}
            className="flex h-11 w-11 touch-manipulation items-center justify-center rounded text-secondary-400 transition-colors hover:text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
        >
            <MenuIcon className="size-6" />
        </button>
    );
}
