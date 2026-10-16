import type { MarketProfileDescriptor } from './types';

/**
 * 공급자가 이용 조건으로 요구하는 **데이터 출처 표기**. 키는 프로필이 실제로 부르는 어댑터
 * (`MarketProfileDescriptor.dataProvider`)다 — 어댑터를 바꾸면 표기도 이 표에서 함께 바뀌어야 하고,
 * 옆 테스트가 프로필의 `dataProvider`와 이 표를 대조한다(`dataSourceLabel.ts`와 같은 규약).
 *
 * 브랜드 고유명이라 로케일과 무관하게 영어 그대로 둔다(카탈로그 번역 대상 아님). 표기 의무가 있는 건
 * FMP뿐이다 — Yahoo(한국 주식)는 `null`이라 아무것도 달지 않는다. 링크에 제휴·ref 파라미터를 붙이지 않는다.
 */
export interface DataAttribution {
    text: string;
    url: string;
}

export const DATA_ATTRIBUTION: Record<
    MarketProfileDescriptor['dataProvider'],
    DataAttribution | null
> = {
    fmp: {
        text: 'Data provided by Financial Modeling Prep',
        url: 'https://financialmodelingprep.com',
    },
    yahoo: null,
};
