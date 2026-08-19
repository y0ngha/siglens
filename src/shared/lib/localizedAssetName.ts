import type { IndexTicker, SectorEtf, SectorStock } from '@y0ngha/siglens-core';
import { DEFAULT_LOCALE, type Locale } from '@/shared/i18n/locales';

/**
 * 자산 표시명을 로케일에 맞게 고른다.
 *
 * ## 왜 메시지 카탈로그가 아닌가
 *
 * 이 값들은 UI 카피가 아니라 **데이터**다. 섹터·지수는 core 타입이 영문명
 * (`sectorName`/`displayName`)과 한국어명(`koreanName`)을 **이미 둘 다** 들고
 * 있으므로, 번역할 것이 없고 고르기만 하면 된다. 카탈로그에 넣으면 같은 문자열을
 * 두 벌 관리하게 되고 데이터가 바뀔 때 한쪽만 갱신된다.
 *
 * ## 개별 종목에 영문명이 없는 이유
 *
 * `SectorStock`은 `koreanName`만 갖는다(core 타입). 비-ko 로케일에서는 **티커
 * 심볼**을 쓴다 — 금융 UI에서 티커는 보편적으로 읽히고, 한글 회사명을 그대로
 * 노출하는 것보다 낫다. 영문 회사명이 필요해지면 `assetTranslations`(DB)에서
 * 끌어오는 것이 맞고, 그건 core 타입 확장이 아니라 siglens 조회 경로다.
 */
export function localizedSectorName(sector: SectorEtf, locale: Locale): string {
    return locale === DEFAULT_LOCALE ? sector.koreanName : sector.sectorName;
}

export function localizedIndexName(index: IndexTicker, locale: Locale): string {
    return locale === DEFAULT_LOCALE ? index.koreanName : index.displayName;
}

export function localizedStockName(stock: SectorStock, locale: Locale): string {
    return locale === DEFAULT_LOCALE ? stock.koreanName : stock.symbol;
}
