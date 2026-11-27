import type { Page } from '@playwright/test';
import { FIRST_INPUT_FLAG } from '@/features/pwa-install/lib/firstInputProbe';
import { test, expect } from '../support/fixtures';
import { seedReturnVisit } from '../support/pwaBanner';

/**
 * 홈을 열고, 하이드레이션이 끝났음을 **상호작용으로 증명**한 뒤, 그 입력이 앱에 닿았음을 확인한다.
 * 재방문일 케이스(배너가 뜬다)와 첫 방문일 케이스(배너가 없다)가 이 함수를 그대로 공유하고 시드만 다르다 —
 * 재방문일 케이스가 같은 동기화 지점만으로 배너가 뜬다는 양성 대조가 되어, 첫 방문일의 부재 단언이
 * "훅이 아직 마운트되지 않았다"가 아님을 보인다.
 *
 * 왜 sleep이 없는가: TESTING.md는 고정 시간 대기를 금지하고 관찰 가능한 사건을 기다리라고 한다.
 *
 * 왜 방문 이력 키를 기다리지 않는가: `VisitorPing`은 자동화 브라우저(`navigator.webdriver`)에서 아무것도
 * 쓰지 않아 Playwright에서는 `siglens:visit-history:v1`이 영영 `null`이다.
 *
 * 왜 DOM 표식이 아니라 상호작용인가: `document`의 `__reactContainer$…` 키는 하이드레이션이 **시작**될 때
 * 붙어(측정: 배너 훅이 돌기 200ms 이상 전), 훅의 마운트 이펙트가 돌았다는 증거가 아니다. 모바일 헤더
 * 햄버거(`header-mobile-nav.spec.ts`)는 하이드레이션된 핸들러만 상태를 바꾸고, React는 하이드레이션의
 * 이펙트(배너 훅 포함)를 이 클릭의 처리보다 먼저 돌린다. 그래서 메뉴가 열렸다 닫히면 훅은 이미 마운트됐다.
 *
 * 동기화 지점:
 *  1. 햄버거 클릭 → `메뉴 닫기` 버튼의 `aria-expanded="true"`(하이드레이션 증명). 이 클릭이 첫 입력이다.
 *  2. `Escape`로 닫고 `메뉴 열기` 버튼의 `aria-expanded="false"`(메뉴가 단언을 가리지 않게 한다).
 *  3. 루트 레이아웃의 인라인 프로브가 첫 입력에 세우는 `window` 플래그(`FIRST_INPUT_FLAG`).
 */
async function openHomeAndSendFirstInput(page: Page): Promise<void> {
    await page.goto('/');
    await page.getByRole('button', { name: '메뉴 열기' }).click();
    await expect(
        page.getByRole('button', { name: '메뉴 닫기' })
    ).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await expect(
        page.getByRole('button', { name: '메뉴 열기' })
    ).toHaveAttribute('aria-expanded', 'false');
    await page.waitForFunction(
        flag => (window as unknown as Record<string, unknown>)[flag] === true,
        FIRST_INPUT_FLAG
    );
}

/**
 * PWA install surface (`@webkit`) — Tier 3 mobile interactive outcome.
 *
 * The install banner is MOBILE-ONLY: usePwaInstall renders it only when
 * `isMobile && !isStandalone && !isInAppBrowser`, and it now waits for the
 * FIRST completed user input (`click`/`keydown`, or a bare `pointerup` after a
 * short grace) instead of a post-mount timer —
 * inserting it on a timer shifted the page well outside the CLS input-exclusion
 * window (2026-09-18 mobile measurement: 0.0605 on symbol pages). So the test
 * has to produce a real input event first; the header hamburger click is used
 * (it also proves hydration, see `openHomeAndSendFirstInput`).
 * On desktop (chromium) `isMobile` is false → the banner never appears, so this
 * spec is skipped outside the webkit (iPhone 14) project. Layout IS the feature
 * here, hence the real mobile WebKit assertion.
 *
 * The banner also waits for a RETURN-VISIT day: `usePwaInstall` reads the
 * already-stored first-visit date (`siglens:visit-history:v1`) at mount and mounts
 * nothing on the first recorded day. A fresh Playwright context is always a first
 * visit, so the banner case seeds an earlier first-visit date with
 * `seedReturnVisit` before `goto`, and a second case (no seed) pins that nothing
 * appears on a first visit.
 *
 * The home page (`/`) carries no MobileAnalysisSheet, so unlike symbol pages
 * there is no Radix aria-hidden trap and role queries resolve normally.
 *
 * The `@webkit` tag is repeated on BOTH the describe and the test title because
 * the webkit Playwright project selects specs via `grep: /@webkit/` against the
 * full test title — matching the existing convention in symbol-tabs/symbol-chat.
 *
 * Flow (return visit): banner appears → tap 설치하기 → the iOS "add to home screen" modal opens
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

        // 첫 방문일에는 배너가 없다 — 이전 방문일을 심어 재방문일로 만든다(`goto` 전에).
        await seedReturnVisit(page);
        // 첫 입력(햄버거 클릭)이 배너의 방아쇠다 — 입력 전에는 배너가 존재하지 않는다.
        await openHomeAndSendFirstInput(page);

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

    test('@webkit does not show the install banner on a first visit', async ({
        page,
    }) => {
        test.skip(
            test.info().project.name !== 'webkit',
            'PWA 설치 배너는 모바일(webkit) 환경에서만 노출된다'
        );

        // 이력을 심지 않는다: 새 컨텍스트는 첫 방문일이다. 위 재방문일 케이스와 같은 동기화 지점을 쓴다.
        await openHomeAndSendFirstInput(page);

        await expect(
            page.locator('[data-testid="pwa-banner-shell"]')
        ).toHaveCount(0);
        await expect(
            page.getByRole('button', { name: '설치하기' })
        ).toHaveCount(0);
    });
});
