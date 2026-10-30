import 'server-only';

import {
    and,
    asc,
    desc,
    eq,
    gte,
    inArray,
    notInArray,
    or,
    sql,
    type SQL,
} from 'drizzle-orm';
import { POPULAR_CRYPTOS } from '@/shared/config/popular-cryptos';
import { KR_SYMBOL_RE } from '@/shared/config/ticker';
import {
    CONTENT_LOCALE_FALLBACK,
    LEGACY_CONTENT_LOCALE,
    toContentLocale,
} from '@/shared/db/contentLocale';
import { seoAnalysisSnapshots } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import { DEFAULT_LOCALE, type Locale } from '@/shared/i18n/locales';
import { hasProseForTab, PROSE_SOURCE_FIELDS } from './lib/hasProseForTab';
import {
    anyLocaleChain,
    pickFallbackRowPerSymbolTab,
    pickFreshestPerTab,
    pickSnapshotPerTab,
} from './lib/pickSnapshots';
import { detectedAmong, parseProjected } from './lib/projectedJson';
import type {
    SeoAnalysisSnapshot,
    SeoSnapshotTab,
    SeoSnapshotUpsertInput,
} from './model';

export interface FindBySymbolOptions {
    /** 의미는 `DrizzleSeoSnapshotRepository.findBySymbol`의 `options.anyLocale` 참고. */
    readonly anyLocale?: boolean;
}

/**
 * `seo_analysis_snapshots`의 Drizzle/PostgreSQL 저장소. `(symbol, tab, locale)`마다 한 행이고,
 * `upsert`는 그 unique 인덱스에 기대어 프리웜 cron이 반복 실행돼도 마지막 정상 행을 덮어쓸 뿐
 * 중복 행을 쌓지 않는다. 서버 전용이라 같은 entity의 `server/`와 app 레이어에서만 import한다.
 */
export class DrizzleSeoSnapshotRepository {
    constructor(private readonly db: SiglensDatabase) {}

    /**
     * 프리웜 결과를 `(symbol, tab, locale)` 행에 저장한다. 심볼은 대문자로 정규화하고,
     * 충돌하면 본문·평이화·모델·생성 시각만 갱신한다(`firstGeneratedAt`은 보존).
     */
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
                // 플래그로 가리지 않는다 — Drizzle은 값에서 스키마 컬럼을 빼도 `default`로
                // 항상 INSERT에 넣기 때문이다.
                locale: input.locale,
            })
            .onConflictDoUpdate({
                /**
                 * 충돌 대상은 **항상** 로케일까지 넓다 — 아니면 en 프리웜이 ko 행을 덮어써서
                 * 어느 언어가 남을지가 프리웜 순서로 정해진다.
                 *
                 * 스위치로 가르지 **않는다**. 꺼져 있을 때 `(symbol, tab)`으로 돌아가면 구
                 * unique(`(symbol, tab)`)를 제거하는 마이그레이션(0030)을 적용할 수 있는
                 * 시점이 "스위치가 전 인스턴스에서 켜진 뒤"로 밀리는데, 스위치가 켜지면
                 * 비-ko 스냅샷이 쓰이기 시작하고 구 unique가 살아 있는 동안 그 쓰기는
                 * **23505로 죽는다**(로컬 Postgres 17로 실측). 항상 3열 타깃을 쓰면 이
                 * 창이 사라진다: 0029가 그 인덱스를 만들고 코드는 그 뒤에 배포되므로 타깃은
                 * 항상 존재하고, 스위치가 꺼진 동안엔 `locale`이 언제나 `ko`라 동작이 2열
                 * 타깃과 동일하다.
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
     * 심볼의 스냅샷을 **탭당 한 행**으로 돌려준다. 페이지 읽기 경로 전체
     * (`getSeoSnapshotsStatic` → 종목 페이지 탭들과 `generateMetadata`)가 쓴다.
     *
     * `locale`이 필요한 이유: 스키마의 unique가 `(symbol, tab, locale)`이라 탭마다 로케일 수만큼
     * 행이 존재할 수 있다. 로케일을 무시하고 읽으면 `snapshots.find(s => s.tab === 'overall')`이
     * **먼저 온 행**을 집어 `/en/AAPL`이 한국어 분석 산문을 렌더한다.
     *
     * 폴백은 `CONTENT_LOCALE_FALLBACK`을 따른다 — 요청 로케일 스냅샷이 아직 프리웜되지
     * 않았으면 없는 것보다 다른 로케일이라도 보여주는 편이 낫다(색인 게이트가 `hasSnapshot`으로
     * 색인 여부를 정하므로, 빈 결과는 그 페이지를 색인 대상에서 빼 버린다).
     *
     * **컬럼을 명시해서 읽는다** — `select()`(전 컬럼)는 스키마에 컬럼이 추가되는 순간
     * 마이그레이션 전 배포에서 통째로 실패한다.
     *
     * @param options.anyLocale - 독자는 읽을 수 있는 언어(`CONTENT_LOCALE_FALLBACK`)만 받는다.
     *   분석을 독자의 언어로 스스로 다시 표현하는 소비자(SIGLENS AI 에이전트)는 행의 언어를
     *   가리지 않으므로, 모든 언어를 통틀어 탭마다 **가장 최신** 행을 받는다. `generatedAt`이
     *   정확히 같을 때만 요청 로케일 → 한국어(원본) → 나머지 순으로 고른다. 탭마다 한 행만 준다 —
     *   같은 탭의 다른 언어 행은 번역이거나 별개의 실행이라, 섞으면 모델이 가격·레벨이 다른 두
     *   분석을 받게 된다.
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
            tab: asSnapshotTab(row.tab),
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

        const candidates = rows.map(row => ({
            symbol: row.symbol,
            tab: asSnapshotTab(row.tab),
            locale: toContentLocale(row.locale) ?? LEGACY_CONTENT_LOCALE,
            generatedAt: row.generatedAt,
            prose: row.prose,
        }));
        return pickFallbackRowPerSymbolTab(candidates, chain).map(
            ({ symbol, tab, generatedAt, prose }) => ({
                symbol,
                tab,
                generatedAt,
                hasProse:
                    tab in PROSE_SOURCE_FIELDS
                        ? hasProseForTab(tab, parseProjected(prose))
                        : true,
            })
        );
    }

    /**
     * 프리웜 선별용: 심볼×탭의 `generatedAt`을 `${SYMBOL}:${tab}` 키 맵으로 돌려준다.
     * 같은 키에 로케일별 행이 있으면 어느 로케일의 시각이 남을지는 정해져 있지 않다 —
     * 프리웜은 `DEFAULT_LOCALE` 행만 굽는다는 전제다.
     */
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

    /**
     * 가이드 라이브 모듈용: `since` 이후 구운 ko technical 스냅샷 중 `patternNames`의 차트 패턴이
     * `detected: true`인 종목. 최근 생성 순 `limit`개. (symbol, tab, locale) 유니크라 심볼이 겹치지 않는다.
     * 크립토(`POPULAR_CRYPTOS`)는 가이드 본문이 주식 전제라 뺀다.
     *
     * `market`으로 한국/미국 심볼만 걸러 읽는다 — 한 시장이 최신 행을 독식해 다른 시장이 limit에서
     * 밀려나는 일을 읽기 단계에서 막는다. 한국 판정은 `isKrEquitySymbol`과 같은 `KR_SYMBOL_RE`를 쓴다
     * (대소문자 무시 `~*`는 그 함수의 `toUpperCase()`와 같은 판정). 미국은 그 부정이다.
     *
     * JSONB containment(`@>`)는 free 티어 스냅샷에도 남는 필드(`patternName`·`detected`)만 본다
     * (`filterAnalysisResult`는 `confidenceWeight`만 0으로 바꾼다). 스냅샷은 프리웜 대상 종목마다 한 행(심볼·탭·로케일 유니크)이라
     * 행 수가 프리웜 대상 수를 넘지 않아 인덱스는 두지 않는다.
     * 대상이 크게 늘면 `SELECT count(*) FROM seo_analysis_snapshots WHERE tab='technical' AND locale='ko'`로
     * 다시 재고 `content` GIN 인덱스를 검토한다.
     */
    async listSymbolsWithDetectedPatterns(
        patternNames: readonly string[],
        options: {
            readonly since: Date;
            readonly limit: number;
            readonly market: 'us' | 'kr';
        }
    ): Promise<
        { symbol: string; generatedAt: Date; detectedPatterns: string[] }[]
    > {
        if (patternNames.length === 0) return [];
        const krMatch = sql`${seoAnalysisSnapshots.symbol} ~* ${KR_SYMBOL_RE.source}`;
        const marketCondition =
            options.market === 'kr' ? krMatch : sql`NOT (${krMatch})`;
        const containment = patternNames.map(
            name =>
                sql`${seoAnalysisSnapshots.content}->'patternSummaries' @> ${JSON.stringify(
                    [{ patternName: name, detected: true }]
                )}::jsonb`
        );
        const rows = await this.db
            .select({
                symbol: seoAnalysisSnapshots.symbol,
                generatedAt: seoAnalysisSnapshots.generatedAt,
                detectedPatterns: sql<unknown>`(
                    select coalesce(jsonb_agg(elem->>'patternName'), '[]'::jsonb)
                    from jsonb_array_elements(${seoAnalysisSnapshots.content}->'patternSummaries') as elem
                    where elem->>'detected' = 'true'
                    and elem->>'patternName' in (select jsonb_array_elements_text(${JSON.stringify(patternNames)}::jsonb))
                )`,
            })
            .from(seoAnalysisSnapshots)
            .where(
                and(
                    eq(seoAnalysisSnapshots.tab, 'technical'),
                    eq(seoAnalysisSnapshots.locale, DEFAULT_LOCALE),
                    gte(seoAnalysisSnapshots.generatedAt, options.since),
                    notInArray(seoAnalysisSnapshots.symbol, [
                        ...POPULAR_CRYPTOS,
                    ]),
                    marketCondition,
                    or(...containment)
                )
            )
            .orderBy(
                desc(seoAnalysisSnapshots.generatedAt),
                asc(seoAnalysisSnapshots.symbol)
            )
            .limit(options.limit);
        return rows.map(row => ({
            symbol: row.symbol,
            generatedAt: row.generatedAt,
            detectedPatterns: detectedAmong(
                patternNames,
                parseProjected(row.detectedPatterns)
            ),
        }));
    }
}

/**
 * DB `tab`(varchar)을 도메인 탭 유니온으로 좁힌다. 이 컬럼은 `SeoSnapshotTab`으로 타입이 걸린
 * `upsert`만 쓰므로 단언한다(검증을 더하면 알 수 없는 탭 행의 노출 여부가 바뀐다).
 */
function asSnapshotTab(tab: string): SeoSnapshotTab {
    // safe: 쓰기 경로가 `SeoSnapshotTab`만 저장한다.
    return tab as SeoSnapshotTab;
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
                // `field`는 위 정규식으로 영문자만 통과시킨 상수 `PROSE_SOURCE_FIELDS`의 키
                // 이름이다 — 사용자 입력이 아니고 인용부호·구분자가 들어올 수 없다.
                return [
                    // react-doctor-disable-next-line react-doctor/raw-sql-injection-risk
                    sql.raw(`'${field}'`),
                    sql`${seoAnalysisSnapshots.content} -> ${sql.raw(`'${field}'`)}`,
                ];
            });
            return sql`when ${tab} then jsonb_build_object(${sql.join(pairs, sql`, `)})`;
        }
    );
    return sql<unknown>`case ${seoAnalysisSnapshots.tab} ${sql.join(branches, sql` `)} else null end`;
}
