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
 * `usePwaInstall`은 배너를 **첫 입력이 끝난 뒤**(`click`·`keydown`, 또는 `click` 없는
 * `pointerup` 뒤 잠시 후)에 띄운다. 배너는 하단
 * 고정 오버레이라 레이아웃을 밀지는 않지만, 모바일 스펙이 아무 준비 없이 첫
 * `.tap()`을 하면 **그 탭이** 방아쇠가 되고 이후 화면 아래쪽 요소(FAB·시트 띠·
 * 푸터 링크)를 향한 탭이 배너에 가로막힐 수 있다.
 *
 * `goto()` 직후 이 헬퍼를 부르면 첫 입력이 `Tab`으로 소진되고 배너는 닫힌 채로
 * 남는다. 닫기는 localStorage에 기억되므로 같은 컨텍스트에서 이미 닫았다면 배너가
 * 다시 뜨지 않는다 — 그때는 닫기 버튼을 5초씩 기다리지 않고 바로 돌아온다.
 * 배너가 없는 환경(데스크탑 프로젝트 등)에서도 조용히 no-op이다. Ask-AI 링크가 있는 화면은
 * `Tab`만 누르고 바로 돌아온다(배너가 CSS로 숨겨진다).
 *
 * 주의: 이 조기 반환은 배너를 **닫지 않는다**. 배너는 마운트된 채 CSS로만 숨겨져 있어서, 같은 페이지
 * 안에서(풀 로드 없이 클라이언트 이동으로) Ask-AI 링크가 없는 화면(홈·시장 등)으로 넘어가면 그때
 * 배너가 보인다. 그런 이동 뒤에 화면 아래쪽을 누르는 스펙은 이동 후 이 헬퍼를 다시 부르거나 풀
 * 로드(`page.goto`)로 이동해야 한다(풀 로드는 배너 상태를 새로 시작하므로 다시 첫 입력을 기다린다).
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
    // Ask-AI 링크가 있는 화면(종목 탭 전부, 가이드 항목)에서는 배너가 CSS로 숨겨진다
    // (`globals.css`, 하단 오버레이 우선순위). 닫기 버튼이 보일 일이 없으니 5초를 태우지 않는다.
    if ((await page.locator('[data-ask-ai-fab]').count()) > 0) return;
    await page
        .locator('[data-testid="pwa-banner-shell"]')
        .getByRole('button', { name: '배너 닫기' })
        .click({ timeout: 5_000 })
        .catch(() => {});
}
