import { kstDateKey } from '@/shared/lib/etTimeUtils';
import { MS_PER_MINUTE } from '@/shared/config/time';
import { QUOTE_MAX_AGE_MS } from '@/shared/config/quoteFreshness';
import type { MarketProfileId } from '@/shared/config/marketProfile/types';

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
 * 한국 종목 리스팅이 **죽은 리스팅**이면 마지막 거래일(`YYYY-MM-DD`, KST)을, 아니면 `null`을 돌려준다.
 *
 * yahoo는 거래가 멈춘 리스팅을 지우지 않는다. 실측(2026-10-22): `253450.KS`는 2024-07-19에 멈춘
 * MUTUALFUND 리스팅인데 시세를 그대로 돌려줬고, 실제 종목은 `253450.KQ`다. 접미사를 잘못 고른
 * 호출이 2년 묵은 가격을 "오늘 시세"로 내보냈다(다시 보려면 yahoo `quote('253450.KS')`의 `regularMarketTime`). 미국 경로는 같은 나이의 시세에 `stale` 표시만
 * 붙이고 값을 살리지만(`assessFreshness`), 한국은 그런 값이 거의 항상 **다른 리스팅**이라 가격으로
 * 쓰지 않고 데이터 오류로 돌린다.
 *
 * 문턱은 {@link QUOTE_MAX_AGE_MS}(14일, 약 10거래일)를 공유한다 — KRX 연휴 클러스터(최대 약 8일)는
 * 걸리지 않는다. 한국 종목(`kr-equity`)에만 적용한다 — 기준 시각이 없으면 판정하지 않는다.
 */
export function staleKrListingDate(
    profile: MarketProfileId,
    asOfMs: number | undefined,
    nowMs: number
): string | null {
    if (profile !== 'kr-equity') return null;
    if (asOfMs === undefined || !Number.isFinite(asOfMs)) return null;
    // KST 달력 날짜로 낸다. yahoo 한국 일봉은 UTC 자정(= 09:00 KST)에 찍혀 UTC 날짜와 같지만, KST 자정
    // (= 전날 15:00 UTC)으로 찍힌 시각이 들어와도 하루 이른 날짜가 나가지 않게 한다.
    return nowMs - asOfMs > QUOTE_MAX_AGE_MS
        ? kstDateKey(new Date(asOfMs))
        : null;
}
