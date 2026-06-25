/**
 * 심볼을 대문자로 정규화한다.
 *
 * 캐시 키에서 대소문자 차이로 엔트리가 분리되는 것을 막기 위해
 * CachedFundamentalProvider, CachedFinancialStatementsProvider,
 * CachedCongressTradesProvider 세 곳이 동일하게 사용한다.
 */
export const sym = (s: string): string => s.toUpperCase();
