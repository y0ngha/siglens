import type { CategoryConfig } from '@/entities/market-news/lib/categoryConfig';
import { regionsOf } from '@/shared/config/assetClassNav';
import type { BreadcrumbCrumb } from '@/shared/ui/Breadcrumb';

/**
 * 카테고리 breadcrumb 마디 하나 — JSON-LD와 화면 렌더 양쪽의 원본 자료.
 * `BreadcrumbCrumb`(label/href)와 shape가 달라 재사용하지 않고, 화면용 변환은
 * {@link toVisibleCrumbs}가 한다.
 */
export interface BreadcrumbTrailNode {
    readonly name: string;
    /** 로케일 접두사가 없는 경로. */
    readonly path: string;
}

/**
 * 카테고리 페이지의 breadcrumb 마디 — 허브 → 지역 허브 → 카테고리.
 *
 * 지역에 카테고리가 하나뿐이면(한국·암호화폐) 지역 허브와 카테고리 페이지가 같은 URL이라
 * 2단계로 줄인다 — 같은 URL을 두 단계로 넣으면 breadcrumb가 자기 자신을 부모로 갖는다.
 * 마크업은 만들지 않는다: 같은 배열이 `BreadcrumbList` JSON-LD와 화면 `<Breadcrumb>`를
 * 만들어야 둘의 텍스트가 갈리지 않는다(구글은 다르면 마크업을 무시한다).
 */
export function categoryBreadcrumbTrail(
    cfg: CategoryConfig,
    categoryPath: string,
    /** 루트 번역자(`getTranslations()`) — 완전 수식 키를 푼다. 순수 함수라 주입받는다. */
    tNav: (key: string) => string
): readonly BreadcrumbTrailNode[] {
    const regionLink = regionsOf('news').find(r => r.region === cfg.region);
    const regionNodes =
        regionLink && regionLink.href !== categoryPath
            ? [{ name: tNav(regionLink.fullLabelKey), path: regionLink.href }]
            : [];
    return [
        { name: tNav('app.news.page.dc06c4'), path: '/news' },
        ...regionNodes,
        { name: tNav(cfg.labelKey), path: categoryPath },
    ];
}

/** 화면 `<Breadcrumb>`용 변환 — 마지막 마디는 현재 페이지라 링크를 걸지 않는다. */
export function toVisibleCrumbs(
    trail: readonly BreadcrumbTrailNode[]
): BreadcrumbCrumb[] {
    return trail.map(({ name, path }, index) =>
        index === trail.length - 1
            ? { label: name }
            : { label: name, href: path }
    );
}
