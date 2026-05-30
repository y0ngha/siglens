import { test, expect } from '../support/fixtures';

/**
 * PWA install surface (`@webkit`) — Tier 3 mobile interactive outcome.
 *
 * The install banner is MOBILE-ONLY: usePwaInstall renders it only when
 * `isMobile && !isStandalone && !isInAppBrowser`, and auto-shows it via a short
 * fallback timer (PWA_BANNER_FALLBACK_DELAY_MS) so no synthetic event is needed.
 * On desktop (chromium) `isMobile` is false → the banner never appears, so this
 * spec is skipped outside the webkit (iPhone 14) project. Layout IS the feature
 * here, hence the real mobile WebKit assertion.
 *
 * The home page (`/`) carries no MobileAnalysisSheet, so unlike symbol pages
 * there is no Radix aria-hidden trap and role queries resolve normally.
 *
 * The `@webkit` tag is repeated on BOTH the describe and the test title because
 * the webkit Playwright project selects specs via `grep: /@webkit/` against the
 * full test title — matching the existing convention in symbol-tabs/symbol-chat.
 *
 * Flow: banner appears → tap 설치하기 → the iOS "add to home screen" modal opens
 * → close it → dismiss the banner. (Dismiss is in-memory only — usePwaInstall's
 * handleDismiss does not persist to localStorage — so we assert the immediate
 * hide and deliberately do NOT assert survival across a reload.)
 */
test.describe('@webkit pwa install', () => {
    test('@webkit shows the install banner, opens the iOS guide, dismisses', async ({
        page,
    }) => {
        test.skip(
            test.info().project.name !== 'webkit',
            'PWA 설치 배너는 모바일(webkit) 환경에서만 노출된다'
        );

        await page.goto('/');

        const installButton = page.getByRole('button', { name: '설치하기' });
        await expect(installButton).toBeVisible();
        await expect(
            page.getByText('앱으로 설치하면 더 빠르게 접속할 수 있어요')
        ).toBeVisible();

        await installButton.click();

        const iosModal = page.getByRole('dialog');
        await expect(iosModal).toBeVisible();
        await expect(
            iosModal.getByRole('heading', { name: '홈 화면에 추가하기' })
        ).toBeVisible();

        await iosModal.getByRole('button', { name: '닫기' }).click();
        await expect(iosModal).toHaveCount(0);

        await page.getByRole('button', { name: '배너 닫기' }).click();
        await expect(installButton).toHaveCount(0);
    });
});
