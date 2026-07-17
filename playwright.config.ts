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
 *   authed   → account-*.spec.ts, plus portfolio-holdings.spec.ts and
 *              portfolio-position.spec.ts (exercise the account-page holdings
 *              section + symbol-page header chip + the member-only "내 위치"
 *              position gauge — all member-only surfaces). Runs with the
 *              seeded user's storageState so proxy.ts's /account
 *              forward-guard is satisfied. Depends on setup.
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
const ACCOUNT_SPECS = /(account-.*|portfolio-(holdings|position))\.spec\.ts/;

export default defineConfig({
    testDir: './e2e/specs',
    globalSetup: './e2e/setup/global-setup.ts',
    fullyParallel: true,
    retries: process.env.CI ? 2 : 0,
    // CI에서는 워커를 1로 직렬화한다. 제약된 러너에서 단일 Next 서버 1개를 여러
    // 워커가 공유하면, DB 쓰기 서버 액션(예: account-api-key 저장)이 Postgres/풀
    // 경합으로 무한 pending("저장 중…")에 빠져 산발적으로 깨진다(관측: 병렬 런에서
    // account-api-key가 15s+ 멈춤, 직렬 런에서는 통과). 속도보다 신뢰성 우선 —
    // 무인 머지 루프를 막는 flake가 더 비싸다. 로컬은 기본 병렬 유지.
    workers: process.env.CI ? 1 : undefined,
    // CI에서는 콜드빌드+제약 러너 지연을 흡수하도록 단언/액션/네비 타임아웃을
    // 넉넉히 잡는다(저렴한 보험). 로컬은 빠른 기본값 유지.
    timeout: process.env.CI ? 60_000 : 30_000,
    expect: { timeout: process.env.CI ? 15_000 : 5_000 },
    reporter: process.env.CI
        ? [['github'], ['html', { open: 'never' }]]
        : 'list',
    use: {
        baseURL: 'http://localhost:4300',
        trace: 'on-first-retry',
        video: 'retain-on-failure',
        screenshot: 'only-on-failure',
        serviceWorkers: 'block',
        actionTimeout: process.env.CI ? 20_000 : 0,
        navigationTimeout: process.env.CI ? 30_000 : 0,
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
