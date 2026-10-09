import { WATCHLIST_LABEL_MAX_LENGTH } from '@/shared/config/watchlist';

/**
 * 순수: 클라이언트가 넘긴 표시명을 저장용으로 정리한다. 공백을 지우고 코드포인트 단위로
 * `WATCHLIST_LABEL_MAX_LENGTH`까지 자른다(다바이트 문자를 쪼개지 않는다). 비었거나 심볼과
 * 같으면 이름을 모르는 것이므로 null — "심볼로 표시" 규칙을 탄다.
 */
export function normalizeWatchlistLabel(
    label: string,
    symbol: string
): string | null {
    const trimmed = label.trim();
    if (trimmed.length === 0 || trimmed.toUpperCase() === symbol) return null;
    return Array.from(trimmed).slice(0, WATCHLIST_LABEL_MAX_LENGTH).join('');
}
