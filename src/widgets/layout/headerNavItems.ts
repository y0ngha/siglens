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
    { href: '/market', label: '미국 시장 분석' },
    // 자산군을 이름에 밝힌다 — 사이트가 미국·한국·암호화폐를 함께 다루면서
    // "공포·탐욕 지수"/"시장 뉴스"만 보고는 어느 시장인지 알 수 없게 됐다.
    // 수식어만 붙이고 핵심 명사("지수")를 떼면 안 된다 — 이 배열은 헤더와 푸터
    // 양쪽에 렌더돼 사실상 그 페이지로 가는 모든 내부 앵커다.
    // 두 페이지 모두 실제로는 미국 시장 전용이다(지수 팩터는 S&P500·VIX 등,
    // 뉴스 소스는 FMP 미국 피드).
    { href: '/fear-greed', label: '미국 공포·탐욕 지수' },
    { href: '/news', label: '미국 시장 뉴스' },
    { href: '/economy', label: '미국 경제' },
] as const;
