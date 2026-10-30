import {
    KR_ECONOMY_INDICATORS,
    normalizeKrEventName,
} from '@/shared/config/economyIndicatorsKr';
import type { KrEconomyIndicatorMeta } from '@/shared/config/economyIndicatorsKr';
import { DEFAULT_LOCALE } from '@/shared/i18n/locales';
import { fmpCalendarDateTimeToKst } from '@/shared/lib/etTimeUtils';

import type { AnnouncedEventPoint } from '../model';

/**
 * 한국 거시 지표 카드 한 장 — `/economy/kr`의 카드 그리드와 에이전트 `get_economy` 도구가
 * 소비한다. 캘린더 발표 이력에서 파생되므로 값은 우리 DB 이력 기준이다.
 */
export interface KrIndicatorCard {
    meta: KrEconomyIndicatorMeta;
    /** 가장 최근 발표값. */
    latest: number;
    /**
     * 발표일 `YYYY-MM-DD` — **KST 달력일**.
     *
     * DB의 `date_et`는 FMP 원본 UTC 벽시계라 그대로 자르면 한국 늦은 밤 발표가
     * 다음 날로 밀린다(한국 CPI 00:00 KST = 전날 15:00 UTC 근처). 같은 행을 그리는
     * 아래 캘린더는 이미 `fmpCalendarDateTimeToKst`로 KST 키를 쓰므로, 카드만 UTC
     * 그대로 두면 **같은 발표가 카드와 캘린더에서 다른 날짜로** 보인다.
     */
    latestDate: string;
    /**
     * 직전 발표 대비 변화. 직전 발표가 없으면 `null` —
     * FMP `previous` 필드가 아니라 **우리가 가진 이력**에서 계산한다.
     * 두 값이 다를 때가 있는데(개정치 반영), 화면에 함께 그리는 추세와 어긋나지
     * 않으려면 같은 출처를 써야 한다.
     */
    changeFromPrevious: number | null;
}

/**
 * 발표 이력을 등록된 한국 지표(`KR_ECONOMY_INDICATORS`) 순서의 카드로 투영한다.
 * 이력이 없는 지표와 레지스트리에 없는 이벤트는 카드가 되지 않는다.
 *
 * @param rows - `dateEt` 오름차순 발표 이력(`listAnnouncedSince`의 정렬을 그대로 받는다).
 */
export function buildKrIndicatorCards(
    rows: readonly AnnouncedEventPoint[]
): KrIndicatorCard[] {
    // 이벤트명(기간 괄호 제거) → 발표 이력. 입력 순서(오래된 → 최신)가 버킷 안에서 유지된다.
    const byEvent = Map.groupBy(rows, row => normalizeKrEventName(row.event));

    return KR_ECONOMY_INDICATORS.flatMap(meta => {
        const history = byEvent.get(meta.event) ?? [];
        const latest = history.at(-1);
        if (latest === undefined) return [];
        const prior = history.at(-2);

        return [
            {
                meta,
                latest: latest.actual,
                // `kstDateKey`만 읽으므로 로케일과 무관하다. 그래도 명시한다 —
                // 기본값을 두면 호출부에서 빠져도 컴파일이 통과한다.
                latestDate: fmpCalendarDateTimeToKst(
                    latest.dateEt,
                    DEFAULT_LOCALE
                ).kstDateKey,
                changeFromPrevious:
                    prior === undefined ? null : latest.actual - prior.actual,
            },
        ];
    });
}
