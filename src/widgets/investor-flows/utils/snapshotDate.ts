/**
 * 스냅샷 조립 시각(UTC ISO)을 시장 현지 달력 날짜(`YYYY-MM-DD`)로 바꾼다.
 */
import type { MarketProfileId } from '@/shared/config/marketProfile/types';
import { ISO_DATE_LENGTH } from '@/shared/config/time';
import { cachedDateTimeFormat } from '@/shared/lib/intlFormatCache';
import { SNAPSHOT_TIME_ZONE_BY_PROFILE } from '@/shared/lib/formatSnapshotAsOf';

/** 시각이 없는 `YYYY-MM-DD` — 이미 달력 날짜라 시간대로 옮기지 않는다. */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** 날짜 부품을 로케일과 무관하게 읽기 위한 고정 로케일 — 값은 숫자 두 자리·네 자리뿐이라 표기가 흔들리지 않는다. */
const PARTS_LOCALE = 'en-US';

/**
 * 스냅샷 기준일을 **그 시장의 현지 날짜**로 낸다(미국 America/New_York, 한국 Asia/Seoul). UTC 날짜를 그대로 자르면 미국 저녁
 * 스냅샷(UTC로는 다음 날)이 실제 세션보다 하루 앞선 날짜로 보인다. 시간대 표는 스냅샷 기준일 캡션과 같은 것을 쓴다.
 * 시각이 없는 날짜 문자열은 그대로 돌려주고, 해석할 수 없는 값은 앞 10자로 물러선다 — 렌더 중 throw하지 않는다.
 */
export function formatSnapshotDate(
    snapshotAsOf: string,
    marketProfile: MarketProfileId
): string {
    if (DATE_ONLY.test(snapshotAsOf)) return snapshotAsOf;
    const instant = new Date(snapshotAsOf);
    if (Number.isNaN(instant.getTime())) {
        return snapshotAsOf.slice(0, ISO_DATE_LENGTH);
    }
    const parts = Object.fromEntries(
        cachedDateTimeFormat(PARTS_LOCALE, {
            timeZone: SNAPSHOT_TIME_ZONE_BY_PROFILE[marketProfile],
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        })
            .formatToParts(instant)
            .map(part => [part.type, part.value])
    );
    return `${parts.year}-${parts.month}-${parts.day}`;
}
