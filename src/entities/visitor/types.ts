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
 * - `other`: 위에 없는 외부 출처
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
    'other',
] as const;

export type EntrySource = (typeof ENTRY_SOURCES)[number];

/** 한 진입 출처가 남긴 방문 행 수. */
export interface EntrySourceTally {
    readonly entrySource: string | null;
    readonly count: number;
}
