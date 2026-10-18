import { roundToKrxTick, type KrxTickTable } from '@y0ngha/siglens-core';
import { INTL_LOCALE, type Locale } from '@/shared/i18n/locales';
import { cachedNumberFormat } from '@/shared/lib/intlFormatCache';
import { currencyFractionDigits } from '@/shared/lib/priceFormat';
import { currencyForSymbol } from '@/shared/config/marketProfile/registry';

// `priceFormat.ts`와 나눈 이유: 그 파일은 루트 레이아웃 번들(헤더 관심종목 시세)에
// 들어가서 core를 import할 수 없다(`rootLayoutCoreFree`·`aiChatCoreFree` 가드).
// 호가 단위 반올림은 core 규칙이라, 분석 카드처럼 core를 이미 쓰는 곳만 이 파일을 쓴다.

/**
 * 분석 결과의 가격(키레벨·목표가·진입/손절·추세선 끝값 등)을 그 시장이 실제로
 * 호가하는 값으로 맞춘다. 한국 상장 종목(KRW)은 KRX 호가가격단위로 반올림한다 —
 * core가 프롬프트와 캐시 결과에 쓰는 규칙(`roundToKrxTick`)과 같은 것이라, core가
 * 반올림하기 전에 캐시된 분석이나 core가 일부러 반올림하지 않는 작도 좌표(추세선
 * 끝값 `271,192.31`)도 화면에서는 호가 단위(`271,000`)로 보인다. 다른 시장은
 * 값을 바꾸지 않는다.
 *
 * `krxTickTable`은 종목이 주식('share')인지 ETF/ETN('etp')인지에 따른 호가표다. ETF는
 * 2,000원 미만 1원·이상 5원 단위라, 주식 표로 깎으면 올바른 값(`40,125`)이 `40,150`으로
 * 망가진다. 분석을 만든 쪽(`resolveKrxTickTable`)과 같은 표여야 하며, 기본값은 'share'.
 */
export function quotedPriceForSymbol(
    price: number,
    symbol: string,
    krxTickTable: KrxTickTable = 'share'
): number {
    return currencyForSymbol(symbol) === 'KRW'
        ? roundToKrxTick(price, krxTickTable)
        : price;
}

interface AnalysisPriceFormatOptions {
    /** 끝자리 0을 줄인다(`12.30` → `12.3`). 한국 종목은 원래 정수라 영향이 없다. */
    trimTrailingZeros?: boolean;
    /** KRX 호가표(주식/ETF). 한국 종목에만 의미가 있다. 기본 'share'. */
    krxTickTable?: KrxTickTable;
}

/**
 * 분석 카드의 가격 표기(통화 기호 없음). 한국 종목은 호가 단위로 반올림한 정수
 * (`205,325` → `205,500`), 그 밖은 소수 둘째 자리(`12.30`)다. 예전에는 시장과
 * 관계없이 둘째 자리를 고정해 `240,300.00`이 찍혔다.
 *
 * 로케일은 페이지 로케일로 고정한다 — 실행 환경 기본 로케일을 타면 서버와 브라우저의
 * 구분자가 달라 하이드레이션 불일치(React #418)가 난다.
 */
export function formatAnalysisPrice(
    price: number,
    symbol: string,
    locale: Locale,
    {
        trimTrailingZeros = false,
        krxTickTable = 'share',
    }: AnalysisPriceFormatOptions = {}
): string {
    const digits = currencyFractionDigits(currencyForSymbol(symbol));
    return cachedNumberFormat(INTL_LOCALE[locale], {
        minimumFractionDigits: trimTrailingZeros ? 0 : digits,
        maximumFractionDigits: digits,
    }).format(quotedPriceForSymbol(price, symbol, krxTickTable));
}
