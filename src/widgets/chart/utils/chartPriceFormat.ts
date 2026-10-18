import type { PriceFormatCustom } from 'lightweight-charts';
import { INTL_LOCALE, type Locale } from '@/shared/i18n/locales';
import { cachedNumberFormat } from '@/shared/lib/intlFormatCache';

/**
 * 가격 시리즈의 `priceFormat` — 가격축 눈금·현재가 라벨·십자선·가격선(진입·청산·손절) 숫자를
 * 페이지 로케일의 천 단위 구분자로 낸다(`215500` → `215,500`, `64192.50` → `64,192.50`).
 *
 * lightweight-charts의 기본 `type: 'price'`는 구분자를 넣지 않는다. 차트 전체의
 * `localization.priceFormatter`로 바꾸지 않는 이유: 같은 차트의 다른 패인(RSI·MACD 등)까지
 * 가격 자릿수로 찍혀 버린다. 가격 단위 시리즈에만 붙인다.
 *
 * 로케일을 페이지 로케일로 고정하는 이유는 분석 패널과 같다 — 실행 환경 기본 로케일을 타면
 * 서버·브라우저마다 구분자가 달라진다.
 */
export function chartPriceFormat(
    decimals: number,
    locale: Locale
): PriceFormatCustom {
    const format = cachedNumberFormat(INTL_LOCALE[locale], {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
    return {
        type: 'custom',
        minMove: 10 ** -decimals,
        formatter: price => format.format(price),
    };
}
