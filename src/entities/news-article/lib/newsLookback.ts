import { MS_PER_DAY } from '@/shared/config/time';

/** 뉴스 목록 화면 표시와 카드별 보강이 쓰는 조회 창(6개월). */
export const NEWS_LOOKBACK_MS = 180 * MS_PER_DAY;

/**
 * AI 집계 뉴스 분석이 쓰는 조회 창(약 1개월). `NEWS_LOOKBACK_MS`보다 좁게 잡아 LLM이 오래된
 * 맥락으로 신호를 희석하지 않고 최근 동인에 집중하게 한다.
 */
export const NEWS_ANALYSIS_LOOKBACK_MS = 30 * MS_PER_DAY;
