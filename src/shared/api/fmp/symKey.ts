/**
 * 심볼을 대문자로 정규화한다.
 *
 * 캐시 키 정규화 — 대소문자 차이로 인해 Redis 엔트리가 중복 생성되는 것을 방지한다.
 */
export const sym = (s: string): string => s.toUpperCase();
