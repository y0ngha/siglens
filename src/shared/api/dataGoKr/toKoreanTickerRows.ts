import type { KoreanTickerEntry } from '@/shared/lib/types';
import type { KrxListedItem } from './krxListedInfoClient';

/**
 * 시장 구분 → canonical 심볼 접미사.
 *
 * KONEX가 `null`인 것은 의도적이다 — yahoo에 KONEX 시세가 없음을 실측으로 확인했다
 * (2026-08-16: `.KN` 심볼 검색 0건). 시드에 넣으면 검색 결과에는 뜨는데 클릭하면
 * 404가 나는 죽은 링크가 된다.
 */
const MARKET_SUFFIX: Record<KrxListedItem['market'], string | null> = {
    KOSPI: '.KS',
    KOSDAQ: '.KQ',
    KONEX: null,
};

const EXCHANGE_FULL_NAME: Record<string, string> = {
    KOSPI: 'Korea Exchange (KOSPI)',
    KOSDAQ: 'KOSDAQ',
};

/**
 * 공공데이터포털 응답을 `korean_tickers` 행으로 변환한다. KONEX와 중복 단축코드는
 * 여기서 떨어진다 — `ON CONFLICT DO UPDATE`는 한 문장에서 같은 행을 두 번 건드릴 수 없다.
 *
 * `server-only`를 선언하지 않는다: 시드 스크립트(`tsx`, Next 밖)와 크론 라우트(Next 안)가
 * **같은 매핑을 공유해야** 하고, 스크립트 쪽은 그 가상 패키지를 해석하지 못한다.
 *
 * `name`(영문명)에 한글명을 넣는 이유: 이 소스는 영문명을 주지 않는다. `name`은 NOT NULL
 * 이고 표시명 폴백일 뿐이며, 실제 영문명은 종목 방문 시 `getAssetInfo`가 yahoo quote에서
 * 채운다(그래서 upsert는 `name`을 덮어쓰지 않는다).
 */
export function toKoreanTickerRows(
    items: readonly KrxListedItem[]
): KoreanTickerEntry[] {
    const bySymbol = new Map<string, KoreanTickerEntry>();

    for (const item of items) {
        const suffix = MARKET_SUFFIX[item.market];
        if (suffix === null) continue;

        const symbol = `${item.shortCode}${suffix}`;
        bySymbol.set(symbol, {
            symbol,
            koreanName: item.koreanName,
            name: item.koreanName,
            exchange: item.market,
            exchangeFullName: EXCHANGE_FULL_NAME[item.market] ?? item.market,
        });
    }

    return [...bySymbol.values()];
}
