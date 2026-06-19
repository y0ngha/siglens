/**
 * Single source of truth for the primary header navigation items.
 *
 * Extracted from `Header.tsx` so the list is unit-testable in isolation and so
 * the desktop (`HeaderNav`/`HeaderNavStatic`) and mobile (`HeaderMobileMenu`)
 * surfaces stay in lockstep — all three consume this same array.
 *
 * Order = the order users see (left→right desktop, top→bottom mobile drawer).
 */
export interface HeaderNavItem {
    readonly href: string;
    readonly label: string;
}

export const NAV_ITEMS: ReadonlyArray<HeaderNavItem> = [
    { href: '/market', label: '시장 분석' },
    { href: '/news', label: '마켓 뉴스' },
    { href: '/economy', label: '미국 경제' },
] as const;
