'use client';

import { createPortal } from 'react-dom';
import type { ReactNode, Ref } from 'react';
import { useTranslations } from 'next-intl';
import { useHydrated } from '@/shared/hooks/useHydrated';
import { cn } from '@/shared/lib/cn';
import { CloseIcon } from '@/shared/ui/StrokeIcons';
import { MOBILE_NAV_DRAWER_ID } from './MobileMenuTrigger';

interface MobileDrawerPanelProps {
    readonly drawerRef: Ref<HTMLDivElement>;
    readonly isOpen: boolean;
    readonly onClose: () => void;
    readonly children: ReactNode;
}

/**
 * 오른쪽에서 밀려 나오는 드로어 셸 — 백드롭 + 다이얼로그 + 닫기 버튼. 내용은 `children`.
 *
 * **`document.body`로 포털한다.** 헤더의 `backdrop-filter`는 `transform`·`filter`처럼
 * `position: fixed` 자손의 containing block이 되어, 포털이 없으면 fixed 좌표(드로어 `top-0
 * right-0`, 백드롭 `inset-0`)가 뷰포트가 아니라 헤더 박스를 기준으로 풀리고 백드롭이 헤더
 * 영역만 덮는다. 링크는 데스크톱 `HeaderNav`가 같은 트리를 서버에서 그리므로 크롤에 영향이 없다.
 *
 * 포털 노드는 트리거 래퍼의 `lg:hidden`이 닿지 않으므로 백드롭과 드로어에 직접 `lg:hidden`을
 * 단다. 포털은 하이드레이션 뒤에만 그린다 — 첫 클라이언트 렌더가 서버 HTML(포털 없음)과 같아야
 * 한다. 드로어는 늘 렌더하고 `translate-x`로 숨긴다(슬라이드 인 애니메이션을 위해).
 * 닫힌 동안은 `inert`라 내용이 탭 순서·보조 기술에서 모두 빠진다.
 */
export function MobileDrawerPanel({
    drawerRef,
    isOpen,
    onClose,
    children,
}: MobileDrawerPanelProps) {
    const t = useTranslations('widgets.layout');
    const mounted = useHydrated();
    if (!mounted) return null;

    return createPortal(
        <>
            {/* z-70: 모바일 분석 시트(z-50)·AI 버튼(z-60) 위에 떠야 한다. 검색 오버레이(z-70)와는
                동시에 열리지 않는다. */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-70 bg-black/50 lg:hidden"
                    aria-hidden="true"
                    data-testid="mobile-nav-backdrop"
                    onClick={onClose}
                />
            )}

            <div
                id={MOBILE_NAV_DRAWER_ID}
                ref={drawerRef}
                role="dialog"
                aria-modal={isOpen ? 'true' : undefined}
                aria-label={t('HeaderMobileMenu.076925')}
                inert={!isOpen}
                tabIndex={-1}
                className={cn(
                    'border-secondary-700 bg-secondary-900 fixed top-0 right-0 z-70 flex h-dvh w-64 flex-col border-l shadow-2xl transition-transform duration-200 outline-none motion-reduce:transition-none lg:hidden',
                    isOpen ? 'translate-x-0' : 'translate-x-full'
                )}
            >
                <div className="flex items-center justify-end border-b border-secondary-700 px-3 py-2">
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label={t('HeaderMobileMenu.d28d27')}
                        className="flex h-11 w-11 touch-manipulation items-center justify-center rounded text-secondary-400 transition-colors hover:text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                    >
                        <CloseIcon className="size-5" />
                    </button>
                </div>
                {children}
            </div>
        </>,
        document.body
    );
}
