import { type PriceFormatConfig } from '@/shared/config/marketProfile/types';

/** 재무 금액에 쓰이는 통화. `MarketProfileDescriptor.priceFormat.currency`와 같은 집합. */
export type StatementCurrency = PriceFormatConfig['currency'];

/** 기본 통화 — 기존 호출부(미국 종목)의 동작을 보존한다. */
export const DEFAULT_STATEMENT_CURRENCY: StatementCurrency = 'USD';
