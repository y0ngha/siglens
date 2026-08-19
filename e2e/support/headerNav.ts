import type { Page } from '@playwright/test';

/**
 * 데스크톱 헤더의 버티컬 드롭다운을 열고, 그 안의 지역 링크를 클릭한다.
 *
 * **왜 `trigger.click()`을 쓰지 않는가.** 이 메뉴는 마우스 hover로도 열린다
 * (`HeaderNavMenu`의 `pointerenter`, `pointerType === 'mouse'` 가드). Playwright의
 * `.click()`은 먼저 포인터를 대상 위로 옮기므로 `pointerenter`가 패널을 열고,
 * 이어지는 click이 토글로 **다시 닫는다**. 실제 마우스 사용자도 같은 순서를 겪지만
 * 그들은 트리거를 누를 이유가 없다 — 올려두면 이미 열려 있으니 바로 링크를 누른다.
 * 테스트도 그 동선을 그대로 따른다.
 *
 * **`mouse.move(0, 0)`이 왜 필요한가.** Playwright의 가상 포인터는 `page.goto()`
 * 뒤에도 마지막 좌표에 그대로 남는다. 직전 테스트가 트리거 위에 포인터를 두고
 * 이동했다면, 새 페이지의 헤더가 마운트되는 순간 그 자리에서 `pointerenter`가 다시
 * 발생해 패널이 "이미 열린" 상태가 된다. 그 상태에서 hover를 걸면 아무 일도 일어나지
 * 않고, click을 걸면 닫힌다 — 순서 의존 실패의 정체가 이것이다.
 *
 * @param page - 테스트 페이지.
 * @param vertical - 헤더 1단 라벨(`시장 분석`·`공포·탐욕 지수`·`뉴스`·`경제`).
 * @param region - 패널 안 지역 라벨(`미국`·`한국`·`암호화폐`). 정확히 일치해야 한다.
 */
export async function clickHeaderNavRegion(
    page: Page,
    vertical: string,
    region: string
): Promise<void> {
    await page.mouse.move(0, 0);

    const trigger = page
        .getByRole('banner')
        .getByRole('navigation', { name: '주요 네비게이션' })
        .getByRole('button', { name: new RegExp(vertical) })
        .first();

    await trigger.hover();

    await page
        .getByRole('list', { name: `${vertical} 바로가기` })
        .getByRole('link', { name: region, exact: true })
        .click();
}
