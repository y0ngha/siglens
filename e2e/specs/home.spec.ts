import { test, expect } from '../support/fixtures';

/**
 * Home page (`/`) — Tier 3 render + search-nav outcomes.
 *
 * Asserts the stable, data-independent markers the landing page emits from RSC:
 *   - the hero h1 (marketing copy, no FMP/LLM dependency);
 *   - the always-present header ticker search (scoped to the banner landmark —
 *     the same combobox is also rendered in the hero panel, so an unscoped query
 *     would be a strict-mode violation; see smoke.spec.ts);
 *   - searching a symbol lands on the server-rendered symbol page (search
 *     short-circuits to the seeded AAPL row under E2E, never a real API);
 *   - hero quick-links (미국 시장 뉴스 / 미국 경제) navigate to the correct routes.
 *     The same labels exist in the header nav and footer, so these queries are
 *     scoped to `main` to exclude those copies.
 *
 * Chromium-only (no @webkit tag): a desktop render/search check. The mobile PWA
 * banner is covered by pwa-install.spec.ts.
 */
test.describe('home page', () => {
    test('renders the hero and the header ticker search', async ({ page }) => {
        await page.goto('/');

        await expect(
            page.getByRole('heading', {
                level: 1,
                name: /주식과 코인의 가격대 지도\s*시그렌즈\(SIGLENS\)/,
            })
        ).toBeVisible();

        await expect(
            page
                .getByRole('banner')
                .getByRole('combobox', { name: '종목 티커 검색' })
        ).toBeVisible();
    });

    test('searching a symbol navigates to its rendered symbol page', async ({
        page,
    }) => {
        await page.goto('/');

        const search = page
            .getByRole('banner')
            .getByRole('combobox', { name: '종목 티커 검색' });
        await search.fill('aapl');
        await search.press('Enter');

        await page.waitForURL('**/AAPL');
        await expect(
            page.getByRole('heading', { level: 1, name: /AAPL/ })
        ).toBeVisible();
    });

    /**
     * Hero quick-links — 미국 시장 뉴스·미국 경제 링크 클릭 시 올바른 URL로 이동한다.
     *
     * 동일 레이블이 헤더 nav와 푸터에도 존재하므로, `main` 랜드마크로 범위를 제한해
     * 그 사본들과 충돌하지 않도록 한다. 각 검사는 홈에서 새로 시작해 이전 탐색
     * 상태가 이후 링크 조회에 영향을 주지 않게 한다.
     */
    test('히어로 퀵링크로 미국 시장 뉴스·미국 경제로 이동한다', async ({
        page,
    }) => {
        // (a) 미국 시장 뉴스 → /news/us
        //
        // 2026-08 동선 재편: 히어로 퀵링크는 이제 허브(`/news`)가 아니라 **최종
        // 목적지**를 건다. 랜딩에서 원하는 화면까지 클릭이 두 번이 되는 것을 막는 것이
        // 자산군을 1차 축으로 올린 목적이라, 허브 경유가 아니라 지역 페이지로 간다.
        await page.goto('/');
        const main = page.getByRole('main');

        // → is wrapped in <span aria-hidden="true">, so it is excluded from the
        // accessible name. The exact accessible name is '미국 시장 뉴스' / '미국 경제'.
        await main.getByRole('link', { name: '미국 시장 뉴스' }).click();
        await page.waitForURL('**/news/us');

        // (b) 미국 경제 → /economy
        await page.goto('/');
        await page
            .getByRole('main')
            .getByRole('link', { name: '미국 경제' })
            .click();
        await page.waitForURL('**/economy');
    });

    /**
     * 인기 종목은 시장 탭 하나로 묶여 있다. 기본은 미국 주식이고, 탭을 바꾸면 한국 종목이 보이고
     * 미국 종목은 숨는다(둘 다 서버 HTML에는 있다 — 단위 테스트가 링크 집합을 고정한다).
     */
    test('인기 종목 탭을 한국 주식으로 바꾸면 한국 종목이 보이고 미국 종목은 숨는다', async ({
        page,
    }) => {
        await page.goto('/');
        const popular = page.locator('#popular');

        await expect(popular.locator('a[href="/AAPL"]')).toBeVisible();
        await popular.getByRole('tab', { name: '한국 주식' }).click();

        await expect(popular.locator('a[href="/005930.KS"]')).toBeVisible();
        await expect(popular.locator('a[href="/AAPL"]')).toBeHidden();
    });

    test('모바일에서 "모든 업종 보기"를 누르면 접힌 업종 카드가 펼쳐진다', async ({
        page,
    }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('/');
        const popular = page.locator('#popular');
        const titles = popular.locator(
            '[role="tabpanel"]:not([hidden]) h3:visible'
        );

        await expect(titles).toHaveCount(3);
        const button = popular.getByRole('button', { name: '모든 업종 보기' });
        await button.click();

        await expect(button).toHaveCount(0);
        await expect(
            popular.getByRole('button', { name: '접기' })
        ).toHaveAttribute('aria-expanded', 'true');
        expect(await titles.count()).toBeGreaterThan(3);
    });

    /** FAQ는 접혀 있되 첫 문항(브랜드 소개 답변)만 열려 있고, 나머지는 누르면 열린다. */
    test('FAQ는 첫 문항만 열려 있고 세 번째 문항은 눌러서 연다', async ({
        page,
    }) => {
        await page.goto('/');
        const items = page.locator(
            'section[aria-labelledby="faq-heading"] details'
        );

        await expect(items.first()).toHaveJSProperty('open', true);
        await expect(items.nth(2)).toHaveJSProperty('open', false);

        await items.nth(2).locator('summary').click();
        await expect(items.nth(2)).toHaveJSProperty('open', true);
    });

    /**
     * 페이지 길이 소프트 상한 — 섹션이 다시 부풀어 오르는 것을 잡는다.
     *
     * 상한은 WP-25 목표치(메일 카드 꺼짐 기준 모바일 5,500px, 데스크톱 3,600px)다. E2E 픽스처에는 오늘의
     * 신호가 없어 실제보다 짧게 나온다. CI가 첫 실측값을 보고하면 그 값 + 15%로 조인다(측정값은 아래
     * `console.log`와 테스트 첨부에 남는다).
     */
    for (const { name, width, height, ceiling } of [
        { name: 'mobile 390x844', width: 390, height: 844, ceiling: 5500 },
        { name: 'desktop 1440x900', width: 1440, height: 900, ceiling: 3600 },
    ]) {
        test(`페이지 길이가 ${name}에서 상한 이하다`, async ({
            page,
        }, testInfo) => {
            await page.setViewportSize({ width, height });
            await page.goto('/');
            await page.evaluate(() => document.fonts.ready);
            const total = await page.evaluate(
                () => document.documentElement.scrollHeight
            );

            console.log(
                `[home length] ${name}: ${total}px (ceiling ${ceiling})`
            );
            await testInfo.attach('home-length', {
                body: `${name}: ${total}px (ceiling ${ceiling})`,
                contentType: 'text/plain',
            });
            expect(total).toBeLessThanOrEqual(ceiling);
        });
    }
});

/**
 * 홈 공유 카드는 `(home)/opengraph-image.tsx` 파일 컨벤션이 낸다. 메타데이터가 옛 공용
 * `/og-image.png`를 함께 선언하면 `og:image`가 둘이 되어 크롤러가 어느 쪽을 고를지 모른다 —
 * 단위 테스트는 `generateMetadata` 반환값만 보므로, 빌드된 HTML에서 한 장인지 확인한다.
 */
test.describe('home share card', () => {
    /*
     * 이미지 URL 모양은 Next 소스에서 정했다. 파일이 `(home)` 라우트 그룹 아래라
     * `getMetadataRouteSuffix`(next/dist/lib/metadata/get-metadata-route.js)가 부모 경로
     * 해시를 붙여 `opengraph-image-xxxxxx`가 되고, twitter 카드는 별도 라우트
     * `twitter-image-yyyyyy`다. 동적 이미지라 캐시 무효화용 `?hash` 쿼리가 붙을 수 있다.
     * ko는 접두사가 없는 로케일이지만 Next가 매칭된 라우트 경로(`/ko/…`)로 URL을 만든다
     * (src/proxy.ts의 메타데이터 이미지 주석). 소스만으로 ko 모양을 확정할 수 없어
     * `/…`와 `/ko/…` 두 모양을 모두 받는다.
     */
    for (const { path, prefix } of [
        { path: '/', prefix: '(/ko)?' },
        { path: '/en', prefix: '/en' },
    ]) {
        const card = (name: string) =>
            new RegExp(`^https?://[^/]+${prefix}/${name}-[0-9a-z]+(\\?.*)?$`);

        test(`${path}: og:image와 twitter:image가 홈 카드 하나씩이다`, async ({
            page,
        }) => {
            await page.goto(path);

            const og = page.locator('meta[property="og:image"]');
            const twitter = page.locator('meta[name="twitter:image"]');
            await expect(og).toHaveCount(1);
            await expect(twitter).toHaveCount(1);
            await expect(og).toHaveAttribute(
                'content',
                card('opengraph-image')
            );
            await expect(twitter).toHaveAttribute(
                'content',
                card('twitter-image')
            );
            await expect(og).not.toHaveAttribute('content', /og-image\.png/);
            await expect(
                page.locator('meta[property="og:image:type"]')
            ).toHaveAttribute('content', 'image/png');
        });
    }

    test('다른 페이지는 공용 og-image.png를 그대로 쓴다', async ({ page }) => {
        await page.goto('/about');

        await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
            'content',
            /\/og-image\.png/
        );
    });
});
