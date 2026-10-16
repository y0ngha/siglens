import { describe, expect, it, vi } from 'vitest';
import { strToU8, zipSync } from 'fflate';
import {
    INVESTOR_FLOWS_FTD_MAX_ATTEMPTS,
    INVESTOR_FLOWS_FTD_MAX_FILES_PER_RUN,
    INVESTOR_FLOWS_FTD_RETENTION_DAYS,
    INVESTOR_FLOWS_STATE_UNIVERSE_COMPLETE,
} from '../../lib/investorFlowsPolicy';
import { addDays } from '../../lib/investorFlowsDates';
import {
    pendingFiles,
    runFtdIngest,
    type IngestFtdDeps,
} from '../../server/ingestFtd';
import type { InvestorFlowsUniverse } from '../../api/investorFlowsUniverseRepository';
import type { FtdFileState, FtdRow } from '../../model';
import {
    FTD_FILE_EXCERPT,
    FTD_LISTING_EXCERPT,
} from '../fixtures/investorFlowsExpansionSamples';

const NOW = new Date('2026-10-16T13:50:00Z');
const UNIVERSE: InvestorFlowsUniverse = {
    cusips: new Map([
        ['084670702', { id: 1, symbol: 'BRK.B' }],
        ['037833100', { id: 2, symbol: 'AAPL' }],
    ]),
    symbols: ['BRK.B', 'AAPL'],
    loadedAt: '2026-10-16 13:00:00+00',
};
const zipOf = (text: string): Uint8Array =>
    zipSync({ 'cnsfails.txt': strToU8(text) });

interface Scenario {
    gate?: boolean;
    universe?: InvestorFlowsUniverse;
    listing?: string | null;
    processed?: string[];
    /** zip bytes per path suffix (`cnsfails202609b`), default: the real excerpt */
    files?: Record<string, Uint8Array | null | Error>;
}

function build(scenario: Scenario = {}, over: Partial<IngestFtdDeps> = {}) {
    // a real database remembers stored and rejected files between runs
    const states = new Map<string, FtdFileState>(
        (scenario.processed ?? []).map(key => [
            key,
            { processed: true, attempts: 0 },
        ])
    );
    const calls = {
        rejected: [] as { fileKey: string; error: string }[],
        files: [] as string[],
        stored: [] as { fileKey: string; rows: readonly FtdRow[] }[],
        prunes: [] as string[],
        invalidated: [] as string[][],
        logs: [] as string[],
    };
    const deps: IngestFtdDeps = {
        sec: {
            fetchFailsToDeliverListing: async () =>
                scenario.listing === undefined
                    ? FTD_LISTING_EXCERPT
                    : scenario.listing,
            fetchSecFile: async path => {
                calls.files.push(path);
                const key = /cnsfails\d{6}[ab]/.exec(path)?.[0] ?? '';
                const file =
                    scenario.files?.[key] === undefined
                        ? zipOf(FTD_FILE_EXCERPT)
                        : scenario.files[key];
                if (file instanceof Error) throw file;
                return file;
            },
        },
        repo: {
            getState: async key =>
                key === INVESTOR_FLOWS_STATE_UNIVERSE_COMPLETE &&
                scenario.gate !== false
                    ? 'done'
                    : null,
            listFileStates: async () => new Map(states),
            recordRejected: async (fileKey, error) => {
                calls.rejected.push({ fileKey, error });
                const state = states.get(fileKey);
                states.set(fileKey, {
                    processed: false,
                    attempts: (state?.attempts ?? 0) + 1,
                });
            },
            storeFile: async (fileKey, rows) => {
                calls.stored.push({ fileKey, rows });
                states.set(fileKey, {
                    processed: true,
                    attempts: states.get(fileKey)?.attempts ?? 0,
                });
            },
            pruneBefore: async cutoff => {
                calls.prunes.push(cutoff);
                return 0;
            },
        },
        loadUniverse: async () => scenario.universe ?? UNIVERSE,
        isSecBlockedError: error =>
            error instanceof Error && error.message === 'blocked',
        now: () => NOW,
        isDeadlineReached: () => false,
        invalidateSymbols: symbols => {
            calls.invalidated.push([...symbols]);
        },
        log: vi.fn((message: string) => {
            calls.logs.push(message);
        }),
        ...over,
    };
    return { deps, calls };
}

describe('runFtdIngest', () => {
    it('does nothing before cusip-map finished its first full pass', async () => {
        const { deps, calls } = build({ gate: false });
        expect((await runFtdIngest(deps)).stoppedBy).toBe(
            'universe_incomplete'
        );
        expect(calls.files).toEqual([]);
    });

    it('does nothing with an empty universe', async () => {
        const { deps, calls } = build({
            universe: { cusips: new Map(), symbols: [], loadedAt: 'x' },
        });
        expect((await runFtdIngest(deps)).stoppedBy).toBe('empty_universe');
        expect(calls.files).toEqual([]);
    });

    it('stops when the listing page is gone', async () => {
        const { deps, calls } = build({ listing: null });
        expect((await runFtdIngest(deps)).stoppedBy).toBe('listing_missing');
        expect(calls.logs[0]).toContain('[sec-ftd] listing_missing');
    });

    it('downloads the newest unprocessed files first, at most four per run, from the linked paths', async () => {
        const { deps, calls } = build();
        const result = await runFtdIngest(deps);
        expect(calls.files).toHaveLength(INVESTOR_FLOWS_FTD_MAX_FILES_PER_RUN);
        expect(calls.files).toEqual([
            '/files/data/fails-deliver-data/cnsfails202609b.zip',
            '/files/data/fails-deliver-data/cnsfails202609a.zip',
            '/files/data/other/fails-deliver-data/cnsfails202605b.zip',
            '/files/data/other/fails-deliver-data/cnsfails202308b_0.zip',
        ]);
        expect(result.pendingFiles).toBe(5);
    });

    it('skips files that are already stored', async () => {
        const { deps, calls } = build({
            processed: ['202609b', '202609a', '202605b', '202308b'],
        });
        await runFtdIngest(deps);
        expect(calls.files).toEqual([
            '/files/data/frequently-requested-foia-document-fails-deliver-data/cnsfails201706a.zip',
        ]);
    });

    it('stores only universe rows under OUR symbol for a file whose trailer matches', async () => {
        const { deps, calls } = build({
            processed: ['202609a', '202605b', '202308b', '201706a'],
        });
        const result = await runFtdIngest(deps);
        expect(calls.stored).toHaveLength(1);
        expect(calls.stored[0]?.fileKey).toBe('202609b');
        expect(calls.stored[0]?.rows.map(r => r.symbol)).toEqual([
            'BRK.B',
            'BRK.B',
            'AAPL',
            'AAPL',
        ]);
        expect(result).toMatchObject({ filesStored: 1, rowsStored: 4 });
        expect(calls.invalidated).toEqual([['AAPL', 'BRK.B']]);
    });

    it('rejects (does not store) a file whose trailer does not match, and keeps going', async () => {
        const { deps, calls } = build({
            processed: ['202605b', '202308b', '201706a'],
            files: {
                cnsfails202609b: zipOf(
                    FTD_FILE_EXCERPT.replace('|4357|', '|4358|')
                ),
            },
        });
        const result = await runFtdIngest(deps);
        expect(result.rejectedFiles).toEqual(['202609b']);
        expect(calls.stored.map(s => s.fileKey)).toEqual(['202609a']);
        expect(calls.logs).toContain('[sec-ftd] trailer mismatch 202609b');
    });

    it('rejects an unreadable zip without failing the run', async () => {
        const { deps } = build({
            processed: ['202609a', '202605b', '202308b', '201706a'],
            files: { cnsfails202609b: strToU8('not a zip') },
        });
        const result = await runFtdIngest(deps);
        expect(result).toMatchObject({
            stoppedBy: 'complete',
            rejectedFiles: ['202609b'],
            filesStored: 0,
        });
    });

    it('continues past a file that is missing', async () => {
        const { deps, calls } = build({
            processed: ['202605b', '202308b', '201706a'],
            files: { cnsfails202609b: null },
        });
        await runFtdIngest(deps);
        expect(calls.stored.map(s => s.fileKey)).toEqual(['202609a']);
    });

    it('stops at a SEC block but still prunes and invalidates what was stored', async () => {
        const { deps, calls } = build({
            files: { cnsfails202609a: new Error('blocked') },
        });
        const result = await runFtdIngest(deps);
        expect(result.stoppedBy).toBe('sec_blocked');
        expect(calls.files).toHaveLength(2);
        expect(calls.stored.map(s => s.fileKey)).toEqual(['202609b']);
        expect(calls.prunes).toEqual([
            addDays('2026-10-16', -INVESTOR_FLOWS_FTD_RETENTION_DAYS),
        ]);
        expect(calls.invalidated).toEqual([['AAPL', 'BRK.B']]);
    });

    it('counts a transient (non-block) file error as a rejection and keeps going, so stored files are still invalidated and pruned', async () => {
        const { deps, calls } = build({
            files: { cnsfails202609b: new Error('socket hang up') },
        });
        const result = await runFtdIngest(deps);
        expect(result.stoppedBy).toBe('complete');
        expect(calls.rejected).toEqual([
            { fileKey: '202609b', error: 'socket hang up' },
        ]);
        expect(calls.stored.map(s => s.fileKey)).toEqual([
            '202609a',
            '202605b',
            '202308b',
        ]);
        expect(calls.invalidated).toEqual([['AAPL', 'BRK.B']]);
        expect(calls.prunes).toEqual([
            addDays('2026-10-16', -INVESTOR_FLOWS_FTD_RETENTION_DAYS),
        ]);
        expect(calls.logs).toContain('[sec-ftd] file failed 202609b:');
    });

    it('still stops the whole run on a SEC block in the middle of a file', async () => {
        const { deps, calls } = build({
            files: { cnsfails202609b: new Error('blocked') },
        });
        expect((await runFtdIngest(deps)).stoppedBy).toBe('sec_blocked');
        expect(calls.files).toHaveLength(1);
        expect(calls.rejected).toEqual([]);
    });

    it('records a rejected file with its reason (attempts are counted by the store)', async () => {
        const { deps, calls } = build({
            processed: ['202609a', '202605b', '202308b', '201706a'],
            files: {
                cnsfails202609b: zipOf(
                    FTD_FILE_EXCERPT.replace('|4357|', '|4358|')
                ),
            },
        });
        await runFtdIngest(deps);
        expect(calls.rejected).toEqual([
            { fileKey: '202609b', error: 'trailer mismatch' },
        ]);
    });

    it('a permanently bad newest file does not block the older backfill, and is given up after the attempt cap', async () => {
        // five links, four per run: the newest is always broken
        const { deps, calls } = build({
            files: { cnsfails202609b: strToU8('not a zip') },
        });
        await runFtdIngest(deps); // 202609b rejected, 202609a + 202605b + 202308b stored
        await runFtdIngest(deps); // 201706a (never failed) goes first, then the broken one again
        expect(calls.stored.map(s => s.fileKey).sort()).toEqual([
            '201706a',
            '202308b',
            '202605b',
            '202609a',
        ]);
        for (let run = 0; run < INVESTOR_FLOWS_FTD_MAX_ATTEMPTS; run += 1) {
            // react-doctor-disable-next-line react-doctor/async-await-in-loop
            await runFtdIngest(deps);
        }
        expect(
            calls.rejected.filter(r => r.fileKey === '202609b')
        ).toHaveLength(INVESTOR_FLOWS_FTD_MAX_ATTEMPTS);
    });

    it('reports a missing link target as a rejection so it cannot stall the queue', async () => {
        const { deps, calls } = build({
            processed: ['202605b', '202308b', '201706a'],
            files: { cnsfails202609b: null },
        });
        await runFtdIngest(deps);
        expect(calls.rejected).toEqual([
            {
                fileKey: '202609b',
                error: 'missing /files/data/fails-deliver-data/cnsfails202609b.zip',
            },
        ]);
    });

    it('starts no new file after the deadline', async () => {
        const { deps, calls } = build({}, { isDeadlineReached: () => true });
        expect((await runFtdIngest(deps)).stoppedBy).toBe('deadline');
        expect(calls.files).toEqual([]);
    });
});

describe('pendingFiles', () => {
    const links = ['202609b', '202609a', '202608b'].map(fileKey => ({
        fileKey,
        path: `/files/${fileKey}.zip`,
    }));

    it('keeps never-failed files first (newest first) and queues failed ones behind them by attempts', () => {
        expect(
            pendingFiles(
                links,
                new Map([
                    ['202609b', { processed: false, attempts: 2 }],
                    ['202609a', { processed: false, attempts: 1 }],
                ])
            ).map(l => l.fileKey)
        ).toEqual(['202608b', '202609a', '202609b']);
    });

    it('drops stored files and files that used up their attempts', () => {
        expect(
            pendingFiles(
                links,
                new Map([
                    ['202609b', { processed: true, attempts: 0 }],
                    [
                        '202609a',
                        {
                            processed: false,
                            attempts: INVESTOR_FLOWS_FTD_MAX_ATTEMPTS,
                        },
                    ],
                ])
            ).map(l => l.fileKey)
        ).toEqual(['202608b']);
    });
});
