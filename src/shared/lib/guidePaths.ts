/**
 * 차트 가이드 경로 헬퍼 — 순수 함수. 로케일 접두사는 `LocaleLink`/`localePath`가 붙인다.
 *
 * 카테고리는 `entities/guide/types`의 `GuideCategory`지만 shared는 entities를 import할 수
 * 없어 문자열로 받는다. 값 검증은 호출부(카테고리 enum)의 몫이다.
 */
export const GUIDE_PATH = '/guide';

export function guideCategoryPath(category: string): string {
    return `${GUIDE_PATH}/${category}`;
}

export function guideEntryPath(category: string, slug: string): string {
    return `${GUIDE_PATH}/${category}/${slug}`;
}
