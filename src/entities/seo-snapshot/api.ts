import 'server-only';

import { eq, inArray } from 'drizzle-orm';
import { seoAnalysisSnapshots } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import type {
    SeoAnalysisSnapshot,
    SeoSnapshotTab,
    SeoSnapshotUpsertInput,
} from './model';
import {
    CONTENT_LOCALE_FALLBACK,
    LEGACY_CONTENT_LOCALE,
    toContentLocale,
} from '@/shared/db/contentLocale';
import type { Locale } from '@/shared/i18n/locales';

/**
 * Drizzle ORM implementation backed by Neon PostgreSQL. One row per
 * (symbol, tab); `upsert` relies on the `seo_analysis_snapshots_symbol_tab_uq`
 * unique index so repeat pre-warm cron runs overwrite the last-known-good
 * row instead of accumulating duplicates.
 */
export class DrizzleSeoSnapshotRepository {
    constructor(private readonly db: SiglensDatabase) {}

    async upsert(input: SeoSnapshotUpsertInput): Promise<void> {
        const symbol = input.symbol.toUpperCase();

        await this.db
            .insert(seoAnalysisSnapshots)
            .values({
                symbol,
                tab: input.tab,
                content: input.content,
                model: input.model,
                generatedAt: input.generatedAt,
                updatedAt: new Date(),
                // 플래그로 가리지 않는다 — Drizzle이 스키마 컬럼을 값에서 빼도
                // `default`로 항상 INSERT에 넣기 때문이다(§shared-analysis/api.ts).
                locale: input.locale,
            })
            .onConflictDoUpdate({
                /**
                 * 충돌 대상은 **항상** 로케일까지 넓다 — 아니면 en 프리웜이 ko
                 * 행을 덮어써서 어느 언어가 남을지가 프리웜 순서로 정해진다.
                 *
                 * 스위치로 가르지 **않는다**. 예전엔 꺼져 있으면
                 * `(symbol, tab)`으로 돌아갔는데, 그러면 0030(구 unique 제거)을
                 * 적용할 수 있는 시점이 "스위치가 전 인스턴스에서 켜진 뒤"로
                 * 밀린다. 그런데 스위치가 켜지면 비-ko 스냅샷이 쓰이기 시작하고,
                 * 구 unique `(symbol, tab)`가 아직 살아 있으면 그 쓰기가
                 * **23505로 죽는다**(로컬 Postgres 17로 실측). 즉 어느 순서로
                 * 해도 창이 남는 설계였다.
                 *
                 * 항상 3열 타깃을 쓰면 창이 사라진다: 0029가 그 인덱스를 만들고
                 * 코드는 그 뒤에 배포되므로 타깃은 항상 존재하고, 배포가 끝나면
                 * 스위치와 무관하게 0030을 적용할 수 있다. 스위치가 꺼진 동안엔
                 * `locale`이 언제나 `ko`라 동작이 2열 타깃과 동일하다.
                 */
                target: [
                    seoAnalysisSnapshots.symbol,
                    seoAnalysisSnapshots.tab,
                    seoAnalysisSnapshots.locale,
                ],
                set: {
                    content: input.content,
                    model: input.model,
                    generatedAt: input.generatedAt,
                    updatedAt: new Date(),
                },
            });
    }

    /**
     * Consumed by `getSeoSnapshotsStatic` (entities/seo-snapshot/lib/getSnapshotStatic.ts)
     * — the read path all 7 tab pages + `generateMetadata` use to surface
     * pre-warmed snapshots. Do not remove as YAGNI without checking that caller first.
     */
    /**
     * 심볼의 스냅샷을 **탭당 한 행**으로 돌려준다.
     *
     * `locale`이 필요한 이유: 스키마의 unique가 `(symbol, tab, locale)`이라
     * 탭마다 로케일 수만큼 행이 존재할 수 있다. 로케일을 무시하고 읽으면
     * `snapshots.find(s => s.tab === 'overall')`이 **먼저 온 행**을 집어,
     * `/en/AAPL`이 한국어 분석 산문을 렌더한다(감사 라운드 1 required #2).
     *
     * 폴백은 `CONTENT_LOCALE_FALLBACK`을 따른다 — 요청 로케일 스냅샷이 아직
     * 프리웜되지 않았으면 없는 것보다 다른 로케일이라도 보여주는 편이 낫다
     * (색인 게이트가 `hasSnapshot`으로 색인 여부를 정하므로, 빈 결과는 그
     * 페이지를 색인 대상에서 빼 버린다).
     *
     * **컬럼을 명시해서 읽는다** — `select()`(전 컬럼)는 스키마에 컬럼이
     * 추가되는 순간 마이그레이션 전 배포에서 통째로 실패한다.
     */
    async findBySymbol(
        symbol: string,
        locale: Locale
    ): Promise<SeoAnalysisSnapshot[]> {
        const rows = await this.db
            .select({
                symbol: seoAnalysisSnapshots.symbol,
                tab: seoAnalysisSnapshots.tab,
                content: seoAnalysisSnapshots.content,
                model: seoAnalysisSnapshots.model,
                generatedAt: seoAnalysisSnapshots.generatedAt,
                updatedAt: seoAnalysisSnapshots.updatedAt,
                locale: seoAnalysisSnapshots.locale,
            })
            .from(seoAnalysisSnapshots)
            .where(eq(seoAnalysisSnapshots.symbol, symbol.toUpperCase()));

        const snapshots = rows.map(row => ({
            symbol: row.symbol,
            tab: row.tab as SeoSnapshotTab,
            content: row.content,
            model: row.model,
            generatedAt: row.generatedAt,
            updatedAt: row.updatedAt,
            locale: toContentLocale(row.locale) ?? LEGACY_CONTENT_LOCALE,
        }));
        return pickSnapshotPerTab(snapshots, locale);
    }

    async findGeneratedAtMap(symbols: string[]): Promise<Map<string, Date>> {
        if (symbols.length === 0) {
            return new Map();
        }

        const rows = await this.db
            .select({
                symbol: seoAnalysisSnapshots.symbol,
                tab: seoAnalysisSnapshots.tab,
                generatedAt: seoAnalysisSnapshots.generatedAt,
            })
            .from(seoAnalysisSnapshots)
            .where(
                inArray(
                    seoAnalysisSnapshots.symbol,
                    symbols.map(symbol => symbol.toUpperCase())
                )
            );

        return new Map(
            rows.map(row => [`${row.symbol}:${row.tab}`, row.generatedAt])
        );
    }
}

/**
 * 탭마다 폴백 체인에서 가장 앞선 로케일의 행 하나만 남긴다.
 *
 * 앱에서 고르는 이유: SQL로 하려면 `DISTINCT ON` + `array_position` 정렬이
 * 필요한데, 심볼당 행이 최대 (탭 7 × 로케일 4)라 정렬 비용보다 왕복 형태를
 * 단순하게 두는 편이 낫다. 무엇보다 폴백 순서의 단일 소스가
 * `CONTENT_LOCALE_FALLBACK` 한 곳에 남는다.
 */
function pickSnapshotPerTab(
    snapshots: readonly SeoAnalysisSnapshot[],
    locale: Locale
): SeoAnalysisSnapshot[] {
    const chain = CONTENT_LOCALE_FALLBACK[locale];
    const best = new Map<SeoSnapshotTab, SeoAnalysisSnapshot>();
    for (const snapshot of snapshots) {
        const rank = chain.indexOf(snapshot.locale);
        // 체인에 없는 로케일(예: zh 요청에 ja 행)은 버린다 — 요청자가 읽을
        // 가능성이 없는 언어를 보여 주느니 색인에서 빠지는 편이 낫다.
        if (rank === -1) continue;
        const current = best.get(snapshot.tab);
        if (current === undefined || rank < chain.indexOf(current.locale)) {
            best.set(snapshot.tab, snapshot);
        }
    }
    return [...best.values()];
}
