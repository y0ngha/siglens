import { test, expect } from '../support/fixtures';
import { E2E_FORCE_INVESTOR_FLOWS_ERROR_COOKIE } from '@/shared/api/e2eAnalysisStub';

/**
 * 수급(기관·내부자·공매도) 탭 E2E — `/[symbol]/flows`.
 *
 * - 본문은 서버 렌더(RSC)이고 데이터는 `FakeInvestorFlowsDataProvider`(E2E_TEST=1)가 준다: DB·FMP·FINRA를
 *   부르지 않는다. 날짜는 오늘 기준 상대값이라 **숫자·라벨**로 단언한다(날짜 문자열 금지).
 * - AI 해석은 클라이언트 훅이 `runInvestorFlowsAction`을 부르고, E2E에서는 고정 fixture
 *   (`e2e/fixtures/analysis.json`의 `investorFlows`)가 즉시 돌아온다.
 * - `EMPTYX`: 수급 데이터 없음(정상 빈 상태, degrade 아님).
 * - 크립토는 404(탭이 없다). 한국 종목(DART 지분공시)은 `flows-kr.spec.ts`가 검증한다.
 */

// `E2E_FLOWS_PIPELINE=collecting`로 서버를 띄우면 13F·FINRA 파이프라인이 비어 있는 부트스트랩 모습이 된다
// (`flows-collecting.spec.ts`). 이 파일의 본문 단언은 준비가 끝난 모습을 전제하므로 그 모드에서는 건너뛴다.
test.skip(
    process.env.E2E_FLOWS_PIPELINE === 'collecting',
    '수집 중 모드 실행 — flows-collecting.spec.ts가 검증한다'
);

const AI_SUMMARY =
    'E2E 고정 수급 해석: 기관은 순매수, 내부자는 클러스터 매수가 보여요.';
const AI_FETCH_FAILED = '데이터를 불러오지 못했습니다.';
const FORCED_ERROR_LOG = 'E2E 강제 수급 분석 실패 (resilience 테스트용)';

test.describe('flows: happy path', () => {
    test('h1·활성 탭·점수 카드·기준 시점이 렌더된다', async ({ page }) => {
        await page.goto('/AAPL/flows');

        await expect(
            page.getByRole('heading', {
                level: 1,
                name: /AAPL.*기관과 공매도 수급/,
            })
        ).toBeVisible();
        await expect(
            page
                .getByRole('navigation', { name: '분석 종류' })
                .getByRole('link', { name: '수급', exact: true })
        ).toHaveAttribute('aria-current', 'page');

        await expect(
            page.getByRole('heading', { level: 2, name: /수급 점수/ })
        ).toBeVisible();
        // 축별 라벨은 색이 아니라 글자로도 나온다(데이터 부족 포함). 기관·내부자·대량보유·공매도·증자 희석 다섯 축.
        const scorecard = page.locator(
            'section[aria-labelledby="flows-scorecard-heading"]'
        );
        await expect(scorecard.getByRole('heading', { level: 3 })).toHaveCount(
            5
        );

        const asOf = page.locator(
            'section[aria-labelledby="flows-asof-heading"]'
        );
        await expect(asOf).toContainText('제출 완료');
        await expect(asOf).toContainText('부분 집계');
        await expect(asOf).toContainText('마지막 거래일');
        await expect(asOf).toContainText('최대 45일 안에 제출');
        await expect(asOf).toContainText('결제 불이행(FTD)');
        await expect(asOf).toContainText('약 2주 뒤에 공개');
        await expect(asOf).toContainText('Nasdaq, NYSE, Cboe');
    });

    test('기관 IN/OUT 막대와 4분할 카드가 방향을 글자·부호로 보여 준다', async ({
        page,
    }) => {
        await page.goto('/AAPL/flows');

        const chart = page.getByRole('list', { name: /분기별 기관 순매수/ });
        await expect(chart).toBeVisible();
        await expect(
            chart.getByText('IN', { exact: true }).first()
        ).toBeVisible();
        await expect(
            chart.getByText('OUT', { exact: true }).first()
        ).toBeVisible();
        await expect(chart.getByText('부분 집계')).toBeVisible();
        await expect(chart.getByText(/^\+/).first()).toBeVisible();
        await expect(chart.getByText(/^-/).first()).toBeVisible();

        for (const label of [
            '신규 진입',
            '지분 증가',
            '지분 감소',
            '완전 청산',
        ]) {
            // 라벨 옆에 (i) 툴팁 버튼이 붙어 있어 exact 매칭이 안 된다.
            await expect(page.getByText(label).first()).toBeVisible();
        }
        await expect(
            page.getByText(/직전 분기보다 \d+곳 (많아요|적어요)/).first()
        ).toBeVisible();
    });

    test('상위 보유 기관 표에서 신규·청산 필터가 동작한다', async ({
        page,
    }) => {
        await page.goto('/AAPL/flows');

        await expect(
            page
                .getByText('Fixture Index Advisors')
                .filter({ visible: true })
                .first()
        ).toBeVisible();
        await page.getByRole('button', { name: /^완전 청산 \d+$/ }).click();
        await expect(
            page
                .getByText('Fixture Hedge Fund LP')
                .filter({ visible: true })
                .first()
        ).toBeVisible();
        await expect(
            page.getByText('Fixture Index Advisors').filter({ visible: true })
        ).toHaveCount(0);
    });

    test('공매도(FINRA) 구간: 잔고·상환일수·장외(TRF) 비중과 각주가 나온다', async ({
        page,
    }) => {
        await page.goto('/AAPL/flows');

        const short = page.locator(
            'section[aria-labelledby="flows-short-heading"]'
        );
        await expect(short).toBeVisible();
        await expect(short.getByText('공매도 잔고(주)')).toBeVisible();
        await expect(short.getByText('상환일수').first()).toBeVisible();
        await expect(short.getByText('평소보다 급증')).toBeVisible();
        await expect(
            short.getByText(/장외\(TRF\) 보고분 기준이에요/)
        ).toBeVisible();
    });

    test('공매도 구간: 숏스퀴즈 점수 카드가 맨 위, 그 아래 결제 불이행(FTD) 막대와 SEC 안내, 과열 목록 줄이 나온다', async ({
        page,
    }) => {
        await page.goto('/AAPL/flows');

        const short = page.locator(
            'section[aria-labelledby="flows-short-heading"]'
        );
        const squeeze = short.getByTestId('flows-squeeze-card');
        await expect(squeeze).toBeVisible();
        await expect(
            squeeze.getByRole('heading', { level: 3, name: /숏스퀴즈 점수/ })
        ).toBeVisible();
        const ftd = short.getByTestId('flows-ftd');
        await expect(
            ftd.getByRole('img', { name: /결제 불이행이 있던 \d+개 결제일/ })
        ).toBeVisible();
        await expect(
            ftd.getByText(/결제 불이행은 무차입 공매도의 증거가 아니에요/)
        ).toBeVisible();
        await expect(ftd.getByText(/약 2주 뒤에 공개해요/)).toBeVisible();
        const squeezeBox = await squeeze.boundingBox();
        const ftdBox = await ftd.boundingBox();
        expect(squeezeBox!.y).toBeLessThan(ftdBox!.y);
        await expect(
            short
                .getByTestId('flows-threshold')
                .getByText('지금은 과열 목록에 없어요.')
        ).toBeVisible();
    });

    test('SQUEEZX: 과열 목록 등재 배지가 연속 거래일·시장·출처와 함께 나온다', async ({
        page,
    }) => {
        await page.goto('/SQUEEZX/flows');

        const threshold = page
            .locator('section[aria-labelledby="flows-short-heading"]')
            .getByTestId('flows-threshold');
        await expect(threshold.getByText('과열 목록 등재')).toBeVisible();
        await expect(
            threshold.getByText('15거래일 연속, Nasdaq')
        ).toBeVisible();
        await expect(
            threshold.getByText(/출처: Nasdaq, NYSE, Cboe/)
        ).toBeVisible();
    });

    test('기관: 옵션 포지션(풋·콜 명목)과 헤지 안내가 나온다', async ({
        page,
    }) => {
        await page.goto('/AAPL/flows');

        const options = page
            .locator('section[aria-labelledby="flows-institutional-heading"]')
            .getByTestId('flows-options');
        await expect(
            options.getByRole('heading', { level: 3, name: /옵션 포지션/ })
        ).toBeVisible();
        await expect(options.getByText(/헤지일 때가 많아요/)).toBeVisible();
        await expect(options.getByText(/풋\/콜 명목 비율/)).toBeVisible();
    });

    test('내부자: 매도 예정 신고(Form 144) 표에 10b5-1 계획 배지와 SEC 링크가 있다', async ({
        page,
    }) => {
        await page.goto('/AAPL/flows');

        const form144 = page
            .locator('section[aria-labelledby="flows-insider-heading"]')
            .getByTestId('flows-form144');
        await expect(
            form144.getByRole('heading', { level: 3, name: /매도 예정 신고/ })
        ).toBeVisible();
        await expect(
            form144
                .getByText('10b5-1 계획', { exact: true })
                .filter({ visible: true })
        ).toHaveCount(1);
        await expect(
            form144
                .getByRole('link', { name: '매도 예정 신고 공시 보기' })
                .filter({ visible: true })
        ).toHaveCount(3);
    });

    test('증자·희석 공시 섹션: 종류 배지(ATM·선반 등록·사모)와 SEC 원문 링크, 점수 창이 나온다', async ({
        page,
    }) => {
        await page.goto('/AAPL/flows');

        const dilution = page.locator(
            'section[aria-labelledby="flows-dilution-heading"]'
        );
        await expect(
            dilution.getByRole('heading', { level: 2, name: /증자 희석 공시/ })
        ).toBeVisible();
        for (const kind of ['ATM', '선반 등록', '사모']) {
            await expect(
                dilution.getByText(kind, { exact: true })
            ).toBeVisible();
        }
        await expect(
            dilution.getByRole('link', { name: 'SEC 원문' })
        ).toHaveCount(3);
        await expect(dilution.getByText(/점수는 최근 \d+일\(/)).toBeVisible();
    });

    test('내부자: 클러스터 매수 배지와 매수·매도 라벨이 나온다', async ({
        page,
    }) => {
        await page.goto('/AAPL/flows');

        const insider = page.locator(
            'section[aria-labelledby="flows-insider-heading"]'
        );
        await expect(insider.getByText(/클러스터 매수/)).toBeVisible();
        await expect(
            insider
                .getByText('매수', { exact: true })
                .filter({ visible: true })
                .first()
        ).toBeVisible();
        await expect(
            insider
                .getByText('매도', { exact: true })
                .filter({ visible: true })
                .first()
        ).toBeVisible();
    });

    test('용어 (i) 툴팁이 열린다', async ({ page }) => {
        await page.goto('/AAPL/flows');

        const heading = page.getByRole('heading', {
            level: 2,
            name: /수급 점수/,
        });
        await heading.getByRole('button').hover();
        await expect(
            page.getByRole('tooltip').getByText(/점수\(-100~\+100\)로 합친 값/)
        ).toBeVisible();
    });

    test('AI 해석이 첫 섹션이고 수급 점수 카드가 그 아래에 온다', async ({
        page,
    }) => {
        await page.goto('/AAPL/flows');

        const ai = page.getByRole('heading', {
            level: 2,
            name: 'AI 수급 해석',
        });
        await expect(ai).toBeVisible({ timeout: 10_000 });
        await expect(page.getByText(AI_SUMMARY)).toBeVisible({
            timeout: 10_000,
        });

        // AI 해석을 탭 맨 위에 둔다(제품 결정) — 스트림이 도착한 뒤에도 점수 카드·기관·공매도 표는 그 아래다.
        const scoreCard = page.getByRole('heading', {
            level: 2,
            name: /수급 점수/,
        });
        const aiBox = await ai.boundingBox();
        const scoreBox = await scoreCard.boundingBox();
        expect(aiBox).not.toBeNull();
        expect(scoreBox).not.toBeNull();
        expect(aiBox!.y).toBeLessThan(scoreBox!.y);

        // DOM 순서도 같다(SSR 본문이 스켈레톤 뒤에 오지 않는다).
        const headings = await page
            .locator('main h2')
            .evaluateAll(nodes => nodes.map(node => node.textContent ?? ''));
        expect(headings[0]).toContain('AI 수급 해석');
        expect(
            headings.findIndex(text => /수급 점수/.test(text))
        ).toBeGreaterThan(0);
    });

    test('항상 noindex이고 JSON-LD가 SSR에 있다', async ({ page }) => {
        const response = await page.request.get('/AAPL/flows');
        expect(response.status()).toBe(200);
        const html = await response.text();
        expect(html).toMatch(/<meta name="robots" content="noindex/);
        expect(html).toContain('application/ld+json');
    });
});

test.describe('flows: 모바일(390px)', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('표 대신 카드로 나오고 가로 스크롤이 생기지 않는다', async ({
        page,
    }) => {
        await page.goto('/AAPL/flows');
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

        await expect(
            page.locator('table').filter({ visible: true })
        ).toHaveCount(0);
        await expect(
            page
                .getByText('Fixture Index Advisors')
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

test.describe('flows: 데이터 없음', () => {
    test('EMPTYX는 200 + "데이터 없음" 빈 상태(degrade 아님)이고 AI를 부르지 않는다', async ({
        page,
    }) => {
        const response = await page.goto('/EMPTYX/flows');
        expect(response?.status()).toBe(200);

        await expect(
            page.getByRole('heading', {
                level: 1,
                name: /EMPTYX.*기관과 공매도 수급/,
            })
        ).toBeVisible();
        await expect(page.getByText(/데이터 없음: 이 종목은/)).toBeVisible();
        await expect(
            page.getByRole('heading', { name: 'AI 수급 해석' })
        ).toHaveCount(0);
    });
});

test.describe('flows: resilience', () => {
    test('AI 오류 쿠키 → 오류 UI, 수급 본문은 그대로, 다시 시도로 복구', async ({
        page,
        context,
    }) => {
        await context.addCookies([
            {
                name: E2E_FORCE_INVESTOR_FLOWS_ERROR_COOKIE,
                value: '1',
                url: 'http://localhost:4300',
            },
        ]);
        const consoleErrors: string[] = [];
        page.on('console', msg => {
            if (msg.type() === 'error') consoleErrors.push(msg.text());
        });

        await page.goto('/AAPL/flows');

        await expect(
            page.getByRole('alert').filter({ hasText: AI_FETCH_FAILED })
        ).toBeVisible({ timeout: 10_000 });
        await expect
            .poll(
                () =>
                    consoleErrors.some(line => line.includes(FORCED_ERROR_LOG)),
                { timeout: 10_000 }
            )
            .toBe(true);
        await expect(
            page.getByText(FORCED_ERROR_LOG, { exact: false })
        ).toHaveCount(0);
        // 본문은 AI와 독립이다.
        await expect(
            page.getByRole('heading', { level: 2, name: /수급 점수/ })
        ).toBeVisible();

        await context.clearCookies({
            name: E2E_FORCE_INVESTOR_FLOWS_ERROR_COOKIE,
        });
        await page.getByRole('button', { name: '다시 시도' }).click();
        await expect(page.getByText(AI_SUMMARY)).toBeVisible({
            timeout: 10_000,
        });
    });
});

test.describe('flows: 크립토 제외', () => {
    test('크립토는 404다', async ({ page }) => {
        const response = await page.request.get('/BTCUSD/flows');
        expect(response.status()).toBe(404);
    });
});
