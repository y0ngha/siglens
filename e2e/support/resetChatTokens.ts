/**
 * Reset the per-IP chat token budget in the E2E Redis (via SRH) so a chat spec
 * always starts from a full allowance.
 *
 * WHY this exists: `chatAction` → core's chat token store enforces a daily limit
 * (`DAILY_CHAT_LIMIT = 5`) keyed by hashed client IP, persisted in Redis with a
 * ~24h TTL. That state survives across test runs and is NOT reset by
 * `global-setup.ts` (which only migrates/seeds Postgres). A suite that sends
 * several chat messages — multiplied by Playwright retries (CI runs 2) — would
 * otherwise exhaust the budget and get the deterministic-but-wrong
 * `token_exhausted` reply ("오늘 무료 질문 5회를 모두 사용했어요…") instead of the
 * fake LLM answer. Clearing the `chat:tokens:*` keys before each chat test makes
 * the round-trip deterministic regardless of prior runs.
 *
 * Transport: the SRH (Serverless Redis HTTP) endpoint the app itself talks to,
 * using the Upstash command-array REST format. This is a Node-side fetch (NOT a
 * browser request), so the page-level network guard in `fixtures.ts` does not
 * apply. We delete by pattern (`KEYS chat:tokens:*` → `DEL …`) so the reset is
 * independent of how `hashClientIp` derives the per-IP key.
 *
 * URL/token default to the local docker-compose.e2e values (mirrored in
 * `.env.e2e`); `playwright test` does not load `.env.e2e` into the runner
 * process, so env overrides are honored when present but the local defaults keep
 * the helper self-contained and CI-portable (CI uses the same compose stack).
 */

const SRH_URL = process.env.UPSTASH_REDIS_REST_URL ?? 'http://localhost:8079';
const SRH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? 'e2e-token';
const CHAT_TOKEN_KEY_PATTERN = 'chat:tokens:*';

async function srhCommand(command: readonly string[]): Promise<unknown> {
    const res = await fetch(SRH_URL, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${SRH_TOKEN}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(command),
    });
    if (!res.ok) {
        throw new Error(
            `SRH command ${command[0]} failed: ${res.status} ${await res.text()}`
        );
    }
    const json = (await res.json()) as { result?: unknown; error?: string };
    if (json.error) {
        throw new Error(`SRH command ${command[0]} errored: ${json.error}`);
    }
    return json.result;
}

/** Deletes every `chat:tokens:*` key so the chat daily budget starts full. */
export async function resetChatTokens(): Promise<void> {
    const keys = (await srhCommand([
        'KEYS',
        CHAT_TOKEN_KEY_PATTERN,
    ])) as string[];
    if (keys.length === 0) return;
    await srhCommand(['DEL', ...keys]);
}
