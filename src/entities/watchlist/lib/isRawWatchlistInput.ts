import type { RawWatchlistInput } from '../model';

/**
 * 순수: 서버 액션 인자는 런타임에 공격자가 정하므로 `.trim()` 전에 `{ symbol, label }`
 * 문자열 쌍인지 좁힌다.
 */
export function isRawWatchlistInput(
    input: unknown
): input is RawWatchlistInput {
    if (typeof input !== 'object' || input === null) return false;
    return (
        'symbol' in input &&
        typeof input.symbol === 'string' &&
        'label' in input &&
        typeof input.label === 'string'
    );
}
