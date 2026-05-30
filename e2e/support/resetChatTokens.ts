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
 * Transport: the shared SRH (Serverless Redis HTTP) client (`./srhClient`),
 * which uses the Upstash command-array REST format. This is a Node-side fetch
 * (NOT a browser request), so the page-level network guard in `fixtures.ts`
 * does not apply. We delete by pattern (`KEYS chat:tokens:*` → `DEL …`) so the
 * reset is independent of how `hashClientIp` derives the per-IP key.
 */

import { srhCommand } from './srhClient';

const CHAT_TOKEN_KEY_PATTERN = 'chat:tokens:*';

/** Deletes every `chat:tokens:*` key so the chat daily budget starts full. */
export async function resetChatTokens(): Promise<void> {
    // Safe cast: the SRH/Redis `KEYS` command always returns an array of string
    // keys (empty array when no key matches the pattern), never another shape.
    const keys = (await srhCommand([
        'KEYS',
        CHAT_TOKEN_KEY_PATTERN,
    ])) as string[];
    if (keys.length === 0) return;
    await srhCommand(['DEL', ...keys]);
}
