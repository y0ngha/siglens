import { test, expect } from '../support/fixtures';

/**
 * Legal pages (`/privacy`, `/terms`) + `/about` — Tier 3 render outcomes.
 *
 * LegalPageShell renders the policy title as the page <h1>; the document title
 * comes from each route's metadata. privacy/terms render from static legal copy +
 * the seeded active terms row (global-setup seeds active privacy/tos terms), so
 * they are fully data-independent and must NOT error with a missing-terms
 * relation.
 *
 * `/about` no longer uses the legal shell: it is an intro page (`views/about`)
 * whose h1 is the action headline and whose title leads with "Siglens 소개".
 * It has no DB read, so it only needs its own render check below.
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

test('/about renders the intro page with its example report and FAQ', async ({
    page,
}) => {
    await page.goto('/about');

    await expect(
        page.getByRole('heading', {
            level: 1,
            name: '종목 하나만 입력하면, AI가 한 번에 분석해 드려요',
        })
    ).toBeVisible();
    await expect(page).toHaveTitle(/^Siglens 소개: /);
    await expect(
        page.getByRole('region', { name: 'Siglens 분석 과정 예시' })
    ).toBeVisible();
    await expect(
        page.getByRole('heading', { level: 2, name: '자주 묻는 질문' })
    ).toBeVisible();

    // JSON-LD is checked in the SSR HTML, like the other hub specs: a
    // `<script>` has no rendered text, so a `hasText` locator never matches it.
    // That the FAQPage block is a single source with the visible FAQ is pinned
    // by the route's unit test.
    const html = await (await page.request.get('/about')).text();
    expect(html).toContain('"@type":"AboutPage"');
    expect(html).toContain('"@type":"FAQPage"');
});
