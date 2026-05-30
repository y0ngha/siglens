import { defineConfig, devices } from '@playwright/test';

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
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
        {
            name: 'webkit',
            grep: /@webkit/,
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
