/**
 * E2E test-mode guard. Server-side actions short-circuit worker/LLM submit
 * paths only when this returns true, so Playwright never reaches real external
 * analysis infrastructure. Keep this helper fixture-free so production traces
 * do not pull in `e2e/fixtures`.
 */
export function isE2E(): boolean {
    return process.env.E2E_TEST === '1';
}
