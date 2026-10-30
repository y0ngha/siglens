/**
 * lightweight-charts `localization` 옵션 — 축 눈금·크로스헤어 시각을 페이지 로케일로 그린다.
 */
import type { Timeframe } from '@y0ngha/siglens-core';
import { INTL_LOCALE, type Locale } from '@/shared/i18n/locales';
import { getTimeFormatter } from '@/shared/lib/timeFormat';

/** 차트 `localization`에 넣는 부분 — 봉 시각은 UTC 초(number)라 포매터도 number를 받는다. */
export interface ChartLocalization {
    locale: string;
    timeFormatter?: (timestamp: number) => string;
}

/**
 * 페이지 로케일의 차트 `localization`. `locale`을 안 주면 lightweight-charts가 축 눈금을
 * `navigator.language`로 그려 `/en/AAPL`인데 브라우저가 ko-KR이면 x축이 `4월 5월`로 나온다.
 * 타임프레임을 알면(종목 차트) 크로스헤어 시각 표기도 그 단위에 맞춘다.
 */
export function chartLocalization(
    locale: Locale,
    timeframe?: Timeframe
): ChartLocalization {
    return {
        locale: INTL_LOCALE[locale],
        ...(timeframe !== undefined && {
            timeFormatter: getTimeFormatter(timeframe, locale),
        }),
    };
}
