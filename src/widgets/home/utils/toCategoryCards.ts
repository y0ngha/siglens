import {
    TICKER_CATEGORY_DESCRIPTION_KEY,
    TICKER_CATEGORY_LABEL_KEY,
} from '@/shared/config/tickerCategoryLabel';
import type { TickerItem } from '@/shared/lib/types';
import type { CardStyle, CategoryCard } from '../ui/CategoryCardGrid';

/** 설정 카테고리의 최소 모양 — 주식/암호화폐 설정이 모두 이 구조를 만족한다. */
interface CategorySource<Id extends string> {
    readonly id: Id;
    readonly label: string;
    readonly items: readonly TickerItem[];
}

/**
 * 설정 카테고리 → `CategoryCard` 프로젝션.
 *
 * 라벨·설명은 키만 실어 보내고 번역은 렌더 시점에 한다 — 설정은 데이터,
 * 표시는 카탈로그다. 스타일은 id로 조회하므로 `Record<Id, CardStyle>`가 모든
 * 카테고리를 덮지 못하면 컴파일 에러가 난다.
 */
export function toCategoryCards<Id extends string>(
    categories: readonly CategorySource<Id>[],
    styles: Record<Id, CardStyle>
): CategoryCard[] {
    return categories.map(category => ({
        id: category.id,
        labelKey: TICKER_CATEGORY_LABEL_KEY[category.label],
        descriptionKey: TICKER_CATEGORY_DESCRIPTION_KEY[category.label],
        label: category.label,
        ...styles[category.id],
        items: category.items,
    }));
}
