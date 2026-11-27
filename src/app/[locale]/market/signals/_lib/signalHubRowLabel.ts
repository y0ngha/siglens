import type { SignalEpisodeRow } from '@/entities/signal-history/types';
import { DEFAULT_LOCALE, type Locale } from '@/shared/i18n/locales';
import { displayTicker } from '@/shared/lib/displayTicker';

/**
 * 종목 한 줄의 이름 — 화면 링크와 구조화데이터(ItemList `name`)가 같은 값을 쓴다. 한글 이름은 ko에서만
 * 쓴다(다른 로케일에 한글을 섞지 않는다 — 홈·가이드 목록과 같은 규칙). 없으면 거래소 접미사를 뗀 티커.
 */
export function signalHubRowLabel(
    row: SignalEpisodeRow,
    locale: Locale
): string {
    return row.koreanName !== null && locale === DEFAULT_LOCALE
        ? row.koreanName
        : displayTicker(row.symbol);
}
