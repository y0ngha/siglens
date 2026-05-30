import { test, expect } from '../support/fixtures';

/**
 * Contact dialog — Tier 3 interactive outcome.
 *
 * Contact is NOT a route: the Footer renders a "문의하기" trigger (ContactDialog)
 * that opens a role="dialog" containing the ContactForm (title/email/content).
 * The submit action (submitContactAction) persists via DrizzleContactRepository
 * to the LOCAL e2e Postgres — no external service, so nothing extra to fake. A
 * successful submit swaps the form for ContactSubmittedNotice ("문의가 접수되었
 *습니다"). We assert that user outcome, plus that an invalid (empty) submit does
 * NOT succeed (the form stays open).
 *
 * Chromium-only: a desktop interaction check.
 */
test.describe('contact dialog', () => {
    test('submitting the contact form shows the success notice', async ({
        page,
    }) => {
        await page.goto('/');

        await page.getByRole('button', { name: '문의하기' }).click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();

        await dialog.getByLabel('제목').fill('E2E 문의 제목');
        await dialog.getByLabel('이메일').fill('e2e-contact@test.com');
        await dialog
            .getByLabel('문의 내용')
            .fill('E2E 자동화 문의 내용입니다.');

        await dialog.getByRole('button', { name: '문의 보내기' }).click();

        await expect(page.getByText('문의가 접수되었습니다')).toBeVisible();
    });

    test('an empty submit does not succeed', async ({ page }) => {
        await page.goto('/');

        await page.getByRole('button', { name: '문의하기' }).click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();

        await dialog.getByRole('button', { name: '문의 보내기' }).click();

        // 검증 실패 시 폼이 유지되며 성공 안내로 전환되지 않는다.
        await expect(page.getByText('문의가 접수되었습니다')).toHaveCount(0);
        await expect(
            dialog.getByRole('button', { name: '문의 보내기' })
        ).toBeVisible();
    });
});
