'use client';

import { LocaleLink as Link } from '@/shared/ui/LocaleLink';
import { useAppPathname } from '@/shared/i18n/useAppPathname';
import {
    startTransition,
    useEffect,
    useEffectEvent,
    useRef,
    useState,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/shared/lib/cn';
import { LocaleSwitcher } from './LocaleSwitcher';
import { useEscapeKey } from '@/shared/hooks/useEscapeKey';
import { useFocusTrap } from '@/shared/hooks/useFocusTrap';
import type { NavVerticalNode } from './headerNavTree';
import { isHrefActive } from './navActiveState';

interface HeaderMobileMenuProps {
    readonly items: ReadonlyArray<NavVerticalNode>;
}

export function HeaderMobileMenu({ items }: HeaderMobileMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    // `NAV_TREE`의 href는 로케일 접두사가 없는 `/market` 형태다. `usePathname()`은
    // `/en/market`을 그대로 주므로, 떼지 않으면 `isHrefActive`의 정확 일치가 영영
    // 실패해 **비-ko 사용자에게 활성 내비 표시가 통째로 사라진다.**
    // next-intl의 navigation 대신 순수 헬퍼를 쓰는 이유: 그쪽은 모듈 로드 시점에
    // `next/navigation`의 `redirect`를 읽어, 부분 mock을 쓰는 기존 테스트 70여 개가
    // 한꺼번에 import에 실패한다.
    const pathname = useAppPathname();
    const triggerRef = useRef<HTMLButtonElement>(null);
    const drawerRef = useRef<HTMLDivElement>(null);

    const close = () => {
        setIsOpen(false);
        triggerRef.current?.focus();
    };

    const toggle = () => setIsOpen(v => !v);

    useEscapeKey(close, isOpen);
    useFocusTrap(drawerRef, isOpen);

    /**
     * SSR/hydration safety gate for the portal.
     * useEffect fires only after hydration, so the first client render (with
     * mounted=false) matches the server HTML (no portal rendered) — avoiding
     * React #418 hydration mismatch. After hydration the effect flips
     * mounted=true and the portal renders normally.
     * The lazy-initializer form (`() => typeof document !== 'undefined`) would
     * set mounted=true on the first client render while the server had false,
     * causing the mismatch this pattern is designed to prevent.
     *
     * useEffectEvent makes the setState lint-safe: setState inside a useEffectEvent
     * is not tracked as an effect dependency, so the react-hooks/set-state-in-effect
     * lint rule does not fire. startTransition separately marks the mount update as
     * non-urgent (deferred paint) — it is NOT the lint fix. Canonical React 19
     * pattern (MISTAKES.md §10).
     */
    const markMounted = useEffectEvent(() => {
        startTransition(() => {
            setMounted(true);
        });
    });
    useEffect(() => {
        markMounted();
    }, []);

    // Auto-close the drawer when the pathname changes (e.g. browser back/forward
    // popstate navigation). Nav link clicks already call close() directly, but
    // history navigation bypasses that handler — leaving the drawer open with
    // body-scroll locked until the user manually dismisses it.
    // useEffectEvent escapes the lint rule: setState inside a useEffectEvent is not
    // tracked as an effect dependency, so react-hooks/set-state-in-effect does not fire.
    // startTransition separately marks the close as a non-urgent transition — it is NOT
    // the lint fix (MISTAKES.md §10).
    const closeOnNav = useEffectEvent(() => {
        if (!isOpen) return; // already closed: nothing to do (avoids spurious focus() on mount)
        startTransition(() => {
            close();
        });
    });
    useEffect(() => {
        closeOnNav();
    }, [pathname]);

    // Prevent body scroll while the drawer is open
    useEffect(() => {
        if (!isOpen) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prev;
        };
    }, [isOpen]);

    /*
     * The backdrop + drawer are portaled to document.body to escape the header's
     * `backdrop-filter: blur(...)` containing block. Per CSS spec, `backdrop-filter`
     * (like `transform` and `filter`) makes the element the containing block for
     * `position: fixed` descendants — so without the portal, the fixed inset
     * coordinates (drawer `top-0 right-0`, backdrop `inset-0`) resolve against
     * the header's bounding box instead of the viewport, and the backdrop would
     * cover only the header area, not the full screen. Portaling to document.body
     * restores standard viewport-relative fixed positioning.
     *
     * Nav links remain crawlable because the desktop `HeaderNavStatic` / `HeaderNav`
     * already renders the same `NAV_TREE` server-side; the mobile drawer being
     * client-only does not affect discoverability.
     *
     * The drawer is always rendered (when mounted) and shown/hidden via translate-x
     * so the slide-in animation works correctly on open.
     */

    return (
        // `lg` 는 Header.tsx의 데스크톱 내비 `hidden lg:flex`와 짝이다 — 한쪽만
        // 바꾸면 두 내비가 동시에 보이거나 둘 다 사라진다.
        <div className="lg:hidden">
            <button
                ref={triggerRef}
                type="button"
                aria-label={isOpen ? '메뉴 닫기' : '메뉴 열기'}
                aria-expanded={isOpen}
                aria-controls="mobile-nav-drawer"
                onClick={toggle}
                className="flex h-11 w-11 touch-manipulation items-center justify-center rounded text-secondary-400 transition-colors hover:text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
            >
                <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    aria-hidden="true"
                >
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
            </button>

            {mounted &&
                createPortal(
                    <>
                        {isOpen && (
                            <div
                                className="fixed inset-0 z-40 bg-black/50"
                                aria-hidden="true"
                                data-testid="mobile-nav-backdrop"
                                onClick={close}
                            />
                        )}

                        <div
                            id="mobile-nav-drawer"
                            ref={drawerRef}
                            role="dialog"
                            aria-modal={isOpen ? 'true' : undefined}
                            aria-label="메뉴"
                            aria-hidden={!isOpen}
                            tabIndex={-1}
                            className={cn(
                                'border-secondary-800 bg-secondary-900 fixed top-0 right-0 z-50 flex h-dvh w-64 flex-col border-l shadow-2xl transition-transform duration-200 outline-none motion-reduce:transition-none',
                                isOpen ? 'translate-x-0' : 'translate-x-full'
                            )}
                        >
                            <div className="flex items-center justify-end border-b border-secondary-800 px-3 py-2">
                                <button
                                    type="button"
                                    onClick={close}
                                    aria-label="메뉴 패널 닫기"
                                    tabIndex={isOpen ? undefined : -1}
                                    className="flex h-11 w-11 touch-manipulation items-center justify-center rounded text-secondary-400 transition-colors hover:text-secondary-100 focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:outline-none"
                                >
                                    <span aria-hidden="true">✕</span>
                                </button>
                            </div>

                            {/*
                                데스크톱은 드롭다운이지만 드로어는 **펼친 채로** 둔다.
                                좁은 화면에서 2단 접힘 메뉴는 목적지 하나에 탭 두 번을
                                요구하고, 열림 상태를 버티컬마다 따로 관리해야 한다.
                                수직 공간은 남으므로 전부 보여주는 편이 짧다.
                            */}
                            {/* 언어 전환은 내비게이션 항목이 아니라 설정이므로
                                <nav> 밖에 둔다 — 안에 넣으면 스크린리더가 메뉴
                                링크 목록의 일부로 읽는다. */}
                            <div className="border-b border-secondary-800 px-2 py-2">
                                <LocaleSwitcher
                                    tabIndex={isOpen ? undefined : -1}
                                />
                            </div>

                            <nav
                                aria-label="메뉴"
                                className="overflow-y-auto overscroll-contain"
                            >
                                {items.map(vertical => (
                                    /*
                                        그룹 구분은 **제목 크기와 구분선**이 함께
                                        만든다. 처음에는 제목을 10px 회색으로 뒀는데,
                                        지역 링크(12px)와 크기가 비슷해 `시장 분석`이
                                        그 아래 `미국`·`한국`과 같은 층으로 읽혔다 —
                                        특히 뉴스처럼 자식이 6줄인 그룹에서는 어디서
                                        다음 그룹이 시작되는지 알 수 없었다.
                                        제목을 키우고 밝게 한 뒤 그룹 사이에 선을 둔다.
                                    */
                                    <div
                                        key={vertical.id}
                                        // 시각적 구분만으로는 부족하다 — 지역 라벨이
                                        // 짧아져(`미국`/`한국`) 버티컬마다 반복되므로,
                                        // 스크린리더에는 같은 이름의 링크 8개가 한
                                        // 줄로 이어진다. 그룹에 이름을 붙여 어느
                                        // 버티컬의 `미국`인지 읽히게 한다.
                                        role="group"
                                        aria-labelledby={`mobile-nav-group-${vertical.id}`}
                                        className="border-t border-secondary-800 py-2 first:border-t-0"
                                    >
                                        <p
                                            id={`mobile-nav-group-${vertical.id}`}
                                            className="px-4 pt-1 pb-2 text-sm font-bold tracking-wide text-secondary-100"
                                        >
                                            {vertical.label}
                                        </p>
                                        {vertical.overview && (
                                            <MobileNavLink
                                                key={vertical.overview.href}
                                                href={vertical.overview.href}
                                                label={vertical.overview.label}
                                                active={isHrefActive(
                                                    vertical.overview.href,
                                                    pathname
                                                )}
                                                focusable={isOpen}
                                                onNavigate={close}
                                            />
                                        )}
                                        {vertical.regions.flatMap(region => [
                                            <MobileNavLink
                                                key={region.href}
                                                href={region.href}
                                                label={region.label}
                                                active={isHrefActive(
                                                    region.href,
                                                    pathname
                                                )}
                                                focusable={isOpen}
                                                onNavigate={close}
                                            />,
                                            ...region.children.map(leaf => (
                                                <MobileNavLink
                                                    key={leaf.href}
                                                    href={leaf.href}
                                                    label={leaf.label}
                                                    active={isHrefActive(
                                                        leaf.href,
                                                        pathname
                                                    )}
                                                    focusable={isOpen}
                                                    onNavigate={close}
                                                    // 들여쓰기로 계층 표현 — 데스크톱 메뉴와 동일 규칙.
                                                    indented
                                                />
                                            )),
                                        ])}
                                    </div>
                                ))}
                            </nav>
                        </div>
                    </>,
                    document.body
                )}
        </div>
    );
}

interface MobileNavLinkProps {
    readonly href: string;
    readonly label: string;
    readonly active: boolean;
    /** 드로어가 닫혀 있으면 탭 순서에서 뺀다 — 화면 밖 링크에 포커스가 갇히지 않도록. */
    readonly focusable: boolean;
    readonly onNavigate: () => void;
    readonly indented?: boolean;
}

/** 드로어의 링크 한 줄. 지역과 그 하위 목적지가 같은 컴포넌트를 쓴다(들여쓰기만 다름). */
function MobileNavLink({
    href,
    label,
    active,
    focusable,
    onNavigate,
    indented,
}: MobileNavLinkProps) {
    return (
        <Link
            href={href}
            // HeaderNav와 동일 — `_rsc` 해시 파편화로 캐시 미스만 늘어난다
            // (CDN_CACHING.md §1).
            prefetch={false}
            aria-current={active ? 'page' : undefined}
            onClick={onNavigate}
            tabIndex={focusable ? undefined : -1}
            className={cn(
                'focus-visible:ring-primary-500 flex min-h-11 w-full touch-manipulation items-center py-2 text-xs tracking-[0.12em] transition-colors focus-visible:ring-2 focus-visible:outline-none',
                indented
                    ? 'pr-4 pl-8 font-normal text-secondary-500 hover:text-secondary-200'
                    : 'px-4 font-semibold',
                active
                    ? 'text-secondary-100 border-primary-500 border-l-2'
                    : cn(
                          'border-l-2 border-transparent',
                          indented
                              ? ''
                              : 'text-secondary-400 hover:text-secondary-100'
                      )
            )}
        >
            {label}
        </Link>
    );
}
