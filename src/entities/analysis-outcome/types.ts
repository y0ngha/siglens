import type {
    AnalysisOutcomeLabels,
    Bar,
    MarketSessionSpec,
    OutcomeSubject,
    OutcomeWindow,
    Timeframe,
} from '@y0ngha/siglens-core';
import type { Locale } from '@/shared/i18n/locales';

/** `analysis_outcomes.status`. */
export type OutcomeStatus = 'pending' | 'labeled' | 'unlabelable';

/**
 * `analysis_outcomes.skip_reason` of an `unlabelable` row.
 *
 * - `subject_invalid`: core could not read a subject out of the stored result.
 * - `timeframe_unsupported`: the stored timeframe is not one the labeller knows.
 * - `anchor_missing` / `anchor_mismatch`: the two core window statuses that no retry can fix.
 * - `bars_unavailable`: the bars of the group failed to load `MAX_GROUP_FAILURES` times.
 * - `forward_stalled`: `insufficient_forward` whose `have` stopped growing (delisted or halted symbol).
 * - `label_error`: processing the row itself threw `MAX_ROW_FAILURES` times.
 */
export type UnlabelableReason =
    | 'subject_invalid'
    | 'timeframe_unsupported'
    | 'anchor_missing'
    | 'anchor_mismatch'
    | 'bars_unavailable'
    | 'forward_stalled'
    | 'label_error';

/**
 * Which counter a failure goes on. Each kind has its own limit and give-up reason, so one kind's history never
 * shortens another's patience (`load` → `bars_unavailable`, `row` → `label_error`,
 * `anchor_missing` → `anchor_missing`).
 */
export type FailureKind = 'load' | 'row' | 'anchor_missing';

/** `analysis_outcomes.anchor_close_basis`, decided in the label step from stored values and the group's session. */
export type AnchorCloseBasis = 'eod_published' | 'after_close_quote';

/** What the `subject` column holds for a row whose result could not be read (the column is NOT NULL). */
export interface InvalidSubject {
    invalid: true;
}

/** One `analysis_history` row that has no `analysis_outcomes` row yet. */
export interface CaptureCandidate {
    analysisId: string;
    symbol: string;
    timeframe: string;
    modelId: string;
    tier: string | null;
    promptVersion: string | null;
    locale: Locale;
    /** Copied as is; no writer fills it today, so it is usually `null`. */
    inputFingerprint: string | null;
    generatedAt: Date;
    /** Stored jsonb, read defensively by core. */
    result: unknown;
    /** `null` once the 7-day prompt expiry has cleared it. */
    promptDynamic: string | null;
}

/** A row to insert; `status` is `pending` or (`subject_invalid` / `timeframe_unsupported`) `unlabelable`. */
export interface NewOutcomeRow {
    analysisId: string;
    symbol: string;
    timeframe: string;
    modelId: string;
    tier: string | null;
    promptVersion: string | null;
    locale: Locale;
    inputFingerprint: string | null;
    generatedAt: Date;
    subject: OutcomeSubject | InvalidSubject;
    status: 'pending' | 'unlabelable';
    skipReason: UnlabelableReason | null;
    nextAttemptAt: Date;
}

/** A (symbol, timeframe) pair with at least one due `pending` row: one bars load serves all its rows. */
export interface DueGroup {
    symbol: string;
    timeframe: string;
}

/** A due `pending` row with what the labeller needs. */
export interface PendingOutcomeRow {
    analysisId: string;
    generatedAt: Date;
    subject: OutcomeSubject;
    /** Last observed `insufficient_forward.have`; `null` before the first deferral. */
    forwardHave: number | null;
    /** When `have` first failed to grow; `null` while it is growing. */
    stalledSince: Date | null;
}

export interface LabeledOutcome {
    analysisId: string;
    labels: AnalysisOutcomeLabels;
    window: OutcomeWindow;
    labelVersion: number;
    labeledAt: Date;
    /** Where the daily anchor close the analysis saw came from; see `anchorCloseBasisOf`. */
    anchorCloseBasis: AnchorCloseBasis | null;
}

export interface DeferredOutcome {
    analysisId: string;
    nextAttemptAt: Date;
    forwardHave: number;
    stalledSince: Date | null;
}

/** A `labeled` row recomputed from its stored inputs. */
export interface RelabelCandidate {
    analysisId: string;
    labelVersion: number;
    subject: OutcomeSubject;
    window: OutcomeWindow;
}

export interface FailureResult {
    /** Rows that stay `pending` with a later `next_attempt_at`. */
    deferred: number;
    /** Rows that reached the attempt limit and became `unlabelable` with the given reason. */
    unlabelable: number;
}

/**
 * Persistence port of the labeller. Every write is idempotent and guarded by the status it expects, so a repeated or
 * overlapping run converges. Methods throw on a database failure; the labeller logs and isolates it per step.
 */
export interface AnalysisOutcomeRepository {
    /**
     * Technical analyses generated since `since` with no outcome row, oldest first. Only rows written with
     * `personalized = false` qualify: a holdings-personalised analysis is never captured, and a row from before the
     * column existed (`NULL`) cannot be told apart, so it is not captured either. `UNCAPTURED_TIMEFRAMES` (`1Week`)
     * rows never qualify.
     */
    listCaptureCandidates(
        since: Date,
        limit: number
    ): Promise<CaptureCandidate[]>;
    /** Same predicate as `listCaptureCandidates`, counted: what is still waiting after a batch. */
    countCaptureCandidates(since: Date): Promise<number>;
    /** `ON CONFLICT DO NOTHING`; returns the number of rows actually inserted. */
    insertOutcomes(rows: readonly NewOutcomeRow[]): Promise<number>;
    /** Groups with a due `pending` row, oldest due first. */
    listDueGroups(now: Date, limit: number): Promise<DueGroup[]>;
    countDueGroups(now: Date): Promise<number>;
    listDueRows(
        group: DueGroup,
        now: Date,
        limit: number
    ): Promise<PendingOutcomeRow[]>;
    /** `WHERE status = 'pending'`; `false` when another run already moved the row. */
    markLabeled(input: LabeledOutcome): Promise<boolean>;
    /**
     * `anchorCloseBasis` is written only when given (the group loaded, so the session was known); omitted, the
     * column stays as it is.
     */
    markUnlabelable(
        analysisId: string,
        reason: UnlabelableReason,
        anchorCloseBasis?: AnchorCloseBasis | null
    ): Promise<boolean>;
    deferRow(input: DeferredOutcome): Promise<boolean>;
    /**
     * Adds one to the `kind` counter and sets `next_attempt_at = retryAt` for the given still-`pending` rows; the
     * ones whose new count reaches `maxCount` become `unlabelable` with that kind's give-up reason.
     */
    recordFailure(
        analysisIds: readonly string[],
        retryAt: Date,
        maxCount: number,
        kind: FailureKind
    ): Promise<FailureResult>;
    listRelabelCandidates(
        currentVersion: number,
        limit: number
    ): Promise<RelabelCandidate[]>;
    /** Selection skips a row whose relabel already threw under `currentVersion`. */
    markRelabelFailed(analysisId: string, version: number): Promise<boolean>;
    /** Guarded by the old `label_version`; `false` when the row moved meanwhile. */
    updateRelabel(input: {
        analysisId: string;
        fromVersion: number;
        labels: AnalysisOutcomeLabels;
        labelVersion: number;
    }): Promise<boolean>;
    /** Deletes at most `limit` rows generated before `cutoff`; returns how many. */
    pruneOlderThan(cutoff: Date, limit: number): Promise<number>;
}

/** What the app layer resolves for one group: the bars and the market's session spec. */
export interface GroupBars {
    bars: readonly Bar[];
    session: MarketSessionSpec;
}

export interface OutcomeLabellerDeps {
    repo: AnalysisOutcomeRepository;
    /**
     * One bars load for a group, through the same cached provider path the analysis uses. Throws on a provider
     * failure or when the symbol cannot be resolved; an empty `bars` array is treated as a failure too.
     */
    loadGroupBars: (symbol: string, timeframe: Timeframe) => Promise<GroupBars>;
    now: () => Date;
    isDeadlineReached: () => boolean;
}

export interface OutcomeLabellerOptions {
    /** Per group bars-load timeout; defaults to `GROUP_TIMEOUT_MS`. Tests shorten it. */
    groupTimeoutMs?: number;
}

export type OutcomeRunStep = 'capture' | 'label' | 'relabel' | 'prune';

/** One JSON line per run (`[analysis-outcomes] run done:`). */
export interface OutcomeRunSummary {
    /** Rows inserted by the capture step (pending and unlabelable). */
    captured: number;
    /** Of `captured`, the rows that could not be read at all (`unlabelable` at birth). */
    capturedInvalid: number;
    /** Capture candidates still waiting after this run's batch. */
    captureRemaining: number;
    labeled: number;
    /** Rows pushed to a later `next_attempt_at` (not enough forward bars yet, or a failed group load). */
    deferred: number;
    /** Rows that became `unlabelable` in the label step. */
    unlabelable: number;
    groupFailures: number;
    /** Rows whose own processing threw (a bug or a failed write); they stay due. */
    rowFailures: number;
    groupsProcessed: number;
    /** Due groups this run did not reach (cap or deadline). */
    groupsRemaining: number;
    relabeled: number;
    pruned: number;
    stoppedBy: 'complete' | 'deadline' | 'cap';
    /** Steps that threw as a whole (their counters stay 0); each also logged `[analysis-outcomes] step failed`. */
    failedSteps: OutcomeRunStep[];
}
