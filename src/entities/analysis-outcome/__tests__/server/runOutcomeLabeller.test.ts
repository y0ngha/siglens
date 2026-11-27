import {
    CRYPTO_SESSION,
    OUTCOME_LABEL_VERSION,
    US_EQUITY_SESSION,
    extractOutcomeSubject,
    labelAnalysisOutcome,
    outcomeEarliestLabelTime,
    type AnalysisOutcomeLabels,
    type Bar,
    type MarketSessionSpec,
    type OutcomeSubject,
} from '@y0ngha/siglens-core';
import {
    afterAll,
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
    type MockInstance,
} from 'vitest';
import {
    MS_PER_DAY,
    MS_PER_SECOND,
    SECONDS_PER_DAY,
} from '@/shared/config/time';
import {
    PLANTED_EMAIL,
    PLANTED_TOKEN,
    expectLogWithoutPlantedSecrets,
    plantedDbError,
} from '@/shared/test-utils/plantedDbError';
import {
    ANCHOR_MISSING_RETRY_MS,
    BARS_CONCURRENCY,
    CAPTURE_BACKLOG_WARN_DAYS,
    CAPTURE_BATCH,
    CAPTURE_CHUNK,
    GROUP_FAILURE_RETRY_MS,
    MAX_ANCHOR_MISSING_OBSERVATIONS,
    MAX_GROUPS_PER_RUN,
    MAX_GROUP_FAILURES,
    MAX_ROW_FAILURES,
    OUTCOME_RETENTION_DAYS,
    PRUNE_BATCH,
    RELABEL_BATCH,
    ROW_FAILURE_RETRY_MS,
    STALLED_RETRY_MS,
    STALL_GIVE_UP_MS,
} from '../../lib/outcomePolicy';
import { runOutcomeLabeller } from '../../server/runOutcomeLabeller';
import type { OutcomeLabellerDeps } from '../../types';
import { KR_EQUITY_SESSION } from '@/shared/api/market/sessionSpecFor';
import fixtures from '../fixtures/storedAnalyses.json';
import { FakeOutcomeRepo, type SeededHistory } from './fakeOutcomeRepo';

/**
 * `runOutcomeLabeller` with fake dependencies: an in-memory repository with the SQL repository's guard semantics,
 * a scripted bars loader and a fixed clock. Subjects come from core's real `extractOutcomeSubject` on a real stored
 * analysis (`fixtures/storedAnalyses.json`, origin stated in the file); only the bars are constructed.
 */

/** Tuesday 2026-12-15 07:00 UTC: Monday 12-14 is the last closed US session, 12-15 is a forming (not yet traded) bar. */
const NOW = new Date('2026-12-15T07:00:00Z');
const FIRST_BAR_DATE = '2026-09-01';

const utcSeconds = (isoDate: string): number =>
    Date.parse(`${isoDate}T00:00:00Z`) / MS_PER_SECOND;

/** A calendar-day series of daily bars (the labeller does not care about weekends), `FIRST_BAR_DATE`..`lastDate`. */
function dailyBars(lastDate: string): Bar[] {
    const first = utcSeconds(FIRST_BAR_DATE);
    const count = (utcSeconds(lastDate) - first) / SECONDS_PER_DAY + 1;
    return Array.from({ length: count }, (_, i) => {
        const close = 100 + (i % 7) * 0.5;
        return {
            time: first + i * SECONDS_PER_DAY,
            open: close,
            high: close + 1,
            low: close - 1,
            close,
            volume: 1,
        };
    });
}

/** Closed bars through Monday 12-14 plus the forming bar dated today. */
const BARS = dailyBars('2026-12-15');
const closeOn = (isoDate: string): number => {
    const bar = BARS.find(candidate => candidate.time === utcSeconds(isoDate));
    if (bar === undefined) throw new Error(`no bar ${isoDate}`);
    return bar.close;
};

const STORED = fixtures.analyses['AAPL-2025-02-19-21fa41a262fc'].result;

/**
 * The subject of the real stored analysis, anchored on `anchorDate` of the constructed bars. `anchorClose` defaults to
 * that bar's close so the price basis matches (factor 1).
 */
function subjectAnchoredOn(
    anchorDate: string | null,
    anchorClose?: number
): OutcomeSubject {
    const subject = extractOutcomeSubject(
        {
            ...STORED,
            dataAsOf:
                anchorDate === null
                    ? undefined
                    : {
                          barTime: utcSeconds(anchorDate),
                          close: anchorClose ?? closeOn(anchorDate),
                      },
        },
        null
    );
    if (subject === null) throw new Error('fixture subject is null');
    return subject;
}

/** Generated after that session's close (21:00 UTC), so the anchor bar was closed at analysis time. */
const generatedAfterClose = (isoDate: string): Date =>
    new Date(`${isoDate}T22:00:00Z`);

interface Harness {
    repo: FakeOutcomeRepo;
    deps: OutcomeLabellerDeps;
    loadGroupBars: MockInstance<OutcomeLabellerDeps['loadGroupBars']>;
    isDeadlineReached: MockInstance<() => boolean>;
    /** The run clock; set `clock.at` between runs to move time. */
    clock: { at: Date };
}

function harness(
    load: OutcomeLabellerDeps['loadGroupBars'] = async () => ({
        bars: BARS,
        session: US_EQUITY_SESSION,
    })
): Harness {
    const repo = new FakeOutcomeRepo();
    const loadGroupBars = vi.fn(load);
    const isDeadlineReached = vi.fn(() => false);
    const clock = { at: NOW };
    return {
        repo,
        loadGroupBars,
        isDeadlineReached,
        clock,
        deps: {
            repo,
            loadGroupBars,
            now: () => clock.at,
            isDeadlineReached,
        },
    };
}

/** A stored value the test just wrote; failing loudly beats a non-null assertion. */
function must<T>(value: T | null | undefined): T {
    if (value === null || value === undefined) {
        throw new Error('expected a value');
    }
    return value;
}

const loggedErrors = (spy: MockInstance): string[] =>
    spy.mock.calls.map(call => String(call[0]));

describe('runOutcomeLabeller', () => {
    const errorSpy = vi.spyOn(console, 'error');
    const warnSpy = vi.spyOn(console, 'warn');

    beforeEach(() => {
        errorSpy.mockImplementation(() => {});
        warnSpy.mockImplementation(() => {});
    });

    afterEach(() => {
        errorSpy.mockClear();
        warnSpy.mockClear();
    });

    afterAll(() => {
        errorSpy.mockRestore();
        warnSpy.mockRestore();
    });

    describe('label: window status ok', () => {
        it('labels the row from core and stores the labels, the window and the label version', async () => {
            const { repo, deps } = harness();
            const subject = subjectAnchoredOn('2026-11-10');
            repo.add({
                analysisId: 'a1',
                subject,
                generatedAt: generatedAfterClose('2026-11-10'),
            });

            const summary = await runOutcomeLabeller(deps);

            const row = repo.get('a1');
            expect(summary).toMatchObject({
                labeled: 1,
                deferred: 0,
                unlabelable: 0,
                groupsProcessed: 1,
                groupsRemaining: 0,
                stoppedBy: 'complete',
                failedSteps: [],
            });
            expect(row.status).toBe('labeled');
            expect(row.labelVersion).toBe(OUTCOME_LABEL_VERSION);
            expect(row.labeledAt).toEqual(NOW);
            expect(row.barsSnapshot?.forward).toHaveLength(20);
            expect(row.barsSnapshot?.anchorSource).toBe('prompt_bar');
            // The labels are core's output on the stored window, nothing recomputed here.
            expect(row.labels).toEqual(
                labelAnalysisOutcome(subject, must(row.barsSnapshot))
            );
            expect(row.labels?.anchorSource).toBe('prompt_bar');
        });

        it('keeps what a statistics query must filter on inside the stored labels JSON', async () => {
            const { repo, deps } = harness();
            repo.add({
                analysisId: 'a1',
                subject: subjectAnchoredOn('2026-11-10'),
                generatedAt: generatedAfterClose('2026-11-10'),
            });
            await runOutcomeLabeller(deps);

            const stored = JSON.parse(
                JSON.stringify(repo.get('a1').labels)
            ) as AnalysisOutcomeLabels;
            expect(stored.anchorSource).toBeDefined();
            expect(stored.plan.anchorBarUnobserved).toBeTypeOf('boolean');
            expect(stored.plan).toHaveProperty('recommendation');
            expect(stored.plan).toHaveProperty('target');
            expect(stored.patterns).toBeInstanceOf(Array);
        });

        it('a row with no stored anchor uses the generation-time fallback and the label says so', async () => {
            const { repo, deps } = harness();
            repo.add({
                analysisId: 'a1',
                subject: subjectAnchoredOn(null),
                generatedAt: new Date('2026-11-10T15:00:00Z'),
            });

            await runOutcomeLabeller(deps);

            const row = repo.get('a1');
            expect(row.status).toBe('labeled');
            expect(row.labels?.anchorSource).toBe('generated_at');
            expect(row.barsSnapshot?.anchorSource).toBe('generated_at');
        });

        it('cuts the forming bar before core: 19 closed forward bars plus a forming one is not enough', async () => {
            const { repo, deps } = harness();
            // Closed forward bars after 11-25 are 11-26..12-14 = 19; the forming 12-15 bar would make 20.
            repo.add({
                analysisId: 'a1',
                subject: subjectAnchoredOn('2026-11-25'),
                generatedAt: generatedAfterClose('2026-11-25'),
            });

            const summary = await runOutcomeLabeller(deps);

            expect(summary).toMatchObject({ labeled: 0, deferred: 1 });
            expect(repo.get('a1').status).toBe('pending');
            expect(repo.get('a1').forwardHave).toBe(19);
        });

        it('a lost race (another run already moved the row) counts nothing', async () => {
            const { repo, deps } = harness();
            repo.add({
                analysisId: 'a1',
                subject: subjectAnchoredOn('2026-11-10'),
                generatedAt: generatedAfterClose('2026-11-10'),
            });
            vi.spyOn(repo, 'markLabeled').mockResolvedValueOnce(false);

            const summary = await runOutcomeLabeller(deps);

            expect(summary.labeled).toBe(0);
            expect(summary.rowFailures).toBe(0);
        });

        it('a second run changes nothing (converges)', async () => {
            const { repo, deps, loadGroupBars } = harness();
            repo.add({
                analysisId: 'a1',
                subject: subjectAnchoredOn('2026-11-10'),
                generatedAt: generatedAfterClose('2026-11-10'),
            });
            await runOutcomeLabeller(deps);
            const afterFirst = structuredClone(repo.get('a1'));
            loadGroupBars.mockClear();

            const second = await runOutcomeLabeller(deps);

            expect(second).toMatchObject({
                labeled: 0,
                groupsProcessed: 0,
                relabeled: 0,
            });
            expect(loadGroupBars).not.toHaveBeenCalled();
            expect(repo.get('a1')).toEqual(afterFirst);
        });
    });

    describe('label: insufficient_forward and the stall rule', () => {
        // Anchor 11-30: closed forward bars 12-01..12-14 = 14 of 20.
        const stalledRow = (overrides: {
            forwardHave: number | null;
            stalledSince: Date | null;
        }) => ({
            analysisId: 'a1',
            subject: subjectAnchoredOn('2026-11-30'),
            generatedAt: generatedAfterClose('2026-11-30'),
            ...overrides,
        });

        it('defers by the missing bars at the bar length and records have', async () => {
            const { repo, deps } = harness();
            repo.add(stalledRow({ forwardHave: null, stalledSince: null }));

            const summary = await runOutcomeLabeller(deps);

            expect(summary).toMatchObject({ deferred: 1, labeled: 0 });
            expect(repo.get('a1')).toMatchObject({
                status: 'pending',
                forwardHave: 14,
                stalledSince: null,
                nextAttemptAt: new Date(NOW.getTime() + 6 * MS_PER_DAY),
            });
        });

        it('have grew since the last attempt: the stall marker is cleared', async () => {
            const { repo, deps } = harness();
            repo.add(
                stalledRow({
                    forwardHave: 10,
                    stalledSince: new Date(NOW.getTime() - 8 * MS_PER_DAY),
                })
            );

            await runOutcomeLabeller(deps);

            expect(repo.get('a1')).toMatchObject({
                status: 'pending',
                forwardHave: 14,
                stalledSince: null,
            });
        });

        it('have did not grow: starts the stall clock and retries in a day', async () => {
            const { repo, deps } = harness();
            repo.add(stalledRow({ forwardHave: 14, stalledSince: null }));

            await runOutcomeLabeller(deps);

            expect(repo.get('a1')).toMatchObject({
                status: 'pending',
                forwardHave: 14,
                stalledSince: NOW,
                nextAttemptAt: new Date(NOW.getTime() + STALLED_RETRY_MS),
            });
        });

        it('have has not grown for less than the limit: keeps waiting', async () => {
            const { repo, deps } = harness();
            const stalledSince = new Date(NOW.getTime() - STALL_GIVE_UP_MS + 1);
            repo.add(stalledRow({ forwardHave: 14, stalledSince }));

            const summary = await runOutcomeLabeller(deps);

            expect(summary).toMatchObject({ deferred: 1, unlabelable: 0 });
            expect(repo.get('a1')).toMatchObject({
                status: 'pending',
                stalledSince,
            });
        });

        it('have has not grown for the stall limit: gives up as forward_stalled', async () => {
            const { repo, deps } = harness();
            repo.add(
                stalledRow({
                    forwardHave: 14,
                    stalledSince: new Date(NOW.getTime() - STALL_GIVE_UP_MS),
                })
            );

            const summary = await runOutcomeLabeller(deps);

            expect(summary).toMatchObject({ unlabelable: 1, deferred: 0 });
            expect(repo.get('a1')).toMatchObject({
                status: 'unlabelable',
                skipReason: 'forward_stalled',
            });
        });
    });

    describe('label: anchor_missing and anchor_mismatch', () => {
        const missingAnchorRow = () => ({
            analysisId: 'a1',
            // A bar dated one hour after midnight does not exist in the series.
            subject: {
                ...subjectAnchoredOn('2026-11-10'),
                anchor: {
                    barTime: utcSeconds('2026-11-10') + 3600,
                    close: 100,
                },
            },
            generatedAt: generatedAfterClose('2026-11-10'),
        });

        it('anchor_missing: a first observation is retried a day later, not given up', async () => {
            const { repo, deps } = harness();
            repo.add(missingAnchorRow());

            const summary = await runOutcomeLabeller(deps);

            expect(summary).toMatchObject({ deferred: 1, unlabelable: 0 });
            expect(repo.get('a1')).toMatchObject({
                status: 'pending',
                anchorMissingSeen: 1,
                nextAttemptAt: new Date(
                    NOW.getTime() + ANCHOR_MISSING_RETRY_MS
                ),
            });
        });

        it('anchor_missing: gives up on the third observation, one day apart', async () => {
            const { repo, deps, clock } = harness();
            repo.add(missingAnchorRow());

            await runOutcomeLabeller(deps);
            clock.at = new Date(NOW.getTime() + ANCHOR_MISSING_RETRY_MS);
            const second = await runOutcomeLabeller(deps);
            expect(repo.get('a1').status).toBe('pending');
            clock.at = new Date(NOW.getTime() + 2 * ANCHOR_MISSING_RETRY_MS);
            const third = await runOutcomeLabeller(deps);

            expect(second).toMatchObject({ deferred: 1, unlabelable: 0 });
            expect(third).toMatchObject({ deferred: 0, unlabelable: 1 });
            expect(MAX_ANCHOR_MISSING_OBSERVATIONS).toBe(3);
            expect(repo.get('a1')).toMatchObject({
                status: 'unlabelable',
                skipReason: 'anchor_missing',
                anchorMissingSeen: 3,
            });
        });

        it('anchor_missing that heals on a later look is labelled (a one-day provider gap)', async () => {
            const gap = { present: false };
            const { repo, deps, clock } = harness(async () => ({
                bars: gap.present
                    ? BARS
                    : BARS.filter(bar => bar.time !== utcSeconds('2026-11-10')),
                session: US_EQUITY_SESSION,
            }));
            repo.add({
                analysisId: 'a1',
                subject: subjectAnchoredOn('2026-11-10'),
                generatedAt: generatedAfterClose('2026-11-10'),
            });

            await runOutcomeLabeller(deps);
            expect(repo.get('a1').status).toBe('pending');
            gap.present = true;
            clock.at = new Date(NOW.getTime() + ANCHOR_MISSING_RETRY_MS);
            await runOutcomeLabeller(deps);

            expect(repo.get('a1').status).toBe('labeled');
        });

        it('anchor_mismatch: the price basis of a closed anchor changed beyond any split factor', async () => {
            const { repo, deps } = harness();
            repo.add({
                analysisId: 'a1',
                subject: subjectAnchoredOn(
                    '2026-11-10',
                    closeOn('2026-11-10') * 1000
                ),
                generatedAt: generatedAfterClose('2026-11-10'),
            });

            const summary = await runOutcomeLabeller(deps);

            expect(summary.unlabelable).toBe(1);
            expect(repo.get('a1')).toMatchObject({
                status: 'unlabelable',
                skipReason: 'anchor_mismatch',
            });
            expect(warnSpy).toHaveBeenCalled();
            expect(repo.get('a1').labels).toBeNull();
        });
    });

    describe('label: group load failures', () => {
        it('a provider failure counts a load failure and retries in six hours', async () => {
            const { repo, deps } = harness(async () => {
                throw new Error('provider down');
            });
            repo.add({
                analysisId: 'a1',
                subject: subjectAnchoredOn('2026-11-10'),
                loadFailures: 2,
            });
            repo.add({
                analysisId: 'a2',
                symbol: 'MSFT',
                subject: subjectAnchoredOn('2026-11-10'),
            });

            const summary = await runOutcomeLabeller(deps);

            expect(summary).toMatchObject({
                groupFailures: 2,
                deferred: 2,
                labeled: 0,
                unlabelable: 0,
                groupsProcessed: 2,
            });
            expect(repo.get('a1')).toMatchObject({
                status: 'pending',
                loadFailures: 3,
                nextAttemptAt: new Date(NOW.getTime() + GROUP_FAILURE_RETRY_MS),
            });
            expect(loggedErrors(errorSpy)).toContain(
                '[analysis-outcomes] group failed AAPL:1Day'
            );
        });

        it('gives up as bars_unavailable at the failure limit', async () => {
            const { repo, deps } = harness(async () => {
                throw new Error('provider down');
            });
            repo.add({
                analysisId: 'a1',
                subject: subjectAnchoredOn('2026-11-10'),
                loadFailures: MAX_GROUP_FAILURES - 1,
            });

            const summary = await runOutcomeLabeller(deps);

            expect(summary).toMatchObject({
                groupFailures: 1,
                unlabelable: 1,
                deferred: 0,
            });
            expect(repo.get('a1')).toMatchObject({
                status: 'unlabelable',
                skipReason: 'bars_unavailable',
                loadFailures: MAX_GROUP_FAILURES,
            });
        });

        it('an empty bars array is a failure, not a permanent anchor_missing', async () => {
            const { repo, deps } = harness(async () => ({
                bars: [],
                session: US_EQUITY_SESSION,
            }));
            repo.add({
                analysisId: 'a1',
                subject: subjectAnchoredOn('2026-11-10'),
            });

            const summary = await runOutcomeLabeller(deps);

            expect(summary.groupFailures).toBe(1);
            expect(repo.get('a1')).toMatchObject({
                status: 'pending',
                loadFailures: 1,
                skipReason: null,
            });
        });

        it('a load that never settles times out and counts as a failure', async () => {
            const { repo, deps } = harness(() => new Promise(() => {}));
            repo.add({
                analysisId: 'a1',
                subject: subjectAnchoredOn('2026-11-10'),
            });

            const summary = await runOutcomeLabeller(deps, {
                groupTimeoutMs: 20,
            });

            expect(summary.groupFailures).toBe(1);
            expect(repo.get('a1').loadFailures).toBe(1);
        });

        it('an unsupported stored timeframe fails the group instead of calling the provider', async () => {
            const { repo, deps, loadGroupBars } = harness();
            repo.add({
                analysisId: 'a1',
                timeframe: '1Week',
                subject: subjectAnchoredOn('2026-11-10'),
            });

            const summary = await runOutcomeLabeller(deps);

            expect(summary.groupFailures).toBe(1);
            expect(loadGroupBars).not.toHaveBeenCalled();
        });

        it('a failing group does not stop the others', async () => {
            const { repo, deps } = harness(async symbol => {
                if (symbol === 'BAD') throw new Error('provider down');
                return { bars: BARS, session: US_EQUITY_SESSION };
            });
            repo.add({
                analysisId: 'bad',
                symbol: 'BAD',
                subject: subjectAnchoredOn('2026-11-10'),
                generatedAt: generatedAfterClose('2026-11-10'),
            });
            repo.add({
                analysisId: 'good',
                symbol: 'GOOD',
                subject: subjectAnchoredOn('2026-11-10'),
                generatedAt: generatedAfterClose('2026-11-10'),
            });

            const summary = await runOutcomeLabeller(deps);

            expect(summary).toMatchObject({ groupFailures: 1, labeled: 1 });
            expect(repo.get('good').status).toBe('labeled');
        });

        it('a database failure while reading a group counts as a failed group and the run goes on', async () => {
            const { repo, deps } = harness();
            repo.add({
                analysisId: 'a1',
                subject: subjectAnchoredOn('2026-11-10'),
            });
            vi.spyOn(repo, 'listDueRows').mockRejectedValueOnce(
                plantedDbError()
            );

            const summary = await runOutcomeLabeller(deps);

            expect(summary.groupFailures).toBe(1);
            expect(summary.failedSteps).toEqual([]);
            expectLogWithoutPlantedSecrets(errorSpy);
        });
    });

    describe('label: one row failing', () => {
        const twoRows = (repo: FakeOutcomeRepo) => {
            repo.add({
                analysisId: 'a1',
                subject: subjectAnchoredOn('2026-11-10'),
                generatedAt: generatedAfterClose('2026-11-10'),
                nextAttemptAt: new Date('2026-11-21T00:00:00Z'),
            });
            repo.add({
                analysisId: 'a2',
                subject: subjectAnchoredOn('2026-11-10'),
                generatedAt: generatedAfterClose('2026-11-10'),
                nextAttemptAt: new Date('2026-11-21T01:00:00Z'),
            });
        };

        it('does not block the rest of its group and is backed off by six hours', async () => {
            const { repo, deps } = harness();
            twoRows(repo);
            vi.spyOn(repo, 'markLabeled').mockRejectedValueOnce(
                plantedDbError()
            );

            const summary = await runOutcomeLabeller(deps);

            expect(summary).toMatchObject({ rowFailures: 1, labeled: 1 });
            expect(repo.get('a1')).toMatchObject({
                status: 'pending',
                rowErrors: 1,
                nextAttemptAt: new Date(NOW.getTime() + ROW_FAILURE_RETRY_MS),
            });
            expect(repo.get('a2').status).toBe('labeled');
            expect(loggedErrors(errorSpy)).toContain(
                '[analysis-outcomes] row failed a1'
            );
            expectLogWithoutPlantedSecrets(errorSpy);
        });

        it('a row that throws every run leaves the queue: the next run does not even load its group', async () => {
            const { repo, deps, loadGroupBars, clock } = harness();
            repo.add({
                analysisId: 'poison',
                subject: subjectAnchoredOn('2026-11-10'),
                generatedAt: generatedAfterClose('2026-11-10'),
            });
            vi.spyOn(repo, 'markLabeled').mockRejectedValue(new Error('bad'));

            await runOutcomeLabeller(deps);
            loadGroupBars.mockClear();
            const second = await runOutcomeLabeller(deps);

            expect(loadGroupBars).not.toHaveBeenCalled();
            expect(second).toMatchObject({
                groupsProcessed: 0,
                groupsRemaining: 0,
                stoppedBy: 'complete',
            });
            // Six hours later it is tried again, counted, and finally given up as label_error.
            const results = await Array.from(
                { length: MAX_ROW_FAILURES - 1 },
                (_, i) => i + 1
            ).reduce<Promise<unknown[]>>(async (previous, step) => {
                const before = await previous;
                clock.at = new Date(
                    NOW.getTime() + step * ROW_FAILURE_RETRY_MS
                );
                return [...before, await runOutcomeLabeller(deps)];
            }, Promise.resolve([]));

            expect(results).toHaveLength(MAX_ROW_FAILURES - 1);
            expect(repo.get('poison')).toMatchObject({
                status: 'unlabelable',
                skipReason: 'label_error',
                rowErrors: MAX_ROW_FAILURES,
            });
        });

        it('failing to record the failure is logged and does not stop the run', async () => {
            const { repo, deps } = harness();
            twoRows(repo);
            vi.spyOn(repo, 'markLabeled').mockRejectedValueOnce(new Error('x'));
            vi.spyOn(repo, 'recordFailure').mockRejectedValueOnce(
                plantedDbError()
            );

            const summary = await runOutcomeLabeller(deps);

            expect(summary).toMatchObject({ rowFailures: 1, labeled: 1 });
            expect(loggedErrors(errorSpy)).toContain(
                '[analysis-outcomes] row failure not recorded a1'
            );
            expectLogWithoutPlantedSecrets(errorSpy);
        });
    });

    describe('label: bounds', () => {
        it('loads bars once per (symbol, timeframe) group, not per row', async () => {
            const { repo, deps, loadGroupBars } = harness();
            ['a1', 'a2', 'a3'].forEach(analysisId =>
                repo.add({
                    analysisId,
                    subject: subjectAnchoredOn('2026-11-10'),
                    generatedAt: generatedAfterClose('2026-11-10'),
                })
            );
            repo.add({
                analysisId: 'b1',
                timeframe: '15Min',
                subject: subjectAnchoredOn('2026-11-10'),
            });

            await runOutcomeLabeller(deps);

            expect(loadGroupBars).toHaveBeenCalledTimes(2);
            expect(loadGroupBars).toHaveBeenCalledWith('AAPL', '1Day');
            expect(loadGroupBars).toHaveBeenCalledWith('AAPL', '15Min');
        });

        it('keeps at most BARS_CONCURRENCY loads in flight and does use that many', async () => {
            const inFlight = { now: 0, max: 0 };
            const { repo, deps } = harness(async () => {
                inFlight.now += 1;
                inFlight.max = Math.max(inFlight.max, inFlight.now);
                await new Promise(resolve => setTimeout(resolve, 5));
                inFlight.now -= 1;
                return { bars: BARS, session: US_EQUITY_SESSION };
            });
            Array.from({ length: 7 }, (_, i) =>
                repo.add({
                    analysisId: `a${i}`,
                    symbol: `S${i}`,
                    subject: subjectAnchoredOn('2026-11-10'),
                    generatedAt: generatedAfterClose('2026-11-10'),
                })
            );

            const summary = await runOutcomeLabeller(deps);

            expect(summary.groupsProcessed).toBe(7);
            expect(inFlight.max).toBe(BARS_CONCURRENCY);
        });

        it('stops at MAX_GROUPS_PER_RUN and reports what is left as a cap stop', async () => {
            const { repo, deps, loadGroupBars } = harness();
            Array.from({ length: MAX_GROUPS_PER_RUN + 5 }, (_, i) =>
                repo.add({
                    analysisId: `a${i}`,
                    symbol: `S${i}`,
                    subject: subjectAnchoredOn('2026-11-10'),
                    generatedAt: generatedAfterClose('2026-11-10'),
                })
            );

            const summary = await runOutcomeLabeller(deps);

            expect(summary).toMatchObject({
                labeled: MAX_GROUPS_PER_RUN,
                groupsProcessed: MAX_GROUPS_PER_RUN,
                groupsRemaining: 5,
                stoppedBy: 'cap',
            });
            expect(loadGroupBars).toHaveBeenCalledTimes(MAX_GROUPS_PER_RUN);
        });

        it('takes the group with the oldest due row first', async () => {
            const { repo, deps, loadGroupBars } = harness();
            repo.add({
                analysisId: 'late',
                symbol: 'LATE',
                subject: subjectAnchoredOn('2026-11-10'),
                nextAttemptAt: new Date('2026-12-10T00:00:00Z'),
            });
            repo.add({
                analysisId: 'early',
                symbol: 'EARLY',
                subject: subjectAnchoredOn('2026-11-10'),
                nextAttemptAt: new Date('2026-12-01T00:00:00Z'),
            });
            await runOutcomeLabeller(deps);

            expect(loadGroupBars.mock.calls.map(call => call[0])).toEqual([
                'EARLY',
                'LATE',
            ]);
        });

        it('does not start a new chunk once the deadline passed; the other steps still run', async () => {
            const { repo, deps, loadGroupBars, isDeadlineReached } = harness();
            Array.from({ length: 5 }, (_, i) =>
                repo.add({
                    analysisId: `a${i}`,
                    symbol: `S${i}`,
                    subject: subjectAnchoredOn('2026-11-10'),
                    generatedAt: generatedAfterClose('2026-11-10'),
                })
            );
            repo.add({
                analysisId: 'old',
                generatedAt: new Date(
                    NOW.getTime() - (OUTCOME_RETENTION_DAYS + 1) * MS_PER_DAY
                ),
                status: 'unlabelable',
            });
            // Capture finds nothing and checks once; the label step's first chunk check passes, every later one is
            // past the deadline.
            isDeadlineReached
                .mockReturnValueOnce(false)
                .mockReturnValueOnce(false)
                .mockReturnValue(true);

            const summary = await runOutcomeLabeller(deps);

            expect(loadGroupBars).toHaveBeenCalledTimes(BARS_CONCURRENCY);
            expect(summary).toMatchObject({
                groupsProcessed: BARS_CONCURRENCY,
                groupsRemaining: 5 - BARS_CONCURRENCY,
                labeled: BARS_CONCURRENCY,
                stoppedBy: 'deadline',
                // Prune is a bounded DB-only step: it runs even after the label step hit the deadline (CC-13).
                pruned: 1,
            });
        });

        it('a deadline already past before the first chunk loads nothing', async () => {
            const { repo, deps, loadGroupBars, isDeadlineReached } = harness();
            repo.add({
                analysisId: 'a1',
                subject: subjectAnchoredOn('2026-11-10'),
            });
            isDeadlineReached.mockReturnValue(true);

            const summary = await runOutcomeLabeller(deps);

            expect(loadGroupBars).not.toHaveBeenCalled();
            expect(summary).toMatchObject({
                groupsProcessed: 0,
                groupsRemaining: 1,
                stoppedBy: 'deadline',
            });
            expect(repo.get('a1').status).toBe('pending');
        });
    });

    describe('capture', () => {
        const GENERATED = new Date('2026-12-13T14:00:00Z');
        const candidate = (
            overrides: Partial<SeededHistory> = {}
        ): SeededHistory => ({
            analysisId: 'h1',
            symbol: 'AAPL',
            timeframe: '1Day',
            modelId: 'deepseek-v4.1-flash',
            tier: 'free',
            promptVersion: 'p34',
            generatedAt: GENERATED,
            result: {
                ...STORED,
                dataAsOf: { barTime: utcSeconds('2026-12-11'), close: 100 },
            },
            promptDynamic: null,
            ...overrides,
        });

        it('copies the subject and the columns and schedules the first attempt at the earliest label time', async () => {
            const { repo, deps } = harness();
            repo.seedHistory(candidate());

            const summary = await runOutcomeLabeller(deps);

            expect(summary).toMatchObject({
                captured: 1,
                capturedInvalid: 0,
                captureRemaining: 0,
            });
            expect(repo.get('h1')).toMatchObject({
                symbol: 'AAPL',
                timeframe: '1Day',
                status: 'pending',
                skipReason: null,
                loadFailures: 0,
                generatedAt: GENERATED,
                nextAttemptAt: outcomeEarliestLabelTime(GENERATED, '1Day'),
            });
            expect(repo.get('h1').subject).toEqual(
                extractOutcomeSubject(candidate().result, null)
            );
        });

        it('hands the stored prompt to core so levels get their Market Reference labels', async () => {
            const { repo, deps } = harness();
            const level = STORED.keyLevels.support[0].price;
            repo.seedHistory(
                candidate({
                    promptDynamic: `## Market Reference\n- ${level} (Test label; 1.2% away below)\n\n## Next\n`,
                })
            );

            await runOutcomeLabeller(deps);

            const subject = repo.get('h1').subject as OutcomeSubject;
            expect(
                subject.levels.find(entry => entry.price === level)?.refLabels
            ).toEqual(['Test label']);
        });

        it('an unreadable result becomes an unlabelable row so the anti-join stops returning it', async () => {
            const { repo, deps } = harness();
            repo.seedHistory(candidate({ result: { nothing: true } }));

            const summary = await runOutcomeLabeller(deps);

            expect(summary).toMatchObject({
                captured: 1,
                capturedInvalid: 1,
                captureRemaining: 0,
            });
            expect(repo.get('h1')).toMatchObject({
                status: 'unlabelable',
                skipReason: 'subject_invalid',
                subject: { invalid: true },
            });
        });

        it('an unknown stored timeframe is recorded as such without reading the result', async () => {
            const { repo, deps } = harness();
            repo.seedHistory(candidate({ timeframe: '1Month' }));

            await runOutcomeLabeller(deps);

            expect(repo.get('h1')).toMatchObject({
                status: 'unlabelable',
                skipReason: 'timeframe_unsupported',
            });
        });

        it('never captures a weekly (1Week) analysis: no row, and it is not counted as remaining', async () => {
            const { repo, deps } = harness();
            repo.seedHistory(
                candidate({ analysisId: 'weekly', timeframe: '1Week' }),
                candidate({ analysisId: 'daily', timeframe: '1Day' })
            );

            const summary = await runOutcomeLabeller(deps);

            expect(summary).toMatchObject({
                captured: 1,
                capturedInvalid: 0,
                captureRemaining: 0,
            });
            expect([...repo.rows.keys()]).toEqual(['daily']);
        });

        it('a result core throws on does not block the rest of the batch', async () => {
            const { repo, deps } = harness();
            const poison = Object.defineProperty({}, 'trend', {
                get() {
                    throw new Error('poison');
                },
                enumerable: true,
            });
            repo.seedHistory(
                candidate({ analysisId: 'poison', result: poison }),
                candidate({ analysisId: 'fine' })
            );

            const summary = await runOutcomeLabeller(deps);

            expect(summary).toMatchObject({ captured: 2, capturedInvalid: 1 });
            expect(repo.get('poison').skipReason).toBe('subject_invalid');
            expect(repo.get('fine').status).toBe('pending');
            expect(loggedErrors(errorSpy)).toContain(
                '[analysis-outcomes] subject extraction failed poison'
            );
        });

        it('reads only the last six days, oldest first, in chunks of CAPTURE_CHUNK', async () => {
            const { repo, deps } = harness();
            const list = vi.spyOn(repo, 'listCaptureCandidates');
            repo.seedHistory(
                candidate({
                    analysisId: 'old',
                    generatedAt: new Date(NOW.getTime() - 7 * MS_PER_DAY),
                })
            );

            const summary = await runOutcomeLabeller(deps);

            expect(list).toHaveBeenCalledWith(
                new Date(NOW.getTime() - 6 * MS_PER_DAY),
                CAPTURE_CHUNK
            );
            expect(summary.captured).toBe(0);
            expect(repo.rows.has('old')).toBe(false);
        });

        it('never captures a personalised analysis, nor a row from before the column existed (NULL)', async () => {
            const { repo, deps } = harness();
            repo.seedHistory(
                candidate({ analysisId: 'personal', personalized: true }),
                candidate({ analysisId: 'plain', personalized: false }),
                candidate({ analysisId: 'legacy', personalized: null })
            );

            const summary = await runOutcomeLabeller(deps);

            expect(summary).toMatchObject({
                captured: 1,
                captureRemaining: 0,
            });
            expect([...repo.rows.keys()]).toEqual(['plain']);
        });

        it('copies locale and input fingerprint from the history row', async () => {
            const { repo, deps } = harness();
            repo.seedHistory(
                candidate({ locale: 'ja', inputFingerprint: 'fp-1' })
            );

            await runOutcomeLabeller(deps);

            expect(repo.get('h1')).toMatchObject({
                locale: 'ja',
                inputFingerprint: 'fp-1',
            });
        });

        it('reads in chunks of CAPTURE_CHUNK up to CAPTURE_BATCH and reports what is left', async () => {
            const { repo, deps } = harness();
            const list = vi.spyOn(repo, 'listCaptureCandidates');
            repo.seedHistory(
                ...Array.from({ length: CAPTURE_BATCH + 5 }, (_, i) =>
                    candidate({
                        analysisId: `h${i}`,
                        generatedAt: new Date(GENERATED.getTime() + i * 1000),
                    })
                )
            );

            const summary = await runOutcomeLabeller(deps);

            expect(summary).toMatchObject({
                captured: CAPTURE_BATCH,
                captureRemaining: 5,
            });
            // Five chunk reads of 100, then the one-row probe for the backlog check is skipped (not old).
            expect(
                list.mock.calls.map(call => call[1]).filter(limit => limit > 1)
            ).toEqual(Array.from({ length: 5 }, () => CAPTURE_CHUNK));
        });

        it('stops reading chunks once the deadline passed', async () => {
            const { repo, deps, isDeadlineReached } = harness();
            repo.seedHistory(
                ...Array.from({ length: 250 }, (_, i) =>
                    candidate({
                        analysisId: `h${i}`,
                        generatedAt: new Date(GENERATED.getTime() + i * 1000),
                    })
                )
            );
            // Capture checks the deadline before each chunk: pass once, then past.
            isDeadlineReached.mockReturnValueOnce(false).mockReturnValue(true);

            const summary = await runOutcomeLabeller(deps);

            expect(summary).toMatchObject({
                captured: CAPTURE_CHUNK,
                captureRemaining: 250 - CAPTURE_CHUNK,
            });
        });

        describe('backlog warning', () => {
            const backlogLogged = () =>
                warnSpy.mock.calls.some(
                    call => call[0] === '[analysis-outcomes] capture backlog'
                );
            /** Nothing is captured (deadline already past) so the uncaptured oldest row is the one given. */
            const withOldest = async (generatedAt: Date) => {
                const { repo, deps, isDeadlineReached } = harness();
                isDeadlineReached.mockReturnValue(true);
                repo.seedHistory(
                    candidate({ analysisId: 'old', generatedAt }),
                    candidate({ analysisId: 'newer' })
                );
                await runOutcomeLabeller(deps);
            };

            it('warns with the count when the oldest uncaptured analysis is older than five days', async () => {
                await withOldest(
                    new Date(
                        NOW.getTime() -
                            CAPTURE_BACKLOG_WARN_DAYS * MS_PER_DAY -
                            1
                    )
                );

                expect(backlogLogged()).toBe(true);
                expect(warnSpy).toHaveBeenCalledWith(
                    '[analysis-outcomes] capture backlog',
                    expect.objectContaining({ count: 2 })
                );
            });

            it('does not warn at exactly five days', async () => {
                await withOldest(
                    new Date(
                        NOW.getTime() - CAPTURE_BACKLOG_WARN_DAYS * MS_PER_DAY
                    )
                );

                expect(backlogLogged()).toBe(false);
            });

            it('does not warn when nothing is left uncaptured', async () => {
                const { repo, deps } = harness();
                repo.seedHistory(
                    candidate({
                        generatedAt: new Date(NOW.getTime() - 5.5 * MS_PER_DAY),
                    })
                );

                await runOutcomeLabeller(deps);

                expect(backlogLogged()).toBe(false);
            });
        });

        it('is idempotent: a second run captures nothing new', async () => {
            const { repo, deps } = harness();
            repo.seedHistory(candidate());
            await runOutcomeLabeller(deps);

            const second = await runOutcomeLabeller(deps);

            expect(second).toMatchObject({ captured: 0, captureRemaining: 0 });
        });
    });

    describe('relabel', () => {
        it('recomputes labels of an older label version from the stored subject and window, with no provider call', async () => {
            const { repo, deps, loadGroupBars } = harness();
            const subject = subjectAnchoredOn('2026-11-10');
            repo.add({
                analysisId: 'a1',
                subject,
                generatedAt: generatedAfterClose('2026-11-10'),
            });
            await runOutcomeLabeller(deps);
            const labeled = repo.get('a1');
            // A row labelled under an older definition: stale labels, the stored window is intact.
            repo.rows.set('a1', {
                ...labeled,
                labelVersion: 0,
                labels: { ...must(labeled.labels), atr: -1 },
            });
            loadGroupBars.mockClear();

            const summary = await runOutcomeLabeller(deps);

            expect(summary).toMatchObject({ relabeled: 1, labeled: 0 });
            expect(loadGroupBars).not.toHaveBeenCalled();
            expect(repo.get('a1').labelVersion).toBe(OUTCOME_LABEL_VERSION);
            expect(repo.get('a1').labels).toEqual(
                labelAnalysisOutcome(subject, must(labeled.barsSnapshot))
            );
        });

        it('leaves rows at the current version alone', async () => {
            const { repo, deps } = harness();
            repo.add({
                analysisId: 'a1',
                subject: subjectAnchoredOn('2026-11-10'),
                generatedAt: generatedAfterClose('2026-11-10'),
            });
            await runOutcomeLabeller(deps);
            const update = vi.spyOn(repo, 'updateRelabel');

            const summary = await runOutcomeLabeller(deps);

            expect(summary.relabeled).toBe(0);
            expect(update).not.toHaveBeenCalled();
        });

        it('asks for at most RELABEL_BATCH rows below the current version', async () => {
            const { deps, repo } = harness();
            const list = vi.spyOn(repo, 'listRelabelCandidates');

            await runOutcomeLabeller(deps);

            expect(list).toHaveBeenCalledWith(
                OUTCOME_LABEL_VERSION,
                RELABEL_BATCH
            );
        });

        describe('a row whose stored input makes the label function throw', () => {
            /** A labeled row of an older version whose stored window is broken. */
            const brokenRow = async (extra: {
                relabelFailedVersion?: number;
            }) => {
                const { repo, deps } = harness();
                repo.add({
                    analysisId: 'broken',
                    status: 'labeled',
                    subject: subjectAnchoredOn('2026-11-10'),
                    labelVersion: 0,
                    labels: null,
                    barsSnapshot: {} as never,
                    ...extra,
                });
                repo.add({
                    analysisId: 'fine',
                    subject: subjectAnchoredOn('2026-11-10'),
                    generatedAt: generatedAfterClose('2026-11-10'),
                });
                return { repo, deps };
            };

            it('is marked at the current version and not selected again on the next run', async () => {
                const { repo, deps } = await brokenRow({});
                const select = vi.spyOn(repo, 'listRelabelCandidates');

                const first = await runOutcomeLabeller(deps);
                const second = await runOutcomeLabeller(deps);

                expect(first.relabeled).toBe(0);
                expect(repo.get('broken')).toMatchObject({
                    relabelFailedVersion: OUTCOME_LABEL_VERSION,
                    labelVersion: 0,
                    status: 'labeled',
                });
                expect(
                    loggedErrors(errorSpy).filter(
                        m => m === '[analysis-outcomes] relabel failed broken'
                    )
                ).toHaveLength(1);
                // The second selection came back empty for that row, so nothing was recomputed or logged again.
                const secondSelection = await select.mock.results[1]?.value;
                expect(secondSelection).toEqual([]);
                expect(second.relabeled).toBe(0);
            });

            it('is tried again once the label version has moved past the marker', async () => {
                const { repo, deps } = await brokenRow({
                    relabelFailedVersion: OUTCOME_LABEL_VERSION - 1,
                });

                await runOutcomeLabeller(deps);

                expect(loggedErrors(errorSpy)).toContain(
                    '[analysis-outcomes] relabel failed broken'
                );
                expect(repo.get('broken').relabelFailedVersion).toBe(
                    OUTCOME_LABEL_VERSION
                );
            });

            it('does not stop the good rows behind it', async () => {
                const { repo, deps } = await brokenRow({});
                await runOutcomeLabeller(deps);
                repo.rows.set('fine', { ...repo.get('fine'), labelVersion: 0 });

                const summary = await runOutcomeLabeller(deps);

                expect(summary.relabeled).toBe(1);
            });
        });

        it('a failing relabel write is logged but not marked, so the next run tries it again', async () => {
            const { repo, deps } = harness();
            repo.add({
                analysisId: 'a1',
                subject: subjectAnchoredOn('2026-11-10'),
                generatedAt: generatedAfterClose('2026-11-10'),
            });
            await runOutcomeLabeller(deps);
            repo.rows.set('a1', { ...repo.get('a1'), labelVersion: 0 });
            vi.spyOn(repo, 'updateRelabel').mockRejectedValueOnce(
                new Error('write failed')
            );

            const first = await runOutcomeLabeller(deps);
            const second = await runOutcomeLabeller(deps);

            expect(first.relabeled).toBe(0);
            expect(repo.get('a1').relabelFailedVersion).toBeNull();
            expect(second.relabeled).toBe(1);
        });
    });

    describe('prune', () => {
        it('deletes rows older than the retention by generated_at, capped per run', async () => {
            const { repo, deps } = harness();
            const prune = vi.spyOn(repo, 'pruneOlderThan');
            repo.add({
                analysisId: 'old',
                status: 'labeled',
                generatedAt: new Date(
                    NOW.getTime() - (OUTCOME_RETENTION_DAYS + 1) * MS_PER_DAY
                ),
            });
            repo.add({
                analysisId: 'kept',
                status: 'labeled',
                generatedAt: new Date(
                    NOW.getTime() - (OUTCOME_RETENTION_DAYS - 1) * MS_PER_DAY
                ),
            });

            const summary = await runOutcomeLabeller(deps);

            expect(prune).toHaveBeenCalledWith(
                new Date(NOW.getTime() - OUTCOME_RETENTION_DAYS * MS_PER_DAY),
                PRUNE_BATCH
            );
            expect(summary.pruned).toBe(1);
            expect(repo.rows.has('old')).toBe(false);
            expect(repo.rows.has('kept')).toBe(true);
        });
    });

    describe('step isolation', () => {
        type StepName = 'capture' | 'label' | 'relabel' | 'prune';
        type FailStep = (repo: FakeOutcomeRepo, error: Error) => unknown;

        const cases: ReadonlyArray<readonly [StepName, FailStep]> = [
            [
                'capture',
                (repo, error) =>
                    vi
                        .spyOn(repo, 'listCaptureCandidates')
                        .mockRejectedValueOnce(error),
            ],
            [
                'label',
                (repo, error) =>
                    vi
                        .spyOn(repo, 'countDueGroups')
                        .mockRejectedValueOnce(error),
            ],
            [
                'relabel',
                (repo, error) =>
                    vi
                        .spyOn(repo, 'listRelabelCandidates')
                        .mockRejectedValueOnce(error),
            ],
            [
                'prune',
                (repo, error) =>
                    vi
                        .spyOn(repo, 'pruneOlderThan')
                        .mockRejectedValueOnce(error),
            ],
        ];

        /** One observable effect per step, so "the others still ran" is a state check, not a call count. */
        async function seeded() {
            const { repo, deps } = harness();
            // relabel: a row labelled under an older definition.
            repo.add({
                analysisId: 'stale',
                subject: subjectAnchoredOn('2026-11-10'),
                generatedAt: generatedAfterClose('2026-11-10'),
            });
            await runOutcomeLabeller(deps);
            repo.rows.set('stale', { ...repo.get('stale'), labelVersion: 0 });
            // label: a due pending row.
            repo.add({
                analysisId: 'due',
                symbol: 'MSFT',
                subject: subjectAnchoredOn('2026-11-10'),
                generatedAt: generatedAfterClose('2026-11-10'),
            });
            // prune: a row past retention.
            repo.add({
                analysisId: 'ancient',
                status: 'labeled',
                generatedAt: new Date(
                    NOW.getTime() - (OUTCOME_RETENTION_DAYS + 1) * MS_PER_DAY
                ),
            });
            // capture: an analysis not captured yet.
            repo.seedHistory({
                analysisId: 'fresh',
                symbol: 'AAPL',
                timeframe: '1Day',
                modelId: 'm',
                tier: null,
                promptVersion: null,
                generatedAt: new Date(NOW.getTime() - MS_PER_DAY),
                result: STORED,
                promptDynamic: null,
            });
            errorSpy.mockClear();
            return { repo, deps };
        }

        const EFFECT: Record<StepName, (repo: FakeOutcomeRepo) => boolean> = {
            capture: repo => repo.rows.has('fresh'),
            label: repo => repo.get('due').status === 'labeled',
            relabel: repo =>
                repo.get('stale').labelVersion === OUTCOME_LABEL_VERSION,
            prune: repo => !repo.rows.has('ancient'),
        };

        it('with nothing failing every step has its effect (control)', async () => {
            const { repo, deps } = await seeded();

            const summary = await runOutcomeLabeller(deps);

            expect(summary.failedSteps).toEqual([]);
            expect(Object.values(EFFECT).map(has => has(repo))).toEqual([
                true,
                true,
                true,
                true,
            ]);
        });

        it.each(cases)(
            'a failure in the %s step is logged redacted and every other step still runs',
            async (step, failStep) => {
                const { repo, deps } = await seeded();
                failStep(repo, plantedDbError());

                const summary = await runOutcomeLabeller(deps);

                expect(summary.failedSteps).toEqual([step]);
                expect(loggedErrors(errorSpy)).toContain(
                    `[analysis-outcomes] step failed: ${step}`
                );
                expectLogWithoutPlantedSecrets(errorSpy);
                expect(
                    (Object.keys(EFFECT) as StepName[]).map(name => [
                        name,
                        EFFECT[name](repo),
                    ])
                ).toEqual(
                    (Object.keys(EFFECT) as StepName[]).map(name => [
                        name,
                        name !== step,
                    ])
                );
            }
        );

        it('a failed step leaves its counters at zero and the summary still has every field', async () => {
            const { repo, deps } = harness();
            vi.spyOn(repo, 'listCaptureCandidates').mockRejectedValueOnce(
                new Error(`boom ${PLANTED_TOKEN} ${PLANTED_EMAIL}`)
            );

            const summary = await runOutcomeLabeller(deps);

            expect(summary).toEqual({
                captured: 0,
                capturedInvalid: 0,
                captureRemaining: 0,
                labeled: 0,
                deferred: 0,
                unlabelable: 0,
                groupFailures: 0,
                rowFailures: 0,
                groupsProcessed: 0,
                groupsRemaining: 0,
                relabeled: 0,
                pruned: 0,
                stoppedBy: 'complete',
                failedSteps: ['capture'],
            });
        });
    });

    describe('failure counters are separate (each kind keeps its own limit)', () => {
        const failLoad = async () => {
            throw new Error('provider down');
        };
        const missingAnchor = (extra: object) => ({
            analysisId: 'a1',
            subject: {
                ...subjectAnchoredOn('2026-11-10'),
                anchor: {
                    barTime: utcSeconds('2026-11-10') + 3600,
                    close: 100,
                },
            },
            generatedAt: generatedAfterClose('2026-11-10'),
            ...extra,
        });

        it('a two-day provider outage followed by the first anchor_missing does not give up', async () => {
            const { repo, deps } = harness();
            repo.add(missingAnchor({ loadFailures: 2 }));

            const summary = await runOutcomeLabeller(deps);

            expect(summary).toMatchObject({ deferred: 1, unlabelable: 0 });
            expect(repo.get('a1')).toMatchObject({
                status: 'pending',
                loadFailures: 2,
                anchorMissingSeen: 1,
            });
        });

        it('four load failures followed by one throw is a first row error, not label_error', async () => {
            const { repo, deps } = harness();
            repo.add({
                analysisId: 'a1',
                subject: subjectAnchoredOn('2026-11-10'),
                generatedAt: generatedAfterClose('2026-11-10'),
                loadFailures: 4,
            });
            vi.spyOn(repo, 'markLabeled').mockRejectedValueOnce(
                new Error('bad')
            );

            await runOutcomeLabeller(deps);

            expect(repo.get('a1')).toMatchObject({
                status: 'pending',
                loadFailures: 4,
                rowErrors: 1,
                skipReason: null,
            });
        });

        it('each kind ends with its own reason once its own limit is reached, whatever the others hold', async () => {
            const { repo, deps } = harness();
            // Seven load failures (one short), four row errors (one short), two missing-anchor looks (one short).
            repo.add({
                analysisId: 'load',
                symbol: 'LOAD',
                subject: subjectAnchoredOn('2026-11-10'),
                loadFailures: MAX_GROUP_FAILURES - 1,
                rowErrors: MAX_ROW_FAILURES - 1,
                anchorMissingSeen: MAX_ANCHOR_MISSING_OBSERVATIONS - 1,
            });
            repo.add({
                ...missingAnchor({
                    loadFailures: MAX_GROUP_FAILURES - 1,
                    rowErrors: MAX_ROW_FAILURES - 1,
                    anchorMissingSeen: MAX_ANCHOR_MISSING_OBSERVATIONS - 1,
                }),
                analysisId: 'anchor',
                symbol: 'ANCHOR',
            });
            repo.add({
                analysisId: 'row',
                symbol: 'ROW',
                subject: subjectAnchoredOn('2026-11-10'),
                generatedAt: generatedAfterClose('2026-11-10'),
                loadFailures: MAX_GROUP_FAILURES - 1,
                rowErrors: MAX_ROW_FAILURES - 1,
                anchorMissingSeen: MAX_ANCHOR_MISSING_OBSERVATIONS - 1,
            });
            vi.spyOn(repo, 'markLabeled').mockRejectedValue(new Error('bad'));
            const loads = vi.fn(async (symbol: string) => {
                if (symbol === 'LOAD') return failLoad();
                return { bars: BARS, session: US_EQUITY_SESSION };
            });

            await runOutcomeLabeller({ ...deps, loadGroupBars: loads });

            expect(repo.get('load')).toMatchObject({
                status: 'unlabelable',
                skipReason: 'bars_unavailable',
            });
            expect(repo.get('anchor')).toMatchObject({
                status: 'unlabelable',
                skipReason: 'anchor_missing',
            });
            expect(repo.get('row')).toMatchObject({
                status: 'unlabelable',
                skipReason: 'label_error',
            });
        });

        it('one short of its own limit a kind does not give up even with the other counters at their limits', async () => {
            const { repo, deps } = harness(failLoad);
            repo.add({
                analysisId: 'a1',
                subject: subjectAnchoredOn('2026-11-10'),
                loadFailures: MAX_GROUP_FAILURES - 2,
                rowErrors: MAX_ROW_FAILURES,
                anchorMissingSeen: MAX_ANCHOR_MISSING_OBSERVATIONS,
            });

            await runOutcomeLabeller(deps);

            expect(repo.get('a1')).toMatchObject({
                status: 'pending',
                loadFailures: MAX_GROUP_FAILURES - 1,
            });
        });
    });

    describe('anchor close basis: decided in the label step, never in capture', () => {
        /** A row anchored on 2026-11-10 (a Tuesday), generated at `generated`, labelled in a group of `session`. */
        const labelledBasis = async (
            generated: string,
            options: {
                session?: MarketSessionSpec;
                timeframe?: string;
                noAnchor?: boolean;
            } = {}
        ) => {
            const session = options.session ?? US_EQUITY_SESSION;
            const { repo, deps } = harness(async () => ({
                bars: BARS,
                session,
            }));
            repo.add({
                analysisId: 'a1',
                timeframe: options.timeframe ?? '1Day',
                subject: subjectAnchoredOn(
                    options.noAnchor ? null : '2026-11-10'
                ),
                generatedAt: new Date(generated),
            });
            await runOutcomeLabeller(deps);
            return repo.get('a1');
        };

        it('US 21:30Z after the close, before the EOD roll: closed + after_close_quote', async () => {
            const row = await labelledBasis('2026-11-10T21:30:00Z');

            expect(row).toMatchObject({
                status: 'labeled',
                anchorCloseBasis: 'after_close_quote',
            });
            expect(row.barsSnapshot).toMatchObject({ anchorForming: false });
        });

        it('US 01:30Z the next day: closed + eod_published', async () => {
            const row = await labelledBasis('2026-11-11T01:30:00Z');

            expect(row).toMatchObject({
                status: 'labeled',
                anchorCloseBasis: 'eod_published',
            });
            expect(row.barsSnapshot).toMatchObject({ anchorForming: false });
        });

        it('US during the session: the anchor was forming and there is no basis', async () => {
            const row = await labelledBasis('2026-11-10T15:00:00Z');

            expect(row).toMatchObject({
                status: 'labeled',
                anchorCloseBasis: null,
            });
            expect(row.barsSnapshot).toMatchObject({ anchorForming: true });
        });

        it('KR 06:45Z: after_close_quote', async () => {
            expect(
                (
                    await labelledBasis('2026-11-10T06:45:00Z', {
                        session: KR_EQUITY_SESSION,
                    })
                ).anchorCloseBasis
            ).toBe('after_close_quote');
        });

        it('crypto just after 00:00Z: eod_published', async () => {
            expect(
                (
                    await labelledBasis('2026-11-11T00:00:30Z', {
                        session: CRYPTO_SESSION,
                    })
                ).anchorCloseBasis
            ).toBe('eod_published');
        });

        it('intraday rows and rows without a subject anchor have no basis', async () => {
            expect(
                (
                    await labelledBasis('2026-11-10T21:30:00Z', {
                        timeframe: '15Min',
                    })
                ).anchorCloseBasis
            ).toBeNull();
            expect(
                (
                    await labelledBasis('2026-11-10T21:30:00Z', {
                        noAnchor: true,
                    })
                ).anchorCloseBasis
            ).toBeNull();
        });

        it('is also written for the unlabelable endings that evaluated the window (anchor_mismatch, forward_stalled)', async () => {
            const { repo, deps } = harness();
            repo.add({
                analysisId: 'mismatch',
                symbol: 'MIS',
                subject: subjectAnchoredOn(
                    '2026-11-10',
                    closeOn('2026-11-10') * 1000
                ),
                generatedAt: new Date('2026-11-11T01:30:00Z'),
            });
            repo.add({
                analysisId: 'stalled',
                symbol: 'STALL',
                subject: subjectAnchoredOn('2026-11-30'),
                generatedAt: new Date('2026-11-30T21:30:00Z'),
                forwardHave: 14,
                stalledSince: new Date(NOW.getTime() - STALL_GIVE_UP_MS),
            });

            await runOutcomeLabeller(deps);

            expect(repo.get('mismatch')).toMatchObject({
                skipReason: 'anchor_mismatch',
                anchorCloseBasis: 'eod_published',
            });
            expect(repo.get('stalled')).toMatchObject({
                skipReason: 'forward_stalled',
                anchorCloseBasis: 'after_close_quote',
            });
        });

        it('stays NULL for endings that never evaluated the window (anchor_missing, load failures)', async () => {
            const { repo, deps } = harness();
            repo.add({
                analysisId: 'missing',
                symbol: 'MISS',
                subject: {
                    ...subjectAnchoredOn('2026-11-10'),
                    anchor: {
                        barTime: utcSeconds('2026-11-10') + 3600,
                        close: 100,
                    },
                },
                generatedAt: new Date('2026-11-11T01:30:00Z'),
                anchorMissingSeen: MAX_ANCHOR_MISSING_OBSERVATIONS - 1,
            });

            await runOutcomeLabeller(deps);

            expect(repo.get('missing').skipReason).toBe('anchor_missing');
            expect(repo.get('missing').anchorCloseBasis ?? null).toBeNull();
        });

        it('capture does no session or asset lookup and leaves the basis unset', async () => {
            const { repo, deps, loadGroupBars } = harness();
            repo.seedHistory({
                analysisId: 'h1',
                symbol: 'AAPL',
                timeframe: '1Day',
                modelId: 'm',
                tier: 'free',
                promptVersion: 'p',
                generatedAt: new Date('2026-12-12T01:30:00Z'),
                result: {
                    ...STORED,
                    dataAsOf: { barTime: utcSeconds('2026-12-11'), close: 100 },
                },
                promptDynamic: null,
            });

            const summary = await runOutcomeLabeller(deps);

            expect(summary.captured).toBe(1);
            // The only collaborators capture has are the repository and the clock; no lookup dependency exists.
            expect(Object.keys(deps).toSorted()).toEqual([
                'isDeadlineReached',
                'loadGroupBars',
                'now',
                'repo',
            ]);
            expect(loadGroupBars).not.toHaveBeenCalled();
            expect(repo.get('h1').anchorCloseBasis).toBeUndefined();
        });

        it('a relabel does not change the basis', async () => {
            const { repo, deps } = harness();
            repo.add({
                analysisId: 'a1',
                subject: subjectAnchoredOn('2026-11-10'),
                generatedAt: new Date('2026-11-10T21:30:00Z'),
            });
            await runOutcomeLabeller(deps);
            repo.rows.set('a1', { ...repo.get('a1'), labelVersion: 0 });

            const summary = await runOutcomeLabeller(deps);

            expect(summary.relabeled).toBe(1);
            expect(repo.get('a1').anchorCloseBasis).toBe('after_close_quote');
        });
    });
});
