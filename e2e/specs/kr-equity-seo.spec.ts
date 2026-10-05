import { POPULAR_TICKERS } from '@/shared/config/popular-tickers';
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
        // ≤120자는 clampSeoDescription이 모든 description(미국 포함)에 구조적으로
        // 강제하므로 여기서 재확인해도 KR 전용 결함을 잡지 못한다(뮤테이션 감사
        // 2026-08-18) — 실제로 의미 있는 단언은 "끝문장까지 살아 있다"는 아래
        // not.toContain('…')뿐이다. 영문 법인명을 함께 넣던 시절엔 137자가 되어
        // 모든 국내 종목에서 끝문장이 잘렸다(그 결함은 '…' 존재로 드러난다).
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
     * `KR_EQUITY_DESCRIPTOR.tabs`에 없다. 본문 가드의 `notFound()`는 이제 **진짜 404**를 낸다
     * — 예전엔 `[symbol]/loading.tsx`·크롬 Suspense 경계 안쪽이라 200으로 샜지만(soft 404)
     * 2026-10-05에 그 서버 경계를 걷어냈다(`symbolNoLoadingBoundaries` 가드). 그래서 상태
     * 코드까지 단언한다. 404 응답에도 not-found UI의 noindex 메타가 실린다.
     */
    test('국내 종목에 없는 탭은 404 + noindex로 나간다', async ({ page }) => {
        for (const tab of ['congress', 'options']) {
            const response = await page.request.get(`/${KR_SYMBOL}/${tab}`);
            expect(response.status()).toBe(404);
            expect(await response.text()).toMatch(
                /<meta name="robots" content="noindex/
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
        // FAQPage 답변 — Google이 rich result로 직접 읽는 표면이다.
        // `SITE_DESCRIPTION`(WebApplication/WebPage/Organization 노드에 공통
        // 임베드됨)이 이미 "한국"을 포함하므로, blocks 전체를 직렬화해 매칭하면
        // FAQPage 본문이 실제로 한국 종목을 언급하는지와 무관하게 항상
        // 통과한다(뮤테이션 감사 2026-08-18) — 그 블록으로 범위를 좁힌다.
        //
        // HowTo 블록도 함께 봤었다. 홈의 "이용 방법" 섹션을 걷어내면서 그
        // 마크업도 뺐다 — 화면에 없는 내용을 설명하는 구조화 데이터를 남기면
        // 규정 위반이라 딸려 나간 것이 아니라 필수 제거였다. 그래서 여기서는
        // **없어야 한다**를 단언한다. 없앤 뒤 다시 살아나면 그때가 결함이다.
        const faqBlock = blocks.find(b => b['@type'] === 'FAQPage');
        expect(faqBlock).toBeDefined();
        expect(JSON.stringify(faqBlock)).toMatch(/코스피|한국/);
        expect(blocks.find(b => b['@type'] === 'HowTo')).toBeUndefined();
    });

    test('홈에서 국내 종목으로 가는 크롤 가능한 링크가 있다', async ({
        page,
    }) => {
        // 검색 자동완성은 `<button>` + router.push라 크롤되지 않는다. 카테고리 그리드가
        // 유일한 인바운드 링크이고, 여기 빠진 종목은 sitemap-only 고아가 된다.
        const html = await (await page.request.get('/')).text();
        expect(html).toContain(`href="/${KR_SYMBOL}"`);
    });

    test('sitemap이 광고할 수 있는 국내 종목이 전부 홈에서 링크된다', async ({
        page,
    }) => {
        // 차트 sitemap 엔트리는 산문(technical 스냅샷)이 있을 때만 실린다. E2E에는
        // LLM 키가 없어 스냅샷이 비므로 sitemap에서 국내 종목을 읽으면 빈 집합이 되어
        // 검사가 무의미해진다. 그래서 sitemap이 광고할 수 있는 전체 후보(큐레이션
        // 국내 종목)를 기준으로 홈 링크를 보고, sitemap이 실은 국내 종목은 그 후보의
        // 부분집합인지 따로 확인한다.
        const sitemap = await (
            await page.request.get('/sitemap-popular.xml')
        ).text();
        const home = await (await page.request.get('/')).text();

        const curatedKr: readonly string[] = POPULAR_TICKERS.filter(symbol =>
            /^\d{6}\.K[SQ]$/.test(symbol)
        );
        expect(curatedKr.length).toBeGreaterThan(0);

        const advertisedKr = [
            ...new Set(
                Array.from(
                    sitemap.matchAll(/<loc>[^<]*\/(\d{6}\.K[SQ])<\/loc>/g),
                    m => m[1]!
                )
            ),
        ];
        expect(
            advertisedKr.filter(symbol => !curatedKr.includes(symbol))
        ).toEqual([]);

        const orphans = curatedKr.filter(
            symbol => !home.includes(`href="/${symbol}"`)
        );
        expect(orphans).toEqual([]);
    });

    // 2026-07 노출 절벽의 원인은 봇에게 677자만 나가던 thin 콘텐츠였다 — 그 인시던트가
    // prewarm 아키텍처 전체를 낳았다. "봇이 받는 KR 본문이 US 대비 얇아지지 않는다"는
    // 회귀 가드가 한때 여기 있었지만, 뮤테이션 감사(2026-08-18)로 삭제했다: E2E 빌드에는
    // FMP·LLM 키가 없어 `seo_analysis_snapshots`가 양쪽 다 비고 `FakeMarketProvider`가
    // 양쪽에 동일한 bars를 주므로 두 경로가 사실상 같은 껍데기를 쓴다 — KR/US 길이비가
    // 구조적으로 ~1.0에 붙박여 있어 0.6배 문턱은 사실상 항상 통과했다(불가위성). 이 환경
    // 자체가 실제 콘텐츠 분량 차를 만들 수 없으므로 상대 비교로도 고칠 수 없다 — 절대
    // 하한과 마찬가지로 키가 있는 프로덕션 빌드에서 검증해야 하고, 배포 실증 체크리스트가
    // 그걸 맡는다.
});
