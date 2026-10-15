import type { PreviousSettlementChange } from '../model';
import { compareIsoDate } from './investorFlowsDates';

/** `ShortInterestPoint`의 구조적 부분집합 — core 타입을 import하지 않고도 쓸 수 있게 필요한 필드만 적는다. */
interface SettlementPoint {
    readonly settlementDate: string;
    readonly shortQty: number;
}

/**
 * 최신 결제일 공매도 잔고를 **바로 앞 결제일**과 비교한다(주식 수·%). 결제일 오름차순으로 정렬해 쓰므로 입력
 * 순서와 무관하다. 결제일이 둘 미만이면 `null`.
 *
 * 화면(직전 결제일 대비 증감 배지)과 에이전트 도구 요약이 **같은 함수**를 불러 숫자가 갈라지지 않게 한다.
 * core `short.metrics.shortInterestChangePct`는 최근 여러 결제일에 걸친 추이라 이 값과 정의가 다르다.
 */
export function computePreviousSettlementChange(
    points: readonly SettlementPoint[]
): PreviousSettlementChange | null {
    const sorted = points.toSorted((a, b) =>
        compareIsoDate(a.settlementDate, b.settlementDate)
    );
    const latest = sorted.at(-1);
    const previous = sorted.at(-2);
    if (latest === undefined || previous === undefined) return null;
    return {
        previousDate: previous.settlementDate,
        sharesChange: latest.shortQty - previous.shortQty,
        pct:
            previous.shortQty === 0
                ? null
                : ((latest.shortQty - previous.shortQty) / previous.shortQty) *
                  100,
    };
}
