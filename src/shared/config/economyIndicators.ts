/**
 * 미니 추세 차트에 쓰는 시계열 포인트 수 — 매직넘버 상수화(MISTAKES §15).
 *
 * core `normalizeEconomicIndicatorSeries(name, raw, trendLength)`의 N 값으로 직접 전달된다.
 */
export const INDICATOR_TREND_LENGTH = 12;

/** /economy 페이지가 보여주는 거시 지표 카테고리 키. */
export type EconomyCategoryKey = 'rates' | 'inflation' | 'growth' | 'labor';

/** 카테고리 섹션 그룹 메타. */
export interface EconomyCategoryMeta {
    key: EconomyCategoryKey;
    /** 섹션 제목 (한국어). */
    label: string;
}

/** 단일 경제지표 카드의 표시 메타. */
export interface EconomyIndicatorMeta {
    /** FMP `/economic-indicators?name=<NAME>` 값. 부록 A 검증된 식별자. */
    name: string;
    /** 어떤 카테고리 섹션에 속하는지. */
    category: EconomyCategoryKey;
    /** 카드 표시 라벨(한국어). */
    label: string;
    /** 값 단위 표기(예: '%', 'pt', '천명'). */
    unit: string;
    /** 표시 소수 자리수. */
    precision: number;
    /** 어려운 용어 풀이(InfoTooltip, ~이에요체). */
    tooltip: string;
}

/** 카테고리 섹션 4종 — UI는 이 순서대로 렌더. */
export const ECONOMY_INDICATOR_CATEGORIES: readonly EconomyCategoryMeta[] = [
    { key: 'rates', label: '금리' },
    { key: 'inflation', label: '물가' },
    { key: 'growth', label: '성장·경기' },
    { key: 'labor', label: '고용' },
];

/**
 * FMP economic-indicators로 받는 9종 지표 레지스트리.
 *
 * (국채 2Y/10Y와 2s10s 스프레드는 별도 treasury-rates endpoint로 처리하므로 여기 포함하지 않는다.)
 * PCE·PPI·ISM PMI는 FMP가 `Invalid name`을 반환하므로 미포함 — 부록 A.
 *
 * 새 지표 추가 = 이 배열에 1행. core가 동일 `name`을 정규화해 시리즈를 반환한다.
 */
export const ECONOMY_INDICATORS: readonly EconomyIndicatorMeta[] = [
    {
        name: 'federalFunds',
        category: 'rates',
        label: '연방기금금리',
        unit: '%',
        precision: 2,
        tooltip:
            '연준이 정하는 미국의 기준금리예요. 높을수록 돈을 빌리는 비용이 커져 경기를 식혀요.',
    },
    {
        name: 'inflationRate',
        category: 'inflation',
        label: '인플레이션율',
        unit: '%',
        precision: 2,
        tooltip:
            '1년 전보다 물가가 얼마나 올랐는지를 나타내요. 연준 목표는 보통 2% 근처예요.',
    },
    {
        name: 'CPI',
        category: 'inflation',
        label: '소비자물가지수',
        unit: 'pt',
        precision: 1,
        tooltip:
            '소비자가 사는 물건·서비스 가격을 지수로 만든 거예요. 이 지수의 변화율이 인플레이션이에요.',
    },
    {
        name: 'GDP',
        category: 'growth',
        label: 'GDP',
        unit: 'B$',
        precision: 0,
        tooltip:
            '미국 경제가 만들어내는 총 부가가치예요. 늘면 경기 확장, 줄면 위축 신호예요.',
    },
    {
        name: 'industrialProductionTotalIndex',
        category: 'growth',
        label: '산업생산지수',
        unit: 'pt',
        precision: 1,
        tooltip:
            '공장·광업·전기 등 실물 생산 활동을 지수로 본 거예요. 경기를 비교적 빠르게 보여줘요.',
    },
    {
        name: 'smoothedUSRecessionProbabilities',
        category: 'growth',
        label: '경기침체 확률',
        unit: '%',
        precision: 1,
        tooltip:
            '지금이 경기침체 국면일 확률을 추정한 값이에요. 높을수록 침체 신호가 강해요.',
    },
    {
        name: 'unemploymentRate',
        category: 'labor',
        label: '실업률',
        unit: '%',
        precision: 1,
        tooltip:
            '일할 의사가 있는데 일자리가 없는 사람의 비율이에요. 오르면 경기 둔화 신호예요.',
    },
    {
        name: 'totalNonfarmPayroll',
        category: 'labor',
        label: '비농업 고용',
        unit: '천명',
        precision: 0,
        tooltip:
            '농업을 뺀 미국 전체 일자리 수예요. 매달 얼마나 늘었는지가 고용 시장의 핵심 지표예요.',
    },
    {
        name: 'initialClaims',
        category: 'labor',
        label: '신규 실업수당청구',
        unit: '건',
        precision: 0,
        tooltip:
            '한 주 동안 새로 실업수당을 신청한 사람 수예요. 빠르게 나와서 고용을 선행해서 보여줘요.',
    },
];
