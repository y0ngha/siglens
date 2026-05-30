import { defineConfig, devices } from '@playwright/test';
import { AUTH_STORAGE_STATE } from './e2e/support/authUser';

/**
 * Spec routing — three project families, mutually exclusive by file pattern so
 * each spec runs in exactly the right project(s):
 *
 *   setup    → e2e/setup/auth-setup.ts. Logs in through the real /login UI and
 *              writes storageState to .auth/user.json. The `authed` project
 *              depends on it. testDir is overridden to e2e/setup because the
 *              setup file lives outside the specs dir.
 *
 *   authed   → account-*.spec.ts. Runs with the seeded user's storageState so
 *              proxy.ts's /account forward-guard is satisfied. Depends on setup.
 *
 *   chromium → every OTHER spec (Tier 1 + auth-login/signup/reset/oauth), with
 *   / webkit    NO storageState (anonymous). Both testIgnore the account specs
 *              so they never run authed; the authed project's testMatch
 *              conversely excludes them from the anon projects. webkit keeps its
 *              @webkit grep and only runs the iPhone-tagged subset.
 *
 * `globalSetup` (migrate + seed, incl. the auth user) still runs once before
 * all projects, so the user exists before the setup project tries to log in.
 */
const ACCOUNT_SPECS = /account-.*\.spec\.ts/;

export default defineConfig({
    testDir: './e2e/specs',
    globalSetup: './e2e/setup/global-setup.ts',
    fullyParallel: true,
    retries: process.env.CI ? 2 : 0,
    reporter: process.env.CI
        ? [['github'], ['html', { open: 'never' }]]
        : 'list',
    use: {
        baseURL: 'http://localhost:4300',
        trace: 'on-first-retry',
        video: 'retain-on-failure',
        screenshot: 'only-on-failure',
        serviceWorkers: 'block',
    },
    projects: [
        {
            name: 'setup',
            testDir: './e2e/setup',
            testMatch: /auth-setup\.ts/,
        },
        {
            name: 'authed',
            testMatch: ACCOUNT_SPECS,
            dependencies: ['setup'],
            use: {
                ...devices['Desktop Chrome'],
                storageState: AUTH_STORAGE_STATE,
            },
        },
        {
            name: 'chromium',
            testIgnore: ACCOUNT_SPECS,
            use: { ...devices['Desktop Chrome'] },
        },
        {
            name: 'webkit',
            grep: /@webkit/,
            testIgnore: ACCOUNT_SPECS,
            use: { ...devices['iPhone 14'] },
        },
    ],
    webServer: {
        command:
            "node_modules/.bin/dotenv -e .env.e2e -- sh -c 'yarn build && yarn start -p 4300'",
        url: 'http://localhost:4300',
        reuseExistingServer: !process.env.CI,
        // 콜드 `next build`(production 빌드)가 180s를 넘길 수 있어 300s로 상향.
        // webServer.command는 빌드+start를 모두 포함하므로 빌드 시간을 충분히 수용해야 한다.
        timeout: 300_000,
    },
});
