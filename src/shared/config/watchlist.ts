/**
 * 관심종목 저장 상한. tier 정책이 아니라 **저장 용량 제한**이라 core의 TIER_CONFIG가
 * 아니라 siglens 상수다(설계 §2).
 */
/** 회원 계정에 담을 수 있는 수. 병합 시 초과분은 최근 담은 순으로 남기고 버린다(§5). */
export const WATCHLIST_MAX_MEMBER = 50;
/** 비회원 localStorage에 담을 수 있는 수. */
export const WATCHLIST_MAX_LOCAL = 20;
/** 헤더 ★ 팝오버·시트가 보여 주는 최대 행 수. 나머지는 `/watchlist`에서 본다. */
export const WATCHLIST_PREVIEW_COUNT = 6;
/** 홈 "내 관심종목" 카드가 보여 주는 최대 수(PC 카드 5장 + 담기 카드 / 모바일 리스트). */
export const HOME_WATCHLIST_DESKTOP_COUNT = 5;
export const HOME_WATCHLIST_MOBILE_COUNT = 3;
/** 기기에 남기는 최근 본 종목 수. 회원도 서버에 올리지 않는다. */
export const RECENT_SYMBOLS_MAX = 20;
/** 클라이언트가 넘긴 표시명(`company_name`)의 최대 글자 수. 서버가 해석한 이름에는 적용하지 않는다. */
export const WATCHLIST_LABEL_MAX_LENGTH = 100;
/**
 * 홈 인기 종목 섹션(`TickerCategories`)의 앵커. 홈 빈 카드의 "인기 종목 보기"가 가리킨다.
 * 서버 컴포넌트(섹션)와 클라이언트 컴포넌트(카드)가 함께 읽으므로 config에 둔다 —
 * `'use client'` 모듈의 export를 서버에서 import하면 값이 아니라 클라이언트 참조가 온다.
 */
export const HOME_POPULAR_ANCHOR_ID = 'popular';
