/**
 * 관심종목 저장 상한. tier 정책이 아니라 **저장 용량 제한**이라 core의 TIER_CONFIG가
 * 아니라 siglens 상수다(설계 §2).
 */
/** 회원 계정에 담을 수 있는 수. 병합 시 초과분은 최근 담은 순으로 남기고 버린다(§5). */
export const WATCHLIST_MAX_MEMBER = 50;
/** 비회원 localStorage에 담을 수 있는 수. */
export const WATCHLIST_MAX_LOCAL = 20;
/** 홈 온보딩 블록이 한 줄 요약으로 접히는 담은 개수 하한(§6.2 접힘 규칙). */
export const WATCHLIST_ONBOARDING_COLLAPSE_COUNT = 3;
/** 클라이언트가 넘긴 표시명(`company_name`)의 최대 글자 수. 서버가 해석한 이름에는 적용하지 않는다. */
export const WATCHLIST_LABEL_MAX_LENGTH = 100;
