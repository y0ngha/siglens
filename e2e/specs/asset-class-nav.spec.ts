import { test, expect } from '../support/fixtures';
import { clickHeaderNavRegion } from '../support/headerNav';

/**
 * 3자산군(미국·한국·암호화폐) 동선 — Playwright E2E.
 *
 * 이 스펙이 지키는 것:
 *
 *   - **신규 5개 라우트가 200으로 살아 있고 자기 시장의 h1을 낸다.**
 *     `/news/us` `/news/kr` `/market/kr` `/fear-greed/kr` `/economy/kr`.
 *
 *   - **지역 탭(`RegionTabs`)이 서버 렌더된다.** 활성 지역은 `<span aria-current="page">`,
 *     나머지는 `<a>`다 — 현재 페이지로 가는 링크는 죽은 앵커라 만들지 않는다.
 *
 *   - **헤더 드롭다운 패널이 닫힌 상태에서도 DOM에 있다.** 전 페이지에 렌더되는
 *     이 앵커들이 신규 지역 페이지로 가는 사실상 유일한 전역 링크다. 조건부 렌더로
 *     감추면 크롤러가 영영 못 본다.
 *
 *   - **미국 페이지에 한국 데이터가 새지 않는다.** scope 배선이 이 스펙의 핵심 대상이다.
 *
 * E2E 환경 주의: CI는 **FMP 키 없이** 돈다(의도된 설계). 따라서
 *   - `/market/kr`·`/economy/kr`은 degraded 상태로만 렌더될 수 있다 → 데이터 유무가 아니라
 *     **크롬(제목·지역 탭·랜드마크)** 을 단언한다.
 *   - `/fear-greed/kr`은 `e2eFearGreedFixture`가 결정적 종가를 주므로 게이지까지 렌더된다.
 *   - 뉴스는 `FakeMarketNewsClient`가 카테고리 무관 픽스처를 주므로 카드가 렌더된다.
 */

const NEW_ROUTES = [
    { path: '/news/us', heading: /미국 시장 뉴스/ },
    { path: '/news/kr', heading: /한국 증시 뉴스/ },
    { path: '/market/kr', heading: /한국 주식/ },
    { path: '/fear-greed/kr', heading: /코스피/ },
    { path: '/economy/kr', heading: /한국 경제/ },
] as const;

test.describe('3자산군 신규 라우트', () => {
    for (const { path, heading } of NEW_ROUTES) {
        test(`${path} 가 200으로 자기 시장 h1을 렌더해요 (happy)`, async ({
            page,
        }) => {
            const response = await page.goto(path);
            expect(response?.status()).toBe(200);
            await expect(page.getByRole('heading', { level: 1 })).toHaveText(
                heading
            );
        });
    }

    test('한국 페이지 h1에 "미국"이 들어가지 않아요 (worst)', async ({
        page,
    }) => {
        // 라벨 복사 실수로 한국 페이지가 미국 제목을 쓰면 SEO·UX 양쪽에서 최악이고,
        // 렌더는 정상이라 아무도 모른다.
        for (const path of ['/market/kr', '/fear-greed/kr', '/economy/kr']) {
            await page.goto(path);
            await expect(
                page.getByRole('heading', { level: 1 })
            ).not.toContainText('미국');
        }
    });
});

test.describe('지역 탭', () => {
    test('활성 지역은 링크가 아니라 aria-current 텍스트예요 (happy)', async ({
        page,
    }) => {
        await page.goto('/market/kr');

        const nav = page.getByRole('navigation', { name: '지역 선택' });
        await expect(nav).toBeVisible();
        // 현재 지역은 링크가 아니다.
        await expect(nav.getByRole('link', { name: '한국' })).toHaveCount(0);
        await expect(nav.locator('[aria-current="page"]')).toHaveText('한국');
        // 다른 지역은 링크다.
        await expect(nav.getByRole('link', { name: '미국' })).toHaveAttribute(
            'href',
            '/market'
        );
    });

    test('탭으로 지역을 오갈 수 있어요 (happy)', async ({ page }) => {
        await page.goto('/market');
        await page
            .getByRole('navigation', { name: '지역 선택' })
            .getByRole('link', { name: '한국' })
            .click();
        await expect(page).toHaveURL(/\/market\/kr$/);

        await page
            .getByRole('navigation', { name: '지역 선택' })
            .getByRole('link', { name: '미국' })
            .click();
        await expect(page).toHaveURL(/\/market$/);
    });

    test('뉴스만 암호화폐 지역을 열어요 (happy)', async ({ page }) => {
        await page.goto('/news/us');
        await expect(
            page
                .getByRole('navigation', { name: '지역 선택' })
                .getByRole('link', { name: '암호화폐' })
        ).toHaveAttribute('href', '/news/crypto');

        await page.goto('/market');
        await expect(
            page
                .getByRole('navigation', { name: '지역 선택' })
                .getByRole('link', { name: '암호화폐' })
        ).toHaveCount(0);
    });
});

test.describe('헤더 지역 드롭다운', () => {
    test('닫힌 상태에서도 모든 지역 링크가 DOM에 있어요 (happy)', async ({
        page,
    }) => {
        // 크롤러가 보는 것이 이 마크업이다 — 조건부 렌더면 신규 페이지가 고아가 된다.
        await page.goto('/');

        for (const href of [
            '/market/kr',
            '/fear-greed/kr',
            '/news/kr',
            '/news/crypto',
            '/economy/kr',
        ]) {
            await expect(page.locator(`a[href="${href}"]`).first()).toHaveCount(
                1
            );
        }
    });

    /**
     * 마우스 동선: 트리거에 **올려두면** 열리고, 패널 안 링크를 누르면 이동한다.
     *
     * 트리거를 `click()`하지 않는 이유는 `support/headerNav.ts` 주석 참조 —
     * Playwright의 클릭은 포인터 이동(=hover로 열림) 뒤에 클릭(=토글로 닫힘)이라
     * 순서상 스스로를 무효화한다. 실제 마우스 사용자도 트리거를 누를 이유가 없다.
     */
    test('트리거에 올리면 패널이 열려요 (happy)', async ({ page }) => {
        await page.goto('/');
        await page.mouse.move(0, 0);

        const trigger = page
            .getByRole('banner')
            .getByRole('navigation', { name: '주요 네비게이션' })
            .getByRole('button', { name: /시장 분석/ })
            .first();
        await expect(trigger).toHaveAttribute('aria-expanded', 'false');
        await trigger.hover();
        await expect(trigger).toHaveAttribute('aria-expanded', 'true');

        await clickHeaderNavRegion(page, '시장 분석', '한국');
        await expect(page).toHaveURL(/\/market\/kr$/);
    });

    test('Escape로 닫히고 포커스가 트리거로 돌아와요 (edge)', async ({
        page,
    }) => {
        await page.goto('/');

        await page.mouse.move(0, 0);
        const trigger = page
            .getByRole('banner')
            .getByRole('navigation', { name: '주요 네비게이션' })
            .getByRole('button', { name: /뉴스/ })
            .first();
        // 키보드 사용자 동선: 포커스 후 Enter. 포인터가 관여하지 않으므로
        // hover-open과 클릭 토글이 겹치지 않는다.
        await trigger.focus();
        await page.keyboard.press('Enter');
        await expect(trigger).toHaveAttribute('aria-expanded', 'true');

        await page.keyboard.press('Escape');
        await expect(trigger).toHaveAttribute('aria-expanded', 'false');
        await expect(trigger).toBeFocused();
    });

    test('뉴스는 미국 카테고리까지 한 번에 펼쳐요 (happy)', async ({
        page,
    }) => {
        // 지역 허브를 한 번 더 거치지 않고 헤더에서 곧장 카테고리로 가는 것이
        // 이 메뉴의 존재 이유다.
        await page.goto('/');
        await expect(page.locator('a[href="/news/stock"]').first()).toHaveCount(
            1
        );
        await expect(page.locator('a[href="/news/forex"]').first()).toHaveCount(
            1
        );
    });
});

test.describe('시장 격리', () => {
    test('한국 페이지를 본 뒤에도 미국 페이지가 미국 데이터를 보여줘요 (worst)', async ({
        page,
    }) => {
        // 두 페이지가 같은 클라이언트 캐시를 공유하므로, 쿼리 키에 scope가 없으면
        // 이동 후에도 이전 시장의 시세가 그대로 남는다.
        await page.goto('/market/kr');
        await expect(page.getByRole('heading', { level: 1 })).toContainText(
            '한국'
        );

        await page.goto('/market');
        await expect(page.getByRole('heading', { level: 1 })).toContainText(
            '미국'
        );
        await expect(page.locator('main')).not.toContainText('코스피');
    });
});

test.describe('홈 진입 동선', () => {
    test('히어로 퀵링크가 허브가 아니라 최종 목적지를 가리켜요 (happy)', async ({
        page,
    }) => {
        await page.goto('/');

        const main = page.locator('main');
        await expect(
            main.getByRole('link', { name: /미국 시장 분석/ }).first()
        ).toHaveAttribute('href', '/market');
        await expect(
            main.getByRole('link', { name: /한국 시장 분석/ }).first()
        ).toHaveAttribute('href', '/market/kr');
    });
});
