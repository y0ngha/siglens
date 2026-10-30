/**
 * 펀더멘털 카테고리 → `shared.enumLabel` 카탈로그 키 조회표.
 */
import type { FundamentalCategory } from '@y0ngha/siglens-core';

/**
 * FundamentalCategory → `shared.enumLabel.fundamentalCategory` 카탈로그 키.
 *
 * 번역은 이 맵을 쓰는 `.tsx`가 `tLabel(CATEGORY_LABEL_KEY[...])`로 직접 호출한다 —
 * `extract.mjs`의 동적 키 탐지는 번역자를 호출하는 파일만 보기 때문이다.
 */
export const CATEGORY_LABEL_KEY: Record<FundamentalCategory, string> = {
    valuation: 'fundamentalCategory.valuation',
    profitability: 'fundamentalCategory.profitability',
    growth: 'fundamentalCategory.growth',
    health: 'fundamentalCategory.health',
    futureDirection: 'fundamentalCategory.futureDirection',
};
