import { EMPTY_INDICATOR_RESULT, type BarsData } from '@y0ngha/siglens-core';

/**
 * 마지막 non-null 원소부터 끝까지를 남긴 배열(없으면 빈 배열). `toSeedBarsData`가 rsi·macd를 접는 데 쓴다.
 *
 * `buildTechnicalFacts`가 rsi·macd에서 뽑는 값은 `lastNonNull(...)` **스칼라 하나씩**이다
 * (`findLast(v => v !== null)`). 501개를 실어 1개를 쓰는 구조라, 마지막 non-null부터만 남겨도
 * `lastNonNull` 결과가 **동일**하다.
 *
 * `arr`가 `undefined`인 경우까지 받는다. 타입상 `IndicatorResult`의 키는 모두 배열이지만, 실제로는
 * provider·테스트 픽스처가 일부 키를 누락한 객체를 흘려보낸다. `undefined`를 seed에 실으면 그걸 읽는
 * 소비자(`lastNonNull`, `.map`)가 터지므로 `[]`로 정규화한다(`EMPTY_INDICATOR_RESULT`의 기본값과 같은 모양).
 *
 * `[arr[k]]`가 아니라 `slice(k)`인 이유: 소비 측(`seriesDataUtils`의 tail 정렬)은 배열의 **마지막 원소가
 * 마지막 봉**이라고 본다. macd처럼 후행 null이 있는 지표는 `[arr[k]]`가 그 값을 마지막 봉 자리에
 * 잘못 찍는다. `slice(k)`는 뒤따르는 null까지 함께 남겨 위치를 보존한다.
 */
export function keepLastNonNull<T>(
    arr: readonly T[] | undefined,
    isPresent: (value: T) => boolean
): T[] {
    if (arr === undefined) return [];
    const k = arr.findLastIndex(isPresent);
    return k === -1 ? [] : arr.slice(k);
}

/**
 * RSC seed 전용 축소판: 첫 페인트가 실제로 읽는 지표만 남기고 나머지를 `EMPTY_INDICATOR_RESULT`의
 * 빈 값으로 대체한다. 서버 페이지가 `setQueryData`로 싣는 값이다.
 *
 * ## 왜 — 직렬화되는 지표의 대부분을 아무도 읽지 않는다
 *
 * `/[symbol]` RSC 페이로드 651KB 중 약 507KB가 `IndicatorResult`다(501봉 × 지표 30여 종).
 * 그런데 차트 오버레이/보조지표 창은 **전부 기본 OFF**이고(`useIndicatorVisibility`의 초기값이 34개 키
 * 모두 false, MA/EMA 기본 period는 빈 배열), 각 훅은 `isVisible`이 false면 데이터를 건드리기 전에
 * 빠져나간다. 즉 콜드 방문자에게 직렬화된 지표의 대부분은 어떤 코드 경로도 읽지 않는다.
 *
 * 첫 페인트에 실제로 필요한 것은 셋뿐이고, 그중 둘은 **배열 전체도 필요 없다**:
 * - `rsi`·`macd` — `buildTechnicalFacts`가 스칼라 한 개씩으로 접는다(FactLayer). 그래서 마지막 non-null
 *   항목부터만 담는다(`keepLastNonNull`). 2026-08 실측 기준 종목 라우트마다 macd 27KB + rsi 3.8KB를
 *   덜 싣는다(gzip −13~17%).
 * - `buySellVolume` — 거래량 차트가 전 구간을 쓴다. 접지 않는다. (공포·탐욕 지수는 이 seed가 아니라
 *   원본 `getQuantizedBarsStatic`의 5년 일봉으로 계산한다.)
 *
 * ## 왜 안전한가
 *
 * 1. `EMPTY_INDICATOR_RESULT`는 모든 키가 올바른 타입의 빈 값으로 채워진 완전한 `IndicatorResult`다.
 *    빠진 키를 읽어 터지는 소비자가 없다.
 * 2. 클라이언트는 **마운트 직후 전체를 다시 받는다**(`useBars`). seed의 `dataUpdatedAt`은 마지막 봉
 *    시각(수 시간~수 일 전)으로 고정되는데 `BARS_STALE_TIME_MS`는 30초라, 이 축소된 지표는 항상 stale로
 *    판정돼 곧바로 원본으로 교체된다. 사용자가 그 사이에 오버레이를 켜면 한 프레임 빈 시리즈를 볼 수
 *    있으나, 오버레이는 기본 OFF라 켜는 행위 자체가 재요청 이후다.
 * 3. `buildTechnicalFacts`가 읽는 값(`lastNonNull`)이 보존되므로 SSR HTML 텍스트는 **바이트 동일**이다 —
 *    SEO·hydration mismatch 영향 없음. `seedBars.test.ts`가 실제 `buildTechnicalFacts` 호출로 단언한다.
 * 4. 저장된 설정으로 RSI·MACD 창을 켜둔 재방문자는 재요청 전까지 짧은 시리즈를 볼 수 있으나, 나머지
 *    38개 지표가 이미 **빈 배열**로 seed되던 것과 같은 범주이며 그보다 낫다.
 *
 * ⚠️ 서버에서 지표를 직접 읽는 소비자(`buildTechnicalFacts` 등)는 축소 전 원본을 써야 한다.
 * ⚠️ `getBarsAction`(클라이언트 재요청 경로)은 **절대 축소하지 않는다**. 축소한 seed의 정확성을 그
 * 재요청이 떠받치고 있다.
 * ⚠️ MA/EMA는 `indicators.ma[period]`처럼 **동적 키 접근**이다. 지금은 기본 period가 빈 배열이라
 * 안전하지만, 누군가 `defaultPeriods`에 값을 주면 first-paint 소비자가 되므로 이 화이트리스트도 함께
 * 넓혀야 한다.
 */
export function toSeedBarsData(data: BarsData): BarsData {
    return {
        bars: data.bars,
        indicators: {
            ...EMPTY_INDICATOR_RESULT,
            rsi: keepLastNonNull(data.indicators.rsi, v => v !== null),
            // `lastNonNull(macd.map(m => m.histogram))` 형태라 **histogram이 non-null인** 마지막
            // 항목부터 남겨야 값이 보존된다.
            macd: keepLastNonNull(
                data.indicators.macd,
                m => m.histogram !== null
            ),
            // 접지 않지만 `undefined` 정규화는 rsi·macd와 같다. 그대로 흘리면 `EMPTY_INDICATOR_RESULT`의
            // `[]`를 `undefined`로 덮어써, 옵셔널 체이닝 없이 `.length`를 읽는 소비자
            // (`widgets/chart/hooks/useVolumeChartData.ts`)가 재요청이 치유하기 전에 터진다.
            buySellVolume: data.indicators.buySellVolume ?? [],
        },
    };
}
