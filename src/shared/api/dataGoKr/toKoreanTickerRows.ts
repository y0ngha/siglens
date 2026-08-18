import type { KoreanTickerEntry } from '@/shared/lib/types';
import type { KrxListedItem } from './krxListedInfoClient';
import { CURATED_KOREAN_NAMES } from '@/shared/config/popular-tickers';

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

/**
 * KONEX는 위 `MARKET_SUFFIX`에서 이미 걸러지므로 이 레코드에는 KOSPI/KOSDAQ만 있으면
 * 된다. 키 집합을 `Exclude<..., 'KONEX'>`로 좁혀 두면 아래 `toKoreanTickerRows`의
 * 인덱싱 지점에서 "KONEX일 수도 있다"는 불가능한 케이스가 컴파일 타임에 배제된다 —
 * `?? item.market` 같은 죽은 폴백을 캐스팅 없이 지울 수 있다.
 */
const EXCHANGE_FULL_NAME: Record<
    Exclude<KrxListedItem['market'], 'KONEX'>,
    string
> = {
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
 *
 * `koreanName`은 KRX 등록명(`itmsNm`)보다 `CURATED_KOREAN_NAMES`를 우선한다. KRX
 * 등록명은 한글이 아닐 수 있다 — 035420(네이버)의 등록명은 로마자 `NAVER`다. 이 필드가
 * 한 번 채워지면 `getAssetInfo`의 `koreanNames[symbol] ?? CURATED_KOREAN_NAMES.get(...)`
 * 폴백이 다시는 큐레이션을 참조하지 않으므로(`??`는 truthy 문자열에서 멈춘다), 큐레이션을
 * 이기는 건 그 이후로는 이 소스뿐이다 — 여기서 지지 않게 순서를 바꾼다.
 */
export function toKoreanTickerRows(
    items: readonly KrxListedItem[]
): KoreanTickerEntry[] {
    const bySymbol = new Map<string, KoreanTickerEntry>();

    for (const item of items) {
        // `suffix === null` 대신 `item.market`을 직접 검사한다 — 그래야 컴파일러가
        // 아래 블록 전체에서 `item.market`을 KOSPI/KOSDAQ로 좁혀, `EXCHANGE_FULL_NAME`
        // 인덱싱이 캐스팅 없이 안전해진다(둘은 `MARKET_SUFFIX`의 정의상 동치다).
        if (item.market === 'KONEX') continue;

        const suffix = MARKET_SUFFIX[item.market];
        const symbol = `${item.shortCode}${suffix}`;
        const koreanName = CURATED_KOREAN_NAMES.get(symbol) ?? item.koreanName;
        bySymbol.set(symbol, {
            symbol,
            koreanName,
            name: item.koreanName,
            exchange: item.market,
            exchangeFullName: EXCHANGE_FULL_NAME[item.market],
        });
    }

    return [...bySymbol.values()];
}
