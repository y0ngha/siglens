import 'server-only';

import {
    and,
    asc,
    eq,
    gte,
    inArray,
    isNull,
    lt,
    lte,
    notExists,
    or,
    sql,
} from 'drizzle-orm';
import type { OutcomeSubject, OutcomeWindow } from '@y0ngha/siglens-core';
import { DB_TRANSIENT_RETRY } from '@/shared/db/isTransientDbError';
import { analysisHistory, analysisOutcomes } from '@/shared/db/schema';
import type { SiglensDatabase } from '@/shared/db/types';
import { withRetry } from '@/shared/lib/withRetry';
import type {
    AnalysisOutcomeRepository,
    AnchorCloseBasis,
    CaptureCandidate,
    DeferredOutcome,
    DueGroup,
    FailureResult,
    LabeledOutcome,
    NewOutcomeRow,
    PendingOutcomeRow,
    RelabelCandidate,
    FailureKind,
    UnlabelableReason,
} from '../types';
import { FAILURE_SPEC } from '../lib/outcomePolicy';

/**
 * `analysis_outcomes` 저장소. `analysis_history`와 달리 **best-effort가 아니다** — 에러를 삼키지 않고 던진다.
 * 호출자(`runOutcomeLabeller`)가 단계별로 로그를 남기고 격리한다.
 *
 * 쓰기는 전부 기대하는 상태를 `WHERE`에 건다(`status = 'pending'` 등). 겹치거나 반복된 실행이 같은 행을 두 번
 * 바꾸지 못하고, 반환값(`boolean`)이 "이번 호출이 실제로 바꿨는가"를 알린다.
 *
 * 시각 비교는 모두 앱 시계 한 곳에서 온다(`SERVER.md#DB-7`): `next_attempt_at`도 앱이 쓰고 `now`도 앱이 넘긴다.
 */
export class DrizzleAnalysisOutcomeRepository implements AnalysisOutcomeRepository {
    constructor(private readonly db: SiglensDatabase) {}

    /**
     * 캡처 대상 조건 — technical 탭, **개인화 아님(`personalized = false`)**, 창 안, 결과 행 없음. 보유 종목
     * 맥락으로 생성한 분석은 회원 보유 정보에서 파생된 산출물이고 보유자 관점의 플랜이라 가져가지 않는다.
     * `personalized`가 null인 행(컬럼이 생기기 전에 쓴 행)은 개인화 여부를 알 수 없어 가져가지 않는다 —
     * 옛 행은 어차피 채우지 않는다. 프롬프트 문자열로 추정하지 않는다.
     * 오래된 것부터라 배치 상한에 걸려도 앞쪽이 먼저
     * `prompt_dynamic` 만료에 가까운 행이다.
     */
    private captureWhere(since: Date) {
        return and(
            eq(analysisHistory.tab, 'technical'),
            eq(analysisHistory.personalized, false),
            gte(analysisHistory.generatedAt, since),
            notExists(
                this.db
                    .select({ one: sql`1` })
                    .from(analysisOutcomes)
                    .where(eq(analysisOutcomes.analysisId, analysisHistory.id))
            )
        );
    }

    async listCaptureCandidates(
        since: Date,
        limit: number
    ): Promise<CaptureCandidate[]> {
        const rows = await withRetry(
            () =>
                this.db
                    .select({
                        analysisId: analysisHistory.id,
                        symbol: analysisHistory.symbol,
                        timeframe: analysisHistory.timeframe,
                        modelId: analysisHistory.modelId,
                        tier: analysisHistory.tier,
                        promptVersion: analysisHistory.promptVersion,
                        locale: analysisHistory.locale,
                        inputFingerprint: analysisHistory.inputFingerprint,
                        generatedAt: analysisHistory.generatedAt,
                        result: analysisHistory.result,
                        promptDynamic: analysisHistory.promptDynamic,
                    })
                    .from(analysisHistory)
                    .where(this.captureWhere(since))
                    .orderBy(asc(analysisHistory.generatedAt))
                    .limit(limit),
            DB_TRANSIENT_RETRY
        );
        return rows;
    }

    async countCaptureCandidates(since: Date): Promise<number> {
        const [row] = await withRetry(
            () =>
                this.db
                    .select({ value: sql<number>`count(*)::int` })
                    .from(analysisHistory)
                    .where(this.captureWhere(since)),
            DB_TRANSIENT_RETRY
        );
        return row?.value ?? 0;
    }

    async insertOutcomes(rows: readonly NewOutcomeRow[]): Promise<number> {
        if (rows.length === 0) return 0;
        const inserted = await withRetry(
            () =>
                this.db
                    .insert(analysisOutcomes)
                    .values([...rows])
                    .onConflictDoNothing({
                        target: analysisOutcomes.analysisId,
                    })
                    .returning({ analysisId: analysisOutcomes.analysisId }),
            DB_TRANSIENT_RETRY
        );
        return inserted.length;
    }

    private dueWhere(now: Date) {
        return and(
            eq(analysisOutcomes.status, 'pending'),
            lte(analysisOutcomes.nextAttemptAt, now)
        );
    }

    async listDueGroups(now: Date, limit: number): Promise<DueGroup[]> {
        const oldestDue = sql`min(${analysisOutcomes.nextAttemptAt})`;
        return withRetry(
            () =>
                this.db
                    .select({
                        symbol: analysisOutcomes.symbol,
                        timeframe: analysisOutcomes.timeframe,
                    })
                    .from(analysisOutcomes)
                    .where(this.dueWhere(now))
                    .groupBy(
                        analysisOutcomes.symbol,
                        analysisOutcomes.timeframe
                    )
                    .orderBy(asc(oldestDue))
                    .limit(limit),
            DB_TRANSIENT_RETRY
        );
    }

    async countDueGroups(now: Date): Promise<number> {
        const [row] = await withRetry(
            () =>
                this.db
                    .select({
                        value: sql<number>`count(distinct (${analysisOutcomes.symbol}, ${analysisOutcomes.timeframe}))::int`,
                    })
                    .from(analysisOutcomes)
                    .where(this.dueWhere(now)),
            DB_TRANSIENT_RETRY
        );
        return row?.value ?? 0;
    }

    async listDueRows(
        group: DueGroup,
        now: Date,
        limit: number
    ): Promise<PendingOutcomeRow[]> {
        const rows = await withRetry(
            () =>
                this.db
                    .select({
                        analysisId: analysisOutcomes.analysisId,
                        generatedAt: analysisOutcomes.generatedAt,
                        subject: analysisOutcomes.subject,
                        forwardHave: analysisOutcomes.forwardHave,
                        stalledSince: analysisOutcomes.stalledSince,
                    })
                    .from(analysisOutcomes)
                    .where(
                        and(
                            this.dueWhere(now),
                            eq(analysisOutcomes.symbol, group.symbol),
                            eq(analysisOutcomes.timeframe, group.timeframe)
                        )
                    )
                    .orderBy(asc(analysisOutcomes.nextAttemptAt))
                    .limit(limit),
            DB_TRANSIENT_RETRY
        );
        // `subject`는 캡처가 core `extractOutcomeSubject`의 결과로만 쓴 jsonb다(읽을 수 없는 행은 pending이 아니다).
        return rows.map(row => ({
            ...row,
            subject: row.subject as OutcomeSubject,
        }));
    }

    async markLabeled(input: LabeledOutcome): Promise<boolean> {
        const changed = await withRetry(
            () =>
                this.db
                    .update(analysisOutcomes)
                    .set({
                        status: 'labeled',
                        skipReason: null,
                        labels: input.labels,
                        barsSnapshot: input.window,
                        labelVersion: input.labelVersion,
                        labeledAt: input.labeledAt,
                        anchorCloseBasis: input.anchorCloseBasis,
                    })
                    .where(
                        and(
                            eq(analysisOutcomes.analysisId, input.analysisId),
                            eq(analysisOutcomes.status, 'pending')
                        )
                    )
                    .returning({ analysisId: analysisOutcomes.analysisId }),
            DB_TRANSIENT_RETRY
        );
        return changed.length > 0;
    }

    async markUnlabelable(
        analysisId: string,
        reason: UnlabelableReason,
        anchorCloseBasis?: AnchorCloseBasis | null
    ): Promise<boolean> {
        const changed = await withRetry(
            () =>
                this.db
                    .update(analysisOutcomes)
                    .set({
                        status: 'unlabelable',
                        skipReason: reason,
                        ...(anchorCloseBasis === undefined
                            ? {}
                            : { anchorCloseBasis }),
                    })
                    .where(
                        and(
                            eq(analysisOutcomes.analysisId, analysisId),
                            eq(analysisOutcomes.status, 'pending')
                        )
                    )
                    .returning({ analysisId: analysisOutcomes.analysisId }),
            DB_TRANSIENT_RETRY
        );
        return changed.length > 0;
    }

    async deferRow(input: DeferredOutcome): Promise<boolean> {
        const changed = await withRetry(
            () =>
                this.db
                    .update(analysisOutcomes)
                    .set({
                        nextAttemptAt: input.nextAttemptAt,
                        forwardHave: input.forwardHave,
                        stalledSince: input.stalledSince,
                    })
                    .where(
                        and(
                            eq(analysisOutcomes.analysisId, input.analysisId),
                            eq(analysisOutcomes.status, 'pending')
                        )
                    )
                    .returning({ analysisId: analysisOutcomes.analysisId }),
            DB_TRANSIENT_RETRY
        );
        return changed.length > 0;
    }

    async recordFailure(
        analysisIds: readonly string[],
        retryAt: Date,
        maxCount: number,
        kind: FailureKind
    ): Promise<FailureResult> {
        if (analysisIds.length === 0) return { deferred: 0, unlabelable: 0 };
        const { counter: key, giveUpReason } = FAILURE_SPEC[kind];
        const counter = analysisOutcomes[key];
        // SET 절의 컬럼 참조는 갱신 전 값이라 `counter + 1`이 이번 실패를 포함한 횟수다.
        const gaveUp = sql`${counter} + 1 >= ${maxCount}`;
        const rows = await withRetry(
            () =>
                this.db
                    .update(analysisOutcomes)
                    .set({
                        [key]: sql`${counter} + 1`,
                        nextAttemptAt: retryAt,
                        status: sql`CASE WHEN ${gaveUp} THEN 'unlabelable' ELSE ${analysisOutcomes.status} END`,
                        skipReason: sql`CASE WHEN ${gaveUp} THEN ${giveUpReason} ELSE ${analysisOutcomes.skipReason} END`,
                    })
                    .where(
                        and(
                            inArray(analysisOutcomes.analysisId, [
                                ...analysisIds,
                            ]),
                            eq(analysisOutcomes.status, 'pending')
                        )
                    )
                    .returning({ status: analysisOutcomes.status }),
            DB_TRANSIENT_RETRY
        );
        const unlabelable = rows.filter(
            row => row.status === 'unlabelable'
        ).length;
        return { deferred: rows.length - unlabelable, unlabelable };
    }

    async listRelabelCandidates(
        currentVersion: number,
        limit: number
    ): Promise<RelabelCandidate[]> {
        const rows = await withRetry(
            () =>
                this.db
                    .select({
                        analysisId: analysisOutcomes.analysisId,
                        labelVersion: analysisOutcomes.labelVersion,
                        subject: analysisOutcomes.subject,
                        barsSnapshot: analysisOutcomes.barsSnapshot,
                    })
                    .from(analysisOutcomes)
                    .where(
                        and(
                            eq(analysisOutcomes.status, 'labeled'),
                            lt(analysisOutcomes.labelVersion, currentVersion),
                            // 이 버전에서 이미 던진 행은 건너뛴다(같은 오류를 매 실행 되풀이하지 않는다).
                            or(
                                isNull(analysisOutcomes.relabelFailedVersion),
                                lt(
                                    analysisOutcomes.relabelFailedVersion,
                                    currentVersion
                                )
                            )
                        )
                    )
                    // 순서는 의미가 없다(어느 행이든 같은 정의로 다시 계산한다). `ORDER BY`가 없어야 부분 인덱스로
                    // 후보가 없을 때 바로 끝난다.
                    .limit(limit),
            DB_TRANSIENT_RETRY
        );
        return rows.flatMap(row =>
            row.labelVersion === null || row.barsSnapshot === null
                ? []
                : [
                      {
                          analysisId: row.analysisId,
                          labelVersion: row.labelVersion,
                          subject: row.subject as OutcomeSubject,
                          window: row.barsSnapshot as OutcomeWindow,
                      },
                  ]
        );
    }

    async markRelabelFailed(
        analysisId: string,
        version: number
    ): Promise<boolean> {
        const changed = await withRetry(
            () =>
                this.db
                    .update(analysisOutcomes)
                    .set({ relabelFailedVersion: version })
                    .where(
                        and(
                            eq(analysisOutcomes.analysisId, analysisId),
                            eq(analysisOutcomes.status, 'labeled')
                        )
                    )
                    .returning({ analysisId: analysisOutcomes.analysisId }),
            DB_TRANSIENT_RETRY
        );
        return changed.length > 0;
    }

    async updateRelabel(input: {
        analysisId: string;
        fromVersion: number;
        labels: LabeledOutcome['labels'];
        labelVersion: number;
    }): Promise<boolean> {
        const changed = await withRetry(
            () =>
                this.db
                    .update(analysisOutcomes)
                    .set({
                        labels: input.labels,
                        labelVersion: input.labelVersion,
                    })
                    .where(
                        and(
                            eq(analysisOutcomes.analysisId, input.analysisId),
                            eq(analysisOutcomes.status, 'labeled'),
                            eq(analysisOutcomes.labelVersion, input.fromVersion)
                        )
                    )
                    .returning({ analysisId: analysisOutcomes.analysisId }),
            DB_TRANSIENT_RETRY
        );
        return changed.length > 0;
    }

    async pruneOlderThan(cutoff: Date, limit: number): Promise<number> {
        const staleIds = this.db
            .select({ id: analysisOutcomes.analysisId })
            .from(analysisOutcomes)
            .where(lt(analysisOutcomes.generatedAt, cutoff))
            .limit(limit);
        const deleted = await withRetry(
            () =>
                this.db
                    .delete(analysisOutcomes)
                    .where(inArray(analysisOutcomes.analysisId, staleIds))
                    .returning({ analysisId: analysisOutcomes.analysisId }),
            DB_TRANSIENT_RETRY
        );
        return deleted.length;
    }
}
