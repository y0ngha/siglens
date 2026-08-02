import 'server-only';
import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';
import { getDatabaseClient } from '@/shared/db/client';
import { DrizzleSeoSnapshotRepository } from '@/entities/seo-snapshot/api';
import { SNAPSHOT_MAX_AGE_MS, type SeoAnalysisSnapshot } from '../model';

/**
 * ISR static-safe read of a symbol's SEO snapshots (spec 2026-07-24 §5 NB-2).
 * A bare DB read in a page's static path throws DYNAMIC_SERVER_USAGE and forces
 * the [symbol] route dynamic (app/CLAUDE.md axis 1) — so wrap it in
 * staticSymbolCache. Tagged `seo-snapshot:${SYMBOL}` so the pre-warm cron's
 * revalidateTag('seo-snapshot:{SYMBOL}','max') invalidates it on new snapshots.
 * revalidateSeconds should match the calling page's declared `revalidate` literal
 * (a shorter TTL would clamp the route's effective s-maxage). Read failures
 * degrade to [] (fail-open) so the section renders its placeholder, never a 500.
 *
 * FIX D (audit): rows older than {@link SNAPSHOT_MAX_AGE_MS} are dropped before
 * returning. Without this, a dead/stalled pre-warm cron would let this read
 * path serve arbitrarily old analysis prose forever under a "전일 장마감 기준"
 * (as-of-yesterday-close) caption — an accuracy/E-E-A-T liability on a finance
 * site, and the `hasSnapshot` indexability gate (consumed by callers) would
 * stay permanently indexable on a stale row. Filtering to `[]` degrades to the
 * existing placeholder path, which is already the safe fail-open behavior —
 * no new failure mode is introduced.
 */
export async function getSeoSnapshotsStatic(
    symbol: string,
    revalidateSeconds: number
): Promise<SeoAnalysisSnapshot[]> {
    const upper = symbol.toUpperCase();
    const rows = await staticSymbolCache(
        ['seo-snapshots', upper],
        upper,
        async () => {
            try {
                const { db } = getDatabaseClient();
                const rows = await new DrizzleSeoSnapshotRepository(
                    db
                ).findBySymbol(upper);
                const cutoff = Date.now() - SNAPSHOT_MAX_AGE_MS;
                const fresh = rows.filter(
                    row => row.generatedAt.getTime() >= cutoff
                );
                const droppedCount = rows.length - fresh.length;
                if (droppedCount > 0) {
                    // FIX D (audit): the operator's only signal that the cron
                    // has been dead long enough for §max-age to bite — absent
                    // this, prose would just silently stop appearing with no
                    // explanation in the logs.
                    console.warn(
                        `[getSeoSnapshotsStatic] ${upper}: dropped ${droppedCount} row(s) older than ${SNAPSHOT_MAX_AGE_MS}ms (cron likely stalled)`
                    );
                }
                // Observability (audit fix FIX 7): if every renderer
                // null-renders (malformed content, a core schema drift, a
                // tab-key mismatch), the system otherwise emits ZERO
                // output — indistinguishable from "working as intended,
                // just no snapshot yet". This runs once per symbol per
                // cache-fill (inside the unstable_cache fetcher, not per
                // request), so volume is bounded — greppable in CloudWatch
                // `/siglens/app` as ground truth that reads are happening.
                console.info(
                    `[getSeoSnapshotsStatic] ${upper}: ${fresh.length} snapshot row(s)`
                );
                return fresh;
            } catch (error) {
                console.error(
                    '[getSeoSnapshotsStatic] read failed, degrading:',
                    error
                );
                return [];
            }
        },
        [`seo-snapshot:${upper}`],
        revalidateSeconds
    );

    /*
     * `unstable_cache`는 결과를 JSON으로 직렬화한다(`JSON.stringify` → 히트 시
     * `JSON.parse`). `Date`는 이 왕복을 견디지 못해, 타입은 `Date`인 채로 값만
     * ISO 문자열로 돌아온다. 캐시 미스 렌더에서는 진짜 `Date`라 문제가 드러나지
     * 않다가, 히트 렌더에서 `Intl.DateTimeFormat.format()`이 `RangeError:
     * Invalid time value`를 던진다 — 그것도 fetcher 안이 아니라 React 렌더 안이라
     * 이 함수의 try/catch로는 잡히지 않는다.
     *
     * 경계가 여기 하나뿐이므로 여기서 되살린다. 미스 경로에서는 `new Date(date)`가
     * 사실상 무연산이라 두 경로가 같은 형태로 수렴한다.
     */
    const rehydrated = rows.map(row => ({
        ...row,
        generatedAt: new Date(row.generatedAt),
        updatedAt: new Date(row.updatedAt),
    }));

    /*
     * A1(감사): 캐시에 이미 저장된 malformed 값(예: 손상된 JSONB, 수동 DB
     * 편집)이 `new Date(...)`로도 유효한 날짜로 되살아나지 않으면(Invalid
     * Date), 그 행을 렌더로 넘기지 않고 여기서 드롭한다. `formatSnapshotAsOf`가
     * `null`을 반환해 SnapshotSummarySection이 안전하게 고정 캡션으로
     * degrade하긴 하지만, 애초에 malformed 캐시 값이 렌더 경계까지 도달하지
     * 않게 막는 편이 더 이르고 안전한 방어선이다. 위 max-age 필터와 동일하게
     * droppedCount를 warn 로그로 남긴다 — 운영자가 원인(캐시 손상)을 구분할 수
     * 있게 한다.
     */
    const valid = rehydrated.filter(
        row => !Number.isNaN(row.generatedAt.getTime())
    );
    const invalidCount = rehydrated.length - valid.length;
    if (invalidCount > 0) {
        console.warn(
            `[getSeoSnapshotsStatic] ${upper}: dropped ${invalidCount} row(s) with an invalid generatedAt (cache corruption?)`
        );
    }

    return valid;
}
