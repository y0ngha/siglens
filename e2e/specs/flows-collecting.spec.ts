import { test, expect } from '../support/fixtures';

/**
 * 수급 탭의 "수집 중" 안내 E2E — 13F·FINRA 수집 파이프라인이 아직 비어 있는 부트스트랩 기간.
 *
 * **수동 확인용이다 — CI(e2e.yml)는 이 스펙을 실행하지 않는다**(CI 서버는 준비가 끝난 모습이고, 같은 빌드에서 ISR 캐시가
 * 모드 사이에 섞이는 것을 피하려고 전용 잡을 두지 않았다). 단위·컴포넌트 테스트가 CI에서 같은 분기를 덮는다.
 * 실행: `.env.e2e`로 빌드한 뒤 `E2E_FLOWS_PIPELINE=collecting`을 준 서버(`E2E_TEST=1` 필요)에서
 * `yarn test:e2e e2e/specs/flows-collecting.spec.ts --project=chromium`.
 *
 * 서버를 `E2E_FLOWS_PIPELINE=collecting`으로 띄워야 한다(그 모드에서 준비 상태가 `collecting`이고 가짜 공급자가 13F·FINRA
 * 행 없는 스냅샷을 준다 — 실제 DB가 비었을 때와 같다). 이 모드가 아니면 건너뛴다: 기본 E2E 서버는 준비가 끝난 모습이라
 * `flows.spec.ts`가 그쪽을 검증한다. 내부자·13D/G는 FMP 라이브라 이 모드에서도 데이터가 있다.
 */
test.skip(
    process.env.E2E_FLOWS_PIPELINE !== 'collecting',
    'E2E_FLOWS_PIPELINE=collecting 서버에서만 실행한다'
);

test.describe('flows: 수집 중 안내', () => {
    test('13F·공매도 구간이 "데이터 없음" 대신 모으는 중 안내를 SSR로 낸다', async ({
        page,
    }) => {
        await page.goto('/AAPL/flows');

        const institutional = page.locator(
            'section[aria-labelledby="flows-institutional-heading"]'
        );
        await expect(
            institutional.getByText('기관 보유 데이터를 모으는 중이에요')
        ).toBeVisible();
        await expect(institutional.getByText('데이터 없음')).toHaveCount(0);

        const short = page.locator(
            'section[aria-labelledby="flows-short-heading"]'
        );
        await expect(
            short.getByText('FINRA 공매도 데이터를 모으는 중이에요')
        ).toBeVisible();
        await expect(
            short.getByText('결제 불이행 데이터를 모으는 중이에요')
        ).toBeVisible();
        await expect(
            short.getByText('과열 목록을 모으는 중이에요.')
        ).toBeVisible();
    });

    test('Form 144·증자 공시 자리는 "공시 없음" 대신 SEC 공시를 모으는 중이라고 말한다', async ({
        page,
    }) => {
        await page.goto('/AAPL/flows');

        await expect(
            page
                .getByTestId('flows-form144')
                .getByText('SEC 공시를 모으는 중이에요')
        ).toBeVisible();
        const dilution = page.locator(
            'section[aria-labelledby="flows-dilution-heading"]'
        );
        await expect(
            dilution.getByText('SEC 공시를 모으는 중이에요')
        ).toBeVisible();
        await expect(
            dilution.getByText('접수된 증자 희석 공시가 없어요.')
        ).toHaveCount(0);
    });

    test('점수 카드는 기관·공매도·증자 희석 축을 "수집 중"으로 말하고 내부자는 그대로 점수를 낸다', async ({
        page,
    }) => {
        await page.goto('/AAPL/flows');

        const scorecard = page.locator(
            'section[aria-labelledby="flows-scorecard-heading"]'
        );
        await expect(scorecard.getByText('수집 중')).toHaveCount(3);
        await expect(scorecard.getByText('데이터 부족')).toHaveCount(0);
        const insider = scorecard
            .getByRole('heading', { level: 3, name: /^내부자/ })
            .locator('xpath=ancestor::li[1]');
        await expect(insider).not.toContainText('수집 중');
    });

    test('안내는 JS 없이도 보인다(SSR 텍스트, 클라이언트 전용 브리지 아님)', async ({
        browser,
    }) => {
        const context = await browser.newContext({ javaScriptEnabled: false });
        const page = await context.newPage();
        await page.goto('/AAPL/flows');
        await expect(
            page.getByText('기관 보유 데이터를 모으는 중이에요')
        ).toBeVisible();
        await expect(
            page.getByText('FINRA 공매도 데이터를 모으는 중이에요')
        ).toBeVisible();
        await context.close();
    });

    test('탭은 여전히 noindex다', async ({ page }) => {
        await page.goto('/AAPL/flows');
        await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
            'content',
            /noindex/
        );
    });
});

test.describe('flows(한국): DART 수집 중 안내', () => {
    test('DART 백필 전에는 한국 탭이 "지분 공시를 모으는 중"이라고 말하고 13F·FINRA 문구는 없다', async ({
        page,
    }) => {
        await page.goto('/005930.KS/flows');
        await expect(
            page.getByText('지분 공시를 모으는 중이에요')
        ).toBeVisible();
        await expect(page.getByText(/13F|FINRA/)).toHaveCount(0);
    });
});
