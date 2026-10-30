import 'server-only';

import { cache } from 'react';
import { contentLocaleKeyPart } from '@/shared/cache/contentLocaleKeyPart';
import { shortenRevalidateForRuntimeDegrade } from '@/shared/cache/buildDegradedRevalidate';
import { staticSymbolCache } from '@/shared/cache/staticSymbolCache';
import { getDatabaseClient } from '@/shared/db/client';
import type { Locale } from '@/shared/i18n/locales';
import { isDynamicServerError } from '@/shared/lib/isDynamicServerError';
import { isCuratedSymbol } from '@/entities/symbol-indexability/lib/isCuratedSymbol';
import { DrizzleSeoSnapshotRepository } from '../api';
import { isPrewarmTab } from '../lib/applicability';
import { filterWithinMaxAge, rehydrateSnapshots } from '../lib/snapshotRows';
import { SNAPSHOT_MAX_AGE_MS, type SeoAnalysisSnapshot } from '../model';

/**
 * 심볼의 SEO 스냅샷을 ISR static-safe하게 읽는다. 종목 페이지 7개 탭과
 * `generateMetadata`·description 로더가 공유하는 유일한 읽기 경로다.
 *
 * 페이지의 static 경로에서 DB를 맨몸으로 읽으면 DYNAMIC_SERVER_USAGE가 터져 `[symbol]`
 * 라우트가 dynamic이 되므로(app/CLAUDE.md 축 1) `staticSymbolCache`로 감싼다. 캐시 태그는
 * `seo-snapshot:${SYMBOL}`이라 프리웜 cron의 `revalidateTag('seo-snapshot:{SYMBOL}', 'max')`가
 * 새 스냅샷을 즉시 반영시킨다. `revalidateSeconds`는 호출 페이지가 선언한 `revalidate`
 * 리터럴과 같아야 한다(더 짧으면 라우트의 실효 s-maxage가 눌린다).
 *
 * `SNAPSHOT_MAX_AGE_MS`보다 오래된 행은 돌려주기 전에 버린다. 이 상한이 없으면 cron이 죽은
 * 동안 낡은 분석 산문이 "전일 장마감 기준" 캡션과 함께 영원히 서빙되고, 색인 게이트
 * (`hasSnapshot`)도 낡은 행 하나로 계속 indexable이 된다. 버린 결과는 기존 플레이스홀더 경로로
 * 내려간다.
 *
 * ## 읽기 실패 = `null`("모름")이다 — `[]`("행 없음")와 다르다
 *
 * fetcher 안쪽 `catch`가 실패를 `[]`로 삼키면 그 `[]`가 `revalidateSeconds`(6~24h) 동안
 * 캐시에 저장되어, DB가 몇 초 흔들린 순간의 렌더가 "스냅샷 없음"으로 굳는다. 그래서 실패는
 * fetcher 안에서 **throw**한다 — `unstable_cache`는 throw하면 저장을 건너뛰고(stale 엔트리가
 * 있으면 그것을 돌려준다), 바깥 `catch`가 `null`을 돌려준다. 소비자는 `null`을 "모름"으로
 * 읽는다: 색인 게이트는 fail-open(색인 유지), 본문은 `?? []`로 플레이스홀더를 그린다.
 * 정말 행이 없는 종목의 `[]`는 정상 결과라 그대로 캐시된다.
 *
 * 큐레이션 종목의 읽기 실패 렌더는 revalidate를 300초로 낮춘다
 * (`shortenRevalidateForRuntimeDegrade`) — 에러 화면 없이 이 degrade 렌더가 6~24h 굳는 것을
 * 막는다. **반드시 `unstable_cache` 콜백 바깥**(여기)에서 불러야 효과가 있다. 롱테일은 어차피
 * noindex라 재생성 비용을 쓰지 않는다.
 *
 * React `cache`로 감싸 한 렌더 안의 여러 호출이 같은 읽기를 공유한다. 인자는 원시값이라
 * 호출부는 대문자 ticker를 넘긴다.
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
    return selectRenderableSnapshots(upper, rows);
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
        // 로케일이 캐시 키에 들어가야 한다 — 스냅샷 본문이 로케일별로 갈리므로 키를 공유하면
        // 먼저 생성한 로케일의 분석 산문이 전 로케일에 굳는다.
        ['seo-snapshots', upper, ...contentLocaleKeyPart(locale)],
        upper,
        async () => {
            const { db } = getDatabaseClient();
            const rows = await new DrizzleSeoSnapshotRepository(
                db
            ).findBySymbol(upper, locale);
            const fresh = filterWithinMaxAge(rows, Date.now());
            const droppedCount = rows.length - fresh.length;
            if (droppedCount > 0) {
                // 운영자가 "cron이 max-age 상한에 걸릴 만큼 멈췄다"는 것을 알 수 있는 유일한 신호다.
                console.warn(
                    `[getSeoSnapshotsStatic] ${upper}: dropped ${droppedCount} row(s) older than ${SNAPSHOT_MAX_AGE_MS}ms (cron likely stalled)`
                );
            }
            // 모든 렌더러가 null을 렌더하면(손상 content, core 스키마 드리프트, 탭 키 불일치)
            // 시스템이 아무 출력도 내지 않아 "아직 스냅샷이 없는 것"과 구분되지 않는다. 캐시 채움당
            // 심볼마다 한 번(요청마다가 아니라 fetcher 안)이라 볼륨이 제한된다.
            console.info(
                `[getSeoSnapshotsStatic] ${upper}: ${fresh.length} snapshot row(s)`
            );
            return fresh;
        },
        [`seo-snapshot:${upper}`],
        revalidateSeconds
    );
}

/**
 * 캐시에서 읽은 행을 렌더 가능한 것만 남긴다 — `Date` 복원, 손상 행 드롭, 프리웜 탭 한정.
 *
 * 프리웜 대상이 아닌 탭(overall·fundamental·financials·congress·options)의 행은 버린다.
 * 프리웜을 technical·news 두 탭으로 줄인(2026-10-01) 뒤로 그 행들은 더 이상 갱신되지
 * 않는데, 7일 컷오프만으로는 마지막 굽기 뒤 일주일 동안 "지난 AI 분석"이 낡은 가격·만기와
 * 함께 화면에 남았다(이미 지난 만기의 옵션 분석). 이 탭들은 클라이언트 위젯이 방문 시점에
 * 새로 만든다.
 *
 * **캐시 fetcher 안이 아니라 여기서 거른다** — 배포 전에 이미 `unstable_cache`에 담긴 항목도
 * 같이 걸러져야 TTL(최대 24h) 동안 낡은 항목이 남지 않는다.
 */
function selectRenderableSnapshots(
    upper: string,
    rows: readonly SeoAnalysisSnapshot[]
): SeoAnalysisSnapshot[] {
    const { snapshots, invalidCount } = rehydrateSnapshots(rows);
    if (invalidCount > 0) {
        console.warn(
            `[getSeoSnapshotsStatic] ${upper}: dropped ${invalidCount} row(s) with an invalid generatedAt (cache corruption?)`
        );
    }
    return snapshots.filter(row => isPrewarmTab(row.tab));
}
