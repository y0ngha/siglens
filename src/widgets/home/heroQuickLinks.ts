/**
 * 홈 히어로 아래 붙는 빠른 이동 링크.
 *
 * 목적지(`href`)는 `widgets/layout/headerNavItems.ts`의 `NAV_ITEMS` 부분집합이다.
 * 라벨이 갈리는 건 `/market` 하나뿐이다 — 히어로는 CTA 문구(`오늘 주목할 종목`),
 * 헤더는 짧은 내비 라벨(`미국 시장 분석`). `/news`·`/economy`는 두 배열이 같은
 * 문자열을 쓴다(그래서 `e2e/specs/home.spec.ts`가 조회를 `main`으로 좁힌다).
 *
 * `page.tsx`의 지역 상수였으나 분리했다. 사이트가 미국·한국·암호화폐를 함께 다루게
 * 되면서 "어느 시장인지"가 라벨에 들어가야 하는데, 같은 목적지의 이름이 두 파일에
 * 흩어져 있으면 한쪽만 바뀐다(2026-08 감사에서 실제로 히어로 쪽이 검증되지 않은
 * 상태였다). 여기로 옮겨 헤더 내비와 함께 테스트로 고정한다.
 */
export interface HeroQuickLink {
    readonly href: string;
    readonly label: string;
}

export const HERO_QUICK_LINKS: ReadonlyArray<HeroQuickLink> = [
    { href: '/market', label: '오늘 주목할 종목' },
    { href: '/news', label: '미국 시장 뉴스' },
    { href: '/economy', label: '미국 경제' },
] as const;
