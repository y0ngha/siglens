import { test, expect } from '../support/fixtures';

/**
 * 국내 상장 종목의 크롤러 대면 계약 — Tier 4 cross-cutting.
 *
 * 저장소 전체 e2e 43개 스펙 중 한국 종목을 태우는 것이 하나도 없었다. KR 경로의 결함은
 * 대부분 "페이지는 렌더되는데 텍스트가 틀린" 종류라(영문 티커 제목, 잘린 description,
 * 미국 티커 형태 JSON-LD) 단위 테스트가 문자열을 맞게 만들어도 그게 실제 HTML까지
 * 도달하는지는 아무도 검증하지 않았다.
 *
 * `page.request`(raw HTTP)를 쓰는 이유는 형제 스펙(`symbol-seo.spec.ts`)과 같다 —
 * 봇이 색인하는 것은 하이드레이션 이전의 SSR HTML이다.
 *
 * E2E 빌드에는 외부 키가 없다. KR 종목명은 `fetchKrEquityQuoteName`의 E2E seam이
 * 큐레이션 카탈로그로 해석하므로, "시드된 종목은 렌더 / 형상만 맞는 가짜 티커는 404"라는
 * 실제 계약이 그대로 재현된다.
 */

const KR_SYMBOL = '005930.KS';
const KR_KOREAN_NAME = '삼성전자';
/** 형상은 국내 종목이지만 상장돼 있지 않은 코드. */
const KR_UNLISTED = '999999.KS';

const LD_JSON_RE = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g;

function jsonLdBlocks(html: string): Record<string, unknown>[] {
    return Array.from(html.matchAll(LD_JSON_RE), match =>
        JSON.parse(match[1]!)
    ) as Record<string, unknown>[];
}

function metaContent(html: string, name: string): string | null {
    const re = new RegExp(`<meta name="${name}" content="([^"]*)"`, 'i');
    return html.match(re)?.[1] ?? null;
}

function titleOf(html: string): string {
    return html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
}

/** 태그·스크립트를 걷어낸 뒤 남는 가시 텍스트 길이 — 봇이 보는 콘텐츠 분량의 근사치. */
function visibleTextLength(html: string): number {
    const body = html
        .replace(/<script[\s\S]*?<\/script>/g, '')
        .replace(/<style[\s\S]*?<\/style>/g, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    return [...body].length;
}

test.describe('KR equity SEO (crawler-facing)', () => {
    test('국내 종목 페이지가 200으로 렌더되고 h1이 하나다', async ({
        page,
    }) => {
        const response = await page.request.get(`/${KR_SYMBOL}`);
        expect(response.status()).toBe(200);

        const html = await response.text();
        expect((html.match(/<h1[\s>]/g) ?? []).length).toBe(1);
    });

    test('title에 한글 종목명이 들어가고 거래소 접미사는 빠진다', async ({
        page,
    }) => {
        const html = await (await page.request.get(`/${KR_SYMBOL}`)).text();
        const title = titleOf(html);

        // 한국어 사이트가 영문 티커 제목을 내보내던 회귀를 막는다.
        expect(title).toContain(KR_KOREAN_NAME);
        // `.KS`는 yahoo 벤더 규약이라 검색량이 0인데 폭 예산만 먹는다 — 표기에서 뺀다.
        expect(title).toContain('005930');
        expect(title).not.toContain('.KS');
    });

    test('meta description이 예산 안에서 끝문장까지 살아 있다', async ({
        page,
    }) => {
        const html = await (await page.request.get(`/${KR_SYMBOL}`)).text();
        const description = metaContent(html, 'description');

        expect(description).not.toBeNull();
        expect(description).toContain(KR_KOREAN_NAME);
        // 영문 법인명을 함께 넣던 시절엔 137자가 되어 모든 국내 종목에서 끝문장이 잘렸다.
        expect([...description!].length).toBeLessThanOrEqual(120);
        expect(description).not.toContain('…');
    });

    test('JSON-LD가 KRX 접두를 붙인 tickerSymbol을 낸다', async ({ page }) => {
        const html = await (await page.request.get(`/${KR_SYMBOL}`)).text();
        const about = jsonLdBlocks(html)
            .map(block => block['about'] as Record<string, unknown> | undefined)
            .find(node => node?.['@type'] === 'Corporation');

        expect(about).toBeDefined();
        // schema.org는 "거래소 + 종목"을 기대한다. `005930.KS`는 둘 중 어느 쪽도 아니다.
        expect(about!['tickerSymbol']).toBe('KRX:005930');
    });

    /**
     * 국내에는 공직자 매매 공시 제도가 없고 yahoo가 KRX 옵션 체인을 주지 않아, 두 탭은
     * `KR_EQUITY_DESCRIPTOR.tabs`에 없다. 본문 가드가 `notFound()`를 던지지만 **상태는
     * 200으로 남는다** — Next 16.2가 Suspense 경계 안에서 던진 `notFound()`의 상태를
     * 200으로 두기 때문이고, 탭 가용성 판정은 어느 탭인지 알아야 해서 `[symbol]/layout.tsx`로
     * 올릴 수 없다(부모 `loading.tsx`의 Suspense가 자식 세그먼트 레이아웃까지 감싼다).
     * `crypto-symbol.spec.ts`의 `/BTCUSD/options`가 같은 잔여 동작을 이미 고정하고 있다.
     *
     * **그래서 여기서 지켜야 할 것은 상태 코드가 아니라 noindex다.** 색인만 막히면 이
     * 응답은 크롤 예산 낭비지 색인 사고가 아니다. sitemap도 이 두 URL을 싣지 않는다.
     * 언젠가 404로 바뀌면 이 단언이 깨지므로, 그때 두 스펙을 함께 갱신하면 된다.
     */
    test('국내 종목에 없는 탭은 not-found UI + noindex로 나간다', async ({
        page,
    }) => {
        for (const tab of ['congress', 'options']) {
            const response = await page.request.get(`/${KR_SYMBOL}/${tab}`);
            expect(response.status()).toBe(200);

            // 형제 스펙(`symbol-seo.spec.ts`)이 쓰는 것과 같은 직렬화 형태로 맞춘다.
            expect(await response.text()).toMatch(
                /<meta name="robots" content="noindex, nofollow"\/?>/
            );
        }
    });

    test('형상만 맞는 미상장 코드는 빈 페이지가 아니라 404다', async ({
        page,
    }) => {
        expect((await page.request.get(`/${KR_UNLISTED}`)).status()).toBe(404);
    });

    /**
     * 홈은 사이트 전체 주제를 선언하는 가장 강한 신호다. 종전에는 `<title>`·description·
     * FAQPage 답변·HowTo·OG alt가 전부 "미국 주식과 암호화폐"라고만 말하면서 본문에는
     * `한국 주식` 카테고리 그리드를 렌더하고 있었다 — 리터럴이 다섯 군데로 흩어져 있어
     * 하나를 고쳐도 나머지가 남았다. 서빙되는 HTML을 통째로 보는 것이 그걸 잡는 유일한 방법이다.
     */
    test('홈의 메타·구조화 데이터가 국내 시장 커버리지를 함께 선언한다', async ({
        page,
    }) => {
        const html = await (await page.request.get('/')).text();

        expect(titleOf(html)).toContain('한국');
        expect(metaContent(html, 'description')).toContain('한국');

        const blocks = jsonLdBlocks(html);
        const serialized = JSON.stringify(blocks);
        // FAQPage 답변과 HowTo 본문 — Google이 rich result로 직접 읽는 표면이다.
        expect(blocks.some(b => b['@type'] === 'FAQPage')).toBe(true);
        expect(serialized).toMatch(/코스피|한국/);
    });

    test('홈에서 국내 종목으로 가는 크롤 가능한 링크가 있다', async ({
        page,
    }) => {
        // 검색 자동완성은 `<button>` + router.push라 크롤되지 않는다. 카테고리 그리드가
        // 유일한 인바운드 링크이고, 여기 빠진 종목은 sitemap-only 고아가 된다.
        const html = await (await page.request.get('/')).text();
        expect(html).toContain(`href="/${KR_SYMBOL}"`);
    });

    test('sitemap이 광고하는 국내 종목이 전부 홈에서 링크된다', async ({
        page,
    }) => {
        const sitemap = await (
            await page.request.get('/sitemap-popular.xml')
        ).text();
        const home = await (await page.request.get('/')).text();

        const krSymbols = [
            ...new Set(
                Array.from(
                    sitemap.matchAll(/<loc>[^<]*\/(\d{6}\.K[SQ])<\/loc>/g),
                    m => m[1]!
                )
            ),
        ];
        expect(krSymbols.length).toBeGreaterThan(0);

        const orphans = krSymbols.filter(
            symbol => !home.includes(`href="/${symbol}"`)
        );
        expect(orphans).toEqual([]);
    });

    /**
     * 2026-07 노출 절벽의 원인은 봇에게 677자만 나가던 thin 콘텐츠였다. 그 인시던트가
     * prewarm 아키텍처 전체를 낳았는데도 회귀 테스트는 한 번도 만들어지지 않았고,
     * 저장소 어디에도 문자 수를 재는 코드가 없다(측정은 수동 절차 문서로만 남아 있다).
     *
     * **여기서 절대 하한을 걸지 않는 이유**: E2E 빌드에는 FMP·LLM 키가 없고
     * `seo_analysis_snapshots`도 비어 있다. 프로덕션 페이지 분량의 대부분은 그 스냅샷
     * 산문에서 나오므로, 이 환경의 절대 문자 수는 껍데기 크기일 뿐이다(실측 589자 —
     * 절벽 당시 수치보다 낮지만 원인이 다르다). 절대 하한 검증은 키가 있는 프로덕션
     * 빌드에서 해야 하고, 배포 실증 체크리스트가 그걸 맡는다.
     *
     * 이 환경에서 의미 있는 것은 **US 대비 비율**이다. 두 경로가 같은 껍데기를 쓰므로,
     * KR만 조용히 얇아지는 회귀(탭 누락, 데이터 미해석, 폴백 문구로 축소)는 여기서 잡힌다.
     */
    test('봇이 받는 KR 본문이 US 대비 얇아지지 않는다', async ({ page }) => {
        const krLength = visibleTextLength(
            await (await page.request.get(`/${KR_SYMBOL}`)).text()
        );
        const usLength = visibleTextLength(
            await (await page.request.get('/AAPL')).text()
        );

        expect(usLength).toBeGreaterThan(0);
        expect(krLength).toBeGreaterThan(usLength * 0.6);
    });
});
