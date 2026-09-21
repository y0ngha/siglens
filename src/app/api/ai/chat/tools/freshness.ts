import { MS_PER_DAY, MS_PER_MINUTE } from '@/shared/config/time';

/**
 * 챗 툴 결과에 붙는 신선도 봉투.
 *
 * ## 왜 필요한가
 *
 * 툴이 돌려주는 값이 "지금 값"인지 "언젠가의 값"인지는 payload만 봐서는 모른다.
 * 실제 사고(2026-09-21): FMP가 티커 개명 전 심볼(`SQ` → `XYZ`)에 **2025-02-13자**
 * 마지막 시세를 계속 돌려줬고, 우리 `getQuote`는 그 값을 그대로 통과시켜
 * "현재가 83.46달러, 전일 대비 +0.57%"로 제시됐다(실제 XYZ는 76.28달러).
 * 값 자체는 FMP가 준 그대로였으므로 어떤 오류 처리도 걸리지 않았다.
 *
 * 그래서 값이 아니라 **값의 나이**를 계약에 넣는다. 모델이 나이를 보고 "현재가"라고
 * 말할지 "마지막으로 확인된 값"이라고 말할지 고르게 하는 것이 목적이다 — 봉투가
 * 없으면 모델은 나이를 추측할 수 없고, 추측할 수 없으면 항상 현재로 읽는다.
 *
 * ## 판정은 툴이 아니라 여기서
 *
 * 임계값을 툴마다 흩어 놓으면 "이 툴은 몇 분까지 신선한가"가 코드 전체에 흩어져
 * 서로 어긋난다. 정책은 `FRESHNESS_MAX_AGE_MS` 한 곳에 모으고, 툴은 `asOf`만
 * 정직하게 싣는다.
 */
export interface FreshnessView {
    /** 데이터 기준 시각(ISO). */
    asOf: string;
    /** 기준 시각으로부터 경과한 분. 미래 시각이면 0으로 내린다. */
    ageMinutes: number;
    /** 이 툴의 허용 나이를 넘었는가. */
    stale: boolean;
    /** 판정에 쓰인 허용 나이(분). 모델이 "얼마나 오래됐는지"를 상대적으로 읽게 한다. */
    maxAgeMinutes: number;
}

export interface AssessFreshnessInput {
    /** 데이터 기준 시각(unix ms). */
    asOfMs: number;
    /** 이 데이터가 신선하다고 볼 수 있는 최대 나이(ms). */
    maxAgeMs: number;
    /** 주입 가능한 현재 시각. 테스트가 실시간에 의존하지 않도록 한다. */
    nowMs: number;
}

/**
 * 순수 함수 — 시각을 주입받아 신선도를 판정한다.
 *
 * 경과 시간을 음수로 두지 않는다. 프로바이더 시계가 앞서거나(FMP 타임스탬프가
 * 체결 시각이 아니라 배치 시각인 경우가 있다) 컨테이너 시계가 뒤처지면 음수가
 * 나오는데, 그대로 노출하면 모델이 "미래 데이터"라는 존재하지 않는 상태를
 * 서술하게 된다. 0으로 내리면 "방금"으로 읽혀 의미가 맞는다.
 */
export function assessFreshness({
    asOfMs,
    maxAgeMs,
    nowMs,
}: AssessFreshnessInput): FreshnessView {
    const ageMs = Math.max(0, nowMs - asOfMs);
    return {
        asOf: new Date(asOfMs).toISOString(),
        ageMinutes: Math.round(ageMs / MS_PER_MINUTE),
        stale: ageMs > maxAgeMs,
        maxAgeMinutes: Math.round(maxAgeMs / MS_PER_MINUTE),
    };
}

/**
 * 시세가 "마지막 값에 동결됐다"고 볼 나이.
 *
 * 두 경우를 가른다. **정상 휴장은 절대 걸리면 안 되고**(금요일 종가를 연휴 뒤에
 * 물어도 정상), 상장폐지·티커 개명으로 **갱신이 멈춘** 시세는 걸려야 한다.
 *
 * 실측 사례(2026-09-21): `SQ`는 2025-02-13에 `XYZ`로 개명됐는데 FMP `quote`가
 * 그 시점의 값(83.46달러)을 19개월째 그대로 돌려줬다. 우리는 그걸 통과시켜
 * "현재가 83.46달러, 전일 대비 +0.57%"로 제시했다 — 그날 실제 XYZ는 76.28달러로
 * 8.6% 차이였다.
 *
 * **14일인 이유는 KRX다.** 처음엔 7일로 잡았는데, 한국 연휴 클러스터가 그걸
 * 넘는다: 2025년 추석·개천절·한글날이 겹쳐 KRX가 10/3·6·7·8·9 휴장했고, 양쪽
 * 주말까지 더하면 마지막 체결(10/2 15:30 KST)과 다음 개장(10/10) 사이가 약
 * 7일 17시간이다. KR 시세도 `timestamp`를 싣는다(`YahooMarketProvider`의
 * `regularMarketTime`).
 *
 * 자산군별로 나누지 않는다. 크립토는 24시간 거래라 훨씬 짧게 잡을 수도 있지만,
 * 이 값의 목적은 "장이 쉬었다"가 아니라 "이 심볼은 더 이상 갱신되지 않는다"를
 * 잡는 것이고 그건 자산군과 무관하다.
 *
 * **시세를 싣는 모든 툴이 이 상수를 공유한다** — `get_quote`와
 * `get_my_portfolio`. 툴마다 따로 두면 한쪽만 조정돼 같은 심볼이 도구에 따라
 * 다르게 판정된다. 테스트는 이 상수를 직접 import해 양쪽 경계를 고정한다.
 */
export const QUOTE_MAX_AGE_MS = 14 * MS_PER_DAY;
