import { test, expect } from '../support/fixtures';

/**
 * Legal pages (`/privacy`, `/terms`) — Tier 3 render outcomes.
 *
 * LegalPageShell renders the policy title as the page <h1>; the document title
 * comes from each route's metadata. Both render from static legal copy + the
 * seeded active terms row (global-setup seeds active privacy/tos terms), so they
 * are fully data-independent and must NOT error with a missing-terms relation.
 */
const LEGAL_PAGES = [
    { path: '/privacy', h1: '개인정보처리방침' },
    { path: '/terms', h1: '이용약관' },
] as const;

test.describe('legal pages', () => {
    for (const legal of LEGAL_PAGES) {
        test(`${legal.path} renders its policy heading and title`, async ({
            page,
        }) => {
            await page.goto(legal.path);

            await expect(
                page.getByRole('heading', { level: 1, name: legal.h1 })
            ).toBeVisible();

            // 문서 title은 "<정책명> | <사이트명>" 형식이므로 정책명으로 시작 여부만 확인.
            await expect(page).toHaveTitle(new RegExp(`^${legal.h1}`));
        });
    }
});
