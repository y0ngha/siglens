import type { Page } from '@playwright/test';

/**
 * 데스크톱 헤더의 버티컬 드롭다운을 열고, 그 안의 지역 링크를 클릭한다.
 *
 * **왜 `trigger.hover()`로 여는가.** 이 메뉴는 마우스 hover로 열린다
 * (`useNavMenuDisclosure`의 `pointerenter`, `pointerType === 'mouse'` 가드). 올려두면
 * 이미 열려 있으니 바로 링크를 누르는 것이 실제 마우스 사용자의 동선이고, 테스트도 그대로
 * 따른다. hover로 열린 메뉴를 클릭해도 닫히지 않지만(클릭은 열림을 고정한다), 클릭이 필요 없는
 * 동선이라 쓰지 않는다.
 *
 * **`mouse.move(0, 0)`이 왜 필요한가.** Playwright의 가상 포인터는 `page.goto()`
 * 뒤에도 마지막 좌표에 그대로 남는다. 직전 테스트가 트리거 위에 포인터를 두고
 * 이동했다면, 새 페이지의 헤더가 마운트되는 순간 그 자리에서 `pointerenter`가 다시
 * 발생해 패널이 "이미 열린" 상태가 된다. 그 상태에서 hover를 걸면 아무 일도 일어나지
 * 않는다 — 순서 의존 실패의 정체가 이것이다.
 *
 * @param page - 테스트 페이지.
 * @param vertical - 헤더 1단 라벨(`시장 분석`, `공포 탐욕 지수`, `뉴스`, `경제`).
 * @param region - 패널 안 지역 라벨(`미국`, `한국`, `암호화폐`). 정확히 일치해야 한다.
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
