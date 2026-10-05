import 'server-only';

import { and, eq, gte, inArray, sql, type SQL } from 'drizzle-orm';
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
import { DEFAULT_LOCALE, LOCALES, type Locale } from '@/shared/i18n/locales';
import { hasProseForTab, PROSE_SOURCE_FIELDS } from './lib/hasProseForTab';

export interface FindBySymbolOptions {
    /** See `DrizzleSeoSnapshotRepository.findBySymbol`. */
    readonly anyLocale?: boolean;
}

/**
 * Drizzle ORM implementation backed by PostgreSQL. One row per
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
                plain: input.plain,
                model: input.model,
                generatedAt: input.generatedAt,
                // 최초 생성 시각. INSERT에서만 값이 들어가고 아래 `set`에는
                // 일부러 넣지 않는다 — 넣으면 매 프리웜이 "처음"을 덮어써
                // `generatedAt`과 같은 값이 되고 발행일 신호가 무의미해진다.
                firstGeneratedAt: input.generatedAt,
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
                    // 원문과 함께 덮어쓴다 — 따로 두면 원문이 갱신됐는데
                    // 평이화만 옛것으로 남아 토글이 서로 다른 분석을 오간다.
                    plain: input.plain,
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
    /**
     * @param options.anyLocale - Readers get only languages they can read
     *   (`CONTENT_LOCALE_FALLBACK`). A consumer that re-expresses the analysis
     *   in the reader's language itself (the SiglensAI agent) does not care
     *   what language a row is in, so it gets the FRESHEST row per tab across
     *   all languages; only an exact `generatedAt` tie falls back to
     *   requested → Korean (the canonical one) → the rest. One row per tab,
     *   never several: rows of the same tab in different languages are
     *   translations or separate runs, and mixing them would feed the model
     *   two analyses with different prices and levels.
     */
    async findBySymbol(
        symbol: string,
        locale: Locale,
        options: FindBySymbolOptions = {}
    ): Promise<SeoAnalysisSnapshot[]> {
        const rows = await this.db
            .select({
                symbol: seoAnalysisSnapshots.symbol,
                tab: seoAnalysisSnapshots.tab,
                content: seoAnalysisSnapshots.content,
                plain: seoAnalysisSnapshots.plain,
                model: seoAnalysisSnapshots.model,
                generatedAt: seoAnalysisSnapshots.generatedAt,
                firstGeneratedAt: seoAnalysisSnapshots.firstGeneratedAt,
                updatedAt: seoAnalysisSnapshots.updatedAt,
                locale: seoAnalysisSnapshots.locale,
            })
            .from(seoAnalysisSnapshots)
            .where(eq(seoAnalysisSnapshots.symbol, symbol.toUpperCase()));

        const snapshots = rows.map(row => ({
            symbol: row.symbol,
            tab: row.tab as SeoSnapshotTab,
            content: row.content,
            plain: row.plain,
            model: row.model,
            generatedAt: row.generatedAt,
            firstGeneratedAt: row.firstGeneratedAt,
            updatedAt: row.updatedAt,
            locale: toContentLocale(row.locale) ?? LEGACY_CONTENT_LOCALE,
        }));
        return options.anyLocale
            ? pickFreshestPerTab(snapshots, anyLocaleChain(locale))
            : pickSnapshotPerTab(snapshots, CONTENT_LOCALE_FALLBACK[locale]);
    }

    /**
     * sitemap용: `tabs` 중 하나에 `since` 이후 생성된 스냅샷이 있는 `(symbol, tab)`과
     * 그 스냅샷의 `generatedAt`, 그리고 **그 행이 렌더 가능한 산문을 담고 있는지**(`hasProse`).
     * `generatedAt`은 sitemap `lastmod`의 근거다 — 산문이 실제로 구워진 시각이 "페이지 내용이
     * 바뀐 시각"이다.
     *
     * 같은 `(symbol, tab)`에 로케일별 행이 여럿일 수 있으므로(unique가
     * `(symbol, tab, locale)`) 페이지 읽기 경로(`pickSnapshotPerTab`)와 같은 폴백
     * 순서로 **한 행**을 고른다 — 페이지가 렌더하는 행의 시각·산문이어야 정직하다.
     *
     * 로케일은 `locale`의 독자 폴백(`CONTENT_LOCALE_FALLBACK`)과 같은 범위로 본다 —
     * 페이지가 `findBySymbol(symbol, locale)`로 읽을 수 있는 행이어야 색인 게이트를
     * 통과한다.
     *
     * **`content` 전체는 읽지 않는다** — 수백 행의 JSONB를 끌어오면 sitemap 한 번에 수십 MB다.
     * 대신 `PROSE_SOURCE_FIELDS`가 정한 산문 원천 필드만 SQL에서 투영해 받고, 판정은 페이지가
     * 쓰는 것과 **같은 함수**(`hasProseForTab`)로 한다. 행 존재 여부로 "산문 있음"을 판정하면
     * 서사 필드가 빈 행(손상 JSONB·스키마 드리프트)이 sitemap에는 실리고 페이지는 noindex가
     * 된다. 투영 대상이 아닌 탭은 `hasProse`를 행 존재로 둔다(`true`).
     */
    async listFreshSymbolTabs(
        tabs: readonly SeoSnapshotTab[],
        locale: Locale,
        since: Date
    ): Promise<
        Array<{
            symbol: string;
            tab: SeoSnapshotTab;
            generatedAt: Date;
            hasProse: boolean;
        }>
    > {
        const chain = CONTENT_LOCALE_FALLBACK[locale];
        const rows = await this.db
            .select({
                symbol: seoAnalysisSnapshots.symbol,
                tab: seoAnalysisSnapshots.tab,
                locale: seoAnalysisSnapshots.locale,
                generatedAt: seoAnalysisSnapshots.generatedAt,
                prose: proseProjection(),
            })
            .from(seoAnalysisSnapshots)
            .where(
                and(
                    inArray(seoAnalysisSnapshots.tab, [...tabs]),
                    inArray(seoAnalysisSnapshots.locale, [...chain]),
                    gte(seoAnalysisSnapshots.generatedAt, since)
                )
            );

        // 같은 (symbol, tab)에 로케일별 행이 여러 개일 수 있다 — 폴백 체인에서 가장
        // 앞선 로케일의 행 하나만 남긴다.
        const ranked = rows
            .map(row => ({
                symbol: row.symbol,
                tab: row.tab as SeoSnapshotTab,
                generatedAt: row.generatedAt,
                prose: row.prose,
                rank: chain.indexOf(
                    toContentLocale(row.locale) ?? LEGACY_CONTENT_LOCALE
                ),
            }))
            .toSorted((a, b) => a.rank - b.rank);
        const firstPerKey = ranked.reduce<typeof ranked>(
            (kept, row) =>
                kept.some(k => k.symbol === row.symbol && k.tab === row.tab)
                    ? kept
                    : [...kept, row],
            []
        );
        return firstPerKey.map(({ symbol, tab, generatedAt, prose }) => ({
            symbol,
            tab,
            generatedAt,
            hasProse:
                tab in PROSE_SOURCE_FIELDS
                    ? hasProseForTab(tab, parseProjected(prose))
                    : true,
        }));
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

/** 드라이버가 jsonb 식 결과를 문자열로 줘도 같은 판정이 되도록 한 번 푼다. */
function parseProjected(value: unknown): unknown {
    if (typeof value !== 'string') return value;
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

/**
 * `PROSE_SOURCE_FIELDS`의 탭마다 산문 원천 필드만 담은 jsonb 객체를 만드는 SQL 식.
 * 대상이 아닌 탭은 `null`이다.
 *
 * 필드 이름은 **코드 상수**(사용자 입력 아님)지만 `sql.raw`로 박으므로 식별자 모양을 한 번
 * 더 검증한다. `->`의 우변을 바인드 파라미터로 두면 Postgres가 `jsonb -> text`와
 * `jsonb -> integer` 중 연산자를 고르지 못한다.
 */
function proseProjection(): SQL<unknown> {
    // ⚠️ 동기화 대상: 이 투영은 TS 판정 함수 `hasTechnicalProse`(→ `narrowTechnicalContent`)와
    // `hasNewsProse`(→ `narrowNewsContent`)가 **산문 근거로 읽는 최상위 필드**를 그대로 뽑는다
    // (`PROSE_SOURCE_FIELDS`, `lib/hasProseForTab.ts`). 그 함수들이 읽는 필드가 바뀌면 여기도
    // 함께 바꿔야 한다 — 어긋나면 sitemap이 페이지보다 보수적이 된다(산문이 있는데 없다고 판정).
    // 이 레포 CI에는 Postgres를 직접 때리는 vitest 통합 스위트가 없어(e2e만 Docker Postgres)
    // SQL 자체는 실행 검증하지 못한다. 대신 `hasProseForTab.test.ts`가 TS 함수가 읽는 필드를
    // Proxy로 **유도**해 `PROSE_SOURCE_FIELDS`와 비교한다.

    const branches = Object.entries(PROSE_SOURCE_FIELDS).map(
        ([tab, fields]) => {
            const pairs = fields.flatMap(field => {
                if (!/^[A-Za-z]+$/.test(field)) {
                    throw new Error(`invalid prose field name: ${field}`);
                }
                return [
                    sql.raw(`'${field}'`),
                    sql`${seoAnalysisSnapshots.content} -> ${sql.raw(`'${field}'`)}`,
                ];
            });
            return sql`when ${tab} then jsonb_build_object(${sql.join(pairs, sql`, `)})`;
        }
    );
    return sql<unknown>`case ${seoAnalysisSnapshots.tab} ${sql.join(branches, sql` `)} else null end`;
}

/** 동점 해소 순서: 요청 로케일 → 한국어(원본) → 나머지. */
function anyLocaleChain(locale: Locale): readonly Locale[] {
    return [...new Set<Locale>([locale, DEFAULT_LOCALE, ...LOCALES])];
}

/**
 * `anyLocale` 전용: 탭마다 언어와 무관하게 `generatedAt`이 가장 최신인 행 하나를
 * 남긴다. 생성 시각이 정확히 같을 때만 `tieBreak` 순서로 고른다.
 */
function pickFreshestPerTab(
    snapshots: readonly SeoAnalysisSnapshot[],
    tieBreak: readonly Locale[]
): SeoAnalysisSnapshot[] {
    const best = new Map<SeoSnapshotTab, SeoAnalysisSnapshot>();
    for (const snapshot of snapshots) {
        const current = best.get(snapshot.tab);
        const newer =
            current === undefined ||
            snapshot.generatedAt.getTime() > current.generatedAt.getTime() ||
            (snapshot.generatedAt.getTime() === current.generatedAt.getTime() &&
                tieBreak.indexOf(snapshot.locale) <
                    tieBreak.indexOf(current.locale));
        if (newer) best.set(snapshot.tab, snapshot);
    }
    return [...best.values()];
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
    chain: readonly Locale[]
): SeoAnalysisSnapshot[] {
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
