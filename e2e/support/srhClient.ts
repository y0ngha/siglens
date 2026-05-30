/**
 * Shared SRH (Serverless Redis HTTP) client for E2E test setup.
 *
 * The app talks to Redis through an SRH endpoint using the Upstash command-array
 * REST format. Test helpers reuse the same transport to reset cross-run Redis
 * state (chat token budgets, reanalyze cooldowns) that `global-setup.ts` does
 * NOT clear (it only migrates/seeds Postgres). These are Node-side fetches (NOT
 * browser requests), so the page-level network guard in `fixtures.ts` does not
 * apply.
 *
 * URL/token default to the local docker-compose.e2e values (mirrored in
 * `.env.e2e`); `playwright test` does not load `.env.e2e` into the runner
 * process, so env overrides are honored when present but the local defaults keep
 * the helper self-contained and CI-portable (CI uses the same compose stack).
 */

const SRH_URL = process.env.UPSTASH_REDIS_REST_URL ?? 'http://localhost:8079';
const SRH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? 'e2e-token';

/**
 * Send one Upstash command-array to SRH and return its `result`. Throws on a
 * non-2xx response or an SRH-level `error` so a misconfigured reset fails the
 * test loudly instead of leaving stale Redis state behind.
 */
export async function srhCommand(command: readonly string[]): Promise<unknown> {
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
