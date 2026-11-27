import { expectAskAiDestination } from '../support/askAi';
import { test, expect } from '../support/fixtures';

/**
 * `/[symbol]` no longer hosts its own chatbot — the floating button in the
 * bottom-right corner is now a plain link to `ai.siglens.io` with the
 * question prefilled (never auto-sent, per `aiAskUrl`'s contract). This spec
 * replaces the old `symbol-chat.spec.ts`, which drove a full chat round-trip
 * against `chatAction`/`FloatingChatButton` — both deleted.
 *
 * The link floats on every symbol tab except the chart tab, where the same link is
 * inline in the AI panel and the floating one is hidden (`symbol-overlays.spec.ts`), so
 * this spec uses the news tab.
 *
 * The label has two forms switched at the Tailwind `2xl` breakpoint (1536px):
 * the short label ("AI에게 묻기" / "Ask AI") below it and the long one
 * ("시그렌즈 AI에게 물어보기" / "Ask SIGLENS AI") from it. Desktop Chrome's default
 * viewport is 1280 wide, so the default-viewport tests assert the short label and
 * the 1600×900 tests assert the long one.
 *
 * The AI host (`http://ai.localhost:4300` under `.env.e2e`) comes from
 * `support/askAi.ts`.
 */
const SYMBOL = 'AAPL';
const WIDE_VIEWPORT = { width: 1600, height: 900 };

const KO_QUESTION = '지금 어떤 상황인지 종합적으로 알려줘';
const EN_QUESTION = 'Give me an overall read on how';

test.describe('symbol page → SIGLENS AI floating link (default viewport, short label)', () => {
    test('기본 로케일(ko)에서 ai 호스트로 질문이 미리 채워진 링크를 낸다', async ({
        page,
    }) => {
        await page.goto(`/${SYMBOL}/news`);

        const link = page.getByRole('link', { name: /^AI에게 묻기/ });
        await expect(link).toBeVisible();
        await expectAskAiDestination(link, {
            pathname: '/',
            questionFragment: KO_QUESTION,
        });
    });

    test('비기본 로케일(en)에서는 ai 호스트 경로에도 로케일 접두사가 붙는다', async ({
        page,
    }) => {
        await page.goto(`/en/${SYMBOL}/news`);

        const link = page.getByRole('link', { name: /^Ask AI/ });
        await expect(link).toBeVisible();
        await expectAskAiDestination(link, {
            pathname: '/en',
            questionFragment: EN_QUESTION,
        });
    });
});

test.describe('symbol page → SIGLENS AI floating link (1600px, long label)', () => {
    test.use({ viewport: WIDE_VIEWPORT });

    test('ko: 1536px 이상에서는 긴 라벨이 접근성 이름이 된다', async ({
        page,
    }) => {
        await page.goto(`/${SYMBOL}/news`);

        const link = page.getByRole('link', {
            name: /^시그렌즈 AI에게 물어보기/,
        });
        await expect(link).toBeVisible();
        await expectAskAiDestination(link, {
            pathname: '/',
            questionFragment: KO_QUESTION,
        });
    });

    test('en: 1536px 이상에서는 긴 라벨이 접근성 이름이 된다', async ({
        page,
    }) => {
        await page.goto(`/en/${SYMBOL}/news`);

        const link = page.getByRole('link', { name: /^Ask SIGLENS AI/ });
        await expect(link).toBeVisible();
        await expectAskAiDestination(link, {
            pathname: '/en',
            questionFragment: EN_QUESTION,
        });
    });
});
