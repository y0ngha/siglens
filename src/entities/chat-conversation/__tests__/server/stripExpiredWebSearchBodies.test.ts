import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    stripExpiredWebSearchBodies,
    type WebSearchRetentionRepository,
} from '@/entities/chat-conversation/server/stripExpiredWebSearchBodies';
import { defined } from '@/shared/test-utils/defined';

const stored = (title: string) =>
    JSON.stringify({
        results: [
            { title, url: `https://e.example/${title}`, snippet: 'body text' },
        ],
    });

/** In-memory stand-in for the repository: filters like the SQL (id order, after cursor, not yet stripped). */
function fakeRepo(initial: Array<{ id: string; content: string }>) {
    const rows = new Map(initial.map(row => [row.id, row.content]));
    const repo: WebSearchRetentionRepository = {
        listUnstrippedWebSearchRows: vi.fn(async (afterId, limit) => {
            return [...rows.entries()]
                .filter(
                    ([id, content]) =>
                        (afterId === null || id > afterId) &&
                        !content.includes('"bodiesOmitted":true')
                )
                .sort(([a], [b]) => (a < b ? -1 : 1))
                .slice(0, limit)
                .map(([id, content]) => ({ id, content }));
        }),
        rewriteWebSearchContent: vi.fn(
            async (updates: ReadonlyArray<{ id: string; content: string }>) => {
                updates.forEach(update => rows.set(update.id, update.content));
                return updates.length;
            }
        ),
    };
    return { repo, rows };
}

describe('stripExpiredWebSearchBodies', () => {
    beforeEach(() => {
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('rewrites every row to title and url and reports the counts', async () => {
        const { repo, rows } = fakeRepo([
            { id: 'a', content: stored('a') },
            { id: 'b', content: stored('b') },
        ]);

        const result = await stripExpiredWebSearchBodies({ repo });

        expect(result).toEqual({
            scanned: 2,
            rewritten: 2,
            skipped: 0,
            batches: 1,
            more: false,
            failed: false,
        });
        expect(JSON.parse(defined(rows.get('a'))).results[0]).toEqual({
            title: 'a',
            url: 'https://e.example/a',
        });
    });

    it('a second run reads nothing and writes nothing (idempotent)', async () => {
        const { repo } = fakeRepo([{ id: 'a', content: stored('a') }]);
        await stripExpiredWebSearchBodies({ repo });
        vi.mocked(repo.rewriteWebSearchContent).mockClear();

        const second = await stripExpiredWebSearchBodies({ repo });

        expect(second).toMatchObject({
            scanned: 0,
            rewritten: 0,
            batches: 0,
        });
        expect(repo.rewriteWebSearchContent).not.toHaveBeenCalled();
    });

    it('walks batches by id cursor and leaves an unrewritable row alone without re-reading it', async () => {
        const { repo, rows } = fakeRepo([
            { id: 'a', content: stored('a') },
            { id: 'b', content: 'not json {' },
            { id: 'c', content: stored('c') },
        ]);

        const result = await stripExpiredWebSearchBodies({
            repo,
            batchSize: 1,
        });

        expect(result).toMatchObject({
            scanned: 3,
            rewritten: 2,
            skipped: 1,
            batches: 3,
        });
        expect(rows.get('b')).toBe('not json {');
        expect(repo.listUnstrippedWebSearchRows).toHaveBeenCalledWith('b', 1);
    });

    it('stops at the batch cap and reports more work remains', async () => {
        const { repo } = fakeRepo([
            { id: 'a', content: stored('a') },
            { id: 'b', content: stored('b') },
            { id: 'c', content: stored('c') },
        ]);

        const result = await stripExpiredWebSearchBodies({
            repo,
            batchSize: 1,
            maxBatches: 2,
        });

        expect(result).toMatchObject({ batches: 2, rewritten: 2, more: true });
    });

    it('does not start a batch once the deadline is reached', async () => {
        const { repo } = fakeRepo([{ id: 'a', content: stored('a') }]);

        const result = await stripExpiredWebSearchBodies({
            repo,
            isDeadlineReached: () => true,
        });

        expect(result).toMatchObject({ batches: 0, more: true });
        expect(repo.listUnstrippedWebSearchRows).not.toHaveBeenCalled();
    });

    it('logs a repository failure through the redactor and returns failed without throwing', async () => {
        const { repo } = fakeRepo([]);
        vi.mocked(repo.listUnstrippedWebSearchRows).mockRejectedValue(
            new Error('connection reset')
        );

        const result = await stripExpiredWebSearchBodies({ repo });

        expect(result.failed).toBe(true);
        expect(console.error).toHaveBeenCalledWith(
            '[web-search-retention] batch failed:',
            expect.anything()
        );
    });
});
