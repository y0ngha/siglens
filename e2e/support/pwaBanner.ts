import type { Page } from '@playwright/test';
// 이 레포의 spec은 모두 외부 요청 차단 가드가 붙은 `fixtures`의 `test`를 쓴다.
// 여기서는 `test.info()`만 필요하지만 출처를 하나로 맞춘다.
import { test } from './fixtures';
import { VISIT_HISTORY_STORAGE_KEY } from '@/features/visitor-ping/lib/visitHistoryStorage';

/**
 * 배너가 실제로 뜨는 프로젝트 — `playwright.config.ts`의 모바일 디바이스 두 개.
 * 데스크탑 프로젝트에서는 `isMobile`이 false라 배너 자체가 렌더되지 않으므로 여기서 걸러 낸다.
 */
const MOBILE_PROJECTS = new Set(['webkit', 'authed-mobile']);

/** 첫 방문일이 한참 전이라 어느 날 실행해도 재방문일(`first < today`)이 되는 방문 이력. */
const RETURN_VISIT_HISTORY = JSON.stringify({
    first: '2020-01-01',
    prev: null,
    last: '2020-01-01',
    days: 1,
});

/**
 * 이 컨텍스트를 **재방문일**로 만든다 — `goto()` 전에 불러야 한다(init script는 다음 내비게이션부터 돈다).
 *
 * 설치 배너는 첫 방문일에는 마운트되지 않는다(`usePwaInstall`, 방침 v15 §7의 첫 방문 날짜 읽기).
 * 새 Playwright 컨텍스트는 저장소가 비어 있어 늘 첫 방문이므로, 배너가 **마운트돼 있어야** 의미가 있는
 * 단언(배너가 뜬다, 배너가 CSS로 숨겨져 있다)은 이 헬퍼로 이력을 먼저 심는다. 심지 않은 컨텍스트에서
 * "배너가 보이지 않는다"는 단언은 마운트 자체가 없어서 통과하므로 CSS 숨김을 증명하지 못한다.
 */
export async function seedReturnVisit(page: Page): Promise<void> {
    await page.addInitScript(
        ([key, value]) => {
            try {
                localStorage.setItem(key, value);
            } catch {
                // 저장소가 막힌 브라우저 — 배너가 안 뜨는 것이 올바른 동작이다.
            }
        },
        [VISIT_HISTORY_STORAGE_KEY, RETURN_VISIT_HISTORY]
    );
}

/**
 * 첫 사용자 입력을 일부러 `Tab`으로 소비한다.
 *
 * `usePwaInstall`은 배너를 **첫 입력이 끝난 뒤**(`click`·`keydown`, 또는 `click` 없는 `pointerup` 뒤 잠시
 * 후)에 띄우지만 **첫 방문일에는 마운트하지 않는다**. 새 컨텍스트는 늘 첫 방문이라 이 헬퍼를 부르는
 * 모바일 스펙에서는 배너가 없고, 첫 `.tap()`이 방아쇠가 돼 하단 요소를 가리는 일도 없다 — 그래서 예전처럼
 * 닫기 버튼을 기다리지 않고 `Tab`만 누르고 돌아온다(5초씩 태우지 않는다). 데스크탑 프로젝트에서는 no-op이다.
 *
 * 왜 늘 첫 방문인가: `VisitorPing`은 자동화 브라우저(`navigator.webdriver`)에서 아무것도 쓰지 않아 Playwright에서는
 * 방문 이력(`siglens:visit-history:v1`)이 어느 프로젝트에서도 생기지 않는다. `authed-mobile`의 storageState도
 * 이력을 담지 않는다. 그래서 배너가 마운트돼 있어야 하는 스펙은 `seedReturnVisit`으로 이력을 직접 심는다.
 *
 * 한계: 재방문일로 심은 컨텍스트에서는 이 헬퍼가 배너를 닫지 않는다. 그런 스펙은 배너를 스스로 다룬다
 * (`pwa-install.spec.ts`, `symbol-overlays.spec.ts`).
 */
export async function settlePwaBanner(page: Page): Promise<void> {
    if (!MOBILE_PROJECTS.has(test.info().project.name)) return;
    await page.keyboard.press('Tab');
}
