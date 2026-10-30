import { MIN_SUGGESTIONS } from './constants';

/** {@link readCachedSuggestions} 결과 — 적중 / 음성 마커 / 미적중(재생성 필요). */
export type CachedSuggestions =
    | { readonly kind: 'hit'; readonly items: string[] }
    | { readonly kind: 'negative' }
    | { readonly kind: 'miss' };

function isStringArray(value: unknown): value is string[] {
    return Array.isArray(value) && value.every(v => typeof v === 'string');
}

/**
 * Redis에서 읽은 값을 해석한다. `[]`는 최근 생성 실패를 뜻하는 음성 마커이고,
 * 문자열 배열이 아니거나 `MIN_SUGGESTIONS`보다 짧으면 미적중으로 보고 재생성한다.
 */
export function readCachedSuggestions(cached: unknown): CachedSuggestions {
    if (!isStringArray(cached)) return { kind: 'miss' };
    if (cached.length === 0) return { kind: 'negative' };
    if (cached.length >= MIN_SUGGESTIONS) return { kind: 'hit', items: cached };
    return { kind: 'miss' };
}
