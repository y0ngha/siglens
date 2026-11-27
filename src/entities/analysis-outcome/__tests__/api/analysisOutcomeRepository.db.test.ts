import {
    OUTCOME_LABEL_VERSION,
    US_EQUITY_SESSION,
    buildOutcomeWindow,
    extractOutcomeSubject,
    labelAnalysisOutcome,
    type Bar,
    type OutcomeSubject,
} from '@y0ngha/siglens-core';
import { and, desc, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';
import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import { DrizzleAnalysisHistoryRepository } from '@/entities/analysis/analysisHistoryRepository';
import {
    MS_PER_DAY,
    MS_PER_SECOND,
    SECONDS_PER_DAY,
} from '@/shared/config/time';
import * as schema from '@/shared/db/schema';
import { analysisHistory, analysisOutcomes } from '@/shared/db/schema';
import { describeTarget } from '../../../../../db/scripts/lib/dbTarget';
import { DrizzleAnalysisOutcomeRepository } from '../../api/analysisOutcomeRepository';
import { runOutcomeLabeller } from '../../server/runOutcomeLabeller';
import type { NewOutcomeRow } from '../../types';
import fixtures from '../fixtures/storedAnalyses.json';

vi.mock('server-only', () => ({}));

/**
 * `DrizzleAnalysisOutcomeRepository` (and the labeller on top of it) against a real Postgres (TESTING.md#TE-55): the
 * capture anti-join, `ON CONFLICT DO NOTHING`, the status-guarded writes, due ordering, relabel selection and the
 * capped prune are SQL whose meaning is the feature. Rows are seeded through the real `saveAnalysisHistory` path with
 * two real stored analyses (`fixtures/storedAnalyses.json`, origin stated in the file).
 *
 * Opt-in by `TEST_DATABASE_URL` (skipped when it is unset, like every `*.db.test.ts`); refuses a non-local target and
 * works in a throwaway schema it drops afterwards. Locally:
 *   docker run -d --name <name> -e POSTGRES_USER=siglens -e POSTGRES_PASSWORD=siglens -e POSTGRES_DB=siglens_e2e -p 127.0.0.1:5461:5432 postgres:17
 *   TEST_DATABASE_URL=postgres://siglens:siglens@localhost:5461/siglens_e2e yarn test .db.test.ts
 */
const URL = process.env.TEST_DATABASE_URL;
const SCHEMA = `analysis_outcomes_test_${process.pid}`;

/**
 * postgres.js connects on the first query, so these module-level handles cost nothing when the suite is skipped (no
 * `TEST_DATABASE_URL`) and let the tests avoid reassigned `let` variables.
 */
const UNUSED_URL = 'postgres://unused@localhost:1/unused';
const admin = postgres(URL ?? UNUSED_URL, { max: 1 });
const client = postgres(URL ?? UNUSED_URL, {
    max: 4,
    connection: { search_path: SCHEMA },
});
const db = drizzle(client, { schema });
const repo = new DrizzleAnalysisOutcomeRepository(db);
const history = new DrizzleAnalysisHistoryRepository(db);
const counter = { analyses: 0 };

const migration = (file: string): string[] =>
    readFileSync(path.join(process.cwd(), 'drizzle', file), 'utf8')
        .split('--> statement-breakpoint')
        .map(statement => statement.trim())
        .filter(statement => statement !== '');

/** The real migrations that build the tables under test, plus the enum `analysis_history.locale` uses. */
const DDL: string[] = [
    `CREATE TYPE "content_locale" AS ENUM('ko', 'en', 'ja', 'zh')`,
    ...migration('0033_analysis_history.sql'),
    // 0061 also touches signal_events; only its analysis_history column is part of this schema.
    ...migration('0061_signal_price_analysis_tier.sql').filter(statement =>
        statement.includes('"analysis_history"')
    ),
    ...migration('0066_analysis_history_personalized.sql'),
    ...migration('0067_analysis_outcomes.sql'),
];

const NOW = new Date('2026-12-15T07:00:00Z');
const day = (offsetDays: number): Date =>
    new Date(NOW.getTime() + offsetDays * MS_PER_DAY);

const FIXTURE = fixtures.analyses['AAPL-2025-02-19-21fa41a262fc'];
const FIXTURE_RECONCILED = fixtures.analyses['AAPL-2025-02-24-07b50eafa33c'];

const SUBJECT: OutcomeSubject = (() => {
    const subject = extractOutcomeSubject(FIXTURE.result, null);
    if (subject === null) throw new Error('fixture subject is null');
    return subject;
})();

/** A real window built by core from constructed daily bars (anchor bar 60), shared by the write and relabel tests. */
const FIXTURE_WINDOW = (() => {
    const bars = Array.from({ length: 120 }, (_, i): Bar => ({
        time: 1_700_000_000 + i * SECONDS_PER_DAY,
        open: 100 + (i % 5),
        high: 102 + (i % 5),
        low: 98 + (i % 5),
        close: 100 + (i % 5),
        volume: 1,
    }));
    const result = buildOutcomeWindow(bars, {
        barTime: bars[60].time,
        closeAtAnalysis: bars[60].close,
        closedAtAnalysis: true,
    });
    if (result.status !== 'ok') throw new Error(result.status);
    return result.window;
})();

describe.skipIf(!URL)('analysis_outcomes repository on a real Postgres', () => {
    beforeAll(async () => {
        const target = describeTarget(URL as string);
        if (!target.isLocal || target.viaTunnel) {
            throw new Error(
                `refusing to run against a non-local database: ${target.host}`
            );
        }
        await admin.unsafe(`CREATE SCHEMA "${SCHEMA}"`);
        await DDL.reduce(
            (previous, statement) =>
                previous.then(() => client.unsafe(statement)),
            Promise.resolve<unknown>(undefined)
        );
    });

    afterAll(async () => {
        await admin.unsafe(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
        await client.end();
        await admin.end();
    });

    beforeEach(async () => {
        await client`TRUNCATE analysis_outcomes, analysis_history, analysis_prompt_blobs`;
        counter.analyses = 0;
    });

    /** One analysis through the real write path; returns its `analysis_history.id`. */
    async function saveAnalysis(input: {
        symbol: string;
        generatedAt: Date;
        result?: unknown;
        timeframe?: string;
        promptDynamic?: string;
        tier?: 'free' | 'member';
        personalized?: boolean;
        locale?: 'ko' | 'en' | 'ja' | 'zh';
        inputFingerprint?: string;
    }): Promise<string> {
        counter.analyses += 1;
        await history.saveAnalysisHistory({
            symbol: input.symbol,
            timeframe: input.timeframe ?? '1Day',
            tab: 'technical',
            modelId: 'deepseek-v4.1-flash',
            personalized: input.personalized ?? false,
            locale: input.locale ?? 'ko',
            inputFingerprint: input.inputFingerprint,
            result: input.result ?? FIXTURE.result,
            generatedAt: input.generatedAt,
            tier: input.tier ?? 'free',
            prompt: {
                stable: `stable ${counter.analyses}`,
                system: `system ${counter.analyses}`,
                dynamic: input.promptDynamic ?? `dynamic ${counter.analyses}`,
                promptVersion: 'p34',
            },
        });
        const [row] = await db
            .select({ id: analysisHistory.id })
            .from(analysisHistory)
            .where(
                and(
                    eq(analysisHistory.symbol, input.symbol),
                    eq(analysisHistory.generatedAt, input.generatedAt)
                )
            )
            .orderBy(desc(analysisHistory.createdAt))
            .limit(1);
        return row.id;
    }

    function newRow(
        analysisId: string,
        overrides: Partial<NewOutcomeRow> = {}
    ): NewOutcomeRow {
        return {
            analysisId,
            symbol: 'AAPL',
            timeframe: '1Day',
            modelId: 'deepseek-v4.1-flash',
            tier: 'free',
            promptVersion: 'p34',
            locale: 'ko',
            inputFingerprint: null,
            generatedAt: day(-1),
            subject: SUBJECT,
            status: 'pending',
            skipReason: null,
            nextAttemptAt: day(-1),
            ...overrides,
        };
    }

    const uuid = (n: number): string =>
        `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

    async function stored(analysisId: string) {
        const [row] = await db
            .select()
            .from(analysisOutcomes)
            .where(eq(analysisOutcomes.analysisId, analysisId));
        return row;
    }

    /** Test-only state changes the repository has no method for. */
    const setRow = (
        analysisId: string,
        change: Partial<typeof analysisOutcomes.$inferInsert>
    ) =>
        db
            .update(analysisOutcomes)
            .set(change)
            .where(eq(analysisOutcomes.analysisId, analysisId));

    const jsonRoundTrip = (value: unknown): unknown =>
        JSON.parse(JSON.stringify(value));

    describe('capture', () => {
        it('selects technical analyses in the window that have no outcome row, oldest first', async () => {
            const since = day(-6);
            const inWindowNew = await saveAnalysis({
                symbol: 'NEW',
                generatedAt: day(-1),
            });
            const inWindowOld = await saveAnalysis({
                symbol: 'OLD',
                generatedAt: day(-5),
            });
            const atBoundary = await saveAnalysis({
                symbol: 'EDGE',
                generatedAt: since,
            });
            await saveAnalysis({
                symbol: 'TOOOLD',
                generatedAt: new Date(since.getTime() - 1),
            });
            // An overall-tab row: the same table, a different tab; written by hand because the real write path
            // refuses results that `toPriorAnalysis` cannot read.
            await db.insert(analysisHistory).values({
                symbol: 'OVR',
                timeframe: '1Day',
                tab: 'overall',
                modelId: 'm',
                locale: 'ko',
                result: {},
                generatedAt: day(-1),
            });

            const candidates = await repo.listCaptureCandidates(since, 10);

            expect(candidates.map(c => c.analysisId)).toEqual([
                atBoundary,
                inWindowOld,
                inWindowNew,
            ]);
            expect(await repo.countCaptureCandidates(since)).toBe(3);
        });

        it('captures only personalized = false: a holdings-personalised row and a legacy NULL row stay out', async () => {
            const plain = await saveAnalysis({
                symbol: 'PLAIN',
                generatedAt: day(-1),
                personalized: false,
            });
            await saveAnalysis({
                symbol: 'HELD',
                generatedAt: day(-2),
                personalized: true,
            });
            const legacy = await saveAnalysis({
                symbol: 'LEGACY',
                generatedAt: day(-3),
            });
            // A row written before the column existed: personalized IS NULL.
            await db
                .update(analysisHistory)
                .set({ personalized: null })
                .where(eq(analysisHistory.id, legacy));

            const candidates = await repo.listCaptureCandidates(day(-6), 10);

            expect(candidates.map(c => c.analysisId)).toEqual([plain]);
            expect(await repo.countCaptureCandidates(day(-6))).toBe(1);
        });

        it('never captures a weekly (1Week) analysis', async () => {
            const daily = await saveAnalysis({
                symbol: 'AAPL',
                generatedAt: day(-1),
            });
            await saveAnalysis({
                symbol: 'AAPL',
                generatedAt: day(-2),
                timeframe: '1Week',
            });

            const candidates = await repo.listCaptureCandidates(day(-6), 10);

            expect(candidates.map(c => c.analysisId)).toEqual([daily]);
            expect(await repo.countCaptureCandidates(day(-6))).toBe(1);
        });

        it('carries locale and input fingerprint so near-duplicates can be told apart later', async () => {
            const id = await saveAnalysis({
                symbol: 'AAPL',
                generatedAt: day(-1),
                locale: 'ja',
                inputFingerprint: 'fp-abc',
            });

            const [candidate] = await repo.listCaptureCandidates(day(-6), 5);
            await repo.insertOutcomes([
                newRow(id, {
                    locale: candidate.locale,
                    inputFingerprint: candidate.inputFingerprint,
                }),
            ]);

            expect(candidate).toMatchObject({
                locale: 'ja',
                inputFingerprint: 'fp-abc',
            });
            expect(await stored(id)).toMatchObject({
                locale: 'ja',
                inputFingerprint: 'fp-abc',
            });
        });

        it('carries the columns the outcome row copies, including tier and the stored prompt', async () => {
            const id = await saveAnalysis({
                symbol: 'AAPL',
                generatedAt: day(-1),
                tier: 'member',
                promptDynamic: 'the dynamic prompt',
            });

            const [candidate] = await repo.listCaptureCandidates(day(-6), 5);

            expect(candidate).toMatchObject({
                analysisId: id,
                symbol: 'AAPL',
                timeframe: '1Day',
                modelId: 'deepseek-v4.1-flash',
                tier: 'member',
                promptVersion: 'p34',
                promptDynamic: 'the dynamic prompt',
            });
            expect(candidate.generatedAt).toEqual(day(-1));
            expect(candidate.result).toEqual(FIXTURE.result);
        });

        it('honours the batch limit and the anti-join: captured rows drop out, the rest come next', async () => {
            const ids = await [1, 2, 3, 4].reduce<Promise<string[]>>(
                async (previous, i) => [
                    ...(await previous),
                    await saveAnalysis({
                        symbol: `S${i}`,
                        generatedAt: day(-5 + i * 0.1),
                    }),
                ],
                Promise.resolve([])
            );

            const firstBatch = await repo.listCaptureCandidates(day(-6), 2);
            await repo.insertOutcomes(
                firstBatch.map(candidate => newRow(candidate.analysisId))
            );
            const secondBatch = await repo.listCaptureCandidates(day(-6), 2);

            expect(firstBatch.map(c => c.analysisId)).toEqual(ids.slice(0, 2));
            expect(secondBatch.map(c => c.analysisId)).toEqual(ids.slice(2));
            expect(await repo.countCaptureCandidates(day(-6))).toBe(2);
        });
    });

    describe('prior analyses never include personalised rows (findRecentForPrompt)', () => {
        it('returns false and legacy NULL rows, not true rows', async () => {
            await saveAnalysis({
                symbol: 'AAPL',
                generatedAt: day(-3),
                personalized: false,
            });
            await saveAnalysis({
                symbol: 'AAPL',
                generatedAt: day(-4),
                personalized: true,
            });
            const legacy = await saveAnalysis({
                symbol: 'AAPL',
                generatedAt: day(-5),
            });
            await db
                .update(analysisHistory)
                .set({ personalized: null })
                .where(eq(analysisHistory.id, legacy));

            const priors = await history.findRecentForPrompt({
                symbol: 'AAPL',
                timeframe: '1Day',
                tab: 'technical',
                now: NOW,
                includeCurrentWindow: true,
            });

            // Three rows exist; the personalised one (day -4) is the one missing.
            expect(priors).toHaveLength(2);
            expect(
                priors.map(prior => prior.generatedAt.valueOf()).toSorted()
            ).toEqual([day(-5).valueOf(), day(-3).valueOf()].toSorted());
        });
    });

    describe('insertOutcomes', () => {
        it('is ON CONFLICT DO NOTHING: a repeat inserts nothing and keeps the first row', async () => {
            const first = newRow(uuid(1), { nextAttemptAt: day(-2) });
            const repeat = newRow(uuid(1), {
                nextAttemptAt: day(9),
                status: 'unlabelable',
                skipReason: 'subject_invalid',
            });

            expect(await repo.insertOutcomes([first])).toBe(1);
            expect(await repo.insertOutcomes([repeat, newRow(uuid(2))])).toBe(
                1
            );

            const row = await stored(uuid(1));
            expect(row.status).toBe('pending');
            expect(row.nextAttemptAt).toEqual(day(-2));
            expect(row.skipReason).toBeNull();
        });

        it('stores the subject jsonb unchanged and an unreadable one as the invalid marker', async () => {
            await repo.insertOutcomes([
                newRow(uuid(1)),
                newRow(uuid(2), {
                    subject: { invalid: true },
                    status: 'unlabelable',
                    skipReason: 'subject_invalid',
                }),
            ]);

            expect((await stored(uuid(1))).subject).toEqual(SUBJECT);
            expect((await stored(uuid(2))).subject).toEqual({ invalid: true });
        });

        it('an empty batch is a no-op', async () => {
            expect(await repo.insertOutcomes([])).toBe(0);
        });
    });

    describe('due ordering', () => {
        it('lists groups by their oldest due row, capped, and counts distinct (symbol, timeframe)', async () => {
            await repo.insertOutcomes([
                newRow(uuid(1), { symbol: 'LATE', nextAttemptAt: day(-1) }),
                newRow(uuid(2), { symbol: 'EARLY', nextAttemptAt: day(-9) }),
                // Same symbol, other timeframe: its own group.
                newRow(uuid(3), {
                    symbol: 'EARLY',
                    timeframe: '15Min',
                    nextAttemptAt: day(-5),
                }),
                // A second row of the first group does not add a group and does not move its order.
                newRow(uuid(4), { symbol: 'EARLY', nextAttemptAt: day(-2) }),
                newRow(uuid(5), { symbol: 'FUTURE', nextAttemptAt: day(3) }),
            ]);

            expect(await repo.listDueGroups(NOW, 10)).toEqual([
                { symbol: 'EARLY', timeframe: '1Day' },
                { symbol: 'EARLY', timeframe: '15Min' },
                { symbol: 'LATE', timeframe: '1Day' },
            ]);
            expect(await repo.listDueGroups(NOW, 2)).toHaveLength(2);
            expect(await repo.countDueGroups(NOW)).toBe(3);
        });

        it('a row is due exactly at next_attempt_at and not one millisecond before', async () => {
            await repo.insertOutcomes([
                newRow(uuid(1), { nextAttemptAt: NOW }),
            ]);

            expect(await repo.countDueGroups(NOW)).toBe(1);
            expect(await repo.countDueGroups(new Date(NOW.getTime() - 1))).toBe(
                0
            );
        });

        it('ignores rows that are not pending', async () => {
            await repo.insertOutcomes([newRow(uuid(1))]);
            await setRow(uuid(1), { status: 'labeled' });

            expect(await repo.countDueGroups(NOW)).toBe(0);
            expect(await repo.listDueGroups(NOW, 10)).toEqual([]);
        });

        it('lists the due rows of one group oldest first, up to the limit, with the stall fields', async () => {
            await repo.insertOutcomes([
                newRow(uuid(1), { nextAttemptAt: day(-3) }),
                newRow(uuid(2), { nextAttemptAt: day(-8) }),
                newRow(uuid(3), { nextAttemptAt: day(-5) }),
                newRow(uuid(4), { symbol: 'OTHER', nextAttemptAt: day(-9) }),
                newRow(uuid(5), { nextAttemptAt: day(4) }),
            ]);
            await setRow(uuid(2), {
                forwardHave: 14,
                stalledSince: day(-1),
            });

            const rows = await repo.listDueRows(
                { symbol: 'AAPL', timeframe: '1Day' },
                NOW,
                2
            );

            expect(rows.map(row => row.analysisId)).toEqual([uuid(2), uuid(3)]);
            expect(rows[0]).toMatchObject({
                forwardHave: 14,
                stalledSince: day(-1),
            });
            expect(rows[0].subject).toEqual(SUBJECT);
        });
    });

    describe('guarded writes', () => {
        const labels = labelAnalysisOutcome(SUBJECT, FIXTURE_WINDOW);
        const labeledInput = (analysisId: string) => ({
            analysisId,
            labels,
            window: FIXTURE_WINDOW,
            labelVersion: labels.v,
            labeledAt: NOW,
            anchorCloseBasis: 'eod_published' as const,
        });

        it('markLabeled changes a pending row once; a second run changes nothing', async () => {
            await repo.insertOutcomes([newRow(uuid(1))]);

            expect(await repo.markLabeled(labeledInput(uuid(1)))).toBe(true);
            const first = await stored(uuid(1));
            const second = await repo.markLabeled({
                ...labeledInput(uuid(1)),
                labelVersion: 99,
                labeledAt: day(5),
            });

            expect(second).toBe(false);
            expect(await stored(uuid(1))).toEqual(first);
            expect(first).toMatchObject({
                status: 'labeled',
                labelVersion: labels.v,
                labeledAt: NOW,
                anchorCloseBasis: 'eod_published',
            });
            expect(first.labels).toEqual(jsonRoundTrip(labels));
            expect(first.barsSnapshot).toEqual(jsonRoundTrip(FIXTURE_WINDOW));
        });

        it('a labeled row is not touched by any other pending-only write', async () => {
            await repo.insertOutcomes([newRow(uuid(1))]);
            await repo.markLabeled(labeledInput(uuid(1)));
            const before = await stored(uuid(1));

            expect(await repo.markUnlabelable(uuid(1), 'anchor_missing')).toBe(
                false
            );
            expect(
                await repo.deferRow({
                    analysisId: uuid(1),
                    nextAttemptAt: day(9),
                    forwardHave: 3,
                    stalledSince: NOW,
                })
            ).toBe(false);
            expect(
                await repo.recordFailure([uuid(1)], day(1), 1, 'row')
            ).toEqual({ deferred: 0, unlabelable: 0 });

            expect(await stored(uuid(1))).toEqual(before);
        });

        it('markUnlabelable writes the basis only when given and keeps it otherwise', async () => {
            await repo.insertOutcomes([newRow(uuid(1)), newRow(uuid(2))]);

            await repo.markUnlabelable(
                uuid(1),
                'anchor_mismatch',
                'after_close_quote'
            );
            await repo.markUnlabelable(uuid(2), 'anchor_missing');

            expect((await stored(uuid(1))).anchorCloseBasis).toBe(
                'after_close_quote'
            );
            expect((await stored(uuid(2))).anchorCloseBasis).toBeNull();
        });

        it('an unlabelable row is not labelled afterwards', async () => {
            await repo.insertOutcomes([newRow(uuid(1))]);
            expect(await repo.markUnlabelable(uuid(1), 'forward_stalled')).toBe(
                true
            );

            expect(await repo.markLabeled(labeledInput(uuid(1)))).toBe(false);
            expect(await stored(uuid(1))).toMatchObject({
                status: 'unlabelable',
                skipReason: 'forward_stalled',
                labels: null,
            });
        });

        it('deferRow records the next attempt and the stall fields on a pending row', async () => {
            await repo.insertOutcomes([newRow(uuid(1))]);

            expect(
                await repo.deferRow({
                    analysisId: uuid(1),
                    nextAttemptAt: day(6),
                    forwardHave: 14,
                    stalledSince: day(-1),
                })
            ).toBe(true);

            expect(await stored(uuid(1))).toMatchObject({
                status: 'pending',
                nextAttemptAt: day(6),
                forwardHave: 14,
                stalledSince: day(-1),
            });
        });

        it("recordFailure counts the given kind only, delays the row and gives up at that kind's limit with its reason", async () => {
            await repo.insertOutcomes([
                newRow(uuid(1)),
                newRow(uuid(2)),
                newRow(uuid(3)),
            ]);
            // Row 2 is one short on load failures but already high on the other two counters.
            await setRow(uuid(2), {
                loadFailures: 7,
                rowErrors: 4,
                anchorMissingSeen: 2,
            });
            await setRow(uuid(3), { status: 'labeled' });

            const result = await repo.recordFailure(
                [uuid(1), uuid(2), uuid(3)],
                day(1),
                8,
                'load'
            );

            expect(result).toEqual({ deferred: 1, unlabelable: 1 });
            expect(await stored(uuid(1))).toMatchObject({
                status: 'pending',
                loadFailures: 1,
                rowErrors: 0,
                anchorMissingSeen: 0,
                nextAttemptAt: day(1),
                skipReason: null,
            });
            expect(await stored(uuid(2))).toMatchObject({
                status: 'unlabelable',
                loadFailures: 8,
                rowErrors: 4,
                anchorMissingSeen: 2,
                skipReason: 'bars_unavailable',
            });
            // The labeled row was filtered out by the pending guard: untouched.
            expect(await stored(uuid(3))).toMatchObject({
                status: 'labeled',
                loadFailures: 0,
            });
            expect(await repo.recordFailure([], day(1), 8, 'load')).toEqual({
                deferred: 0,
                unlabelable: 0,
            });
        });

        it.each([
            ['row', 5, 'rowErrors', 'label_error'],
            ['anchor_missing', 3, 'anchorMissingSeen', 'anchor_missing'],
        ] as const)(
            'the %s counter has its own limit (%i) and reason, independent of the other counters',
            async (kind, limit, column, reason) => {
                await repo.insertOutcomes([newRow(uuid(1)), newRow(uuid(2))]);
                // Row 1: the other counters are far past any limit, its own is at zero: it must only be counted.
                await setRow(uuid(1), {
                    loadFailures: 99,
                    rowErrors: kind === 'row' ? 0 : 99,
                    anchorMissingSeen: kind === 'anchor_missing' ? 0 : 99,
                });
                // Row 2: its own counter is one short of the limit, the others are zero: it gives up with the reason.
                await setRow(uuid(2), { [column]: limit - 1 });

                await repo.recordFailure(
                    [uuid(1), uuid(2)],
                    day(1),
                    limit,
                    kind
                );

                expect(await stored(uuid(1))).toMatchObject({
                    status: 'pending',
                    loadFailures: 99,
                    [column]: 1,
                    skipReason: null,
                });
                expect(await stored(uuid(2))).toMatchObject({
                    status: 'unlabelable',
                    skipReason: reason,
                    loadFailures: 0,
                });
            }
        );
    });

    describe('relabel selection', () => {
        const labelled = async (id: number, version: number) => {
            await repo.insertOutcomes([
                newRow(uuid(id), { generatedAt: day(-id) }),
            ]);
            await setRow(uuid(id), {
                status: 'labeled',
                labelVersion: version,
                labels: { v: 0 },
                barsSnapshot: FIXTURE_WINDOW,
            });
        };

        it('selects labeled rows below the current version that still have their window', async () => {
            await labelled(1, 0);
            await labelled(2, OUTCOME_LABEL_VERSION);
            await labelled(3, 0);
            await repo.insertOutcomes([newRow(uuid(4))]); // pending, version null
            await repo.insertOutcomes([newRow(uuid(5))]);
            await setRow(uuid(5), {
                status: 'labeled',
                labelVersion: 0,
                barsSnapshot: null,
            });

            const candidates = await repo.listRelabelCandidates(
                OUTCOME_LABEL_VERSION,
                10
            );

            expect(candidates.map(c => c.analysisId).toSorted()).toEqual([
                uuid(1),
                uuid(3),
            ]);
            expect(candidates[0]).toMatchObject({
                labelVersion: 0,
                subject: SUBJECT,
            });
            expect(candidates[0].window).toEqual(jsonRoundTrip(FIXTURE_WINDOW));
            expect(
                await repo.listRelabelCandidates(OUTCOME_LABEL_VERSION, 1)
            ).toHaveLength(1);
        });

        it('skips a row whose relabel failed at the current version and takes it again after a version bump', async () => {
            await labelled(1, 0);
            await labelled(2, 0);

            expect(
                await repo.markRelabelFailed(uuid(1), OUTCOME_LABEL_VERSION)
            ).toBe(true);
            const skipped = await repo.listRelabelCandidates(
                OUTCOME_LABEL_VERSION,
                10
            );
            // A later label version: the marker is older than the current one, so the row is selected again.
            const afterBump = await repo.listRelabelCandidates(
                OUTCOME_LABEL_VERSION + 1,
                10
            );

            expect(skipped.map(c => c.analysisId)).toEqual([uuid(2)]);
            expect(afterBump.map(c => c.analysisId).toSorted()).toEqual([
                uuid(1),
                uuid(2),
            ]);
            // The stale label is not hidden: the row keeps its old label_version.
            expect((await stored(uuid(1))).labelVersion).toBe(0);
        });

        it('markRelabelFailed only touches labeled rows', async () => {
            await repo.insertOutcomes([newRow(uuid(1))]);

            expect(
                await repo.markRelabelFailed(uuid(1), OUTCOME_LABEL_VERSION)
            ).toBe(false);
            expect((await stored(uuid(1))).relabelFailedVersion).toBeNull();
        });

        it('has a partial index on label_version for labeled rows, so an empty selection does not walk the table', async () => {
            const [row] = await client<{ indexdef: string }[]>`
                SELECT indexdef FROM pg_indexes
                WHERE schemaname = ${SCHEMA} AND indexname = 'analysis_outcomes_relabel_idx'`;

            expect(row.indexdef).toContain('(label_version)');
            expect(row.indexdef).toContain("status)::text = 'labeled'");
        });

        it('updateRelabel is guarded by the old version: a second call changes nothing', async () => {
            await labelled(1, 0);
            const next = labelAnalysisOutcome(SUBJECT, FIXTURE_WINDOW);

            expect(
                await repo.updateRelabel({
                    analysisId: uuid(1),
                    fromVersion: 0,
                    labels: next,
                    labelVersion: OUTCOME_LABEL_VERSION,
                })
            ).toBe(true);
            expect(
                await repo.updateRelabel({
                    analysisId: uuid(1),
                    fromVersion: 0,
                    labels: { ...next, atr: -1 },
                    labelVersion: 77,
                })
            ).toBe(false);

            const row = await stored(uuid(1));
            expect(row.labelVersion).toBe(OUTCOME_LABEL_VERSION);
            expect(row.labels).toEqual(jsonRoundTrip(next));
        });
    });

    describe('prune', () => {
        it('deletes at most `limit` rows older than the cutoff by generated_at and keeps the rest', async () => {
            const cutoff = day(-730);
            await repo.insertOutcomes([
                ...Array.from({ length: 7 }, (_, i) =>
                    newRow(uuid(10 + i), {
                        generatedAt: new Date(
                            cutoff.getTime() - (i + 1) * 1000
                        ),
                    })
                ),
                // Exactly at the cutoff and newer: kept (the predicate is strictly older).
                newRow(uuid(20), { generatedAt: cutoff }),
                newRow(uuid(21), { generatedAt: day(-1) }),
            ]);

            expect(await repo.pruneOlderThan(cutoff, 5)).toBe(5);
            expect(await repo.pruneOlderThan(cutoff, 5)).toBe(2);
            expect(await repo.pruneOlderThan(cutoff, 5)).toBe(0);

            const left = await db
                .select({ id: analysisOutcomes.analysisId })
                .from(analysisOutcomes)
                .orderBy(analysisOutcomes.analysisId);
            expect(left.map(row => row.id)).toEqual([uuid(20), uuid(21)]);
        });
    });

    describe('what a later statistics query reads from the labels JSON', () => {
        it('filters anchor source, the unobserved flag, verdict, target and pattern lists without a column', async () => {
            const bars = Array.from({ length: 120 }, (_, i): Bar => ({
                time: 1_700_000_000 + i * SECONDS_PER_DAY,
                open: 100,
                high: 101,
                low: 99,
                close: 100,
                volume: 1,
            }));
            const fromPrompt = buildOutcomeWindow(bars, {
                barTime: bars[60].time,
                closeAtAnalysis: 100,
                closedAtAnalysis: true,
            });
            const fromGenerated = buildOutcomeWindow(bars, {
                generatedAtMs: (bars[60].time + 3600) * MS_PER_SECOND,
            });
            if (fromPrompt.status !== 'ok' || fromGenerated.status !== 'ok') {
                throw new Error('window not ok');
            }
            await repo.insertOutcomes([newRow(uuid(1)), newRow(uuid(2))]);
            await repo.markLabeled({
                analysisId: uuid(1),
                labels: labelAnalysisOutcome(SUBJECT, fromPrompt.window),
                window: fromPrompt.window,
                labelVersion: OUTCOME_LABEL_VERSION,
                labeledAt: NOW,
                anchorCloseBasis: null,
            });
            await repo.markLabeled({
                analysisId: uuid(2),
                labels: labelAnalysisOutcome(SUBJECT, fromGenerated.window),
                window: fromGenerated.window,
                labelVersion: OUTCOME_LABEL_VERSION,
                labeledAt: NOW,
                anchorCloseBasis: null,
            });

            const [counts] = await client<
                {
                    generated: number;
                    prompt: number;
                    unobserved: number;
                    sameVerdict: number;
                    withTargetKey: number;
                    patternLists: number;
                }[]
            >`SELECT
                count(*) FILTER (WHERE labels->>'anchorSource' = 'generated_at')::int AS generated,
                count(*) FILTER (WHERE labels->>'anchorSource' = 'prompt_bar')::int AS prompt,
                count(*) FILTER (WHERE labels->'plan'->>'anchorBarUnobserved' = 'true')::int AS unobserved,
                count(*) FILTER (WHERE labels->'plan'->>'recommendation' = ${SUBJECT.plan?.recommendation ?? 'none'})::int AS "sameVerdict",
                count(*) FILTER (WHERE labels->'plan' ? 'target')::int AS "withTargetKey",
                count(*) FILTER (WHERE jsonb_typeof(labels->'patterns') = 'array')::int AS "patternLists"
              FROM analysis_outcomes WHERE status = 'labeled'`;

            expect(counts).toEqual({
                generated: 1,
                prompt: 1,
                unobserved: 0,
                sameVerdict: 2,
                withTargetKey: 2,
                patternLists: 2,
            });
        });
    });

    describe('the table carries nothing about who asked', () => {
        it('has no user, guest, IP or e-mail column and no foreign key', async () => {
            const columns = await client<{ column_name: string }[]>`
                SELECT column_name FROM information_schema.columns
                WHERE table_schema = ${SCHEMA} AND table_name = 'analysis_outcomes'`;
            const foreignKeys = await client<{ conname: string }[]>`
                SELECT conname FROM pg_constraint
                WHERE contype = 'f' AND conrelid = 'analysis_outcomes'::regclass`;

            expect(columns.map(c => c.column_name).toSorted()).toEqual(
                [
                    'analysis_id',
                    'anchor_close_basis',
                    'anchor_missing_seen',
                    'bars_snapshot',
                    'created_at',
                    'forward_have',
                    'input_fingerprint',
                    'generated_at',
                    'label_version',
                    'labeled_at',
                    'labels',
                    'load_failures',
                    'locale',
                    'model_id',
                    'next_attempt_at',
                    'prompt_version',
                    'relabel_failed_version',
                    'row_errors',
                    'skip_reason',
                    'stalled_since',
                    'status',
                    'subject',
                    'symbol',
                    'tier',
                    'timeframe',
                ].toSorted()
            );
            expect(foreignKeys).toEqual([]);
        });
    });

    describe('the nightly run end to end (real repository, constructed bars)', () => {
        const ANALYSIS_DATE = '2025-02-19';
        const utc = (isoDate: string): number =>
            Date.parse(`${isoDate}T00:00:00Z`) / MS_PER_SECOND;
        /** Daily bars 2024-12-01..2025-03-31; the anchor bar closes at the analysis' `dataAsOf.close`. */
        const BARS: Bar[] = Array.from({ length: 121 }, (_, i) => {
            const time = utc('2024-12-01') + i * SECONDS_PER_DAY;
            const close =
                time === utc(ANALYSIS_DATE) ? FIXTURE.lastClose : 240 + (i % 9);
            return {
                time,
                open: close,
                high: close + 2,
                low: close - 2,
                close,
                volume: 1,
            };
        });
        const runAt = (now: Date) =>
            runOutcomeLabeller({
                repo,
                loadGroupBars: async () => ({
                    bars: BARS,
                    session: US_EQUITY_SESSION,
                }),
                now: () => now,
                isDeadlineReached: () => false,
            });

        it('captures on day 2, labels once the window is full, and a repeat run changes nothing', async () => {
            const id = await saveAnalysis({
                symbol: 'AAPL',
                generatedAt: new Date(`${ANALYSIS_DATE}T22:00:00Z`),
                tier: 'member',
            });
            const reconciledId = await saveAnalysis({
                symbol: 'MSFT',
                generatedAt: new Date('2025-02-24T22:00:00Z'),
                result: FIXTURE_RECONCILED.result,
            });

            const captureRun = await runAt(new Date('2025-02-25T07:00:00Z'));
            const early = await stored(id);

            expect(captureRun).toMatchObject({
                captured: 2,
                capturedInvalid: 0,
                labeled: 0,
                groupsProcessed: 0,
                failedSteps: [],
            });
            expect(early).toMatchObject({
                status: 'pending',
                tier: 'member',
                nextAttemptAt: new Date('2025-03-11T22:00:00Z'),
            });

            const labelRun = await runAt(new Date('2025-03-31T07:00:00Z'));
            const labeled = await stored(id);

            expect(labelRun).toMatchObject({
                captured: 0,
                labeled: 2,
                groupsProcessed: 2,
                groupsRemaining: 0,
                stoppedBy: 'complete',
            });
            expect(labeled).toMatchObject({
                status: 'labeled',
                labelVersion: OUTCOME_LABEL_VERSION,
            });
            expect(labeled.barsSnapshot).toMatchObject({
                anchorSource: 'prompt_bar',
            });
            expect(
                (labeled.barsSnapshot as { forward: unknown[] }).forward
            ).toHaveLength(20);
            expect(labeled.labels).toMatchObject({
                anchorSource: 'prompt_bar',
            });
            expect(await stored(reconciledId)).toMatchObject({
                status: 'labeled',
            });

            const repeat = await runAt(new Date('2025-03-31T08:00:00Z'));

            expect(repeat).toMatchObject({
                labeled: 0,
                groupsProcessed: 0,
                relabeled: 0,
            });
            expect(await stored(id)).toEqual(labeled);
        });
    });
});
