import { describe, expect, it, vi } from 'vitest';
import {
    rememberRecentIndexes,
    runSecIndexIngest,
} from '../../server/runSecIndexIngest';
import type { Ingest13fResult } from '../../server/ingest13f';
import type { IngestSecFilingsResult } from '../../server/ingestSecFilings';

const thirteenF = (stoppedBy: Ingest13fResult['stoppedBy']) =>
    ({ stoppedBy }) as Ingest13fResult;
const filings = { stoppedBy: 'complete' } as IngestSecFilingsResult;

describe('runSecIndexIngest', () => {
    it('runs the filings step after a complete 13F run', async () => {
        const runFilings = vi.fn(async () => filings);
        expect(
            await runSecIndexIngest({
                run13f: async () => thirteenF('complete'),
                runFilings,
            })
        ).toEqual({ thirteenF: { stoppedBy: 'complete' }, filings });
        expect(runFilings).toHaveBeenCalledTimes(1);
    });

    it.each([
        'deadline',
        'sec_blocked',
        'universe_incomplete',
        'empty_universe',
    ] as const)(
        'skips the filings step when 13F stopped with %s',
        async stoppedBy => {
            const runFilings = vi.fn(async () => filings);
            expect(
                await runSecIndexIngest({
                    run13f: async () => thirteenF(stoppedBy),
                    runFilings,
                })
            ).toEqual({
                thirteenF: { stoppedBy },
                filings: { skipped: stoppedBy },
            });
            expect(runFilings).not.toHaveBeenCalled();
        }
    );
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
