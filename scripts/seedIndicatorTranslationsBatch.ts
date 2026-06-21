/**
 * ONE-OFF SEED script: translate every distinct, not-yet-covered economic-indicator
 * base name from `economic_calendar` into Korean via the Gemini Batch API, then
 * UPSERT the results into `economic_indicator_translations` (source='ai').
 *
 * This front-loads the DB translation cache so the calendar grid immediately shows
 * Korean indicator names without waiting for the on-access AI path to lazily
 * translate each one at first render.
 *
 * Translation-source hierarchy (hybrid, three layers):
 *   1. `INDICATOR_NAME_KO` code dict (dict) — 28 hardcoded entries, source-of-truth,
 *      excluded here (no DB row needed; display code already checks dict first).
 *   2. `economic_indicator_translations` DB cache (ai) — THIS script fills it.
 *   3. On-access AI path (lazy fallback) — resolveIndicatorLabels triggers the
 *      submitIndicatorTranslation / pollIndicatorTranslation worker per-indicator
 *      when neither dict nor DB cache has a hit. This seed front-loads that cache.
 *
 * Usage:
 *   yarn db:seed:indicator-translations:batch            # full run (submits batches)
 *   DRY_RUN=1 yarn db:seed:indicator-translations:batch  # query + build only, no submit
 *
 * Requires (.env.local): DATABASE_URL (or DIRECT_DATABASE_URL), GEMINI_API_KEY.
 *
 * Flow:
 *   1. Connect to prod DB (postgres-js + drizzle, max:1).
 *   2. SELECT DISTINCT event FROM economic_calendar; compute base = normalizeIndicatorName(event).base.
 *   3. Exclude bases already covered by INDICATOR_NAME_KO (dict) or already in the
 *      translations table — leaving only genuinely pending bases.
 *   4. Build one prompt per base via buildIndicatorTranslationPrompt; chunk into CHUNK_SIZE.
 *   5. Per chunk: submit → poll → process → UPSERT with onConflictDoNothing.
 *   6. Resilient per-chunk: a failed/timed-out batch is logged and skipped so remaining
 *      chunks still run.
 */
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import {
    buildIndicatorTranslationPrompt,
    normalizeIndicatorTranslation,
} from '@y0ngha/siglens-core';
import type { InlinedRequest, InlinedResponse } from '@google/genai';
import { GoogleGenAI, JobState } from '@google/genai';

import {
    normalizeIndicatorName,
    INDICATOR_NAME_KO,
} from '../src/entities/economy/lib/indicatorNameKo';
import {
    economicCalendar,
    economicIndicatorTranslations,
} from '../src/shared/db/schema';

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

// Translation prompts are tiny (single indicator name, ~dozens of tokens each).
// 300 requests/batch keeps each batch well under the Gemini enqueue token limit
// (429 RESOURCE_EXHAUSTED) while keeping batch count low (~270 candidates → 1 batch).
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
    // `metadata.id` ties each response back to its base name, making chunk-processing
    // id-based (safer than index-based for re-run idempotency).
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
    translated: number;
    skipped: number;
}

/**
 * Process one completed batch: map responses by `metadata.id` (id-based, not
 * index-based) for re-run safety — the Gemini Batch API preserves order
 * empirically, but id-mapping guards against any future ordering divergence.
 * UPSERT uses onConflictDoNothing so re-runs are idempotent and existing dict/ai
 * rows are never clobbered.
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

    let translated = 0;
    let skipped = 0;

    for (const { id: base } of chunk) {
        const response = responseById.get(base);
        if (!response) {
            console.warn(`    [${base}] skipped — no matching response found`);
            skipped += 1;
            continue;
        }

        if (response.error) {
            console.warn(
                `    [${base}] skipped — response error: ${response.error.message ?? 'unknown'}`
            );
            skipped += 1;
            continue;
        }

        const text = extractResponseText(response);
        if (text === null) {
            console.warn(`    [${base}] skipped — empty response text`);
            skipped += 1;
            continue;
        }

        const koreanName = normalizeIndicatorTranslation(text);

        // Empty koreanName = failed/garbage translation. Leave untranslated rather
        // than writing an empty string — the on-access AI path will retry lazily.
        if (koreanName.trim() === '') {
            console.warn(
                `    [${base}] skipped — empty koreanName after normalize`
            );
            skipped += 1;
            continue;
        }

        // onConflictDoNothing (NOT update): never clobber an existing dict or ai row.
        // An empty returning array means the row already existed → count as skip.
        const inserted = await db
            .insert(economicIndicatorTranslations)
            .values({
                normalizedName: base,
                koreanName,
                source: 'ai',
            })
            .onConflictDoNothing({
                target: economicIndicatorTranslations.normalizedName,
            })
            .returning({
                normalizedName: economicIndicatorTranslations.normalizedName,
            });

        if (inserted.length > 0) {
            translated += 1;
        } else {
            // Row already existed (prior run or concurrent write) — idempotent skip.
            skipped += 1;
        }
    }

    return { translated, skipped };
}

async function run(): Promise<void> {
    const client = postgres(databaseUrl!, { max: 1 });
    try {
        const db = drizzle(client);

        // Collect all distinct raw event names from the calendar.
        const eventRows = await db
            .selectDistinct({ event: economicCalendar.event })
            .from(economicCalendar);

        // Compute distinct bases — normalizeIndicatorName strips the trailing period
        // qualifier so 'CPI (May)' and 'CPI (Jun)' both reduce to base 'CPI'.
        // The Set deduplicates across all distinct raw event names.
        const allBases = new Set<string>(
            eventRows.map(r => normalizeIndicatorName(r.event).base)
        );

        // Load bases already present in the translations table to skip re-translating.
        const existingRows = await db
            .select({
                normalizedName: economicIndicatorTranslations.normalizedName,
            })
            .from(economicIndicatorTranslations);
        const existingBases = new Set<string>(
            existingRows.map(r => r.normalizedName)
        );

        const dictCoveredCount = [...allBases].filter(b =>
            Object.hasOwn(INDICATOR_NAME_KO, b)
        ).length;
        const alreadyInDbCount = [...allBases].filter(
            b => !Object.hasOwn(INDICATOR_NAME_KO, b) && existingBases.has(b)
        ).length;

        // Pending = bases NOT covered by code dict AND NOT already in DB.
        // Sorted deterministically so log output and chunk boundaries are stable.
        const pendingBases = [...allBases]
            .filter(
                b =>
                    !Object.hasOwn(INDICATOR_NAME_KO, b) &&
                    !existingBases.has(b)
            )
            .toSorted((a, b) => a.localeCompare(b));

        const total = pendingBases.length;
        console.log(
            `Distinct bases: ${allBases.size} total, ${dictCoveredCount} dict-covered, ${alreadyInDbCount} already-in-DB, ${total} pending`
        );

        if (total === 0) {
            console.log('Nothing to do — exiting.');
            return;
        }

        // Build one prompt per pending base; the base string IS the metadata id since
        // bases are distinct. The metadata id ties each Batch API response back to
        // its base name for id-based (not index-based) processing.
        const requests: PendingRequest[] = pendingBases.map(base => ({
            id: base,
            prompt: buildIndicatorTranslationPrompt(base),
        }));

        if (isDryRun) {
            const sample = requests[0];
            console.log(
                '\n[dry-run] DRY_RUN=1 — query + prompt build only, no batch submitted.'
            );
            console.log(
                `[dry-run] pending=${total} dictCovered=${dictCoveredCount} alreadyInDB=${alreadyInDbCount}`
            );
            console.log(
                `[dry-run] model=${GEMINI_MODEL} chunkSize=${CHUNK_SIZE}`
            );
            console.log(
                `[dry-run] sample base="${sample.id}" promptChars=${sample.prompt.length}`
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

        let translated = 0;
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
                const displayName = `siglens-indicator-translations-${chunkNo}-${Date.now()}`;
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
                translated += result.translated;
                skipped += result.skipped;
                console.log(
                    `  [written] batch ${chunkNo}: translated +${result.translated}, skipped +${result.skipped} (running: ${translated}/${total})`
                );
            } catch (err) {
                // Resilience: a failed/timed-out batch is logged and skipped so
                // remaining chunks still run. Their bases stay untranslated.
                failedBatches += 1;
                console.error(
                    `  [batch ${chunkNo}] FAILED — continuing: ${err instanceof Error ? err.message : String(err)}`
                );
            }
        }

        console.log(
            `\n[done] translated ${translated} / pending ${total} (${skipped} skipped, ${failedBatches} failed batch(es))`
        );
    } finally {
        await client.end();
    }
}

run().catch((error: unknown) => {
    console.error('[seedIndicatorTranslationsBatch] failed:', error);
    process.exitCode = 1;
});
