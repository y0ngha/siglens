import { formatCompactAmount } from '@/shared/lib/priceFormat';
import type { Locale } from '@/shared/i18n/locales';
import {
    currencyForSymbol,
    type PriceFormatConfig,
} from '@/shared/config/marketProfile';

/** 재무 금액에 쓰이는 통화. `MarketProfileDescriptor.priceFormat.currency`와 같은 집합. */
export type StatementCurrency = PriceFormatConfig['currency'];

/** 기본 통화 — 기존 호출부(미국 종목)의 동작을 보존한다. */
export const DEFAULT_STATEMENT_CURRENCY: StatementCurrency = 'USD';

/** compact 통화 표기로 포맷한다. */
export function formatCurrencyCompact(
    value: number,
    currency: StatementCurrency = DEFAULT_STATEMENT_CURRENCY,
    // 기본값을 두지 않는다 — 빠지면 그 카드만 조용히 한국어 단위로 돌아간다.
    locale: Locale
): string {
    return formatCompactAmount(value, currency, locale);
}

/**
 * 심볼의 재무제표 표기 통화. 한국 상장 종목(`005930.KS`)은 KRW, 그 외는 USD.
 *
 * `currencyForSymbol`(`shared/config/marketProfile/registry.ts`)에 위임한다 —
 * `isKrEquitySymbol(symbol) ? 'KRW' : DEFAULT_STATEMENT_CURRENCY` 삼항식은
 * `currencyForSymbol`이 이미 통합한 것과 같은 판정을 이 파일에서 네 번째로
 * 독립 복제하는 것이었다. 반환 타입(`StatementCurrency`)이 이미
 * `PriceFormatConfig['currency']`와 동일해 동작은 그대로다.
 *
 * 심볼 형상만으로 결정되므로 조회도 async도 필요 없다 — 클라이언트 컴포넌트에서
 * 그대로 쓸 수 있다. 크립토는 재무제표 탭 자체가 없어 고려 대상이 아니다.
 */
export function statementCurrencyOf(symbol: string): StatementCurrency {
    return currencyForSymbol(symbol);
}
