/**
 * 내비 항목의 "현재 경로" 판정. 헤더 드롭다운·모바일 드로어·가이드 링크가 같은 규칙을 쓴다.
 */
import type { NavVerticalNode } from './headerNavTree';

/**
 * 경로가 `root` 자신이거나 그 하위(`root/…`)인지.
 *
 * 단순 `startsWith(root)`는 `/market-x`까지 `/market`의 하위로 본다 — 구분자(`/`)까지
 * 붙여 비교해야 형제 경로가 걸리지 않는다. `pathname`이 `null`(경로를 아직 모름)이면 `false`.
 */
export function isPathWithin(root: string, pathname: string | null): boolean {
    if (pathname === null) return false;
    return pathname === root || pathname.startsWith(`${root}/`);
}

/**
 * 링크 하나가 현재 경로인지.
 *
 * **접두사 매칭을 쓰지 않는다.** `/market`은 `/market/kr`의 접두사라, 접두사 규칙을
 * 쓰면 한국 페이지에서 미국 항목도 같이 활성이 된다 — 지역을 나눈 목적이 화면에서
 * 사라진다. 내비의 지역·카테고리 링크는 전부 최종 목적지이므로 정확 일치로 충분하다.
 */
export function isHrefActive(href: string, pathname: string | null): boolean {
    return pathname === href;
}

/**
 * 버티컬(1단 메뉴)이 현재 경로를 포함하는지.
 *
 * 지역·자식 링크 중 하나와 정확히 일치하거나, 버티컬 루트의 하위 경로일 때 활성이다.
 * 후자는 트리에 없는 자식 라우트를 위한 것이다 — 지역 허브(`/news`)나 앞으로 추가될
 * 카테고리에서도 `뉴스` 메뉴가 활성으로 보여야 한다.
 */
export function isVerticalActive(
    vertical: NavVerticalNode,
    pathname: string | null
): boolean {
    const hit = vertical.regions.some(
        region =>
            isHrefActive(region.href, pathname) ||
            region.children.some(leaf => isHrefActive(leaf.href, pathname))
    );
    return hit || isPathWithin(vertical.rootHref, pathname);
}
