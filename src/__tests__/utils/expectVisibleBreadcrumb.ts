import type { ReactNode } from 'react';
import { expect } from 'vitest';
import { Breadcrumb, type BreadcrumbCrumb } from '@/shared/ui/Breadcrumb';
import { SITE_NAME } from '@/shared/lib/seo';
import { findAllElementsByType } from './findElementByType';
import { collectJsonLdData } from './collectJsonLdData';

interface ListItemNode {
    name: string;
}

/**
 * 가시 브레드크럼이 `BreadcrumbList` 마크업과 **같은 문자열**을 그리는지 못 박는다.
 *
 * 구글은 둘이 다르면 마크업을 무시한다 — 마크업만 고치거나 화면만 고치는 실수는
 * 렌더도 빌드도 깨뜨리지 않아 다음 감사까지 드러나지 않는다. 허브 8곳이 같은
 * 컴포넌트를 쓰므로 검사도 한 곳에 둔다.
 *
 * 홈(`SITE_NAME`) 마디는 양쪽 모두 자동으로 붙으므로 비교에서 뺀다.
 */
export function expectVisibleBreadcrumbMatchesJsonLd(tree: ReactNode): void {
    const navs = findAllElementsByType(tree, Breadcrumb);
    expect(navs, '가시 브레드크럼은 한 번만 렌더돼야 한다').toHaveLength(1);
    // findAllElementsByType은 ReactElement.props를 unknown으로 돌려준다 — 위에서
    // toHaveLength(1)로 걸러 이 트리의 유일한 Breadcrumb 엘리먼트임을 보장했으므로
    // props가 BreadcrumbProps({ trail })임이 컴포넌트 정의상 확실하다.
    const trail = (navs[0]?.props as { trail: readonly BreadcrumbCrumb[] })
        .trail;

    const lists = collectJsonLdData(tree).filter(
        d => d['@type'] === 'BreadcrumbList'
    );
    expect(lists, 'BreadcrumbList JSON-LD는 한 벌이어야 한다').toHaveLength(1);
    const names = (lists[0]!.itemListElement as ListItemNode[]).map(
        i => i.name
    );

    expect(names[0], '첫 마디는 사이트명이다').toBe(SITE_NAME);
    expect(trail.map(c => c.label)).toEqual(names.slice(1));
}

/**
 * `buildBreadcrumbJsonLd`를 목킹한 테스트용 — 마크업을 볼 수 없으므로 빌더에
 * 넘어간 이름과 화면 마디를 직접 대조한다. 계약은 위와 같다.
 */
export function expectVisibleBreadcrumbLabels(
    tree: ReactNode,
    names: readonly string[]
): void {
    const navs = findAllElementsByType(tree, Breadcrumb);
    expect(navs, '가시 브레드크럼은 한 번만 렌더돼야 한다').toHaveLength(1);
    // 위와 동일한 근거: toHaveLength(1)로 좁힌 유일한 Breadcrumb 엘리먼트라
    // props shape(BreadcrumbProps)이 보장된다.
    const trail = (navs[0]?.props as { trail: readonly BreadcrumbCrumb[] })
        .trail;
    expect(trail.map(c => c.label)).toEqual(names);
}

/**
 * DOM 렌더 결과에서 같은 계약을 검사한다. 라우트가 본문을 **엘리먼트로만**
 * 돌려주는 경우(서버 컴포넌트 자식) 트리 탐색으로는 브레드크럼이 보이지 않아
 * 실제로 그려 봐야 한다.
 */
export function expectVisibleBreadcrumbMatchesJsonLdDom(
    container: HTMLElement,
    navLabel: string
): void {
    const nav = container.querySelector(`nav[aria-label="${navLabel}"]`);
    expect(nav, '가시 브레드크럼 nav가 있어야 한다').not.toBeNull();
    const visible = Array.from(nav!.querySelectorAll('li'))
        .map(li => li.textContent?.trim() ?? '')
        .filter(text => text !== '/');

    const lists = Array.from(
        container.querySelectorAll('script[type="application/ld+json"]')
    )
        .map(script => {
            try {
                return JSON.parse(script.textContent ?? '');
            } catch {
                return null;
            }
        })
        .filter(data => data?.['@type'] === 'BreadcrumbList');
    expect(lists, 'BreadcrumbList JSON-LD는 한 벌이어야 한다').toHaveLength(1);

    expect(visible).toEqual(
        (lists[0].itemListElement as ListItemNode[]).map(i => i.name)
    );
}
