import 'server-only';
import { cache } from 'react';
import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';
import { getDatabaseClient } from '@/shared/db/client';
import { DrizzleSeoSnapshotRepository } from '@/entities/seo-snapshot/api';
import { SNAPSHOT_MAX_AGE_MS, type SeoAnalysisSnapshot } from '../model';
import { contentLocaleKeyPart } from '@/shared/cache/contentLocaleKeyPart';
import type { Locale } from '@/shared/i18n/locales';
import { shortenRevalidateForRuntimeDegrade } from '@/shared/cache/buildDegradedRevalidate';
import { isDynamicServerError } from '@/shared/lib/isDynamicServerError';
import { isCuratedSymbol } from '@/entities/symbol-indexability/lib/isCuratedSymbol';

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
 *
 * ## 읽기 실패 = `null`("모름")이다 — `[]`("행 없음")와 다르다 (2026-10-05 감사)
 *
 * 예전에는 fetcher 안쪽 `catch`가 실패를 `[]`로 삼켰고, 그 `[]`가 `revalidateSeconds`
 * (6~24h) 동안 **캐시에 저장됐다.** DB가 몇 초 흔들린 순간의 렌더가 "스냅샷 없음"으로
 * 굳어, 산문이 멀쩡한 큐레이션 종목이 반나절 넘게 noindex(또는 산문 없는 껍데기)로
 * 서빙됐다. 이제 실패는 fetcher 안에서 **throw**한다 — `unstable_cache`는 throw하면 저장을
 * 건너뛰고(stale 엔트리가 있으면 그것을 돌려준다), 바깥 `catch`가 `null`을 돌려준다.
 * 소비자는 `null`을 "모름"으로 읽는다: 색인 게이트는 fail-open(색인 유지), 본문은 `?? []`로
 * 플레이스홀더를 그린다. 정말 행이 없는 종목의 `[]`는 정상 결과라 그대로 캐시된다.
 *
 * 큐레이션 종목의 읽기 실패 렌더는 revalidate를 300초로 낮춘다
 * (`shortenRevalidateForRuntimeDegrade`) — 사람에게 에러 화면을 보이지 않으면서(throw/500 대신)
 * 이 degrade 렌더가 6~24h 굳는 것을 막는다. **반드시 `unstable_cache` 콜백 바깥**(여기)에서
 * 불러야 효과가 있다. 롱테일은 어차피 noindex라 재생성 비용을 쓰지 않는다.
 *
 * React `cache`로 감싸 한 렌더 안의 여러 호출(`generateMetadata`·본문·description 로더)이
 * 같은 읽기를 공유한다. 인자는 원시값이다 — 호출부는 대문자 ticker를 넘긴다.
 */
export const getSeoSnapshotsStatic = cache(async function getSeoSnapshotsStatic(
    symbol: string,
    revalidateSeconds: number,
    locale: Locale
): Promise<SeoAnalysisSnapshot[] | null> {
    const upper = symbol.toUpperCase();
    let rows: SeoAnalysisSnapshot[];
    try {
        rows = await readSnapshotRows(upper, revalidateSeconds, locale);
    } catch (error) {
        // Next 제어 흐름(DYNAMIC_SERVER_USAGE 등)은 degrade가 아니다 — 그대로 올려 보낸다.
        if (isDynamicServerError(error)) throw error;
        console.error(
            '[getSeoSnapshotsStatic] read failed, degrading to unknown (null):',
            error
        );
        if (isCuratedSymbol(upper)) await shortenRevalidateForRuntimeDegrade();
        return null;
    }
    return rehydrateSnapshots(upper, rows);
});

/**
 * 캐시 경계 안쪽 읽기. **실패하면 throw한다** — 삼키면 `unstable_cache`가 그 결과를 저장한다.
 */
function readSnapshotRows(
    upper: string,
    revalidateSeconds: number,
    locale: Locale
): Promise<SeoAnalysisSnapshot[]> {
    return staticSymbolCache(
        // 로케일이 캐시 키에 들어가야 한다 — 스냅샷 본문이 로케일별로 갈리므로,
        // 키를 공유하면 먼저 생성한 로케일의 분석 산문이 전 로케일에 굳는다
        // (감사 라운드 1 required #2).
        ['seo-snapshots', upper, ...contentLocaleKeyPart(locale)],
        upper,
        async () => {
            const { db } = getDatabaseClient();
            const rows = await new DrizzleSeoSnapshotRepository(
                db
            ).findBySymbol(upper, locale);
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
        },
        [`seo-snapshot:${upper}`],
        revalidateSeconds
    );
}

function rehydrateSnapshots(
    upper: string,
    rows: readonly SeoAnalysisSnapshot[]
): SeoAnalysisSnapshot[] {
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
        // `firstGeneratedAt`도 같은 왕복을 탄다. 선언 타입이 `Date | null`이라
        // 히트 렌더에서 문자열이 흘러가면 `.getTime()`을 부르는 다음 소비자가
        // 캐시 상태에 따라서만 깨진다 — 재현이 가장 어려운 형태의 결함이다.
        //
        // **`== null`이어야 한다(`=== null` 아님).** 이 컬럼이 생기기 전 코드가 채운
        // 캐시 항목에는 필드 자체가 없어 히트 시 `undefined`로 돌아온다. 엄격 비교면
        // `new Date(undefined)` = Invalid Date가 되고, 그건 `null`이 아니라서 소비처의
        // `?? null`도 통과해 `toISOString()`에서 `RangeError`로 렌더가 죽는다 —
        // 배포 직후 캐시 TTL(최대 86400s) 동안만 나타나는 형태다.
        firstGeneratedAt:
            row.firstGeneratedAt == null
                ? null
                : new Date(row.firstGeneratedAt),
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
