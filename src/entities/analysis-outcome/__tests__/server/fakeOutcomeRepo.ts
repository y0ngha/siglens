import {
    OUTCOME_LABEL_VERSION,
    type AnalysisOutcomeLabels,
    type OutcomeSubject,
    type OutcomeWindow,
} from '@y0ngha/siglens-core';
import { FAILURE_SPEC, UNCAPTURED_TIMEFRAMES } from '../../lib/outcomePolicy';
import type {
    AnalysisOutcomeRepository,
    AnchorCloseBasis,
    CaptureCandidate,
    DeferredOutcome,
    DueGroup,
    FailureResult,
    LabeledOutcome,
    NewOutcomeRow,
    OutcomeStatus,
    PendingOutcomeRow,
    RelabelCandidate,
    FailureKind,
    UnlabelableReason,
} from '../../types';

/** One stored `analysis_outcomes` row as the fake keeps it. */
export interface StoredOutcome {
    analysisId: string;
    symbol: string;
    timeframe: string;
    locale?: string;
    inputFingerprint?: string | null;
    generatedAt: Date;
    subject: OutcomeSubject | { invalid: true };
    status: OutcomeStatus;
    skipReason: UnlabelableReason | null;
    loadFailures: number;
    rowErrors: number;
    anchorMissingSeen: number;
    anchorCloseBasis?: string | null;
    nextAttemptAt: Date;
    forwardHave: number | null;
    stalledSince: Date | null;
    relabelFailedVersion: number | null;
    labelVersion: number | null;
    labels: AnalysisOutcomeLabels | null;
    barsSnapshot: OutcomeWindow | null;
    labeledAt: Date | null;
}

/** An `analysis_history` row as the capture query sees it, with the column the port hides. */
export type SeededHistory = Omit<
    CaptureCandidate,
    'locale' | 'inputFingerprint'
> &
    Partial<Pick<CaptureCandidate, 'locale' | 'inputFingerprint'>> & {
        personalized?: boolean | null;
    };

/**
 * In-memory port with the same semantics the SQL repository promises: every write is guarded by the status it expects
 * and reports whether it changed anything, `insertOutcomes` is `ON CONFLICT DO NOTHING`, due groups are ordered by
 * their oldest due row and capped by `limit`. The SQL itself is proven in `analysisOutcomeRepository.db.test.ts`.
 */
export class FakeOutcomeRepo implements AnalysisOutcomeRepository {
    readonly rows = new Map<string, StoredOutcome>();
    private history: readonly SeededHistory[] = [];

    /** The `analysis_history` rows the capture step can see; `personalized` defaults to `false`. */
    seedHistory(...candidates: SeededHistory[]): void {
        this.history = [...this.history, ...candidates];
    }

    add(row: Partial<StoredOutcome> & { analysisId: string }): StoredOutcome {
        const full: StoredOutcome = {
            symbol: 'AAPL',
            timeframe: '1Day',
            generatedAt: new Date('2026-11-01T22:00:00Z'),
            subject: { invalid: true },
            status: 'pending',
            skipReason: null,
            loadFailures: 0,
            rowErrors: 0,
            anchorMissingSeen: 0,
            nextAttemptAt: new Date('2026-11-21T22:00:00Z'),
            forwardHave: null,
            stalledSince: null,
            relabelFailedVersion: null,
            labelVersion: null,
            labels: null,
            barsSnapshot: null,
            labeledAt: null,
            ...row,
        };
        this.rows.set(full.analysisId, full);
        return full;
    }

    get(analysisId: string): StoredOutcome {
        const row = this.rows.get(analysisId);
        if (row === undefined) throw new Error(`no row ${analysisId}`);
        return row;
    }

    private patch(
        analysisId: string,
        expected: OutcomeStatus,
        change: Partial<StoredOutcome>
    ): boolean {
        const row = this.rows.get(analysisId);
        if (row === undefined || row.status !== expected) return false;
        this.rows.set(analysisId, { ...row, ...change });
        return true;
    }

    private captureCandidates(since: Date): CaptureCandidate[] {
        return this.history
            .filter(
                candidate =>
                    // The real query: `personalized = false` only; NULL (written before the column) is out too.
                    (candidate.personalized === undefined ||
                        candidate.personalized === false) &&
                    // ...and never a timeframe the labeller has no rules for (`UNCAPTURED_TIMEFRAMES`).
                    !(UNCAPTURED_TIMEFRAMES as readonly string[]).includes(
                        candidate.timeframe
                    ) &&
                    candidate.generatedAt >= since &&
                    !this.rows.has(candidate.analysisId)
            )
            .toSorted(
                (a, b) => a.generatedAt.getTime() - b.generatedAt.getTime()
            )
            .map(({ personalized: _personalized, ...candidate }) => ({
                ...candidate,
                locale: candidate.locale ?? 'ko',
                inputFingerprint: candidate.inputFingerprint ?? null,
            }));
    }

    async listCaptureCandidates(since: Date, limit: number) {
        return this.captureCandidates(since).slice(0, limit);
    }

    async countCaptureCandidates(since: Date) {
        return this.captureCandidates(since).length;
    }

    async insertOutcomes(rows: readonly NewOutcomeRow[]) {
        const fresh = rows.filter(row => !this.rows.has(row.analysisId));
        fresh.forEach(row =>
            this.add({
                ...row,
                loadFailures: 0,
                rowErrors: 0,
                anchorMissingSeen: 0,
                forwardHave: null,
                stalledSince: null,
            })
        );
        return fresh.length;
    }

    private due(now: Date): StoredOutcome[] {
        return [...this.rows.values()].filter(
            row => row.status === 'pending' && row.nextAttemptAt <= now
        );
    }

    private dueGroups(now: Date): DueGroup[] {
        const oldest = new Map<string, { group: DueGroup; at: number }>();
        this.due(now).forEach(row => {
            const key = `${row.symbol}|${row.timeframe}`;
            const seen = oldest.get(key);
            const at = row.nextAttemptAt.getTime();
            if (seen === undefined || at < seen.at) {
                oldest.set(key, {
                    group: { symbol: row.symbol, timeframe: row.timeframe },
                    at,
                });
            }
        });
        return [...oldest.values()]
            .toSorted((a, b) => a.at - b.at)
            .map(entry => entry.group);
    }

    async listDueGroups(now: Date, limit: number) {
        return this.dueGroups(now).slice(0, limit);
    }

    async countDueGroups(now: Date) {
        return this.dueGroups(now).length;
    }

    async listDueRows(
        group: DueGroup,
        now: Date,
        limit: number
    ): Promise<PendingOutcomeRow[]> {
        return this.due(now)
            .filter(
                row =>
                    row.symbol === group.symbol &&
                    row.timeframe === group.timeframe
            )
            .toSorted(
                (a, b) => a.nextAttemptAt.getTime() - b.nextAttemptAt.getTime()
            )
            .slice(0, limit)
            .map(row => ({
                analysisId: row.analysisId,
                generatedAt: row.generatedAt,
                subject: row.subject as OutcomeSubject,
                forwardHave: row.forwardHave,
                stalledSince: row.stalledSince,
            }));
    }

    async markLabeled(input: LabeledOutcome) {
        return this.patch(input.analysisId, 'pending', {
            anchorCloseBasis: input.anchorCloseBasis,
            status: 'labeled',
            skipReason: null,
            labels: input.labels,
            barsSnapshot: input.window,
            labelVersion: input.labelVersion,
            labeledAt: input.labeledAt,
        });
    }

    async markUnlabelable(
        analysisId: string,
        reason: UnlabelableReason,
        anchorCloseBasis?: AnchorCloseBasis | null
    ) {
        return this.patch(analysisId, 'pending', {
            status: 'unlabelable',
            skipReason: reason,
            ...(anchorCloseBasis === undefined ? {} : { anchorCloseBasis }),
        });
    }

    async deferRow(input: DeferredOutcome) {
        return this.patch(input.analysisId, 'pending', {
            nextAttemptAt: input.nextAttemptAt,
            forwardHave: input.forwardHave,
            stalledSince: input.stalledSince,
        });
    }

    async recordFailure(
        analysisIds: readonly string[],
        retryAt: Date,
        maxCount: number,
        kind: FailureKind
    ): Promise<FailureResult> {
        return analysisIds.reduce<FailureResult>(
            (total, id) => {
                const row = this.rows.get(id);
                if (row === undefined || row.status !== 'pending') {
                    return total;
                }
                const { counter, giveUpReason } = FAILURE_SPEC[kind];
                const count = row[counter] + 1;
                const gaveUp = count >= maxCount;
                this.rows.set(id, {
                    ...row,
                    [counter]: count,
                    nextAttemptAt: retryAt,
                    status: gaveUp ? 'unlabelable' : row.status,
                    skipReason: gaveUp ? giveUpReason : row.skipReason,
                });
                return gaveUp
                    ? { ...total, unlabelable: total.unlabelable + 1 }
                    : { ...total, deferred: total.deferred + 1 };
            },
            { deferred: 0, unlabelable: 0 }
        );
    }

    async markRelabelFailed(analysisId: string, version: number) {
        const row = this.rows.get(analysisId);
        if (row === undefined || row.status !== 'labeled') return false;
        this.rows.set(analysisId, { ...row, relabelFailedVersion: version });
        return true;
    }

    async listRelabelCandidates(
        currentVersion: number,
        limit: number
    ): Promise<RelabelCandidate[]> {
        return [...this.rows.values()]
            .filter(
                row =>
                    row.status === 'labeled' &&
                    row.labelVersion !== null &&
                    row.labelVersion < currentVersion &&
                    (row.relabelFailedVersion === null ||
                        row.relabelFailedVersion < currentVersion) &&
                    row.barsSnapshot !== null
            )
            .slice(0, limit)
            .map(row => ({
                analysisId: row.analysisId,
                labelVersion: row.labelVersion ?? OUTCOME_LABEL_VERSION,
                subject: row.subject as OutcomeSubject,
                window: row.barsSnapshot as OutcomeWindow,
            }));
    }

    async updateRelabel(input: {
        analysisId: string;
        fromVersion: number;
        labels: AnalysisOutcomeLabels;
        labelVersion: number;
    }) {
        const row = this.rows.get(input.analysisId);
        if (
            row === undefined ||
            row.status !== 'labeled' ||
            row.labelVersion !== input.fromVersion
        ) {
            return false;
        }
        this.rows.set(input.analysisId, {
            ...row,
            labels: input.labels,
            labelVersion: input.labelVersion,
        });
        return true;
    }

    async pruneOlderThan(cutoff: Date, limit: number) {
        const stale = [...this.rows.values()]
            .filter(row => row.generatedAt < cutoff)
            .slice(0, limit);
        stale.forEach(row => this.rows.delete(row.analysisId));
        return stale.length;
    }
}
