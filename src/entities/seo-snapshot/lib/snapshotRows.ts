import { SNAPSHOT_MAX_AGE_MS, type SeoAnalysisSnapshot } from '../model';

/**
 * `nowMs` 기준 `SNAPSHOT_MAX_AGE_MS` 이내에 생성된 행만 남긴다.
 *
 * 프리웜 cron이 멈춰도 오래된 행이 "전일 장마감 기준" 캡션과 함께 계속 서빙되지
 * 않게 하는 읽기 경로의 상한이다. 걸러진 행 수는 호출부가 `rows.length - 결과.length`로 구한다.
 */
export function filterWithinMaxAge(
    rows: readonly SeoAnalysisSnapshot[],
    nowMs: number
): SeoAnalysisSnapshot[] {
    const cutoff = nowMs - SNAPSHOT_MAX_AGE_MS;
    return rows.filter(row => row.generatedAt.getTime() >= cutoff);
}

interface RehydratedSnapshots {
    /** `Date` 필드가 되살아났고 `generatedAt`이 유효한 행. */
    readonly snapshots: SeoAnalysisSnapshot[];
    /** `generatedAt`이 Invalid Date라 버려진 행 수 — 호출부가 캐시 손상 경고를 남기는 근거. */
    readonly invalidCount: number;
}

/**
 * `unstable_cache` 왕복을 거친 행의 `Date` 필드를 되살리고, 되살려도 유효하지 않은 행을 버린다.
 *
 * `unstable_cache`는 결과를 JSON으로 직렬화해(`JSON.stringify` → 히트 시 `JSON.parse`),
 * 타입은 `Date`인 채로 값만 ISO 문자열로 돌아온다. 캐시 미스 렌더에서는 진짜 `Date`라
 * 드러나지 않다가, 히트 렌더에서 `Intl.DateTimeFormat.format()`이
 * `RangeError: Invalid time value`를 던진다 — 그것도 fetcher 밖의 React 렌더 안이라
 * try/catch로 잡히지 않는다. 미스 경로에서는 `new Date(date)`가 사실상 무연산이라 두 경로가
 * 같은 형태로 수렴한다.
 *
 * `firstGeneratedAt`은 **`== null`로 비교해야 한다**(`=== null` 아님). 이 컬럼이 생기기 전
 * 코드가 채운 캐시 항목에는 필드 자체가 없어 히트 시 `undefined`로 돌아온다. 엄격 비교면
 * `new Date(undefined)`(Invalid Date)가 되고, 그건 `null`이 아니라서 소비처의 `?? null`도
 * 통과해 `toISOString()`에서 렌더가 죽는다 — 배포 직후 캐시 TTL 동안만 나타나는 형태다.
 */
export function rehydrateSnapshots(
    rows: readonly SeoAnalysisSnapshot[]
): RehydratedSnapshots {
    const rehydrated = rows.map(row => ({
        ...row,
        generatedAt: new Date(row.generatedAt),
        updatedAt: new Date(row.updatedAt),
        firstGeneratedAt:
            row.firstGeneratedAt == null
                ? null
                : new Date(row.firstGeneratedAt),
    }));
    // 손상된 캐시 값(깨진 JSONB, 수동 DB 편집)이 렌더 경계까지 가지 않게 여기서 드롭한다.
    const snapshots = rehydrated.filter(
        row => !Number.isNaN(row.generatedAt.getTime())
    );
    return { snapshots, invalidCount: rehydrated.length - snapshots.length };
}
