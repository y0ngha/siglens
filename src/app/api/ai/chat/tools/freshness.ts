import { MS_PER_MINUTE } from '@/shared/config/time';

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
