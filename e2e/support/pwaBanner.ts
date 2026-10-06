import type { Page } from '@playwright/test';
// 이 레포의 spec은 모두 외부 요청 차단 가드가 붙은 `fixtures`의 `test`를 쓴다.
// 여기서는 `test.info()`만 필요하지만 출처를 하나로 맞춘다.
import { test } from './fixtures';
import { PWA_BANNER_DISMISSED_STORAGE_KEY } from '@/features/pwa-install/lib/bannerDismissal';

/**
 * 배너가 실제로 뜨는 프로젝트 — `playwright.config.ts`의 모바일 디바이스 두 개.
 * 데스크탑 프로젝트에서는 `isMobile`이 false라 배너 자체가 렌더되지 않으므로,
 * 여기서 걸러 내지 않으면 `goto`마다 닫기 버튼을 기다리다 5초씩 태운다.
 */
const MOBILE_PROJECTS = new Set(['webkit', 'authed-mobile']);

/**
 * 첫 사용자 입력을 일부러 소비하고 PWA 설치 배너를 닫는다.
 *
 * `usePwaInstall`은 배너를 **첫 `pointerdown`/`keydown`**에 띄운다. 배너는 하단
 * 고정 오버레이라 레이아웃을 밀지는 않지만, 모바일 스펙이 아무 준비 없이 첫
 * `.tap()`을 하면 **그 탭이** 방아쇠가 되고 이후 화면 아래쪽 요소(FAB·시트 띠·
 * 푸터 링크)를 향한 탭이 배너에 가로막힐 수 있다.
 *
 * `goto()` 직후 이 헬퍼를 부르면 첫 입력이 `Tab`으로 소진되고 배너는 닫힌 채로
 * 남는다. 닫기는 localStorage에 기억되므로 같은 컨텍스트에서 이미 닫았다면 배너가
 * 다시 뜨지 않는다 — 그때는 닫기 버튼을 5초씩 기다리지 않고 바로 돌아온다.
 * 배너가 없는 환경(데스크탑 프로젝트 등)에서도 조용히 no-op이다.
 */
export async function settlePwaBanner(page: Page): Promise<void> {
    if (!MOBILE_PROJECTS.has(test.info().project.name)) return;
    const alreadyDismissed = await page.evaluate(key => {
        try {
            return localStorage.getItem(key) !== null;
        } catch {
            return false;
        }
    }, PWA_BANNER_DISMISSED_STORAGE_KEY);
    if (alreadyDismissed) return;
    await page.keyboard.press('Tab');
    await page
        .locator('[data-testid="pwa-banner-shell"]')
        .getByRole('button', { name: '배너 닫기' })
        .click({ timeout: 5_000 })
        .catch(() => {});
}
