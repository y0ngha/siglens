import {
    type Bar,
    type MarketSessionSpec,
    OUTCOME_LABEL_VERSION,
    buildOutcomeWindow,
    extractOutcomeSubject,
    labelAnalysisOutcome,
    outcomeEarliestLabelTime,
    type Timeframe,
} from '@y0ngha/siglens-core';
import { MS_PER_DAY } from '@/shared/config/time';
import { redactDbErrorForLog } from '@/shared/db/redactDbErrorForLog';
import { closedBars } from '../lib/closedBars';
import { anchorCloseBasisOf, buildOutcomeAnchor } from '../lib/outcomeAnchor';
import {
    BARS_CONCURRENCY,
    ANCHOR_MISSING_RETRY_MS,
    CAPTURE_BACKLOG_WARN_DAYS,
    CAPTURE_BATCH,
    CAPTURE_CHUNK,
    CAPTURE_LOOKBACK_DAYS,
    GROUP_FAILURE_RETRY_MS,
    GROUP_TIMEOUT_MS,
    MAX_GROUPS_PER_RUN,
    MAX_ANCHOR_MISSING_OBSERVATIONS,
    MAX_GROUP_FAILURES,
    MAX_ROW_FAILURES,
    OUTCOME_RETENTION_DAYS,
    PRUNE_BATCH,
    RELABEL_BATCH,
    ROW_FAILURE_RETRY_MS,
    ROWS_PER_GROUP_LIMIT,
    decideInsufficientForward,
    isTimeframe,
} from '../lib/outcomePolicy';
import type {
    CaptureCandidate,
    DueGroup,
    NewOutcomeRow,
    OutcomeLabellerDeps,
    OutcomeLabellerOptions,
    OutcomeRunStep,
    OutcomeRunSummary,
    PendingOutcomeRow,
} from '../types';

/**
 * 분석 사후 결과 라벨러 — 크론 한 번의 본문(`PATCH /api/cron/analysis-outcomes`). 라벨 판정은 전부 core다
 * (`extractOutcomeSubject`, `buildOutcomeWindow`, `labelAnalysisOutcome`). 여기는 저장·스케줄·재시도만 한다.
 *
 * 네 단계를 이 순서로, 각각 상한을 두고 돈다. 한 단계가 던져도 나머지는 돈다(`failedSteps`에 남고
 * `[analysis-outcomes] step failed`를 로그한다 — 알람 필터 문구).
 *
 * 1. **capture** (DB만 — 외부 호출도 종목 해석도 없다. `CAPTURE_CHUNK`씩 읽어 `CAPTURE_BATCH`까지): `analysis_history`의 technical 행 중 개인화가 아니고
 *    (`personalized = false`) 결과 행이 없는 것의 주장(`subject`)을 복사한다. 가져가지 못한 가장 오래된 분석이 5일을 넘으면
 *    `[analysis-outcomes] capture backlog`를 남긴다. 90일 prune과 7일 `prompt_dynamic` 만료 전에 해야 해서 맨 앞이다.
 * 2. **label** (`MAX_GROUPS_PER_RUN`, `BARS_CONCURRENCY`, `GROUP_TIMEOUT_MS`): 만기가 된 `pending` 행을
 *    (symbol, timeframe)로 묶어 그룹당 봉을 한 번 로드하고 core window 결과 네 가지를 처리한다.
 * 3. **relabel** (`RELABEL_BATCH`, 공급자 호출 없음): `label_version < OUTCOME_LABEL_VERSION`인 행을 저장된
 *    `subject` + `bars_snapshot`으로 다시 계산한다.
 * 4. **prune** (`PRUNE_BATCH`): `generated_at`이 `OUTCOME_RETENTION_DAYS`(730일)를 넘은 행을 지운다.
 *
 * ## 외부 요청 최악치 (SERVER.md#CC-1, #CC-7)
 *
 * 외부 호출은 label 단계의 그룹당 한 번(자산 정보 조회 + `getBars`)뿐이다. capture·relabel·prune은 DB만 쓴다. 실행당 ≤ `MAX_GROUPS_PER_RUN`(120)건, 하루 8 tick이면
 * ≤ 960건이고 전부 캐시 미스일 때 일봉 한 번이 약 41KB라 하루 ≤ 약 39MB다. 호출 경로는 분석과 같은 캐시
 * provider(`getCachedMarketDataProvider(session)` + `fetchBarsWithIndicators`)라 새 캐시 키를 만들지 않고, 분석된
 * 종목은 보통 캐시에 있다. 콜드 심볼은 자산 조회 한 번이, 일봉 그룹은 시세 호출 한 번이 더 붙을 수 있다(둘 다 작다). 자산 조회도 그룹의
 * 로드 타임아웃(`GROUP_TIMEOUT_MS`) 안에 들어 있다. 동시성은 `BARS_CONCURRENCY`(2)로 묶는다 — 다른 크론(seo-prewarm 등)과 겹치지 않는
 * 시간대에 돈다(`infra/aws/22-analysis-outcomes-cron.sh`).
 *
 * ## 시간 예산 (CC-7)
 *
 * capture와 label 단계는 마감(`isDeadlineReached`)을 **청크 사이**에서만 본다. capture의 청크는 DB 읽기·쓰기 100행이고, label의
 * 이미 시작한 청크는 그룹당 `GROUP_TIMEOUT_MS`와 행 쓰기까지 끝낸다. relabel·prune은 DB만 쓰는 상한 있는 작업이라 마감 뒤에도 돈다 — 안 그러면 label이 매번
 * 마감을 소진할 때 prune·relabel이 굶는다(CC-13). 락 TTL은 마감 + 한 청크 + DB 여유보다 커야 한다(route 테스트).
 *
 * 모든 쓰기는 멱등이고 기대 상태를 `WHERE`에 건다. 반복·겹친 실행은 같은 상태로 수렴한다.
 */
export async function runOutcomeLabeller(
    deps: OutcomeLabellerDeps,
    options: OutcomeLabellerOptions = {}
): Promise<OutcomeRunSummary> {
    const groupTimeoutMs = options.groupTimeoutMs ?? GROUP_TIMEOUT_MS;
    const capture = await runStep('capture', () => captureStep(deps), {
        captured: 0,
        capturedInvalid: 0,
        captureRemaining: 0,
    });
    const label = await runStep(
        'label',
        () => labelStep(deps, groupTimeoutMs),
        EMPTY_LABEL
    );
    const relabel = await runStep('relabel', () => relabelStep(deps), 0);
    const prune = await runStep('prune', () => pruneStep(deps), 0);

    return {
        ...capture.value,
        labeled: label.value.labeled,
        deferred: label.value.deferred,
        unlabelable: label.value.unlabelable,
        groupFailures: label.value.groupFailures,
        rowFailures: label.value.rowFailures,
        groupsProcessed: label.value.groupsProcessed,
        groupsRemaining: label.value.groupsRemaining,
        relabeled: relabel.value,
        pruned: prune.value,
        stoppedBy: label.value.stoppedBy,
        failedSteps: [capture, label, relabel, prune].flatMap(step =>
            step.failedStep === null ? [] : [step.failedStep]
        ),
    };
}

interface StepResult<T> {
    value: T;
    failedStep: OutcomeRunStep | null;
}

/** 한 단계를 격리한다 — 던지면 로그하고 `fallback`(0으로 채운 카운터)을 돌려준다(SA-4, SA-26). */
async function runStep<T>(
    step: OutcomeRunStep,
    run: () => Promise<T>,
    fallback: T
): Promise<StepResult<T>> {
    try {
        return { value: await run(), failedStep: null };
    } catch (error) {
        console.error(
            `[analysis-outcomes] step failed: ${step}`,
            redactDbErrorForLog(error)
        );
        return { value: fallback, failedStep: step };
    }
}

function chunkOf<T>(items: readonly T[], size: number): T[][] {
    return Array.from({ length: Math.ceil(items.length / size) }, (_, index) =>
        items.slice(index * size, (index + 1) * size)
    );
}

/* ------------------------------------------------------------------ */
/* 1. capture                                                           */
/* ------------------------------------------------------------------ */

interface CaptureResult {
    captured: number;
    capturedInvalid: number;
    captureRemaining: number;
}

/** core가 주제를 못 읽거나 던지면 `null` — 한 행이 배치 전체(가장 오래된 행부터라 앞자리)를 막지 않게 한다. */
function readSubject(candidate: CaptureCandidate) {
    try {
        return extractOutcomeSubject(candidate.result, candidate.promptDynamic);
    } catch (error) {
        console.error(
            `[analysis-outcomes] subject extraction failed ${candidate.analysisId}`,
            redactDbErrorForLog(error)
        );
        return null;
    }
}

function toNewRow(candidate: CaptureCandidate): NewOutcomeRow {
    const base = {
        analysisId: candidate.analysisId,
        symbol: candidate.symbol,
        timeframe: candidate.timeframe,
        modelId: candidate.modelId,
        tier: candidate.tier,
        promptVersion: candidate.promptVersion,
        locale: candidate.locale,
        inputFingerprint: candidate.inputFingerprint,
        generatedAt: candidate.generatedAt,
    };
    // 읽을 수 없는 행도 행을 남긴다 — 다음 tick의 anti-join이 같은 행을 다시 집지 않게 하고, 비율을 센다.
    const invalid = (reason: 'subject_invalid' | 'timeframe_unsupported') => ({
        ...base,
        subject: { invalid: true as const },
        status: 'unlabelable' as const,
        skipReason: reason,
        nextAttemptAt: candidate.generatedAt,
    });
    if (!isTimeframe(candidate.timeframe))
        return invalid('timeframe_unsupported');
    const subject = readSubject(candidate);
    if (subject === null) return invalid('subject_invalid');
    return {
        ...base,
        subject,
        status: 'pending',
        skipReason: null,
        // 하한일 뿐이다(세션 간격 때문에 그 시각에도 봉이 모자랄 수 있고, 그러면 `have`/`need`로 다시 본다).
        nextAttemptAt: outcomeEarliestLabelTime(
            candidate.generatedAt,
            candidate.timeframe
        ),
    };
}

interface CaptureProgress {
    captured: number;
    capturedInvalid: number;
    /** 지금까지 읽은 후보 수 — 삽입이 0건이어도 루프가 끝나도록 센다. */
    seen: number;
}

/**
 * `CAPTURE_CHUNK`개씩 읽어 넣는 것을 `CAPTURE_BATCH`까지(또는 후보가 떨어지거나 마감이 올 때까지) 되풀이한다.
 * 넣은 행은 anti-join에서 빠지므로 다음 읽기가 다음 후보를 준다. 청크 사이에서 마감을 본다(CC-1).
 */
async function captureChunks(
    deps: OutcomeLabellerDeps,
    since: Date,
    progress: CaptureProgress
): Promise<CaptureProgress> {
    if (progress.seen >= CAPTURE_BATCH || deps.isDeadlineReached()) {
        return progress;
    }
    const size = Math.min(CAPTURE_CHUNK, CAPTURE_BATCH - progress.seen);
    const candidates = await deps.repo.listCaptureCandidates(since, size);
    if (candidates.length === 0) return progress;
    const rows = candidates.map(toNewRow);
    const inserted = await deps.repo.insertOutcomes(rows);
    const next: CaptureProgress = {
        captured: progress.captured + inserted,
        capturedInvalid:
            progress.capturedInvalid +
            rows.filter(row => row.status === 'unlabelable').length,
        seen: progress.seen + candidates.length,
    };
    return candidates.length < size ? next : captureChunks(deps, since, next);
}

async function captureStep(deps: OutcomeLabellerDeps): Promise<CaptureResult> {
    const now = deps.now();
    const since = new Date(now.getTime() - CAPTURE_LOOKBACK_DAYS * MS_PER_DAY);
    const progress = await captureChunks(deps, since, {
        captured: 0,
        capturedInvalid: 0,
        seen: 0,
    });
    const captureRemaining = await deps.repo.countCaptureCandidates(since);
    if (captureRemaining > 0) {
        // 못 가져간 분석이 창 밖으로 밀려 나가기 전에 알린다 — 밀려 나간 행은 영영 못 가져온다.
        const [oldest] = await deps.repo.listCaptureCandidates(since, 1);
        const warnBefore = new Date(
            now.getTime() - CAPTURE_BACKLOG_WARN_DAYS * MS_PER_DAY
        );
        if (oldest !== undefined && oldest.generatedAt < warnBefore) {
            console.warn('[analysis-outcomes] capture backlog', {
                count: captureRemaining,
                oldestGeneratedAt: oldest.generatedAt.toISOString(),
            });
        }
    }
    return {
        captured: progress.captured,
        capturedInvalid: progress.capturedInvalid,
        captureRemaining,
    };
}

/* ------------------------------------------------------------------ */
/* 2. label                                                             */
/* ------------------------------------------------------------------ */

interface RowCounts {
    labeled: number;
    deferred: number;
    unlabelable: number;
    groupFailures: number;
    rowFailures: number;
}

const ZERO_COUNTS: RowCounts = {
    labeled: 0,
    deferred: 0,
    unlabelable: 0,
    groupFailures: 0,
    rowFailures: 0,
};

const addCounts = (a: RowCounts, b: RowCounts): RowCounts => ({
    labeled: a.labeled + b.labeled,
    deferred: a.deferred + b.deferred,
    unlabelable: a.unlabelable + b.unlabelable,
    groupFailures: a.groupFailures + b.groupFailures,
    rowFailures: a.rowFailures + b.rowFailures,
});

interface LabelResult extends RowCounts {
    groupsProcessed: number;
    groupsRemaining: number;
    stoppedBy: OutcomeRunSummary['stoppedBy'];
}

const EMPTY_LABEL: LabelResult = {
    ...ZERO_COUNTS,
    groupsProcessed: 0,
    groupsRemaining: 0,
    stoppedBy: 'complete',
};

/** 타임아웃을 넘긴 로드는 취소할 수 없다(AbortSignal 없음). 고아 promise의 reject는 아래에서 처리돼 unhandled가 아니다. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(
            () => reject(new Error(`bars load timed out after ${ms}ms`)),
            ms
        );
        promise.then(
            value => {
                clearTimeout(timer);
                resolve(value);
            },
            error => {
                clearTimeout(timer);
                reject(error);
            }
        );
    });
}

async function loadGroupBars(
    deps: OutcomeLabellerDeps,
    symbol: string,
    timeframe: string,
    timeoutMs: number
) {
    if (!isTimeframe(timeframe)) {
        throw new Error(`unsupported timeframe ${timeframe}`);
    }
    const loaded = await withTimeout(
        deps.loadGroupBars(symbol, timeframe),
        timeoutMs
    );
    // 빈 봉은 "종목에 봉이 없다"가 아니라 공급자 실패로 본다 — 안 그러면 일시 장애가 모든 행을 anchor_missing
    // (되돌릴 수 없는 포기)으로 만든다.
    if (loaded.bars.length === 0) {
        throw new Error('provider returned no bars');
    }
    return { ...loaded, timeframe };
}

async function labelRow(
    deps: OutcomeLabellerDeps,
    row: PendingOutcomeRow,
    context: {
        closed: Bar[];
        timeframe: Timeframe;
        session: MarketSessionSpec;
        groupLabel: string;
    }
): Promise<RowCounts> {
    try {
        const anchor = buildOutcomeAnchor(
            row.subject,
            row.generatedAt,
            context.timeframe,
            context.session
        );
        // 앵커 종가의 출처는 저장된 값(생성 시각, 앵커 봉 날짜)과 이 그룹이 이미 푼 세션 스펙만으로 정해진다. 캡처가
        // 아니라 여기서 정하는 이유: 캡처는 DB만 쓰고(종목 해석이 외부 조회로 이어질 수 있다), 여기는 세션이 이미 풀려
        // 있어 조회 실패로 영구히 비는 값이 생기지 않는다.
        const anchorCloseBasis = anchorCloseBasisOf(
            row.subject,
            row.generatedAt,
            context.timeframe,
            context.session
        );
        const result = buildOutcomeWindow(context.closed, anchor);
        switch (result.status) {
            case 'ok': {
                const labels = labelAnalysisOutcome(row.subject, result.window);
                const changed = await deps.repo.markLabeled({
                    analysisId: row.analysisId,
                    labels,
                    window: result.window,
                    labelVersion: labels.v,
                    labeledAt: deps.now(),
                    anchorCloseBasis,
                });
                return { ...ZERO_COUNTS, labeled: changed ? 1 : 0 };
            }
            case 'insufficient_forward': {
                const decision = decideInsufficientForward({
                    have: result.have,
                    need: result.need,
                    timeframe: context.timeframe,
                    now: deps.now(),
                    previousHave: row.forwardHave,
                    previousStalledSince: row.stalledSince,
                });
                if (decision.kind === 'give_up') {
                    const changed = await deps.repo.markUnlabelable(
                        row.analysisId,
                        'forward_stalled',
                        anchorCloseBasis
                    );
                    return { ...ZERO_COUNTS, unlabelable: changed ? 1 : 0 };
                }
                const changed = await deps.repo.deferRow({
                    analysisId: row.analysisId,
                    nextAttemptAt: decision.nextAttemptAt,
                    forwardHave: decision.forwardHave,
                    stalledSince: decision.stalledSince,
                });
                return { ...ZERO_COUNTS, deferred: changed ? 1 : 0 };
            }
            case 'anchor_mismatch': {
                console.warn(
                    `[analysis-outcomes] anchor mismatch ${context.groupLabel}`,
                    { analysisId: row.analysisId, factor: result.factor }
                );
                const changed = await deps.repo.markUnlabelable(
                    row.analysisId,
                    'anchor_mismatch',
                    anchorCloseBasis
                );
                return { ...ZERO_COUNTS, unlabelable: changed ? 1 : 0 };
            }
            case 'anchor_missing': {
                // 앞 봉 하나의 검증 실패나 제공자의 일시 결측도 이 결과가 된다 — 하루 간격으로 몇 번 더 본다.
                const failure = await deps.repo.recordFailure(
                    [row.analysisId],
                    new Date(deps.now().getTime() + ANCHOR_MISSING_RETRY_MS),
                    MAX_ANCHOR_MISSING_OBSERVATIONS,
                    'anchor_missing'
                );
                return {
                    ...ZERO_COUNTS,
                    deferred: failure.deferred,
                    unlabelable: failure.unlabelable,
                };
            }
        }
    } catch (error) {
        // 행 하나의 실패(버그나 쓰기 실패)가 그룹의 나머지를 막지 않는다. 백오프 없이 두면 매번 던지는 행이
        // 자기 그룹을 줄 맨 앞에 붙들어 실행마다 봉 로드 한 번과 그룹 자리 하나를 먹으므로, 시도를 세고
        // 미룬 뒤 `MAX_ROW_FAILURES`번째에 `label_error`로 포기한다.
        console.error(
            `[analysis-outcomes] row failed ${row.analysisId}`,
            redactDbErrorForLog(error)
        );
        try {
            const failure = await deps.repo.recordFailure(
                [row.analysisId],
                new Date(deps.now().getTime() + ROW_FAILURE_RETRY_MS),
                MAX_ROW_FAILURES,
                'row'
            );
            return {
                ...ZERO_COUNTS,
                rowFailures: 1,
                unlabelable: failure.unlabelable,
            };
        } catch (recordError) {
            console.error(
                `[analysis-outcomes] row failure not recorded ${row.analysisId}`,
                redactDbErrorForLog(recordError)
            );
            return { ...ZERO_COUNTS, rowFailures: 1 };
        }
    }
}

/** 그룹 하나를 처리한다. 절대 reject하지 않는다 — 실패는 카운터로만 돌아온다. */
async function processGroup(
    deps: OutcomeLabellerDeps,
    group: DueGroup,
    timeoutMs: number
): Promise<RowCounts> {
    const groupLabel = `${group.symbol}:${group.timeframe}`;
    try {
        const rows = await deps.repo.listDueRows(
            group,
            deps.now(),
            ROWS_PER_GROUP_LIMIT
        );
        if (rows.length === 0) return ZERO_COUNTS;

        const loaded = await loadGroupBars(
            deps,
            group.symbol,
            group.timeframe,
            timeoutMs
        ).then(
            value => ({ ok: true as const, value }),
            error => ({ ok: false as const, error })
        );
        if (!loaded.ok) {
            console.error(
                `[analysis-outcomes] group failed ${groupLabel}`,
                redactDbErrorForLog(loaded.error)
            );
            const failure = await deps.repo.recordFailure(
                rows.map(row => row.analysisId),
                new Date(deps.now().getTime() + GROUP_FAILURE_RETRY_MS),
                MAX_GROUP_FAILURES,
                'load'
            );
            return {
                ...ZERO_COUNTS,
                groupFailures: 1,
                deferred: failure.deferred,
                unlabelable: failure.unlabelable,
            };
        }

        const { bars, session, timeframe } = loaded.value;
        // 형성 중 봉은 여기서 뗀다 — core는 받은 봉이 전부 닫혔다고 믿는다.
        const closed = closedBars(bars, timeframe, session, deps.now());
        return await rows.reduce<Promise<RowCounts>>(
            (previous, row) =>
                previous.then(async total =>
                    addCounts(
                        total,
                        await labelRow(deps, row, {
                            closed,
                            timeframe,
                            session,
                            groupLabel,
                        })
                    )
                ),
            Promise.resolve(ZERO_COUNTS)
        );
    } catch (error) {
        // 그룹 조회나 실패 기록 쓰기가 던진 경우. 행은 due로 남아 다음 tick이 다시 본다.
        console.error(
            `[analysis-outcomes] group failed ${groupLabel}`,
            redactDbErrorForLog(error)
        );
        return { ...ZERO_COUNTS, groupFailures: 1 };
    }
}

interface ChunkProgress extends RowCounts {
    groupsProcessed: number;
    deadlineHit: boolean;
}

/**
 * 그룹을 `BARS_CONCURRENCY`개씩 청크로 처리한다. 마감은 청크 **사이**에서 본다(CC-1, CC-5) — 시작한 청크는
 * 그룹당 타임아웃 안에 끝난다. 재귀인 이유는 청크가 순차이고 카운터를 변이 없이 누적하기 위해서다.
 */
async function processChunks(
    deps: OutcomeLabellerDeps,
    chunks: readonly DueGroup[][],
    index: number,
    timeoutMs: number,
    progress: ChunkProgress
): Promise<ChunkProgress> {
    const chunk = chunks[index];
    if (chunk === undefined) return progress;
    if (deps.isDeadlineReached()) return { ...progress, deadlineHit: true };
    const results = await Promise.all(
        chunk.map(group => processGroup(deps, group, timeoutMs))
    );
    return processChunks(deps, chunks, index + 1, timeoutMs, {
        ...results.reduce(addCounts, progress),
        groupsProcessed: progress.groupsProcessed + chunk.length,
        deadlineHit: false,
    });
}

async function labelStep(
    deps: OutcomeLabellerDeps,
    timeoutMs: number
): Promise<LabelResult> {
    const now = deps.now();
    const dueTotal = await deps.repo.countDueGroups(now);
    const groups = await deps.repo.listDueGroups(now, MAX_GROUPS_PER_RUN);
    const progress = await processChunks(
        deps,
        chunkOf(groups, BARS_CONCURRENCY),
        0,
        timeoutMs,
        { ...ZERO_COUNTS, groupsProcessed: 0, deadlineHit: false }
    );
    const groupsRemaining = Math.max(0, dueTotal - progress.groupsProcessed);
    return {
        labeled: progress.labeled,
        deferred: progress.deferred,
        unlabelable: progress.unlabelable,
        groupFailures: progress.groupFailures,
        rowFailures: progress.rowFailures,
        groupsProcessed: progress.groupsProcessed,
        groupsRemaining,
        stoppedBy: progress.deadlineHit
            ? 'deadline'
            : groupsRemaining > 0
              ? 'cap'
              : 'complete',
    };
}

/* ------------------------------------------------------------------ */
/* 3. relabel, 4. prune                                                 */
/* ------------------------------------------------------------------ */

/**
 * 재라벨. 던지는 행을 두 가지로 가른다: 라벨 함수가 던지면(저장된 입력이 깨졌다 — 같은 버전에서는 다시 해도
 * 같다) 그 행에 이 버전을 `relabel_failed_version`으로 적어 선택에서 빼고(`label_version`은 그대로라 낡은 라벨이
 * 낡았다는 사실이 남는다, 버전이 오르면 다시 시도한다), 쓰기가 던지면(일시 장애) 적지 않고 로그만 남겨 다음
 * 실행이 다시 본다.
 */
async function relabelStep(deps: OutcomeLabellerDeps): Promise<number> {
    const candidates = await deps.repo.listRelabelCandidates(
        OUTCOME_LABEL_VERSION,
        RELABEL_BATCH
    );
    // 저장된 subject + window만 쓴다 — 공급자 호출 없음.
    return candidates.reduce<Promise<number>>(
        (previous, candidate) =>
            previous.then(async total => {
                const computed = (() => {
                    try {
                        return {
                            ok: true as const,
                            labels: labelAnalysisOutcome(
                                candidate.subject,
                                candidate.window
                            ),
                        };
                    } catch (error) {
                        return { ok: false as const, error };
                    }
                })();
                try {
                    if (!computed.ok) {
                        console.error(
                            `[analysis-outcomes] relabel failed ${candidate.analysisId}`,
                            redactDbErrorForLog(computed.error)
                        );
                        await deps.repo.markRelabelFailed(
                            candidate.analysisId,
                            OUTCOME_LABEL_VERSION
                        );
                        return total;
                    }
                    const changed = await deps.repo.updateRelabel({
                        analysisId: candidate.analysisId,
                        fromVersion: candidate.labelVersion,
                        labels: computed.labels,
                        labelVersion: computed.labels.v,
                    });
                    return total + (changed ? 1 : 0);
                } catch (error) {
                    console.error(
                        `[analysis-outcomes] relabel failed ${candidate.analysisId}`,
                        redactDbErrorForLog(error)
                    );
                    return total;
                }
            }),
        Promise.resolve(0)
    );
}

async function pruneStep(deps: OutcomeLabellerDeps): Promise<number> {
    const cutoff = new Date(
        deps.now().getTime() - OUTCOME_RETENTION_DAYS * MS_PER_DAY
    );
    return deps.repo.pruneOlderThan(cutoff, PRUNE_BATCH);
}
