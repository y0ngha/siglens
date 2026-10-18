import { test, expect } from '../support/fixtures';

/**
 * 한국 종목 수급 탭 E2E — `/[symbol]/flows`의 DART 지분공시 레이아웃.
 *
 * - 데이터는 `FakeInvestorFlowsDataProvider`의 한국 분기가 준다: 가짜 DART 응답(`buildFakeDartData`)을 수집기 파서·스냅샷
 *   조립에 통과시킨 것이라 DB·DART를 부르지 않는다. 접수일은 오늘(KST) 기준 상대값이라 **이름·라벨·숫자**로 단언한다.
 * - 삼성전자(`005930.KS`): 대량보유 2건(국민연금공단·5%를 새로 넘은 픽스처자산운용), 소유보고 2건, 거래계획 1건.
 *   우선주 안내("보통주와 같은 내용")는 단위 테스트가 덮는다 — E2E 종목 해석은 큐레이션 카탈로그라 우선주(`005935.KS`)가 404다.
 * - 미국 전용 원천(13F·FINRA·SEC)은 한국 탭에 없다.
 */

test.skip(
    process.env.E2E_FLOWS_PIPELINE === 'collecting',
    '수집 중 모드 실행 — flows-collecting.spec.ts가 검증한다'
);

const KR_SYMBOL = '005930.KS';
/** E2E 큐레이션 카탈로그에 있어(종목 해석 통과) 가짜 DART에는 없는 회사 — DART "데이터 없음" 빈 상태. */
const KR_WITHOUT_FILINGS = '000660.KS';

test.describe('flows(한국): DART 지분공시', () => {
    test('200이고 지분공시 제목·활성 탭·두 축 점수 카드·DART 출처를 SSR로 낸다', async ({
        page,
    }) => {
        const response = await page.goto(`/${KR_SYMBOL}/flows`);
        expect(response?.status()).toBe(200);

        await expect(
            page.getByRole('heading', {
                level: 1,
                name: /대량보유·임원 지분 공시/,
            })
        ).toBeVisible();
        await expect(
            page
                .getByRole('navigation', { name: '분석 종류' })
                .getByRole('link', { name: '수급', exact: true })
        ).toHaveAttribute('aria-current', 'page');

        const scorecard = page.locator(
            'section[aria-labelledby="flows-scorecard-heading"]'
        );
        await expect(scorecard.getByRole('heading', { level: 3 })).toHaveCount(
            2
        );
        await expect(
            scorecard.getByText(/기관·공매도·증자 희석 점수는 제공하지 않아요/)
        ).toBeVisible();

        const asOf = page.getByTestId('flows-kr-asof');
        await expect(
            asOf.getByText('출처: 금융감독원 전자공시시스템(DART)')
        ).toBeVisible();
        await expect(
            asOf.getByText('기관·외국인 순매수는 제공하지 않아요.')
        ).toBeVisible();
        await expect(page.getByTestId('flows-kr-preferred-note')).toHaveCount(
            0
        );
    });

    test('대량보유·임원·주요주주·거래계획 섹션이 순서대로 나오고 미국 원천 섹션은 없다', async ({
        page,
    }) => {
        await page.goto(`/${KR_SYMBOL}/flows`);

        const major = page.getByTestId('flows-kr-major-holders');
        await expect(
            major.getByText('픽스처자산운용').filter({ visible: true }).first()
        ).toBeVisible();
        await expect(
            major.getByText('국민연금공단').filter({ visible: true }).first()
        ).toBeVisible();
        await expect(
            major
                .getByRole('link', { name: '국민연금공단 DART 원문' })
                .filter({ visible: true })
        ).toHaveAttribute(
            'href',
            /dart\.fss\.or\.kr\/dsaf001\/main\.do\?rcpNo=/
        );

        const insiders = page.getByTestId('flows-kr-insiders');
        await expect(
            insiders.getByText('박주주').filter({ visible: true }).first()
        ).toBeVisible();
        await expect(
            insiders.getByText('부사장').filter({ visible: true }).first()
        ).toBeVisible();

        await expect(
            page.getByTestId('flows-kr-trading-plans').getByText('이임원')
        ).toBeVisible();

        const order = await page
            .locator('main h2')
            .evaluateAll(nodes => nodes.map(node => node.textContent ?? ''));
        // 못 찾으면 -1이 되어 "앞에 있다"가 항상 참이 된다 — 제목이 바뀌면 조용히 통과하지 않도록 먼저 실패시킨다.
        const index = (pattern: RegExp) => {
            const i = order.findIndex(text => pattern.test(text));
            expect(i, `heading ${pattern} not found`).toBeGreaterThanOrEqual(0);
            return i;
        };
        expect(index(/지분 공시 점수/)).toBeLessThan(index(/대량보유 보고/));
        expect(index(/대량보유 보고/)).toBeLessThan(
            index(/임원·주요주주 소유/)
        );
        expect(index(/임원·주요주주 소유/)).toBeLessThan(
            index(/거래계획 보고서/)
        );

        await expect(
            page.locator(
                'section[aria-labelledby="flows-institutional-heading"]'
            )
        ).toHaveCount(0);
        await expect(
            page.locator('section[aria-labelledby="flows-short-heading"]')
        ).toHaveCount(0);
    });

    test('AI 해석은 표 아래에 온다', async ({ page }) => {
        await page.goto(`/${KR_SYMBOL}/flows`);
        const ai = page.getByRole('heading', {
            level: 2,
            name: 'AI 수급 해석',
        });
        await expect(ai).toBeVisible({ timeout: 10_000 });
        const order = await page
            .locator('main h2')
            .evaluateAll(nodes => nodes.map(node => node.textContent ?? ''));
        expect(
            order.findIndex(text => text.includes('AI 수급 해석'))
        ).toBeGreaterThan(
            order.findIndex(text => /거래계획 보고서/.test(text))
        );
    });

    test('항상 noindex이고 JSON-LD가 SSR에 있다', async ({ page }) => {
        const response = await page.request.get(`/${KR_SYMBOL}/flows`);
        expect(response.status()).toBe(200);
        const html = await response.text();
        expect(html).toMatch(/<meta name="robots" content="noindex/);
        expect(html).toContain('application/ld+json');
    });

    test('한국 종목 탭 바에 수급 탭이 있다', async ({ page }) => {
        await page.goto(`/${KR_SYMBOL}`);
        await expect(
            page
                .getByRole('navigation', { name: '분석 종류' })
                .getByRole('link', { name: '수급', exact: true })
        ).toHaveAttribute('href', /\/005930\.KS\/flows$/);
    });
});

test.describe('flows(한국): 모바일(390px)', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('표 대신 카드로 나오고 가로 스크롤이 생기지 않는다', async ({
        page,
    }) => {
        await page.goto(`/${KR_SYMBOL}/flows`);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        await expect(
            page.locator('table').filter({ visible: true })
        ).toHaveCount(0);
        await expect(
            page
                .getByTestId('flows-kr-major-holders')
                .getByText('국민연금공단')
                .filter({ visible: true })
                .first()
        ).toBeVisible();
        const overflow = await page.evaluate(
            () =>
                document.documentElement.scrollWidth -
                document.documentElement.clientWidth
        );
        expect(overflow).toBeLessThanOrEqual(0);
    });
});

test.describe('flows(한국): 데이터 없음', () => {
    test('가짜 DART에 없는 회사는 200 + DART "데이터 없음" 빈 상태이고 AI를 부르지 않는다', async ({
        page,
    }) => {
        const response = await page.goto(`/${KR_WITHOUT_FILINGS}/flows`);
        expect(response?.status()).toBe(200);
        await expect(
            page.getByText(/최근 2년 동안 이 종목의 대량보유·임원 소유 공시/)
        ).toBeVisible();
        await expect(
            page.getByRole('heading', { name: 'AI 수급 해석' })
        ).toHaveCount(0);
    });
});
