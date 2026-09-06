/**
 * `analysis_history` / `analysis_prompt_blobs` repository.
 *
 * **Deliberately NOT re-exported from `entities/analysis/index.ts`.** This
 * module imports `node:crypto` (for `sha256Hex`) and is `server-only` —
 * pulling it into the barrel would make every barrel consumer's bundle
 * (including client components) eligible to pick up that dependency. This
 * is exactly the guard that prevents a repeat of the earlier incident
 * where a barrel leak shipped `crypto-browserify` into all 33 routes'
 * first-load JS (`project_client_bundle_server_sdk_leak`). Server
 * consumers import this file directly —
 * `@/entities/analysis/analysisHistoryRepository` — instead of through the
 * barrel.
 *
 * Sibling precedent: `usageRepository.ts` in this same directory is
 * excluded from the barrel for the identical reason (DB-touching,
 * server-only, not safe to expose through a client-reachable barrel).
 * Follow that file's placement, not the barrel, when adding another
 * repository here.
 */
import 'server-only';

import { createHash } from 'node:crypto';
import {
    and,
    desc,
    eq,
    gte,
    inArray,
    isNotNull,
    lt,
    notExists,
    sql,
} from 'drizzle-orm';
import {
    analysisHistoryQuery,
    type AssembledPromptRecord,
    type PriorAnalysis,
    type RiskLevel,
    type Timeframe,
    type Trend,
} from '@y0ngha/siglens-core';
import { MS_PER_DAY, MS_PER_MINUTE } from '@/shared/config/time';
import { NEON_TRANSIENT_RETRY } from '@/shared/db/isNeonTransientError';
import { analysisHistory, analysisPromptBlobs } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import type { Locale } from '@/shared/i18n/locales';
import { withRetry } from '@/shared/lib/withRetry';
import {
    resolveEffectiveActionLevels,
    type ActionLevelsSource,
} from './lib/effectiveActionLevels';

/** `analysis_history` 탭 축 — S2 스코프는 technical/overall 둘뿐. */
export type AnalysisHistoryTab = 'technical' | 'overall';

/**
 * `result`(분석 본문) 보관 기간. `'1Day'` prior-analysis 윈도우가 21 거래일 ≈
 * 역법일 30일이고 core가 주말·공휴일 때문에 그 폭을 더 넓히므로(`analysisHistoryQuery`
 * 참고), 90일로 넉넉히 여유를 둔다. `schema.ts`의 `analysisHistory` JSDoc과
 * 동일한 근거 — 수정 시 두 곳을 함께 맞춘다.
 */
export const RESULT_RETENTION_DAYS = 90;

/**
 * `prompt_dynamic`(가장 큰 컬럼) 보관 기간. 디버깅·오프라인 평가 전용이라
 * 최신성만 중요하다. prior-analysis 기능은 `result`만 읽으므로 이 컬럼을
 * 비워도 그 기능에는 영향이 없다 — `prompt_stable_hash`/`prompt_system_hash`/
 * `prompt_version`은 그대로 남겨 "어느 프롬프트 세대가 이 행을 만들었는지"는
 * 계속 식별 가능하게 한다(세 컬럼 모두 값이 작다).
 */
export const PROMPT_DYNAMIC_RETENTION_DAYS = 7;

/**
 * 한 번의 {@link DrizzleAnalysisHistoryRepository.pruneAnalysisHistory} 호출에서
 * 각 DELETE/UPDATE 문이 처리하는 최대 행 수.
 *
 * Postgres는 DELETE/UPDATE에 `LIMIT`을 직접 못 붙인다(MySQL 전용 확장이라
 * Drizzle의 `PgDeleteBase`/`PgUpdateBase`에도 `.limit()`이 없다) — 대신
 * `id IN (SELECT id FROM … LIMIT N)` 서브쿼리로 우회한다. 이 캡이 없으면
 * 몇 달째 자란 테이블에 대한 무제한 DELETE가 오래 잠그거나 서버리스 함수의
 * 시간 예산을 태울 수 있다. 한 번에 캡보다 더 지울 게 남아 있으면 이번
 * 호출은 이 값만큼만 처리하고 끝나며, 남은 몫은 다음 seo-prewarm cron
 * tick이 이어서 처리한다(만료 기준 삭제/클리어라 순서 의존성이 없어 여러
 * tick에 걸쳐 수렴해도 무해하다).
 */
export const PRUNE_BATCH_SIZE = 500;

/**
 * Minimum age (from {@link analysisPromptBlobs.firstSeenAt}) a blob must
 * have before the orphan sweep in {@link DrizzleAnalysisHistoryRepository.pruneAnalysisHistory}
 * is allowed to delete it, even if no `analysis_history` row currently
 * references it.
 *
 * **The race this closes.** `saveAnalysisHistory` does two sequential,
 * non-transactional writes — insert the prompt blobs, then (a network
 * round-trip later) insert the `analysis_history` row that references
 * their hashes. There is deliberately no FK between the two tables (see
 * `pruneAnalysisHistory`'s JSDoc), so nothing stops the orphan sweep from
 * running in that gap: it would see a freshly-inserted blob with no
 * referencing row yet, delete it, and the history insert that follows
 * would then persist a hash pointing at nothing. Silent — `result` is
 * unaffected (prior-analysis only reads that column), but the row loses
 * its prompt for no reason.
 *
 * **Why this value is safe.** The gap between the two writes is bounded by
 * one blob-insert round-trip plus its `NEON_TRANSIENT_RETRY` backoff
 * budget (`backoffBudgetMs: 5000` — see `isNeonTransientError.ts`), so a
 * few seconds covers every realistic case, including a transient Neon
 * retry. Five minutes is two to three orders of magnitude past that,
 * with room to spare for clock skew between the app instance and Neon.
 * It costs nothing to wait — the sweep just picks up a still-orphaned
 * blob on a later `pruneAnalysisHistory` call, the same way it already
 * carries over remainders past {@link PRUNE_BATCH_SIZE}.
 */
export const ORPHAN_BLOB_MIN_AGE_MS = 5 * MS_PER_MINUTE;

/**
 * The analysis's own generation time when it carries one, otherwise now.
 *
 * `AnalysisResponse.analyzedAt` is an ISO string set by core when the result
 * is produced. It is optional and, on a bad value, must not poison the row —
 * an unparseable date would become `Invalid Date` and silently break every
 * ordering and window query that reads this column.
 *
 * Shared by both `analysis_history` writers — the SSE route
 * (`app/api/analysis/stream/route.ts`) and the SEO prewarm seams
 * (`entities/analysis/api.ts`'s `prewarmTechnical`/`prewarmOverall`) — so the
 * guard lives in exactly one place instead of being copy-pasted per caller.
 * Lives here (not in the app-layer route) because `entities/analysis/api.ts`
 * cannot import from `app/` (FSD dependency direction), while both callers
 * can already import this repository module directly (see this file's
 * top-of-module JSDoc on why it is excluded from the barrel).
 */
export function resolveGeneratedAt(result: unknown): Date {
    const stamped = (result as { analyzedAt?: unknown } | null)?.analyzedAt;
    if (typeof stamped === 'string') {
        const parsed = new Date(stamped);
        if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
}

export interface SaveAnalysisHistoryInput {
    symbol: string;
    timeframe: string;
    tab: AnalysisHistoryTab;
    modelId: string;
    /** 감사용 컬럼 — 저장만 하고 읽기 필터로는 쓰지 않는다 (schema.ts `analysisHistory` JSDoc 참고). */
    locale: Locale;
    /** core가 정규화한 AnalysisResponse. jsonb 컬럼에 그대로 적재. */
    result: unknown;
    generatedAt: Date;
    /**
     * core `onPromptAssembled`이 **캐시 미스에서 정확히 한 번** 넘겨준 레코드.
     *
     * 이 필드의 부재는 "이 요청이 분석을 생성하지 않았다"와 동의어다. core는
     * `dedupeInFlight` factory **안에서만** 콜백을 부르므로, 같은 캐시 키로 겹친
     * 요청 중 승자만 받고 패자는 승자의 결과를 공유받는다 — 둘 다 `status: 'done'`을
     * 보게 된다. 그래서 저장 여부를 `status`로 판정할 수 없고, 이 필드로 판정한다
     * (`saveAnalysisHistory` 참고).
     */
    prompt?: AssembledPromptRecord;
    inputFingerprint?: string;
}

function sha256Hex(body: string): string {
    return createHash('sha256').update(body, 'utf8').digest('hex');
}

/**
 * `Trend` / `RiskLevel`의 허용 값 집합.
 *
 * `typeof === 'string'`만으로는 부족하다. 이 행들은 몇 달 전 스키마가 쓴
 * 것일 수 있고(이 모듈의 다른 JSDoc이 인정하는 전제다), 유니온에 없는
 * 문자열(`'sideways'` 등)이 들어 있으면 캐스트로는 걸러지지 않은 채
 * **AI 프롬프트에 사실처럼 주입된다.** 값이 실제로 유니온에 속하는지
 * 확인해야 하고, 아니면 그 행은 버린다.
 */
const TRENDS: ReadonlySet<string> = new Set<Trend>([
    'bullish',
    'bearish',
    'neutral',
]);
const RISK_LEVELS: ReadonlySet<string> = new Set<RiskLevel>([
    'low',
    'medium',
    'high',
]);

const isTrend = (value: unknown): value is Trend =>
    typeof value === 'string' && TRENDS.has(value);

const isRiskLevel = (value: unknown): value is RiskLevel =>
    typeof value === 'string' && RISK_LEVELS.has(value);

/**
 * `analysis_history.result` jsonb → core's `PriorAnalysis` projection.
 *
 * `result` is `unknown` at the type level and may hold whatever an older
 * schema version wrote months ago, so this is defensive rather than a
 * straight cast: a row missing `trend`/`riskLevel`, or holding a non-string
 * value for either, is not a usable prior analysis and is dropped (returns
 * `null`) rather than passed through with garbage fields. Numeric fields
 * under `actionRecommendation` are filtered individually — a single bad
 * `NaN`/`Infinity` entry drops just that value, not the whole row, mirroring
 * core's own guard against non-finite values on the way into the prompt.
 */
function toPriorAnalysis(row: {
    result: unknown;
    generatedAt: Date;
}): PriorAnalysis | null {
    if (typeof row.result !== 'object' || row.result === null) return null;
    const { trend, riskLevel, actionRecommendation } = row.result as {
        trend?: unknown;
        riskLevel?: unknown;
        actionRecommendation?: ActionLevelsSource;
    };
    if (!isTrend(trend) || !isRiskLevel(riskLevel)) {
        return null;
    }

    // 진입가 검증 + 손절/익절 보정값 우선 — 근거는 헬퍼 JSDoc.
    const { entryPrices, stopLoss, takeProfitPrices } =
        resolveEffectiveActionLevels(actionRecommendation);

    return {
        generatedAt: row.generatedAt,
        trend,
        riskLevel,
        ...(entryPrices !== undefined ? { entryPrices } : {}),
        ...(stopLoss !== undefined ? { stopLoss } : {}),
        ...(takeProfitPrices !== undefined ? { takeProfitPrices } : {}),
    };
}

/**
 * `pruneAnalysisHistory`의 결과 — 이번 실행이 실제로 처리한 양.
 *
 * 두 수치는 서로 다른 보존 주기를 반영한다: 행 자체는 90일 뒤 삭제되고,
 * `prompt_dynamic`은 7일 뒤 비워진다(행은 남는다). 배치 상한에 걸려
 * 남은 분량은 다음 크론 틱이 가져가므로, 이 값이 0이 아니라는 것은
 * "더 지울 게 남았을 수도 있다"는 뜻이다.
 */
export interface PruneAnalysisHistoryResult {
    /** 90일 보존 기간을 넘겨 삭제된 `analysis_history` 행 수. */
    rowsDeleted: number;
    /** 7일이 지나 `prompt_dynamic`을 비운 행 수(행 자체는 유지된다). */
    promptsCleared: number;
}

/**
 * Drizzle ORM 기반 `analysis_history` / `analysis_prompt_blobs` 영속화.
 *
 * **전체가 best-effort다.** 호출 시점엔 분석 응답이 이미 사용자에게 나간
 * 뒤라 여기서 던지면 성공한 요청이 실패로 보인다. 모든 에러를 흡수하고
 * 로그만 남긴다 — `saveAnalysisHistory`는 절대 reject하지 않는다.
 */
export class DrizzleAnalysisHistoryRepository {
    constructor(private readonly db: SiglensDatabase) {}

    /**
     * 이력 한 건을 남긴다. **`prompt`가 없으면 아무것도 쓰지 않는다.**
     *
     * ## 왜 prompt 부재가 곧 skip인가
     *
     * 호출부는 core가 준 `status: 'done'`으로 "새로 생성됐다"를 판정하지만 그것으로는
     * 부족하다. `dedupeInFlight`는 같은 캐시 키로 겹친 요청 중 **승자의 factory만**
     * 실행하고 나머지에는 그 결과를 그대로 나눠 준다. 패자도 `'done'`을 받으므로,
     * `status`만 보면 **한 번의 분석이 동시 요청 수만큼 행을 만든다.**
     *
     * 실측(2026-09-05 운영): AAPL 1Day에서 LLM 호출은 1회(`latency 32.8s`)인데 행은
     * 2건이 남았고, 그중 하나만 프롬프트를 갖고 있었다.
     *
     * 그 중복은 조용히 기능을 무력화한다. 프롬프트에 실리는 이력은 최근
     * {@link PRIOR_ANALYSIS_LIMIT}건인데, 그 자리가 **같은 시점의 복제본**으로 차면
     * 모델에게 "이전 분석들"이라며 한 시점을 여러 번 보여 주게 된다 — 서로 다른
     * 시점의 판단을 비교시키려는 설계 의도와 정반대다.
     *
     * 승자를 남기는 쪽이 옳은 이유는 하나 더 있다: 프롬프트가 함께 남아야 결과를
     * 그 입력과 대조할 수 있다. 프롬프트 없는 행은 중복인 데다 품질 추적도 불가능해
     * 남길 이유가 없다.
     */
    async saveAnalysisHistory(input: SaveAnalysisHistoryInput): Promise<void> {
        const prompt = input.prompt;
        if (prompt === undefined) return;

        // 읽기가 버릴 행은 쓰지 않는다 — 판정은 읽기와 **같은 함수**로 한다.
        //
        // core는 tier별로 응답 필드를 잠근 뒤(`filterAnalysisResult`) 그 결과를
        // 호출자에게 돌려준다. free tier의 `infoDepth`는 `direction`·`summary`·
        // `skill_detection`뿐이라 `riskLevel`(= `partial_detail`)이 `null`로
        // 내려오고, `toPriorAnalysis`는 `trend`/`riskLevel`이 온전하지 않은 행을
        // 버린다. 즉 free 경로가 남기는 이력은 **읽는 순간 전량 폐기**된다.
        //
        // 그 경로가 주변부가 아니다: SEO pre-warm이 `tier: 'free'`로 돌고
        // (`entities/analysis/api.ts` — 캐시 키 5축 정합 때문에 올릴 수 없다),
        // 비회원 방문자도 같은 tier다. 저장을 막지 않으면 90일 보존 내내 아무도
        // 읽지 못하는 행과 그 프롬프트 블롭(수십 KB)만 쌓인다.
        //
        // 여기서 `toPriorAnalysis`를 그대로 쓰는 이유는 대칭성이다. 조건을 다시
        // 적으면 읽기 쪽 판정이 바뀔 때 조용히 어긋난다 — 저장은 되는데 읽히지
        // 않거나, 그 반대가 된다.
        //
        // ⚠️ 이건 봉합이지 근본 해결이 아니다. free tier의 분석도 **이력으로서는**
        // 온전히 남는 것이 옳고, 그러려면 core가 tier 필터 이전 결과를 이력용으로
        // 따로 노출해야 한다(캐시에는 이미 필터 전 값이 들어간다).
        if (
            toPriorAnalysis({
                result: input.result,
                generatedAt: input.generatedAt,
            }) === null
        ) {
            return;
        }

        try {
            const promptHashes = {
                stableHash: sha256Hex(prompt.stable),
                systemHash: sha256Hex(prompt.system),
            };

            // 블롭을 먼저 upsert한다 — history 행이 가리킬 해시가 존재해야
            // 한다(FK는 없지만 쓰기 순서로 동일한 불변식을 지킨다).
            await withRetry(
                () =>
                    this.db
                        .insert(analysisPromptBlobs)
                        .values([
                            {
                                hash: promptHashes.stableHash,
                                body: prompt.stable,
                            },
                            {
                                hash: promptHashes.systemHash,
                                body: prompt.system,
                            },
                        ])
                        .onConflictDoNothing({
                            target: analysisPromptBlobs.hash,
                        }),
                NEON_TRANSIENT_RETRY
            );

            await withRetry(
                () =>
                    this.db.insert(analysisHistory).values({
                        symbol: input.symbol,
                        timeframe: input.timeframe,
                        tab: input.tab,
                        modelId: input.modelId,
                        locale: input.locale,
                        result: input.result,
                        inputFingerprint: input.inputFingerprint ?? null,
                        promptVersion: prompt.promptVersion,
                        promptStableHash: promptHashes.stableHash,
                        promptSystemHash: promptHashes.systemHash,
                        promptDynamic: prompt.dynamic,
                        generatedAt: input.generatedAt,
                    }),
                NEON_TRANSIENT_RETRY
            );
        } catch (err) {
            console.error('[analysisHistoryRepository] persist failed:', err);
        }
    }

    /**
     * Reads recent prior analyses for one (symbol, timeframe, tab) to feed
     * core's `priorAnalyses` option (Task S3, prior-analysis-context).
     *
     * **`model_id` and `locale` are deliberately NOT filtered.** Both columns
     * exist on `analysis_history` for auditing only — see the table's JSDoc
     * in `shared/db/schema.ts`. Analyses are generated per output locale
     * (four separate LLM calls per analysis run), but the digest core builds
     * from `PriorAnalysis` is numeric/enum-only and language-neutral, so all
     * four locales draw from one shared history pool; filtering by locale
     * would cut the available data to a quarter for no reason. The same
     * logic applies to `model_id`: a past market call (trend/risk/levels) is
     * a past market call regardless of which model produced it, so this read
     * is model-agnostic too. **If you are "fixing" this by adding a
     * `WHERE model_id = ...` or `WHERE locale = ...` clause, don't — that is
     * the specific mistake this comment exists to head off.**
     *
     * The query is sized via core's `analysisHistoryQuery(timeframe)`
     * (`limit` + `sinceMs`) rather than hand-picked constants — it is a
     * deliberately coarse pre-filter core re-narrows twice downstream, and
     * under-fetching here silently disables the feature. Never tighten this
     * query below what `analysisHistoryQuery` returns.
     *
     * Each row's `result` jsonb is mapped to `PriorAnalysis` via
     * {@link toPriorAnalysis}, which drops rows with a missing/non-string
     * `trend` or `riskLevel` and strips individual non-finite prices rather
     * than passing them through.
     *
     * **Best-effort, like `saveAnalysisHistory`.** A history read must never
     * fail — or slow down beyond one indexed query — an analysis request. Any
     * failure (bad connection, malformed rows, etc.) is logged and resolves
     * to `[]`, which is byte-identical to "this symbol/timeframe/tab has no
     * history yet" from core's point of view.
     */
    async findRecentForPrompt(input: {
        symbol: string;
        timeframe: string;
        tab: AnalysisHistoryTab;
        now?: Date;
    }): Promise<PriorAnalysis[]> {
        try {
            const { limit, sinceMs } = analysisHistoryQuery(
                input.timeframe as Timeframe
            );
            const since = new Date(
                (input.now ?? new Date()).getTime() - sinceMs
            );

            const rows = await withRetry(
                () =>
                    this.db
                        .select({
                            result: analysisHistory.result,
                            generatedAt: analysisHistory.generatedAt,
                        })
                        .from(analysisHistory)
                        .where(
                            and(
                                eq(analysisHistory.symbol, input.symbol),
                                eq(analysisHistory.timeframe, input.timeframe),
                                eq(analysisHistory.tab, input.tab),
                                gte(analysisHistory.generatedAt, since)
                            )
                        )
                        .orderBy(desc(analysisHistory.generatedAt))
                        .limit(limit),
                NEON_TRANSIENT_RETRY
            );

            return rows
                .map(toPriorAnalysis)
                .filter((mapped): mapped is PriorAnalysis => mapped !== null);
        } catch (err) {
            console.error(
                '[analysisHistoryRepository] findRecentForPrompt failed:',
                err
            );
            return [];
        }
    }

    /**
     * Retention sweep for `analysis_history` / `analysis_prompt_blobs`
     * (Task S4). Intended caller: the seo-prewarm cron, after its primary
     * work — see that route's JSDoc.
     *
     * Two schedules, deliberately different — see {@link RESULT_RETENTION_DAYS}
     * and {@link PROMPT_DYNAMIC_RETENTION_DAYS} (also `schema.ts`'s
     * `analysisHistory` JSDoc):
     *
     * 1. Delete rows older than {@link RESULT_RETENTION_DAYS}.
     * 2. Among survivors, clear `prompt_dynamic` (only) on rows older than
     *    {@link PROMPT_DYNAMIC_RETENTION_DAYS} that still have it set —
     *    `prompt_stable_hash`/`prompt_system_hash`/`prompt_version` are left
     *    untouched.
     * 3. Sweep `analysis_prompt_blobs` for hashes no `analysis_history` row
     *    references any more (neither as `prompt_stable_hash` nor
     *    `prompt_system_hash`). Run **after** steps 1–2 so it sees the final
     *    state — step 1 is what actually orphans a blob (step 2 never
     *    touches the hash columns, so it cannot orphan anything on its own).
     *    There is no FK between the two tables specifically so this sweep
     *    stays possible despite the differing retention windows (schema.ts).
     *    Only blobs older than {@link ORPHAN_BLOB_MIN_AGE_MS} are eligible —
     *    see that constant for the concurrent-write race this excludes.
     *
     * Every statement is capped at {@link PRUNE_BATCH_SIZE} rows — see that
     * constant for why and what happens when more remains than one call can
     * clear.
     *
     * **Best-effort, like `saveAnalysisHistory`/`findRecentForPrompt`.**
     * Retention housekeeping must never take down the cron that carries it.
     * Any failure is logged and resolved to zeroed counts.
     */
    async pruneAnalysisHistory(
        now: Date = new Date()
    ): Promise<PruneAnalysisHistoryResult> {
        try {
            const resultCutoff = new Date(
                now.getTime() - RESULT_RETENTION_DAYS * MS_PER_DAY
            );
            const promptCutoff = new Date(
                now.getTime() - PROMPT_DYNAMIC_RETENTION_DAYS * MS_PER_DAY
            );
            const blobAgeCutoff = new Date(
                now.getTime() - ORPHAN_BLOB_MIN_AGE_MS
            );

            // (1) Delete rows past the result retention window.
            const staleRowIds = this.db
                .select({ id: analysisHistory.id })
                .from(analysisHistory)
                .where(lt(analysisHistory.generatedAt, resultCutoff))
                .limit(PRUNE_BATCH_SIZE);

            const deletedRows = await withRetry(
                () =>
                    this.db
                        .delete(analysisHistory)
                        .where(inArray(analysisHistory.id, staleRowIds))
                        .returning({ id: analysisHistory.id }),
                NEON_TRANSIENT_RETRY
            );

            // (2) Among survivors, clear prompt_dynamic past the shorter window.
            const promptClearIds = this.db
                .select({ id: analysisHistory.id })
                .from(analysisHistory)
                .where(
                    and(
                        lt(analysisHistory.generatedAt, promptCutoff),
                        isNotNull(analysisHistory.promptDynamic)
                    )
                )
                .limit(PRUNE_BATCH_SIZE);

            const clearedRows = await withRetry(
                () =>
                    this.db
                        .update(analysisHistory)
                        .set({ promptDynamic: null })
                        .where(inArray(analysisHistory.id, promptClearIds))
                        .returning({ id: analysisHistory.id }),
                NEON_TRANSIENT_RETRY
            );

            // (3) Sweep blobs no surviving row references — computed last so
            // it sees the post-delete state. `notExists` (not `notInArray`)
            // is required here: the hash columns are nullable, and
            // `NOT IN (subquery-with-NULLs)` is three-valued-logic UNKNOWN
            // for every row once the subquery returns any NULL, which would
            // silently keep every orphan forever.
            //
            // `lt(firstSeenAt, blobAgeCutoff)` guards against the
            // insert-order race with `saveAnalysisHistory` — see
            // `ORPHAN_BLOB_MIN_AGE_MS` for what it closes and why the
            // window is sized the way it is. Without it, a blob inserted
            // moments ago (its `analysis_history` row not written yet)
            // looks identical to a real orphan and gets deleted here.
            const orphanBlobHashes = this.db
                .select({ hash: analysisPromptBlobs.hash })
                .from(analysisPromptBlobs)
                .where(
                    and(
                        lt(analysisPromptBlobs.firstSeenAt, blobAgeCutoff),
                        notExists(
                            this.db
                                .select({ one: sql`1` })
                                .from(analysisHistory)
                                .where(
                                    eq(
                                        analysisHistory.promptStableHash,
                                        analysisPromptBlobs.hash
                                    )
                                )
                        ),
                        notExists(
                            this.db
                                .select({ one: sql`1` })
                                .from(analysisHistory)
                                .where(
                                    eq(
                                        analysisHistory.promptSystemHash,
                                        analysisPromptBlobs.hash
                                    )
                                )
                        )
                    )
                )
                .limit(PRUNE_BATCH_SIZE);

            const deletedBlobs = await withRetry(
                () =>
                    this.db
                        .delete(analysisPromptBlobs)
                        .where(
                            inArray(analysisPromptBlobs.hash, orphanBlobHashes)
                        )
                        .returning({ hash: analysisPromptBlobs.hash }),
                NEON_TRANSIENT_RETRY
            );
            console.log(
                `[analysisHistoryRepository] prune: ${deletedRows.length} row(s) deleted, ${clearedRows.length} prompt(s) cleared, ${deletedBlobs.length} orphan blob(s) deleted`
            );

            return {
                rowsDeleted: deletedRows.length,
                promptsCleared: clearedRows.length,
            };
        } catch (err) {
            console.error(
                '[analysisHistoryRepository] pruneAnalysisHistory failed:',
                err
            );
            return { rowsDeleted: 0, promptsCleared: 0 };
        }
    }
}
