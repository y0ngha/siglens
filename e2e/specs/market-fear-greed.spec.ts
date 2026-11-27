import { test, expect } from '../support/fixtures';
import { clickHeaderNavRegion } from '../support/headerNav';

const PAGE_TITLE = '오늘 미국 증시 심리, 공포 탐욕 지수로 확인';

/**
 * `/fear-greed` — 시장 전체 공포·탐욕 지수 (Tier 3 정적 최상위 라우트).
 *
 * E2E 빌드에는 FMP 키가 없지만 `fetchDailyCloses`가 `isE2E()`에서 결정적 fixture로
 * 갈아타므로, 게이지·기간별 비교·요인 막대까지 실제로 렌더된다. 다만 점수 값 자체는
 * fixture 난수에 달렸으므로 어서션하지 않는다 — 구조와 범위만 본다.
 */
test.describe('market fear & greed', () => {
    /**
     * 최우선 회귀 가드: `src/proxy.ts`의 ticker 케이스 정규화가 하이픈 라우트명을
     * 심볼로 오인해 `/fear-greed`를 `/FEAR-GREED`로 301시킨 적이 있다. App Router는
     * 정적 세그먼트를 우선하므로 빌드 산출물만 보면 정상으로 보이고, 프록시가
     * 라우팅보다 먼저 도는 런타임에서만 깨진다.
     */
    test('리다이렉트 없이 200으로 응답한다 (proxy 대문자 정규화 회귀 가드)', async ({
        page,
    }) => {
        const res = await page.request.get('/fear-greed', {
            maxRedirects: 0,
        });

        expect(res.status()).toBe(200);
    });

    test('h1과 지수 가이드 landmark가 렌더된다', async ({ page }) => {
        await page.goto('/fear-greed');

        await expect(
            page.getByRole('heading', { level: 1, name: PAGE_TITLE })
        ).toBeVisible();

        await expect(
            page.getByRole('heading', {
                level: 2,
                name: '공포탐욕지수 읽는 법',
            })
        ).toBeVisible();
    });

    /**
     * SSR 크롤 텍스트 보장. 이 페이지는 전부 서버 컴포넌트라 JS 없이도 본문이
     * 그대로 박혀야 한다 — 이 사이트는 thin content로 코어 업데이트에 맞은 이력이 있다.
     */
    test('SSR HTML에 지수 설명·점수 구간·요인 설명이 노출된다 (no-JS crawlers)', async ({
        page,
    }) => {
        const res = await page.request.get('/fear-greed');
        expect(res.status()).toBe(200);
        const html = await res.text();

        expect(html).toContain('공포탐욕지수 읽는 법');
        expect(html).toContain('극심한 탐욕');
        expect(html).toContain('시장 모멘텀');
        expect(html).toContain('시장 변동성');
        expect(html).toContain('안전자산 선호');
        expect(html).toContain('하이일드 수요');
        expect(html).toContain('시장 폭');

        // CNN과 구성이 다르다는 고지가 본문에 있어야 한다(FAQ 답변과 일치).
        expect(html).toContain('CNN Fear');
    });

    test('WebPage·BreadcrumbList·FAQPage JSON-LD가 SSR HTML에 포함된다', async ({
        page,
    }) => {
        const res = await page.request.get('/fear-greed');
        const html = await res.text();

        expect(html).toContain('"@type":"WebPage"');
        expect(html).toContain('"@type":"BreadcrumbList"');
        expect(html).toContain('"@type":"FAQPage"');
    });

    /**
     * fixture가 살아 있으면 게이지·비교 4칸·요인 막대 5개가 모두 렌더된다.
     * 점수 숫자는 fixture 난수에 달렸으므로 0~100 범위만 확인한다.
     */
    test('게이지·기간별 비교 4칸·요인 막대 5개가 렌더된다', async ({
        page,
    }) => {
        await page.goto('/fear-greed');

        await expect(
            page.getByRole('heading', { level: 2, name: '기간별 비교' })
        ).toBeVisible();
        await expect(
            page.getByRole('heading', { level: 2, name: '요인별 기여도' })
        ).toBeVisible();

        for (const label of ['현재', '1주 전', '1개월 전', '1년 전']) {
            await expect(page.getByText(label, { exact: true })).toBeVisible();
        }

        // 요인 막대는 각각 progressbar role을 갖는다.
        await expect(page.getByRole('progressbar')).toHaveCount(5);

        const score = await page.evaluate(() => {
            const m = document.body.innerText.match(/(\d+)\s*\/\s*100/);
            return m ? Number(m[1]) : null;
        });
        expect(score).not.toBeNull();
        expect(score as number).toBeGreaterThanOrEqual(0);
        expect(score as number).toBeLessThanOrEqual(100);
    });

    test('헤더 "공포 탐욕 지수 > 미국" 링크 클릭으로 /fear-greed에 도달한다', async ({
        page,
    }) => {
        // 헤더 nav 링크는 lg(1024px) 이상에서만 표시된다 — 그 아래는 햄버거다.
        await page.setViewportSize({ width: 1280, height: 800 });
        await page.goto('/');

        // 2026-08 동선 재편: 헤더가 버티컬 드롭다운이 되면서 지역 라벨이 짧아졌다
        // (`미국 공포 탐욕 지수` → `공포 탐욕 지수` 패널 안의 `미국`).
        await clickHeaderNavRegion(page, '공포 탐욕 지수', '미국');

        await page.waitForURL('**/fear-greed');

        await expect(
            page.getByRole('heading', { level: 1, name: PAGE_TITLE })
        ).toBeVisible();
    });

    test('모바일 viewport(375px)에서 가로 오버플로가 없다', async ({
        page,
    }) => {
        await page.setViewportSize({ width: 375, height: 667 });
        await page.goto('/fear-greed');

        await expect(
            page.getByRole('heading', { level: 1, name: PAGE_TITLE })
        ).toBeVisible();

        const overflow = await page.evaluate(
            () =>
                document.documentElement.scrollWidth -
                document.documentElement.clientWidth
        );
        expect(
            overflow,
            `/fear-greed 375px: 가로 오버플로 ${overflow}px — 레이아웃 회귀`
        ).toBeLessThanOrEqual(0);
    });

    /**
     * sitemap 등록 확인 — 새 최상위 라우트가 정적 sitemap에서 누락되면 색인이 늦는다.
     */
    test('정적 sitemap에 /fear-greed 엔트리가 있다', async ({ page }) => {
        const res = await page.request.get('/sitemap-static.xml');
        expect(res.status()).toBe(200);

        expect(await res.text()).toContain('/fear-greed</loc>');
    });
});

const CRYPTO_PAGE_TITLE = '코인 공포탐욕지수: 오늘 암호화폐 시장 심리';

/**
 * `/fear-greed/crypto` — 암호화폐 시장 공포탐욕지수. `fetchCryptoDailyBars`가
 * `isE2E()`에서 결정적 fixture(종가 + 거래량)로 갈아타므로 게이지·비교·요인 막대 6개가
 * 실제로 렌더된다. 점수 값은 fixture 난수라 어서션하지 않는다.
 */
test.describe('crypto market fear & greed', () => {
    test('리다이렉트 없이 200으로 응답한다', async ({ page }) => {
        const res = await page.request.get('/fear-greed/crypto', {
            maxRedirects: 0,
        });

        expect(res.status()).toBe(200);
    });

    test('fixture 데이터로 게이지·비교 4칸·요인 막대 6개가 렌더된다', async ({
        page,
    }) => {
        await page.goto('/fear-greed/crypto');

        await expect(
            page.getByRole('heading', { level: 1, name: CRYPTO_PAGE_TITLE })
        ).toBeVisible();
        await expect(
            page.getByRole('heading', { level: 2, name: '기간별 비교' })
        ).toBeVisible();
        for (const label of ['현재', '1주 전', '1개월 전', '1년 전']) {
            await expect(page.getByText(label, { exact: true })).toBeVisible();
        }
        await expect(page.getByRole('progressbar')).toHaveCount(6);
    });

    test('SSR HTML에 암호화폐 요인·FAQ·JSON-LD가 노출된다 (no-JS crawlers)', async ({
        page,
    }) => {
        const res = await page.request.get('/fear-greed/crypto');
        const html = await res.text();

        for (const text of [
            '하락 변동성',
            '알트코인 강세',
            '거래대금 흐름',
            'alternative.me',
            '"@type":"WebPage"',
            '"@type":"BreadcrumbList"',
            '"@type":"FAQPage"',
        ]) {
            expect(html).toContain(text);
        }
        // 부정 단언은 `<script>`를 걷어낸 본문에만 건다. next-intl 클라이언트
        // 메시지 페이로드가 모든 시장의 팩터 라벨을 싣고 있어서, 원문 HTML에는
        // 미국 라벨이 늘 들어 있다. 크롤러가 읽는 건 렌더된 본문이다.
        const body = html.replace(/<script[\s\S]*?<\/script>/g, '');
        expect(body).not.toContain('하이일드 수요');
    });

    test('정적 sitemap에 /fear-greed/crypto 엔트리가 있다', async ({
        page,
    }) => {
        const res = await page.request.get('/sitemap-static.xml');

        expect(await res.text()).toContain('/fear-greed/crypto</loc>');
    });
});

/**
 * 공포·탐욕 기록 내려받기 파일. 여섯 공개 경로가 rewrite로 라우트 핸들러에 닿고, 프록시
 * matcher가 `.csv`·`.json`을 건드리지 않아야 한다. E2E fixture는 점수가 있는 점을 20개
 * 넘게 만든다 — 하한 밑으로 내려가면 파일이 503이 되어 아래 테스트가 크게 깨지는데, 그게
 * 의도다.
 */
test.describe('fear & greed data files', () => {
    test('us csv가 200과 noindex 헤더, 헤더 줄, 20줄 이상의 데이터를 돌려준다', async ({
        page,
    }) => {
        const res = await page.request.get('/fear-greed/data.csv', {
            maxRedirects: 0,
        });

        expect(res.status()).toBe(200);
        expect(res.headers()['content-type']).toMatch(/^text\/csv/);
        expect(res.headers()['x-robots-tag']).toBe('noindex');
        const lines = (await res.text()).split('\n').filter(Boolean);
        expect(lines[0]).toBe('date,score,label');
        expect(lines.length - 1).toBeGreaterThanOrEqual(20);
    });

    test('crypto json이 schemaVersion 1과 20점 이상을 돌려준다', async ({
        page,
    }) => {
        const res = await page.request.get('/fear-greed/crypto/data.json', {
            maxRedirects: 0,
        });

        expect(res.status()).toBe(200);
        expect(res.headers()['content-type']).toMatch(/^application\/json/);
        expect(res.headers()['x-robots-tag']).toBe('noindex');
        const body = (await res.json()) as {
            schemaVersion: number;
            points: unknown[];
        };
        expect(body.schemaVersion).toBe(1);
        expect(body.points.length).toBeGreaterThanOrEqual(20);
    });

    test('kr csv가 200이다', async ({ page }) => {
        const res = await page.request.get('/fear-greed/kr/data.csv', {
            maxRedirects: 0,
        });

        expect(res.status()).toBe(200);
        expect(res.headers()['content-type']).toMatch(/^text\/csv/);
        expect(res.headers()['x-robots-tag']).toBe('noindex');
    });

    test('허브 HTML에 DataDownload JSON-LD와 csv 주소가 들어 있다', async ({
        page,
    }) => {
        const res = await page.request.get('/fear-greed');
        const html = await res.text();

        expect(html).toContain('"@type":"DataDownload"');
        expect(html).toContain('/fear-greed/data.csv');
    });
});

/**
 * 허브의 "지난 점수 기록" 카드. 표와 극단 구간 기록은 서버 컴포넌트라 JS 없이 받은 HTML에
 * 그대로 있어야 한다(크롤러가 읽는 건 이 표다). 제목은 next-intl 클라이언트 메시지 페이로드
 * (`<script>`)에도 들어 있으므로 `<script>`를 걷어낸 본문에만 단언한다.
 *
 * E2E fixture는 400일의 연속 달력일을 만들어 점수 있는 점이 약 265개다. 그래서 월별 표는
 * 12개월을 넘지 않아 접힌 `<details>`는 생기지 않고(단위 테스트가 접힘을 고정한다), 차트가
 * 그리는 마지막 252점은 약 8개월에 걸친다.
 */
const HISTORY_HUBS = [
    {
        path: '/fear-greed',
        csv: '/fear-greed/data.csv',
        recent: '최근 20거래일',
    },
    {
        path: '/fear-greed/kr',
        csv: '/fear-greed/kr/data.csv',
        recent: '최근 20거래일',
    },
    // 암호화폐는 매일 거래하므로 "거래일"이 아니라 "일"이다.
    {
        path: '/fear-greed/crypto',
        csv: '/fear-greed/crypto/data.csv',
        recent: '최근 20일',
    },
] as const;

const stripScripts = (html: string): string =>
    html.replace(/<script[\s\S]*?<\/script>/g, '');

test.describe('fear & greed history section', () => {
    for (const { path, csv, recent } of HISTORY_HUBS) {
        test(`${path}: JS 없이 받은 HTML에 기록 카드의 제목·표·내려받기 링크가 있다`, async ({
            page,
        }) => {
            const res = await page.request.get(path);
            expect(res.status()).toBe(200);
            const body = stripScripts(await res.text());

            for (const text of [
                '지난 점수 기록',
                '월별 기록',
                recent,
                '극단 구간 기록',
            ]) {
                expect(body, `${path}에 "${text}"가 없다`).toContain(text);
            }
            // React는 `dateTime`을 그대로 내보내므로 대소문자를 가리지 않는다. 최근 20일 행(날짜 머리 셀)만으로도 20개다. 월별 표의 `<time>`은 더해진다.
            const timeCount = (body.match(/<time datetime="/gi) ?? []).length;
            expect(timeCount).toBeGreaterThanOrEqual(20);

            expect(body).toContain(`href="${csv}"`);
            expect(body).toContain(`href="${csv.replace('.csv', '.json')}"`);
            // 접힘은 닫힌 채로 시작한다(열린 `<details>`는 첫 화면을 밀어낸다).
            expect(body).not.toMatch(/<details[^>]*\sopen/);
        });
    }

    /**
     * 차트 접근성 이름의 기간은 그려지는 점이 걸친 기간에서 나온다. 고정 문구 "최근 1년"이면
     * 252일(약 8개월)을 그리는 이 화면에서 틀리므로 옛 코드는 이 단언을 통과하지 못한다.
     * 차트는 `ssr: false`라 하이드레이션 뒤에야 `role="img"`가 생긴다.
     */
    test('암호화폐 허브의 차트 이름이 실제 기간(8개월)을 말한다', async ({
        page,
    }) => {
        await page.goto('/fear-greed/crypto');

        await expect(
            page.getByRole('img', {
                name: '최근 8개월 공포 탐욕 지수 추이 차트',
            })
        ).toBeVisible();
        await expect(
            page.getByRole('img', { name: '최근 1년 공포 탐욕 지수 추이 차트' })
        ).toHaveCount(0);
    });
});
