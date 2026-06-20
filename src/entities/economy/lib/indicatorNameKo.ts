/**
 * 경제 지표명 한국어화 — 코드 const 사전(source-of-truth, `dict`)이 1차, DB 캐시(`ai`)가
 * 2차다. 이 모듈은 순수(React/server-only/DB 비의존)하므로 클라 그리드와 서버 reader가
 * 함께 import할 수 있다. DB 캐시 룩업과 AI 트리거는 서버 계층(api/, actions/)이 담당하고,
 * 여기서는 이미 로드된 DB 맵을 받아 동기 합성만 한다.
 *
 * 초기 사전은 FMP 샘플에서 가장 흔한 지표 일부만 확정해 시드한다. 전체 ~277개 큐레이션은
 * SP-A 백필 name-dump를 소비하는 별도 데이터 작업이다(docs/superpowers/seeding 참조).
 */

/** `INDICATOR_NAME_KO`/DB 캐시의 키 = 정규화된 base 지표명, 값 = 한국어. */
export const INDICATOR_NAME_KO: Record<string, string> = {
    // 물가
    'Core PCE Price Index YoY': '근원 PCE 물가지수(전년比)',
    'Core PCE Price Index MoM': '근원 PCE 물가지수(전월比)',
    'PCE Price Index YoY': 'PCE 물가지수(전년比)',
    'Inflation Rate YoY': '소비자물가 상승률(전년比)',
    'Core Inflation Rate YoY': '근원 소비자물가 상승률(전년比)',
    CPI: '소비자물가지수',
    'CPI YoY': '소비자물가지수(전년比)',
    'CPI MoM': '소비자물가지수(전월比)',
    'Core CPI YoY': '근원 소비자물가지수(전년比)',
    'Core CPI MoM': '근원 소비자물가지수(전월比)',
    'PPI MoM': '생산자물가지수(전월比)',
    'Core PPI MoM': '근원 생산자물가지수(전월比)',
    // 고용
    'Nonfarm Payrolls': '비농업 고용',
    'ADP Employment Change': 'ADP 고용 변화',
    'Initial Jobless Claims': '신규 실업수당 청구',
    'Continuing Jobless Claims': '연속 실업수당 청구',
    'Unemployment Rate': '실업률',
    'Average Hourly Earnings MoM': '시간당 평균 임금(전월比)',
    'JOLTs Job Openings': '구인 건수(JOLTs)',
    // 성장·심리
    'GDP Growth Rate QoQ': 'GDP 성장률(전분기比)',
    'Retail Sales MoM': '소매판매(전월比)',
    'ISM Manufacturing PMI': 'ISM 제조업 PMI',
    'ISM Services PMI': 'ISM 서비스업 PMI',
    'Michigan Consumer Sentiment': '미시간대 소비자심리지수',
    // 정책·국채
    'Fed Interest Rate Decision': '연준 기준금리 결정',
    '10-Year Note Auction': '10년물 국채 입찰',
    '30-Year Bond Auction': '30년물 국채 입찰',
    '2-Year Note Auction': '2년물 국채 입찰',
    '3-Month Bill Auction': '3개월물 국채 입찰',
};

/** 변화-방향 접미 토큰의 한국어 매핑. */
const PERIOD_DIRECTION_KO: Record<string, string> = {
    YoY: '전년比',
    MoM: '전월比',
    QoQ: '전분기比',
};

/** 영어 월 약어 → 1-indexed 월. */
const MONTH_INDEX: Record<string, number> = {
    Jan: 1,
    Feb: 2,
    Mar: 3,
    Apr: 4,
    May: 5,
    Jun: 6,
    Jul: 7,
    Aug: 8,
    Sep: 9,
    Oct: 10,
    Nov: 11,
    Dec: 12,
};

/** `normalizeIndicatorName` 반환 형태. */
export interface NormalizedIndicatorName {
    /** 접미 괄호를 제거한 base 지표명. */
    base: string;
    /** 마지막 괄호 안의 기간 토큰(없으면 ''). 예 'May' | 'Q1' | 'Jun/20'. */
    period: string;
}

/**
 * 마지막 괄호 그룹을 base와 period로 분리한다. 중간 괄호('Index (ex Food) MoM')는
 * 보존하고 끝 괄호만 떼어낸다. 접미 괄호가 없으면 period는 ''.
 */
export function normalizeIndicatorName(raw: string): NormalizedIndicatorName {
    const match = raw.trim().match(/^(.*?)\s*\(([^()]*)\)\s*$/);
    if (match === null) {
        return { base: raw.trim(), period: '' };
    }
    return { base: match[1].trim(), period: match[2].trim() };
}

/**
 * 기간 토큰을 한국어로 변환한다 — 변화-방향(YoY/MoM/QoQ), 월 약어(May→5월),
 * 분기(Q1→1분기). 미지 토큰은 원문 유지(예 'Jun/20').
 */
export function koreanizePeriodToken(token: string): string {
    if (token in PERIOD_DIRECTION_KO) {
        return PERIOD_DIRECTION_KO[token];
    }
    if (token in MONTH_INDEX) {
        return `${MONTH_INDEX[token]}월`;
    }
    const quarter = token.match(/^Q([1-4])$/);
    if (quarter !== null) {
        return `${quarter[1]}분기`;
    }
    return token;
}

/**
 * 동기 표시 헬퍼 — dict(코드 사전) → dbMap(이미 로드된 DB 캐시) 순으로 base를 룩업한다.
 * 둘 다 miss면 raw 영어 원문을 그대로 반환(결정론적 fallback). hit이면 한국어 base에
 * period 토큰을 한국어로 붙인다(' (5월)'). period가 dict base 안에 이미 녹아 있으면
 * (예 'Core PCE Price Index YoY' base는 '(전년比)' 포함) period 괄호만 추가된다.
 *
 * AI 트리거/캐시 쓰기는 서버 계층(resolveIndicatorLabels)이 담당 — 이 함수는 순수.
 */
export function indicatorLabelKoFromMaps(
    raw: string,
    dbMap: Record<string, string>
): string {
    const { base, period } = normalizeIndicatorName(raw);
    // `Record<string, string>` 타입은 `noUncheckedIndexedAccess` 없이 항상 string을
    // 반환하므로 `?? dbMap[base]` fallback이 타입 상 dead code처럼 보인다. `Object.hasOwn`으로
    // dict miss를 명시적으로 검사해 fallback 체인(dict → dbMap → raw)을 타입 안전하게 만든다.
    const ko = Object.hasOwn(INDICATOR_NAME_KO, base)
        ? INDICATOR_NAME_KO[base]
        : (dbMap[base] ?? undefined);
    if (ko === undefined) {
        return raw;
    }
    if (period === '') {
        return ko;
    }
    return `${ko} (${koreanizePeriodToken(period)})`;
}
