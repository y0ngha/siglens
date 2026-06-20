/**
 * ONE-OFF SEED script: analyze all Medium+ announced, unanalyzed
 * `economic_calendar` rows via the Gemini Batch API and write the results back.
 *
 * Unlike `seedEconomicEventAnalysis.ts` (which drives the core
 * submit/poll worker path per-event), this script submits the prompts directly
 * to the Gemini Batch API in chunks — far cheaper/faster for a one-time backfill
 * of ~900 small, self-contained prompts. It mirrors the exact Batch API call
 * shape used by `scripts/backtests/generate-backtest.ts`.
 *
 * Usage:
 *   yarn db:seed:calendar-analysis:batch            # full run (submits batches)
 *   DRY_RUN=1 yarn db:seed:calendar-analysis:batch  # query + build only, no submit
 *
 * Requires (.env.local): DATABASE_URL (or DIRECT_DATABASE_URL), GEMINI_API_KEY.
 *
 * Flow:
 *   1. Connect to prod DB (postgres-js + drizzle, max:1).
 *   2. Query pending rows: impact IN ('High','Medium') AND actual IS NOT NULL
 *      AND analyzed_at IS NULL.
 *   3. Build a core prompt per event, preserving order.
 *   4. Chunk into CHUNK_SIZE requests; per chunk: submit → poll → process → write.
 *   5. Write-once UPDATE guarded by `analyzed_at IS NULL`.
 *   6. Resilient per-chunk: a failed/timed-out batch is logged and skipped.
 */
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { and, eq, inArray, isNotNull, isNull, sql } from 'drizzle-orm';
import {
    buildEconomicEventAnalysisPrompt,
    normalizeEconomicEventAnalysis,
} from '@y0ngha/siglens-core';
import type {
    CalendarImpact,
    EconomicEventAnalysisInput,
} from '@y0ngha/siglens-core';
import type { InlinedRequest, InlinedResponse } from '@google/genai';
import { GoogleGenAI, JobState } from '@google/genai';

import { CALENDAR_ANALYZED_IMPACTS } from '../src/entities/economy/lib/economyCalendarConstants';
import { economicCalendar } from '../src/shared/db/schema';

const databaseUrl = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) {
    throw new Error('DIRECT_DATABASE_URL (or DATABASE_URL) env var required');
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? '';
const isDryRun = process.env.DRY_RUN === '1';

// DRY_RUN skips the batch submit, so the key is only mandatory for a real run.
if (!isDryRun && !GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is required in .env.local');
}

const GEMINI_MODEL = 'gemini-2.5-flash-lite';

// The calendar prompts are SMALL (~hundreds of tokens each), unlike the
// backtest's huge per-candidate prompts. 300 requests/batch keeps each batch
// well under the Gemini enqueue token limit (429 RESOURCE_EXHAUSTED) while
// keeping the batch count low (~933 events → 4 batches).
const CHUNK_SIZE = 300;

const POLL_INTERVAL_MS = 30_000;
const MAX_POLL_MS = 2 * 60 * 60 * 1_000; // 2h

const ai = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function formatElapsed(ms: number): string {
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    const rem = s % 60;
    if (m < 60) return `${m}m${rem}s`;
    const h = Math.floor(m / 60);
    return `${h}h${m % 60}m`;
}

interface PendingEvent {
    id: string;
    input: EconomicEventAnalysisInput;
}

interface PendingRequest {
    id: string;
    prompt: string;
}

/**
 * Mirrors `extractResponseText` from generate-backtest.ts: pulls the first
 * candidate's first text part, returning null when absent or blank.
 */
function extractResponseText(resp: InlinedResponse): string | null {
    const text = resp.response?.candidates?.[0]?.content?.parts?.[0]?.text;
    return typeof text === 'string' && text.trim() !== '' ? text : null;
}

function buildInlinedRequest(id: string, prompt: string): InlinedRequest {
    // The core prompt is self-contained (no separate systemInstruction needed).
    // flash-lite + short structured output → no thinkingConfig (kept minimal).
    // `metadata.id` ties each response back to its request by DB row id, making
    // chunk-processing id-based (safer than index-based for re-run idempotency).
    return {
        contents: [{ parts: [{ text: prompt }] }],
        config: {
            temperature: 0,
            responseMimeType: 'application/json',
        },
        metadata: { id },
    };
}

/**
 * Polls a submitted batch to completion (30s interval, 2h timeout).
 * On JobState.JOB_STATE_SUCCEEDED returns the inlinedResponses array; on a
 * terminal failure state or timeout throws (caller logs + skips the chunk).
 */
async function pollUntilComplete(
    batchName: string
): Promise<InlinedResponse[]> {
    if (!ai) throw new Error('Gemini client not initialized');
    const start = Date.now();

    while (Date.now() - start <= MAX_POLL_MS) {
        const elapsed = Date.now() - start;
        const status = await ai.batches.get({ name: batchName });
        const state = status.state ?? 'UNKNOWN';
        console.log(
            `  [poll] state=${state} elapsed=${formatElapsed(elapsed)}`
        );

        if (state === JobState.JOB_STATE_SUCCEEDED) {
            const responses = status.dest?.inlinedResponses ?? [];
            console.log(`  [batch] Succeeded — ${responses.length} responses`);
            return responses;
        }
        if (
            state === JobState.JOB_STATE_FAILED ||
            state === JobState.JOB_STATE_CANCELLED ||
            state === JobState.JOB_STATE_EXPIRED
        ) {
            const errMsg = status.error?.message ?? 'no error message';
            throw new Error(`Job ${state} for ${batchName}: ${errMsg}`);
        }

        await sleep(POLL_INTERVAL_MS);
    }
    throw new Error(
        `Timeout — exceeded ${formatElapsed(MAX_POLL_MS)} waiting for ${batchName}`
    );
}

type Db = ReturnType<typeof drizzle>;

interface ChunkResult {
    analyzed: number;
    skipped: number;
}

/**
 * Process one completed batch: map responses by `metadata.id` (id-based, not
 * index-based) for re-run safety — the Gemini Batch API preserves order
 * empirically, but id-mapping guards against any future ordering divergence.
 * write-once: analyzed_at IS NULL guard makes re-runs idempotent.
 */
async function processResponses(
    db: Db,
    chunk: readonly PendingRequest[],
    responses: readonly InlinedResponse[]
): Promise<ChunkResult> {
    if (responses.length !== chunk.length) {
        console.warn(
            `  [warn] chunk(${chunk.length}) / responses(${responses.length}) mismatch — id-mapping; unmatched responses dropped.`
        );
    }

    // Build a lookup map from response metadata.id → response.
    const responseById = new Map<string, InlinedResponse>();
    for (const resp of responses) {
        const respId = resp.metadata?.id;
        if (!respId) {
            console.warn(
                `  [warn] response missing metadata.id — skipped (cannot correlate to request)`
            );
            continue;
        }
        responseById.set(respId, resp);
    }

    let analyzed = 0;
    let skipped = 0;

    for (const { id } of chunk) {
        const response = responseById.get(id);
        if (!response) {
            console.warn(`    [${id}] skipped — no matching response found`);
            skipped += 1;
            continue;
        }

        if (response.error) {
            console.warn(
                `    [${id}] skipped — response error: ${response.error.message ?? 'unknown'}`
            );
            skipped += 1;
            continue;
        }

        const text = extractResponseText(response);
        if (text === null) {
            console.warn(`    [${id}] skipped — empty response text`);
            skipped += 1;
            continue;
        }

        const { sentiment, summaryKo, interpretationKo } =
            normalizeEconomicEventAnalysis(text);

        // Empty summary = failed analysis. Leave row unanalyzed (analyzed_at NULL).
        if (summaryKo.trim() === '') {
            console.warn(`    [${id}] skipped — empty summaryKo`);
            skipped += 1;
            continue;
        }

        // Write-once: the analyzed_at IS NULL guard makes re-runs idempotent.
        const updated = await db
            .update(economicCalendar)
            .set({
                sentiment,
                summaryKo,
                interpretationKo,
                analyzedAt: sql`now()`,
            })
            .where(
                and(
                    eq(economicCalendar.id, id),
                    isNull(economicCalendar.analyzedAt)
                )
            )
            .returning({ id: economicCalendar.id });

        if (updated.length > 0) {
            analyzed += 1;
        } else {
            // Row was analyzed by a concurrent/previous run — count as skip.
            skipped += 1;
        }
    }

    return { analyzed, skipped };
}

async function run(): Promise<void> {
    const client = postgres(databaseUrl!, { max: 1 });
    try {
        const db = drizzle(client);

        // Query pending events directly. impact is text in the DB; the WHERE
        // clause restricts it to CALENDAR_ANALYZED_IMPACTS, so the cast to CalendarImpact
        // at the boundary is sound.
        const rows = await db
            .select({
                id: economicCalendar.id,
                event: economicCalendar.event,
                impact: economicCalendar.impact,
                actual: economicCalendar.actual,
                estimate: economicCalendar.estimate,
                previous: economicCalendar.previous,
                unit: economicCalendar.unit,
            })
            .from(economicCalendar)
            .where(
                and(
                    inArray(economicCalendar.impact, [
                        ...CALENDAR_ANALYZED_IMPACTS,
                    ]),
                    isNotNull(economicCalendar.actual),
                    isNull(economicCalendar.analyzedAt)
                )
            );

        const pending: PendingEvent[] = rows.map(row => ({
            id: row.id,
            input: {
                event: row.event,
                impact: row.impact as CalendarImpact,
                actual: row.actual,
                estimate: row.estimate,
                previous: row.previous,
                unit: row.unit,
            },
        }));

        const total = pending.length;
        console.log(`Pending: ${total} Medium+ announced unanalyzed event(s)`);
        if (total === 0) {
            console.log('Nothing to do — exiting.');
            return;
        }

        // Build a prompt per event, preserving order (id ↔ request alignment).
        const requests: PendingRequest[] = pending.map(p => ({
            id: p.id,
            prompt: buildEconomicEventAnalysisPrompt(p.input),
        }));

        if (isDryRun) {
            const sample = requests[0];
            console.log(
                '\n[dry-run] DRY_RUN=1 — query + prompt build only, no batch submitted.'
            );
            console.log(
                `[dry-run] pending=${total} model=${GEMINI_MODEL} chunkSize=${CHUNK_SIZE}`
            );
            console.log(
                `[dry-run] sample id=${sample.id} promptChars=${sample.prompt.length}`
            );
            console.log(
                `[dry-run] sample prompt head (first 200 chars):\n${sample.prompt.slice(0, 200)}`
            );
            // Build (but do NOT submit) the first chunk's requests as a sanity check.
            const firstChunk = requests.slice(0, CHUNK_SIZE);
            const firstChunkRequests: InlinedRequest[] = firstChunk.map(r =>
                buildInlinedRequest(r.id, r.prompt)
            );
            console.log(
                `[dry-run] built ${firstChunkRequests.length} InlinedRequest(s) for chunk 1 (not submitted).`
            );
            return;
        }

        const chunkCount = Math.ceil(requests.length / CHUNK_SIZE);
        console.log(
            `\n[plan] ${total} requests → ${chunkCount} batch(es) of up to ${CHUNK_SIZE} each (model=${GEMINI_MODEL})`
        );

        let analyzed = 0;
        let skipped = 0;
        let failedBatches = 0;

        for (let c = 0; c < chunkCount; c++) {
            const chunk = requests.slice(c * CHUNK_SIZE, (c + 1) * CHUNK_SIZE);
            const chunkNo = c + 1;
            const inlined: InlinedRequest[] = chunk.map(r =>
                buildInlinedRequest(r.id, r.prompt)
            );

            console.log(
                `\n=== Batch ${chunkNo}/${chunkCount} (${chunk.length} requests) ===`
            );

            try {
                const displayName = `siglens-calendar-analysis-${chunkNo}-${Date.now()}`;
                console.log(`  [submit] ${displayName}...`);
                const batch = await ai!.batches.create({
                    model: GEMINI_MODEL,
                    src: inlined,
                    config: { displayName },
                });
                const name = batch.name;
                if (!name) {
                    throw new Error('Batch create response missing .name');
                }
                console.log(
                    `  [submit] created ${name} (state=${batch.state ?? 'UNKNOWN'})`
                );

                const responses = await pollUntilComplete(name);
                const result = await processResponses(db, chunk, responses);
                analyzed += result.analyzed;
                skipped += result.skipped;
                console.log(
                    `  [written] batch ${chunkNo}: analyzed +${result.analyzed}, skipped +${result.skipped} (running: ${analyzed}/${total})`
                );
            } catch (err) {
                // Resilience: a failed/timed-out batch is logged and skipped so
                // remaining chunks still run. Their rows stay unanalyzed.
                failedBatches += 1;
                console.error(
                    `  [batch ${chunkNo}] FAILED — continuing: ${err instanceof Error ? err.message : String(err)}`
                );
            }
        }

        console.log(
            `\n[done] analyzed ${analyzed} / pending ${total} (${skipped} skipped, ${failedBatches} failed batch(es))`
        );
    } finally {
        await client.end();
    }
}

run().catch((error: unknown) => {
    console.error('[seedCalendarAnalysisBatch] failed:', error);
    process.exitCode = 1;
});
