import {
    isKrEquitySymbol,
    type PriceFormatConfig,
} from '@/shared/config/marketProfile';

/** 재무 금액에 쓰이는 통화. `MarketProfileDescriptor.priceFormat.currency`와 같은 집합. */
export type StatementCurrency = PriceFormatConfig['currency'];

/**
 * 통화별 compact 금액 포맷터: `$1.2B`, `₩333조`.
 *
 * 모듈 레벨 싱글턴 — `Intl.NumberFormat` 생성은 로케일 데이터를 파싱하므로 호출마다
 * 만들면 안 된다. 통화 수가 고정(2개)이라 맵으로 미리 만들어 둔다.
 *
 * 로케일을 통화에 묶는 이유: `en-US`로 KRW를 포맷하면 `₩333T`(trillion)가 되어 한국
 * 사용자에게 읽히지 않는다. `ko-KR`은 같은 값을 `₩333조`로 낸다. compact 표기는
 * 로케일별 단위 체계를 따르므로 통화만 바꾸는 것으로는 부족하다.
 */
const FORMATTERS: Record<StatementCurrency, Intl.NumberFormat> = {
    USD: new Intl.NumberFormat('en-US', {
        notation: 'compact',
        maximumFractionDigits: 1,
        style: 'currency',
        currency: 'USD',
    }),
    KRW: new Intl.NumberFormat('ko-KR', {
        notation: 'compact',
        maximumFractionDigits: 1,
        style: 'currency',
        currency: 'KRW',
    }),
};

/** 기본 통화 — 기존 호출부(미국 종목)의 동작을 보존한다. */
export const DEFAULT_STATEMENT_CURRENCY: StatementCurrency = 'USD';

/** compact 통화 표기로 포맷한다. */
export function formatCurrencyCompact(
    value: number,
    currency: StatementCurrency = DEFAULT_STATEMENT_CURRENCY
): string {
    return FORMATTERS[currency].format(value);
}

/**
 * 심볼의 재무제표 표기 통화. 한국 상장 종목(`005930.KS`)은 KRW, 그 외는 USD.
 *
 * 심볼 형상만으로 결정되므로 조회도 async도 필요 없다 — 클라이언트 컴포넌트에서
 * 그대로 쓸 수 있다. 크립토는 재무제표 탭 자체가 없어 고려 대상이 아니다.
 */
export function statementCurrencyOf(symbol: string): StatementCurrency {
    return isKrEquitySymbol(symbol) ? 'KRW' : DEFAULT_STATEMENT_CURRENCY;
}
