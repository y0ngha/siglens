import { test, expect } from '../support/fixtures';
import { expectAskAiDestination } from '../support/askAi';

/**
 * 종목 화면 하단 오버레이 우선순위 — 일시·모달 UI > 모바일 분석 시트 > Ask-AI 링크 > 설치 배너
 * (`globals.css`의 `[data-ask-ai-inline]`·`[data-ask-ai-fab]` 규칙).
 *
 * - 차트 탭(`/AAPL`): Ask-AI 링크는 AI 분석 패널 본문에 인라인으로 있고, 떠 있는 버튼은 숨겨진다.
 * - 다른 종목 탭(`/AAPL/news`): 떠 있는 버튼만 있다.
 * - 모바일(`@webkit`): 시트 핸들만 보이고 떠 있는 버튼도 설치 배너도 보이지 않는다.
 *
 * 숨김은 CSS(`display: none`)라 요소는 DOM에 남는다 — `toBeVisible` 계열로 판정한다. 차트는
 * Suspense 뒤에서 마운트되므로 인라인 링크가 보일 때까지 자동 재시도로 기다린 뒤 숨김을 단언한다
 * (그 전에는 떠 있는 버튼이 아직 보일 수 있다).
 */
const SYMBOL = 'AAPL';
const FLOATING_LINK = '[data-ask-ai-fab]';
const SHEET_HANDLE = '[aria-label="AI 분석 패널 크기 조절"]';

test.describe('symbol overlays: 데스크톱', () => {
    test('차트 탭은 패널 안 인라인 링크만 보이고 떠 있는 버튼은 숨겨진다', async ({
        page,
    }) => {
        test.skip(
            test.info().project.name !== 'chromium',
            '데스크톱 패널은 chromium 프로젝트에서만 검증한다'
        );

        await page.goto(`/${SYMBOL}`);

        const panel = page.getByRole('region', { name: 'AI 차트 분석' });
        const inline = panel.getByRole('link', {
            name: /시그렌즈 AI에게 물어보기/,
        });
        await expect(inline).toBeVisible();
        // 떠 있는 버튼(`symbol-chat.spec.ts`)과 같은 목적지: ai 호스트, 접두사 없는 `/`, 종목 질문.
        await expectAskAiDestination(inline, {
            pathname: '/',
            questionFragment: '지금 어떤 상황인지 종합적으로 알려줘',
        });
        await expect(page.locator(FLOATING_LINK)).toBeHidden();
    });

    test('차트 탭(en)의 인라인 링크는 ai 호스트 /en 경로로 간다', async ({
        page,
    }) => {
        test.skip(
            test.info().project.name !== 'chromium',
            '데스크톱 패널은 chromium 프로젝트에서만 검증한다'
        );

        await page.goto(`/en/${SYMBOL}`);

        const panel = page.getByRole('region', { name: 'AI Chart Analysis' });
        const inline = panel.getByRole('link', { name: /Ask SIGLENS AI/ });
        await expect(inline).toBeVisible();
        await expectAskAiDestination(inline, {
            pathname: '/en',
            questionFragment: 'Give me an overall read on how',
        });
        await expect(page.locator(FLOATING_LINK)).toBeHidden();
    });

    test('다른 종목 탭(news)은 떠 있는 버튼이 보인다', async ({ page }) => {
        test.skip(
            test.info().project.name !== 'chromium',
            '데스크톱 레이아웃은 chromium 프로젝트에서만 검증한다'
        );

        await page.goto(`/${SYMBOL}/news`);

        await expect(page.locator(FLOATING_LINK)).toBeVisible();
        await expect(page.locator('[data-ask-ai-inline]')).toHaveCount(0);
    });
});

test.describe('@webkit symbol overlays: 모바일', () => {
    test('@webkit 차트 탭은 시트 핸들만 보이고 떠 있는 버튼·설치 배너는 보이지 않는다', async ({
        page,
    }) => {
        test.skip(
            test.info().project.name !== 'webkit',
            '모바일 분석 시트는 webkit(모바일)에서만 마운트된다'
        );

        await page.goto(`/${SYMBOL}`);

        await expect(page.locator(SHEET_HANDLE)).toBeVisible();
        // 서버 HTML에도 인라인 링크가 한 벌 있어 `[data-ask-ai-inline]`만으로는 바로 통과한다.
        // 시트(`[data-vaul-drawer]`) 안의 사본이 올라올 때까지 기다린 뒤 떠 있는 버튼 숨김을 본다.
        await expect(
            page.locator('[data-vaul-drawer] [data-ask-ai-inline]')
        ).toBeAttached();
        await expect(page.locator(FLOATING_LINK)).toBeHidden();

        // 첫 입력이 배너의 방아쇠다. 배너는 DOM에 올라오되 CSS로 숨겨진다.
        await page.keyboard.press('Tab');
        const banner = page.locator('[data-testid="pwa-banner-shell"]');
        await expect(banner).toBeAttached();
        await expect(banner).toBeHidden();
    });
});
