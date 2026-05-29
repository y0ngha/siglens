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
        timeout: 180_000,
    },
});
