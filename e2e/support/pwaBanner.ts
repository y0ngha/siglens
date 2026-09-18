import { test, type Page } from '@playwright/test';

/**
 * 배너가 실제로 뜨는 프로젝트 — `playwright.config.ts`의 모바일 디바이스 두 개.
 * 데스크탑 프로젝트에서는 `isMobile`이 false라 배너 자체가 렌더되지 않으므로,
 * 여기서 걸러 내지 않으면 `goto`마다 닫기 버튼을 기다리다 5초씩 태운다.
 */
const MOBILE_PROJECTS = new Set(['webkit', 'authed-mobile']);

/**
 * 첫 사용자 입력을 일부러 소비하고 PWA 설치 배너를 닫는다.
 *
 * `usePwaInstall`은 배너를 **첫 `pointerdown`/`keydown`**에 띄운다(CLS 수정 —
 * 마운트 뒤 타이머로 띄우면 삽입이 입력 제외 창 밖이라 그대로 CLS가 된다).
 * 그래서 모바일 스펙이 아무 준비 없이 첫 `.tap()`을 하면 **그 탭이** 방아쇠가
 * 된다: 배너가 흐름에 삽입되며 헤더가 3rem 밀리고, 이미 좌표가 정해진 탭의
 * up/click 단계가 대상 밖으로 빗나갈 수 있다.
 *
 * `goto()` 직후 이 헬퍼를 부르면 첫 입력이 `Tab`으로 소진되고 배너는 닫힌 채로
 * 남아, 이후 탭은 안정된 레이아웃 위에서 일어난다. 배너가 없는 환경(데스크탑
 * 프로젝트 등)에서는 조용히 no-op이다 — 기본 30초를 태우지 않도록 5초로 끊는다.
 */
export async function settlePwaBanner(page: Page): Promise<void> {
    if (!MOBILE_PROJECTS.has(test.info().project.name)) return;
    await page.keyboard.press('Tab');
    await page
        .locator('[data-testid="pwa-banner-shell"]')
        .getByRole('button', { name: '배너 닫기' })
        .click({ timeout: 5_000 })
        .catch(() => {});
}
