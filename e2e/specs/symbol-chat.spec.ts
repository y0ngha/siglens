import { test, expect } from '../support/fixtures';

/**
 * `/[symbol]` no longer hosts its own chatbot — the floating button in the
 * bottom-right corner is now a plain link to `ai.siglens.io` with the
 * question prefilled (never auto-sent, per `aiAskUrl`'s contract). This spec
 * replaces the old `symbol-chat.spec.ts`, which drove a full chat round-trip
 * against `chatAction`/`FloatingChatButton` — both deleted.
 *
 * `AI_SITE_URL` resolves to `http://ai.localhost:4300` under `.env.e2e`
 * (`NEXT_PUBLIC_AI_SITE_URL`), same as `agent-chat.spec.ts`.
 */
const AI = 'http://ai.localhost:4300';
const SYMBOL = 'AAPL';

test.describe('symbol page → SIGLENS AI floating link', () => {
    test('기본 로케일(ko)에서 ai 호스트로 질문이 미리 채워진 링크를 낸다', async ({
        page,
    }) => {
        await page.goto(`/${SYMBOL}`);

        const link = page.getByRole('link', {
            name: /SIGLENS AI에게 물어보기/,
        });
        await expect(link).toBeVisible();
        await expect(link).toHaveAttribute('target', '_blank');
        await expect(link).toHaveAttribute('rel', 'noopener');

        const href = await link.getAttribute('href');
        expect(href).not.toBeNull();
        const url = new URL(href!);
        expect(`${url.protocol}//${url.host}`).toBe(AI);
        expect(url.pathname).toBe('/');
        // 질문 본문은 종목명에 따라 갈리므로, 고정된 문구 조각만으로 프리필
        // 계약을 확인한다 — 자동 전송은 아니고 채워지기만 한다(`aiAskUrl` 계약).
        expect(url.searchParams.get('q')).toContain(
            '지금 어떤 상황인지 종합적으로 알려줘'
        );
    });

    test('비기본 로케일(en)에서는 ai 호스트 경로에도 로케일 접두사가 붙는다', async ({
        page,
    }) => {
        await page.goto(`/en/${SYMBOL}`);

        const link = page.getByRole('link', { name: /Ask SIGLENS AI/ });
        await expect(link).toBeVisible();

        const href = await link.getAttribute('href');
        expect(href).not.toBeNull();
        const url = new URL(href!);
        expect(`${url.protocol}//${url.host}`).toBe(AI);
        expect(url.pathname).toBe('/en');
        expect(url.searchParams.get('q')).toContain(
            'Give me an overall read on how'
        );
    });
});
