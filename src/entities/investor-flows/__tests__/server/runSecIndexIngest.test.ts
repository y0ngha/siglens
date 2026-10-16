import { describe, expect, it, vi } from 'vitest';
import { INVESTOR_FLOWS_STATE_SEC_FILINGS_CURSOR } from '../../lib/investorFlowsPolicy';
import {
    hasSecFilingsBacklog,
    rememberRecentIndexes,
    runSecIndexIngest,
    SEC_FILINGS_BACKLOG_BUDGET_SHARE,
    SEC_FILINGS_MIN_BUDGET_MS,
    type SecIndexIngestSteps,
} from '../../server/runSecIndexIngest';
import type { Ingest13fResult } from '../../server/ingest13f';
import type { IngestSecFilingsResult } from '../../server/ingestSecFilings';

const thirteenF = (stoppedBy: Ingest13fResult['stoppedBy']) =>
    ({ stoppedBy }) as Ingest13fResult;
const filings = { stoppedBy: 'complete' } as IngestSecFilingsResult;
const DEADLINE_MS = 600_000;

/**
 * A manual clock: each step advances it by its own duration, and records whether its deadline callback had fired at the
 * moments the test probes.
 */
function clockedSteps(options: {
    backlog: boolean;
    thirteenFStop?: Ingest13fResult['stoppedBy'];
    thirteenFRunsMs: number;
    probeOffsetsMs?: readonly number[];
}) {
    let nowMs = 1_000;
    const probes = { thirteenF: [] as boolean[], filings: [] as boolean[] };
    const probe = (deadline: () => boolean, into: boolean[]) => {
        const at = nowMs;
        for (const offset of options.probeOffsetsMs ?? []) {
            nowMs = at + offset;
            into.push(deadline());
        }
        nowMs = at;
    };
    const runFilings = vi.fn(async (deadline: () => boolean) => {
        probe(deadline, probes.filings);
        return filings;
    });
    const steps: SecIndexIngestSteps = {
        deadlineMs: DEADLINE_MS,
        now: () => nowMs,
        hasFilingsBacklog: async () => options.backlog,
        run13f: async deadline => {
            probe(deadline, probes.thirteenF);
            nowMs += options.thirteenFRunsMs;
            return thirteenF(options.thirteenFStop ?? 'deadline');
        },
        runFilings,
    };
    return { steps, probes, runFilings };
}

describe('runSecIndexIngest — steps', () => {
    it('runs the filings step after a complete 13F run', async () => {
        const { steps, runFilings } = clockedSteps({
            backlog: false,
            thirteenFStop: 'complete',
            thirteenFRunsMs: 1_000,
        });
        expect(await runSecIndexIngest(steps)).toEqual({
            thirteenF: { stoppedBy: 'complete' },
            filings,
        });
        expect(runFilings).toHaveBeenCalledTimes(1);
    });

    it('still runs the filings step when 13F stopped at its deadline', async () => {
        const { steps, runFilings } = clockedSteps({
            backlog: true,
            thirteenFRunsMs: DEADLINE_MS,
        });
        expect((await runSecIndexIngest(steps)).filings).toBe(filings);
        expect(runFilings).toHaveBeenCalledTimes(1);
    });

    it.each(['sec_blocked', 'universe_incomplete', 'empty_universe'] as const)(
        'skips the filings step when 13F stopped with %s',
        async stoppedBy => {
            const { steps, runFilings } = clockedSteps({
                backlog: true,
                thirteenFStop: stoppedBy,
                thirteenFRunsMs: 1_000,
            });
            expect(await runSecIndexIngest(steps)).toEqual({
                thirteenF: { stoppedBy },
                filings: { skipped: stoppedBy },
            });
            expect(runFilings).not.toHaveBeenCalled();
        }
    );
});

describe('runSecIndexIngest — budget split', () => {
    const backlogReserve = DEADLINE_MS * SEC_FILINGS_BACKLOG_BUDGET_SHARE;

    it('with a filings backlog, 13F stops at the run deadline minus the filings share', async () => {
        const { steps, probes } = clockedSteps({
            backlog: true,
            thirteenFRunsMs: 0,
            probeOffsetsMs: [
                DEADLINE_MS - backlogReserve - 1,
                DEADLINE_MS - backlogReserve,
            ],
        });
        await runSecIndexIngest(steps);
        expect(probes.thirteenF).toEqual([false, true]);
    });

    it('without a backlog, 13F keeps all but the minimum filings budget', async () => {
        const { steps, probes } = clockedSteps({
            backlog: false,
            thirteenFRunsMs: 0,
            probeOffsetsMs: [
                DEADLINE_MS - SEC_FILINGS_MIN_BUDGET_MS - 1,
                DEADLINE_MS - SEC_FILINGS_MIN_BUDGET_MS,
            ],
        });
        await runSecIndexIngest(steps);
        expect(probes.thirteenF).toEqual([false, true]);
    });

    it('when 13F finishes early, the filings step may use the rest of the run deadline', async () => {
        const { steps, probes } = clockedSteps({
            backlog: true,
            thirteenFStop: 'complete',
            thirteenFRunsMs: 60_000,
            // filings start at +60s; the run deadline is +600s
            probeOffsetsMs: [DEADLINE_MS - 60_000 - 1, DEADLINE_MS - 60_000],
        });
        await runSecIndexIngest(steps);
        expect(probes.filings).toEqual([false, true]);
    });

    it('when 13F overruns the run deadline, the filings step still gets its own share', async () => {
        const { steps, probes } = clockedSteps({
            backlog: true,
            thirteenFRunsMs: DEADLINE_MS + 120_000,
            probeOffsetsMs: [backlogReserve - 1, backlogReserve],
        });
        await runSecIndexIngest(steps);
        expect(probes.filings).toEqual([false, true]);
    });
});

describe('hasSecFilingsBacklog', () => {
    const now = () => new Date('2026-10-16T12:00:00Z');

    it.each([
        [null, true],
        ['2026-04-20', true],
        ['2026-10-15', false],
    ])('cursor %j → backlog %s', async (cursor, expected) => {
        const getState = vi.fn(async () => cursor);
        expect(
            await hasSecFilingsBacklog({
                repo: { getState },
                now,
                log: vi.fn(),
            })
        ).toBe(expected);
        expect(getState).toHaveBeenCalledWith(
            INVESTOR_FLOWS_STATE_SEC_FILINGS_CURSOR
        );
    });

    it('assumes a backlog and logs when the cursor cannot be read', async () => {
        const log = vi.fn();
        expect(
            await hasSecFilingsBacklog({
                repo: {
                    getState: async () => {
                        throw new Error('db down');
                    },
                },
                now,
                log,
            })
        ).toBe(true);
        expect(log).toHaveBeenCalledWith(
            expect.stringContaining('could not read the filings cursor'),
            'db down'
        );
    });
});

describe('rememberRecentIndexes', () => {
    it('fetches a recent date once, including a missing (null) one', async () => {
        const fetch = vi.fn(async (date: string) =>
            date === '2026-10-16' ? null : `index ${date}`
        );
        const shared = rememberRecentIndexes(fetch, '2026-10-09');
        expect(await shared('2026-10-15')).toBe('index 2026-10-15');
        expect(await shared('2026-10-15')).toBe('index 2026-10-15');
        expect(await shared('2026-10-16')).toBeNull();
        expect(await shared('2026-10-16')).toBeNull();
        expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('does not keep dates older than the window', async () => {
        const fetch = vi.fn(async (date: string) => `index ${date}`);
        const shared = rememberRecentIndexes(fetch, '2026-10-09');
        await shared('2026-05-01');
        await shared('2026-05-01');
        expect(fetch).toHaveBeenCalledTimes(2);
    });
});
