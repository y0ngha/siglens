import type { EconomyCategoryKey } from './economyIndicators';

/**
 * `/economy/kr`이 카드로 보여주는 한국 거시 지표 레지스트리.
 *
 * **왜 미국판(`economyIndicators.ts`)과 구조가 다른가**: 미국 지표는 FMP
 * `/economic-indicators?name=<NAME>` 시계열 엔드포인트에서 온다. 한국은 그 엔드포인트가
 * 커버하지 않아, **경제 캘린더의 발표 이력(`actual`)**에서 지표를 되짚는다. 그래서
 * 식별자가 지표 이름이 아니라 **FMP 이벤트명**이다.
 *
 * 이벤트명은 `Inflation Rate YoY (Jul)`처럼 괄호 안 기간이 붙어 오므로, 매칭은
 * 괄호를 떼고 한다(`normalizeKrEventName`).
 *
 * **한계(그대로 표시한다)**: FMP 플랜의 캘린더 조회 상한이 과거 ~180일이라(365일은
 * 402), 초기 시계열은 월간 지표 기준 5~6포인트다. DB에 누적되면 자연히 길어진다.
 * 없는 구간을 채워 넣지 않는다 — 포인트가 부족하면 추세를 숨긴다.
 *
 * 2026-08-18 실측으로 확인한 이벤트만 넣었다(180일 창, `actual` 존재 기준).
 */
export interface KrEconomyIndicatorMeta {
    /** FMP 이벤트명(괄호 기간 제외). 매칭 키. */
    event: string;
    category: EconomyCategoryKey;
    /** 카드 표시 라벨(한국어). */
    label: string;
    /** 값 단위 표기. */
    unit: string;
    /** 표시 소수 자리수. */
    precision: number;
    /** 어려운 용어 풀이(~이에요체) — 미국판 카드와 같은 톤. */
    tooltip: string;
}

/**
 * 이벤트명에서 뒤에 붙는 기간 괄호를 떼어 매칭 키로 만든다.
 * `Inflation Rate YoY (Jul)` → `Inflation Rate YoY`
 * `GDP Growth Rate YoY (Q2)` → `GDP Growth Rate YoY`
 */
export function normalizeKrEventName(event: string): string {
    return event.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

export const KR_ECONOMY_INDICATORS: readonly KrEconomyIndicatorMeta[] = [
    {
        event: 'Interest Rate Decision',
        category: 'rates',
        label: '한국 기준금리',
        unit: '%',
        precision: 2,
        tooltip:
            '한국은행 금융통화위원회가 정하는 기준금리예요. 높을수록 돈을 빌리는 비용이 커져 경기를 식혀요.',
    },
    {
        event: '3-Year KTB Auction',
        category: 'rates',
        label: '국고채 3년 낙찰금리',
        unit: '%',
        precision: 3,
        tooltip:
            '정부가 3년 만기 국고채를 발행할 때 정해진 금리예요. 단기 시장금리의 기준으로 읽혀요.',
    },
    {
        event: '10-Year KTB Auction',
        category: 'rates',
        label: '국고채 10년 낙찰금리',
        unit: '%',
        precision: 3,
        tooltip:
            '정부가 10년 만기 국고채를 발행할 때 정해진 금리예요. 장기 성장·물가 기대를 반영해요.',
    },
    {
        event: 'Inflation Rate YoY',
        category: 'inflation',
        label: '소비자물가 상승률',
        unit: '%',
        precision: 1,
        tooltip:
            '1년 전과 비교한 소비자물가 상승 폭이에요. 한국은행 물가안정목표는 2%예요.',
    },
    {
        event: 'Producer Price Index YoY',
        category: 'inflation',
        label: '생산자물가 상승률',
        unit: '%',
        precision: 1,
        tooltip:
            '기업이 파는 물건 가격의 1년 전 대비 상승 폭이에요. 보통 소비자물가보다 먼저 움직여요.',
    },
    {
        event: 'GDP Growth Rate YoY',
        category: 'growth',
        label: 'GDP 성장률(전년비)',
        unit: '%',
        precision: 1,
        tooltip: '1년 전 같은 분기와 비교한 실질 국내총생산 증가율이에요.',
    },
    {
        event: 'Industrial Production YoY',
        category: 'growth',
        label: '산업생산(전년비)',
        unit: '%',
        precision: 1,
        tooltip:
            '광공업 생산량의 1년 전 대비 증감이에요. 제조업 경기를 가장 빠르게 보여줘요.',
    },
    {
        event: 'Exports YoY',
        category: 'growth',
        label: '수출(전년비)',
        unit: '%',
        precision: 1,
        tooltip:
            '수출액의 1년 전 대비 증감이에요. 수출 비중이 큰 한국 경제에서 가장 중요한 선행 지표예요.',
    },
    {
        event: 'Consumer Confidence',
        category: 'growth',
        label: '소비자심리지수',
        unit: 'pt',
        precision: 1,
        tooltip:
            '소비자가 느끼는 경기 체감이에요. 100보다 크면 낙관, 작으면 비관이 우세하다는 뜻이에요.',
    },
    {
        event: 'Unemployment Rate',
        category: 'labor',
        label: '실업률',
        unit: '%',
        precision: 1,
        tooltip: '일할 의사가 있는 사람 중 일자리를 찾지 못한 비율이에요.',
    },
];
