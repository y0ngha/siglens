/**
 * 신호 카드가 종목 페이지로 걸 링크를 정하는 순수 헬퍼.
 */
import { isCuratedSymbol } from '@/entities/symbol-indexability/lib/isCuratedSymbol';

/**
 * 종목 페이지 경로. 큐레이션 밖 종목은 `null`이다 — 그 페이지는 noindex 롱테일이라
 * 링크는 크롤 예산만 쓴다.
 */
export function signalStockHref(symbol: string): string | null {
    return isCuratedSymbol(symbol) ? `/${symbol}` : null;
}
