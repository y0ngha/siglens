/**
 * Re-runnable seed: translate crypto asset English names to Korean via Gemini
 * Batch API and UPSERT the results into `crypto_assets.korean_name`.
 *
 * This front-loads the DB so Korean-name search (e.g. "비트코" → BTCUSD) works
 * immediately without waiting for on-access lazy translation. Only the top N
 * coins by circulating_supply are translated to control Gemini API cost — the
 * long-tail of low-liquidity assets is unlikely to be searched in Korean.
 *
 * Translation uses the Gemini Batch API (same pattern as
 * scripts/seedIndicatorTranslationsBatch.ts) rather than the live
 * `translateCompanyNames` helper: the batch path is cheaper, resilient per-chunk,
 * and suited to a one-off offline seed rather than a real-time autocomplete call.
 *
 * Usage:
 *   yarn db:seed:crypto-korean            # full run (submits batches)
 *   DRY_RUN=1 yarn db:seed:crypto-korean  # query + prompt build only, no submit
 *
 * Requires (.env.local): DATABASE_URL (or DIRECT_DATABASE_URL), GEMINI_API_KEY.
 *
 * Flow:
 *   1. Connect to prod DB (postgres-js + drizzle, max:1).
 *   2. SELECT top CRYPTO_KOREAN_TRANSLATE_LIMIT rows by circulating_supply WHERE
 *      korean_name IS NULL — only untranslated rows, most-liquid first.
 *   3. Build one prompt per coin via buildCryptoTranslationPrompt; chunk into
 *      CHUNK_SIZE (300) batches.
 *   4. Per chunk: submit Gemini Batch → poll → process responses → UPSERT
 *      korean_name via onConflictDoUpdate (idempotent on symbol).
 *   5. Per-chunk resilience: failure logs and skips the chunk; remaining chunks
 *      still run.
 */
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { isNull, sql } from 'drizzle-orm';
import type { InlinedRequest, InlinedResponse } from '@google/genai';
import { GoogleGenAI, JobState } from '@google/genai';
import { fileURLToPath } from 'node:url';
import { cryptoAssets } from '../src/shared/db/schema';

// Env reads are deferred to run() (not module-level throws) so the pure helpers
// below (extractKoreanName / buildUpsertValues) can be imported by unit tests
// without DATABASE_URL / GEMINI_API_KEY present. The run() entry point validates
// them before doing any I/O.
const databaseUrl = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? '';
const isDryRun = process.env.DRY_RUN === '1';

/**
 * Translate only the top N coins by circulating_supply — long-tail coins are
 * unlikely to be searched in Korean and translating them wastes Gemini quota.
 * Adjust by setting CRYPTO_KOREAN_TRANSLATE_LIMIT env var or editing this constant.
 */
const CRYPTO_KOREAN_TRANSLATE_LIMIT = Number(
    process.env.CRYPTO_KOREAN_TRANSLATE_LIMIT ?? '300'
);

// Mirrors CHUNK_SIZE in seedIndicatorTranslationsBatch.ts — 300 prompts/batch
// stays within Gemini enqueue token limits for short translation prompts.
const CHUNK_SIZE = 300;
const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const POLL_INTERVAL_MS = 30_000;
const MAX_POLL_MS = 2 * 60 * 60 * 1_000; // 2h
const DRY_RUN_PROMPT_PREVIEW_LENGTH = 200;
const UPSERT_BATCH_SIZE = 500;

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
    /** Canonical crypto symbol (e.g. "BTCUSD"), used as metadata.id for id-based response matching. */
    id: string;
    prompt: string;
}

/**
 * Build a self-contained translation prompt for a single coin English name.
 *
 * Returns a JSON object `{ "SYMBOL": "한국어 이름" }` so the response is
 * unambiguous (coin names can be multi-word; a plain string response risks
 * mis-parsing multi-line output).
 */
function buildCryptoTranslationPrompt(symbol: string, name: string): string {
    return `Translate this cryptocurrency English name to Korean (한국에서 통용되는 한국어 이름 또는 음역).
Return ONLY a JSON object with the symbol as key and the Korean name as value.
Example for Bitcoin: {"BTCUSD":"비트코인"}

Coin:
- ${symbol}: ${name}`;
}

/**
 * Mirrors extractResponseText from seedIndicatorTranslationsBatch.ts.
 * Pulls the first candidate's first text part, returning null when absent or blank.
 */
function extractResponseText(resp: InlinedResponse): string | null {
    const text = resp.response?.candidates?.[0]?.content?.parts?.[0]?.text;
    return typeof text === 'string' && text.trim() !== '' ? text : null;
}

/**
 * Extract the Korean name for `symbol` from a Gemini JSON response body.
 *
 * The prompt asks for `{ "SYMBOL": "한국어 이름" }`, so we parse the JSON object
 * and read the value keyed by the request's symbol. Returns the trimmed string,
 * or null when the response is malformed, an array, missing the key, or blank.
 *
 * Exported so the unit test exercises the real production extraction logic
 * (not a duplicate) — this is the parse path processResponses relies on.
 */
export function extractKoreanName(symbol: string, text: string): string | null {
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch {
        // null signals the caller to skip this coin rather than upsert a bad value.
        return null;
    }
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return null;
    }
    const val = (parsed as Record<string, unknown>)[symbol];
    if (typeof val !== 'string') return null;
    const trimmed = val.trim();
    return trimmed === '' ? null : trimmed;
}

interface CryptoKoreanUpsertValue {
    symbol: string;
    koreanName: string;
}

interface UpsertBuildResult {
    values: CryptoKoreanUpsertValue[];
    skipped: number;
}

interface UpsertRow {
    symbol: string;
    name: string;
    koreanName: string;
}

/**
 * Map a completed batch chunk's responses to upsert values, using id-based
 * matching (metadata.id = symbol) for re-run safety. Pure (no DB / no logging
 * beyond warnings) so the unit test can assert the response→value mapping —
 * including which responses get skipped — without a database.
 *
 * Exported for the same reason as extractKoreanName: the test must run the real
 * mapping, not a copy.
 */
export function buildUpsertValues(
    chunk: readonly PendingRequest[],
    responses: readonly InlinedResponse[]
): UpsertBuildResult {
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
        // Normalize to uppercase so Gemini casing variants (e.g. "btcusd", "BtcUsd")
        // still match the canonical uppercase symbol stored in the DB.
        responseById.set(respId.toUpperCase(), resp);
    }

    const values = chunk.flatMap(({ id: symbol }): CryptoKoreanUpsertValue[] => {
        const response = responseById.get(symbol.toUpperCase());
        if (!response) {
            console.warn(`    [${symbol}] skipped — no matching response found`);
            return [];
        }

        if (response.error) {
            console.warn(
                `    [${symbol}] skipped — response error: ${response.error.message ?? 'unknown'}`
            );
            return [];
        }

        const text = extractResponseText(response);
        if (text === null) {
            console.warn(`    [${symbol}] skipped — empty response text`);
            return [];
        }

        const koreanName = extractKoreanName(symbol, text);
        if (!koreanName) {
            console.warn(
                `    [${symbol}] skipped — could not extract Korean name from response`
            );
            return [];
        }

        return [{ symbol, koreanName }];
    });

    const skipped = chunk.length - values.length;
    return { values, skipped };
}

/**
 * Build the Drizzle insert row for an upsert value. The `name` placeholder is
 * never persisted: every symbol selected by run() already exists in crypto_assets
 * (seeded by seed-crypto-assets.ts), so onConflictDoUpdate always takes the
 * UPDATE path — which only sets korean_name + updatedAt and leaves name untouched.
 * The placeholder exists solely to satisfy the NOT NULL `name` column in the
 * (unreachable) INSERT branch of Drizzle's typed values().
 *
 * Exported so the test can assert the placeholder-name invariant directly.
 */
export function toUpsertRow(value: CryptoKoreanUpsertValue): UpsertRow {
    return {
        symbol: value.symbol,
        name: value.symbol,
        koreanName: value.koreanName,
    };
}

function buildInlinedRequest(id: string, prompt: string): InlinedRequest {
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
 * Polls a submitted Gemini Batch to completion (30s interval, 2h timeout).
 * Mirrors pollUntilComplete from seedIndicatorTranslationsBatch.ts.
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
 * Process one completed Gemini Batch chunk: extract the Korean name from each
 * JSON response, then bulk-UPSERT valid translations into crypto_assets.korean_name.
 *
 * Uses id-based response mapping (metadata.id = symbol) for re-run safety,
 * mirroring processResponses in seedIndicatorTranslationsBatch.ts.
 * onConflictDoUpdate on symbol so re-runs overwrite stale Korean names (unlike
 * the indicator seed's onConflictDoNothing — crypto names may be corrected).
 */
async function processResponses(
    db: Db,
    chunk: readonly PendingRequest[],
    responses: readonly InlinedResponse[]
): Promise<ChunkResult> {
    const { values: upsertValues, skipped } = buildUpsertValues(
        chunk,
        responses
    );

    if (upsertValues.length === 0) {
        return { translated: 0, skipped };
    }

    // Bulk upsert: onConflictDoUpdate on symbol so re-runs update stale/corrected
    // Korean names. `updatedAt` set explicitly (Drizzle skips $onUpdateFn on conflict).
    const upsertLength = upsertValues.length;
    let translated = 0;
    for (let i = 0; i < upsertLength; i += UPSERT_BATCH_SIZE) {
        const batch = upsertValues.slice(i, i + UPSERT_BATCH_SIZE);
        await db
            .insert(cryptoAssets)
            .values(batch.map(toUpsertRow))
            .onConflictDoUpdate({
                target: cryptoAssets.symbol,
                // Only update korean_name (and updatedAt). Preserve existing symbol,
                // name, circulatingSupply populated by seed-crypto-assets.ts.
                set: {
                    koreanName: sql`excluded.korean_name`,
                    updatedAt: sql`now()`,
                },
            });
        translated += batch.length;
    }

    return { translated, skipped };
}

async function run(): Promise<void> {
    // Validate env at the entry point (not module load) so the exported pure
    // helpers stay importable by unit tests without these vars.
    if (!databaseUrl) {
        throw new Error('DIRECT_DATABASE_URL (or DATABASE_URL) env var required');
    }
    if (!isDryRun && !GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY is required in .env.local');
    }

    const client = postgres(databaseUrl, { max: 1 });
    try {
        const db = drizzle(client);

        // Select top N coins by circulating_supply that still need a Korean name.
        // Coins with korean_name already set are excluded for idempotency — re-running
        // after a partial success only retranslates the remaining NULL rows.
        const rows = await db
            .select({
                symbol: cryptoAssets.symbol,
                name: cryptoAssets.name,
            })
            .from(cryptoAssets)
            .where(isNull(cryptoAssets.koreanName))
            .orderBy(sql`${cryptoAssets.circulatingSupply} DESC NULLS LAST`)
            .limit(CRYPTO_KOREAN_TRANSLATE_LIMIT);

        const total = rows.length;
        console.log(
            `Found ${total} crypto assets needing Korean names (limit=${CRYPTO_KOREAN_TRANSLATE_LIMIT})`
        );

        if (total === 0) {
            console.log('Nothing to do — exiting.');
            return;
        }

        const requests: PendingRequest[] = rows.map(r => ({
            id: r.symbol,
            prompt: buildCryptoTranslationPrompt(r.symbol, r.name),
        }));

        if (isDryRun) {
            const sample = requests[0];
            console.log(
                '\n[dry-run] DRY_RUN=1 — query + prompt build only, no batch submitted.'
            );
            console.log(
                `[dry-run] pending=${total} limit=${CRYPTO_KOREAN_TRANSLATE_LIMIT}`
            );
            console.log(
                `[dry-run] model=${GEMINI_MODEL} chunkSize=${CHUNK_SIZE}`
            );
            console.log(
                `[dry-run] sample symbol="${sample.id}" promptChars=${sample.prompt.length}`
            );
            console.log(
                `[dry-run] sample prompt head (first ${DRY_RUN_PROMPT_PREVIEW_LENGTH} chars):\n${sample.prompt.slice(0, DRY_RUN_PROMPT_PREVIEW_LENGTH)}`
            );
            const firstChunk = requests.slice(0, CHUNK_SIZE);
            const firstChunkRequests: InlinedRequest[] = firstChunk.map(r =>
                buildInlinedRequest(r.id, r.prompt)
            );
            console.log(
                `[dry-run] built ${firstChunkRequests.length} InlinedRequest(s) for chunk 1 (not submitted).`
            );
            return;
        }

        const chunkCount = Math.ceil(total / CHUNK_SIZE);
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
                const displayName = `siglens-crypto-korean-${chunkNo}-${Date.now()}`;
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

// Run the seed only when executed directly (`tsx scripts/seed-crypto-korean-names.ts`),
// not when imported by the unit test (which exercises extractKoreanName /
// buildUpsertValues). Mirrors the entry guard in scripts/validate-skills.ts.
const executedDirectly =
    process.argv[1] !== undefined &&
    fileURLToPath(import.meta.url) === process.argv[1];

if (executedDirectly) {
    run().catch((error: unknown) => {
        console.error('[seed-crypto-korean-names] failed:', error);
        process.exitCode = 1;
    });
}
