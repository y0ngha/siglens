/** 하루치 활성 사용자 수. `date`는 KST 기준 `YYYY-MM-DD`. */
export interface DailyActiveUsers {
    readonly date: string;
    readonly count: number;
}

/** 하루 동안 한 섹션(예: 가이드)으로 처음 들어온 방문자 수. */
export interface DailyLandingCount {
    readonly date: string;
    readonly count: number;
}

/** UA 한 종류가 남긴 방문 행 수. 봇 필터를 통과한 트래픽을 눈으로 검수할 때 쓴다. */
export interface UserAgentTally {
    readonly userAgent: string | null;
    readonly country: string | null;
    readonly count: number;
}

/**
 * 하루 첫 진입의 출처 분류. 개인정보처리방침 §2(접속 통계)가 고지한 "정해진 분류값"이 이 목록이다 —
 * 원본 도메인·URL은 저장하지 않는다. 값을 늘리면 방침 문구가 말하는 범위 안인지 확인한다.
 *
 * - AI 답변 서비스: `chatgpt`·`perplexity`·`gemini`·`copilot`·`claude`·`deepseek`·`grok`
 * - 검색엔진: `google`·`naver`·`bing`·`daum`·`duckduckgo`
 * - SNS·커뮤니티: `x`·`threads`·`facebook`·`instagram`·`youtube`·`naver-blog`·`reddit`
 * - 증권 포털: `naver-finance`(네이버 증권. 검색이 아니라 추천 유입이다)
 * - 광고: `paid`(URL에 광고 클릭 식별자가 있거나 `utm_medium`이 유료 매체 값)
 * - 메일: `email`(`utm_source` 또는 `utm_medium`이 `email`인 우리 메일 링크)
 * - 공유 링크: `share`(분석 공유 링크 페이지로 들어온 방문)
 * - `other`: 위에 없는 외부 출처
 *
 * 광고·메일·공유 링크는 개인정보처리방침 v15 §2가 고지한 분류다. 광고 클릭 식별자의 값과
 * `utm_medium` 원문은 저장하지 않고, 있었는지 여부와 정해진 값인지만 분류에 쓴다.
 *
 * 같은 사이트 안의 이동이나 출처를 알 수 없는 직접 방문은 값이 없다(`null`).
 */
export const ENTRY_SOURCES = [
    'chatgpt',
    'perplexity',
    'gemini',
    'copilot',
    'claude',
    'deepseek',
    'grok',
    'google',
    'naver',
    'bing',
    'daum',
    'duckduckgo',
    'x',
    'threads',
    'facebook',
    'instagram',
    'youtube',
    'naver-blog',
    'naver-finance',
    'reddit',
    'paid',
    'email',
    'share',
    'other',
] as const;

export type EntrySource = (typeof ENTRY_SOURCES)[number];

/**
 * 비콘을 보낸 페이지가 속한 사이트. 원본 호스트가 아니라 이 두 값만 저장한다.
 * 그날 첫 진입 기준이다(`visitor_days.landing_site`).
 */
export const LANDING_SITES = ['main', 'ai'] as const;
export type LandingSite = (typeof LANDING_SITES)[number];

/** 이 브라우저에서 처음 방문한 뒤 지난 일수 구간(`new`는 오늘이 첫 방문). */
export const FIRST_VISIT_BUCKETS = [
    'new',
    'd1_6',
    'd7_13',
    'd14_29',
    'd30_89',
    'd90_plus',
] as const;
export type FirstVisitBucket = (typeof FIRST_VISIT_BUCKETS)[number];

/** 직전 방문 뒤 지난 일수 구간(`none`은 직전 방문이 없다). */
export const LAST_VISIT_BUCKETS = [
    'none',
    'd1',
    'd2_6',
    'd7_13',
    'd14_29',
    'd30_plus',
] as const;
export type LastVisitBucket = (typeof LAST_VISIT_BUCKETS)[number];

/** 이 브라우저가 방문한 날 수 구간. */
export const VISIT_DAYS_BUCKETS = [
    'n1',
    'n2',
    'n3_4',
    'n5_9',
    'n10_19',
    'n20_plus',
] as const;
export type VisitDaysBucket = (typeof VISIT_DAYS_BUCKETS)[number];

/** 첫 방문 다음 날(`d1`), 7~13일 뒤(`d7`), 30~36일 뒤(`d30`) 창. */
export const RETURN_WINDOWS = ['d1', 'd7', 'd30'] as const;
export type ReturnWindow = (typeof RETURN_WINDOWS)[number];

/**
 * 브라우저가 계산해 비콘에 싣는 방문 이력 구간값. 정확한 날짜·횟수는 보내지 않는다.
 * `window`는 이번 방문이 그 창 안의 **첫** 방문일 때만 채워진다.
 */
export interface VisitSignals {
    readonly first: FirstVisitBucket;
    readonly last: LastVisitBucket;
    readonly days: VisitDaysBucket;
    readonly window: ReturnWindow | null;
}

/** (사이트, 출처) 한 칸의 방문 행 수. 새 방문·재방문은 `first_visit_bucket` 기준(구간값 없는 행은 둘 다 제외). */
export interface EntrySourceSiteTally {
    readonly site: string | null;
    readonly entrySource: string | null;
    readonly count: number;
    readonly newVisitors: number;
    readonly returning: number;
}

/** (사이트, 방문 날 수 구간) 한 칸의 방문 행 수. 구간값이 있는 행만 센다. */
export interface VisitDaysTally {
    readonly site: string | null;
    readonly bucket: string;
    readonly count: number;
}

/**
 * 첫 방문 날짜 범위 하나에 대한 사이트별 재방문 집계. D1은 정확하고, D7·D30은 창 중앙값으로 코호트를
 * 옮겨 센 추정치다(오차 ±3일 경계).
 */
export interface ReturnWindowRow {
    readonly site: string | null;
    readonly newVisitors: number;
    readonly d1: number;
    readonly d7: number;
    readonly d30: number;
}
