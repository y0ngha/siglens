const mocks = vi.hoisted(() => ({
    getMarketSummaryStatic: vi.fn(),
    peekBriefingStatic: vi.fn(),
    getEconomySnapshotStatic: vi.fn(),
    peekMacroBriefingStatic: vi.fn(),
    peekMarketNewsDigestStatic: vi.fn(),
    readHubContentStamp: vi.fn(),
    loadStaticChildEntries: vi.fn(),
}));

vi.mock('@/entities/market-summary/api/marketSummaryStaticCache', () => ({
    getMarketSummaryStatic: mocks.getMarketSummaryStatic,
}));
vi.mock('@/entities/market-summary/api/briefingStaticCache', () => ({
    peekBriefingStatic: mocks.peekBriefingStatic,
}));
vi.mock('@/entities/economy/api/economySnapshotStaticCache', () => ({
    getEconomySnapshotStatic: mocks.getEconomySnapshotStatic,
}));
vi.mock('@/entities/economy/api/macroBriefingStaticCache', () => ({
    peekMacroBriefingStatic: mocks.peekMacroBriefingStatic,
}));
vi.mock('@/entities/market-news/api/marketNewsDigestStaticCache', () => ({
    peekMarketNewsDigestStatic: mocks.peekMarketNewsDigestStatic,
}));
// 해시 함수는 실물이다 — 라우트가 읽은 본문과 크론이 저장한 해시의 일치 규칙이
// 이 테스트의 핵심이라 해시를 목으로 두면 규칙 자체가 검증되지 않는다.
vi.mock('@/shared/cache/hubContentStamp', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@/shared/cache/hubContentStamp')
    >()),
    readHubContentStamp: mocks.readHubContentStamp,
}));
vi.mock('@/app/api/sitemap/_shared/childEntries', () => ({
    loadStaticChildEntries: mocks.loadStaticChildEntries,
}));

import nextConfig from '../../../../../next.config';
import { GET } from '@/app/api/rss/route';
import { RSS_FEED_PATH } from '@/shared/config/rssFeed';
import { buildStaticEntries } from '@/entities/sitemap-entry/lib/buildStaticEntries';
import {
    RSS_ECONOMY_SURFACE,
    rssMarketSurface,
    rssNewsSurface,
} from '@/entities/rss-feed/model';
import { CATEGORY_CONFIG } from '@/entities/market-news/lib/categoryConfig';
import {
    SITEMAP_CACHE_CONTROL,
    SITEMAP_RETRY_AFTER_SECONDS,
    SITEMAP_UNAVAILABLE_BODY,
} from '@/app/api/sitemap/_shared/constants';
import { hashHubBody } from '@/shared/cache/hubContentStamp';
import { SITE_URL } from '@/shared/lib/seo';

const STAMP_AT = '2026-10-04T03:00:00.000Z';
const NEWS_CATEGORIES = Object.keys(CATEGORY_CONFIG);

const US_BODY = {
    summary: '미국 지수는 **상승**했습니다. 기술주가 이끌었습니다.',
    dominantThemes: ['반도체'],
};
const KR_BODY = { summary: '코스피는 약보합이었습니다.', dominantThemes: [] };
const MACRO_BODY = {
    summary: '- 물가 둔화가 이어지고 있습니다. 고용은 견조합니다.',
    highlights: ['금리 동결'],
    regime: 'neutral',
};
function newsBody(category: string) {
    return {
        currentDriverKo: `${category} 시장은 실적 발표에 반응했습니다.`,
        keyEventsKo: ['이벤트'],
    };
}

/** 표면 → 크론이 저장했다고 가정하는 본문. */
function bodies(): Record<string, unknown> {
    return {
        [rssMarketSurface('us')]: US_BODY,
        [rssMarketSurface('kr')]: KR_BODY,
        [RSS_ECONOMY_SURFACE]: MACRO_BODY,
        ...Object.fromEntries(
            NEWS_CATEGORIES.map(c => [rssNewsSurface(c), newsBody(c)])
        ),
    };
}

/** 모든 표면에 대해 "크론이 이 본문을 확인했다"는 스탬프를 준다. */
function stampsMatching(stored: Record<string, unknown>): void {
    mocks.readHubContentStamp.mockImplementation(async (surface: string) =>
        surface in stored
            ? { hash: hashHubBody(stored[surface]), at: STAMP_AT }
            : null
    );
}

function wirePageReaders(current: Record<string, unknown>): void {
    mocks.getMarketSummaryStatic.mockResolvedValue({
        indices: [],
        sectors: [],
    });
    mocks.peekBriefingStatic.mockImplementation(
        async (_summary: unknown, _dateHour: string, scope: { id: string }) =>
            current[rssMarketSurface(scope.id)] ?? null
    );
    mocks.getEconomySnapshotStatic.mockResolvedValue({ snapshot: true });
    // 거시 브리핑 reader는 `{ briefing, generatedAt }` 봉투를 돌려준다.
    mocks.peekMacroBriefingStatic.mockResolvedValue(
        RSS_ECONOMY_SURFACE in current
            ? { briefing: current[RSS_ECONOMY_SURFACE], generatedAt: null }
            : null
    );
    mocks.peekMarketNewsDigestStatic.mockImplementation(
        async (category: string) => current[rssNewsSurface(category)] ?? null
    );
}

function request(host = 'siglens.io'): Request {
    return new Request(`https://${host}/api/rss`, { headers: { host } });
}

function itemGuids(xml: string): string[] {
    return [...xml.matchAll(/<guid isPermaLink="false">([^<]*)<\/guid>/g)].map(
        m => m[1] ?? ''
    );
}

describe('GET /api/rss', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        const stored = bodies();
        wirePageReaders(stored);
        stampsMatching(stored);
        mocks.loadStaticChildEntries.mockResolvedValue(
            buildStaticEntries(new Date('2026-10-04T12:00:00Z'))
        );
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('200과 RSS 콘텐츠 타입, sitemap과 같은 캐시 헤더를 낸다', async () => {
        const res = await GET(request());

        expect(res.status).toBe(200);
        expect(res.headers.get('Content-Type')).toBe(
            'application/rss+xml; charset=utf-8'
        );
        expect(res.headers.get('Cache-Control')).toBe(SITEMAP_CACHE_CONTROL);
    });

    it('스탬프가 본문과 맞는 표면마다 항목을 하나씩 낸다 — 시장 2 + 거시 1 + 뉴스 카테고리 전부', async () => {
        const xml = await (await GET(request())).text();

        expect(itemGuids(xml)).toHaveLength(3 + NEWS_CATEGORIES.length);
        expect(xml).toContain(`<link>${SITE_URL}/market</link>`);
        expect(xml).toContain(`<link>${SITE_URL}/market/kr</link>`);
        expect(xml).toContain(`<link>${SITE_URL}/economy</link>`);
        for (const config of Object.values(CATEGORY_CONFIG)) {
            expect(xml).toContain(
                `<link>${SITE_URL}/news/${config.slug}</link>`
            );
        }
    });

    it('guid는 링크#해시 앞 12자(isPermaLink=false)고 pubDate는 스탬프 시각이다', async () => {
        const xml = await (await GET(request())).text();

        const hash12 = hashHubBody(US_BODY).slice(0, 12);
        expect(xml).toContain(
            `<guid isPermaLink="false">${SITE_URL}/market#${hash12}</guid>`
        );
        expect(xml).toContain(
            `<pubDate>${new Date(STAMP_AT).toUTCString()}</pubDate>`
        );
    });

    it('제목은 한국어 표제다 — 카테고리명은 카테고리 설정의 ko 라벨을 쓴다', async () => {
        const xml = await (await GET(request())).text();

        expect(xml).toContain('<title>미국 시장 브리핑</title>');
        expect(xml).toContain('<title>한국 시장 브리핑</title>');
        expect(xml).toContain('<title>거시 경제 브리핑</title>');
        for (const config of Object.values(CATEGORY_CONFIG)) {
            expect(xml).toContain(`<title>${config.koLabel} 뉴스 요약</title>`);
        }
    });

    it('설명은 소스별 본문 필드를 마크다운을 떼고 쓴다 — 시장·거시는 summary, 뉴스는 currentDriverKo', async () => {
        const xml = await (await GET(request())).text();

        expect(xml).toContain(
            '<description>미국 지수는 상승했습니다. 기술주가 이끌었습니다.</description>'
        );
        expect(xml).toContain(
            '<description>물가 둔화가 이어지고 있습니다. 고용은 견조합니다.</description>'
        );
        expect(xml).toContain(
            '<description>general 시장은 실적 발표에 반응했습니다.</description>'
        );
        expect(xml).not.toContain('**');
        // 본문의 다른 필드는 설명에 섞이지 않는다.
        expect(xml).not.toContain('금리 동결');
    });

    it('긴 본문은 300 code point 이내 문장 경계에서 끊는다', async () => {
        const sentence = '지수는 하루 종일 좁은 범위에서 움직였습니다. ';
        const long = { summary: sentence.repeat(30).trim() };
        const stored = { ...bodies(), [rssMarketSurface('us')]: long };
        wirePageReaders(stored);
        stampsMatching(stored);

        const xml = await (await GET(request())).text();

        const description = xml.match(
            new RegExp(
                `${SITE_URL}/market#[0-9a-f]{12}</guid>[\\s\\S]*?<description>([^<]*)</description>`
            )
        )?.[1];
        expect(description).toBeDefined();
        expect([...(description ?? '')].length).toBeLessThanOrEqual(300);
        expect(description?.endsWith('습니다.')).toBe(true);
    });

    it('스탬프 해시가 현재 본문과 다르면 그 항목을 내지 않는다 — 크론이 본 적 없는 본문이다', async () => {
        const stored = {
            ...bodies(),
            [rssMarketSurface('us')]: { summary: '크론이 확인한 옛 본문' },
        };
        stampsMatching(stored);

        const xml = await (await GET(request())).text();

        expect(xml).not.toContain(`<link>${SITE_URL}/market</link>`);
        // 다른 표면은 영향받지 않는다.
        expect(xml).toContain(`<link>${SITE_URL}/market/kr</link>`);
        expect(itemGuids(xml)).toHaveLength(2 + NEWS_CATEGORIES.length);
    });

    it('스탬프가 없으면 항목을 내지 않는다 — 날짜를 지어내지 않는다', async () => {
        const stored = bodies();
        delete stored[RSS_ECONOMY_SURFACE];
        stampsMatching(stored);

        const xml = await (await GET(request())).text();

        expect(xml).not.toContain(`<link>${SITE_URL}/economy</link>`);
        expect(itemGuids(xml)).toHaveLength(2 + NEWS_CATEGORIES.length);
    });

    it('본문이 없으면(캐시 미스) 스탬프가 있어도 항목을 내지 않는다', async () => {
        const current = bodies();
        delete current[rssNewsSurface('stock')];
        wirePageReaders(current);

        const xml = await (await GET(request())).text();

        expect(xml).not.toContain(`<link>${SITE_URL}/news/stock</link>`);
        expect(itemGuids(xml)).toHaveLength(2 + NEWS_CATEGORIES.length);
    });

    it('읽기가 던지는 소스 하나가 피드 전체를 500으로 만들지 않는다', async () => {
        mocks.peekMacroBriefingStatic.mockRejectedValue(
            new Error('redis down')
        );

        const res = await GET(request());

        expect(res.status).toBe(200);
        const xml = await res.text();
        expect(xml).not.toContain(`<link>${SITE_URL}/economy</link>`);
        expect(itemGuids(xml)).toHaveLength(2 + NEWS_CATEGORIES.length);
    });

    it('정적 sitemap에 실리지 않은 허브(정체돼 빠진 뉴스 카테고리)는 항목에서 뺀다', async () => {
        const now = new Date('2026-10-04T12:00:00Z');
        mocks.loadStaticChildEntries.mockResolvedValue(
            buildStaticEntries(now, {
                newsLatestPublishedAt: {
                    forex: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
                },
            })
        );

        const xml = await (await GET(request())).text();

        expect(xml).not.toContain(`<link>${SITE_URL}/news/forex</link>`);
        expect(xml).toContain(`<link>${SITE_URL}/news/stock</link>`);
    });

    it('항목이 하나도 없어도 유효한 빈 피드를 200으로 낸다', async () => {
        mocks.readHubContentStamp.mockResolvedValue(null);

        const res = await GET(request());

        expect(res.status).toBe(200);
        const xml = await res.text();
        expect(xml).toContain('<channel>');
        expect(xml).toContain('<atom:link');
        expect(xml).not.toContain('<item>');
        expect(xml.trimEnd().endsWith('</rss>')).toBe(true);
    });

    /**
     * 허브가 색인 대상인지 알 수 없으면 피드를 만들 수 없다. 빈 피드를 200으로 내면
     * `Cache-Control`(1시간)이 그 빈 응답을 굳힌다.
     */
    it('정적 sitemap 엔트리 로더가 던지면 503 + Retry-After를 내고 캐시하지 않는다', async () => {
        mocks.loadStaticChildEntries.mockRejectedValue(new Error('db down'));

        const res = await GET(request());

        expect(res.status).toBe(503);
        expect(res.headers.get('Retry-After')).toBe(
            SITEMAP_RETRY_AFTER_SECONDS
        );
        expect(res.headers.get('Cache-Control')).toBeNull();
        expect(await res.text()).toBe(SITEMAP_UNAVAILABLE_BODY);
        expect(console.error).toHaveBeenCalledWith(
            '[rss] static sitemap entries failed:',
            expect.any(Error)
        );
    });

    it('503일 때는 소스를 읽지 않는다', async () => {
        mocks.loadStaticChildEntries.mockRejectedValue(new Error('db down'));

        await GET(request());

        expect(mocks.readHubContentStamp).not.toHaveBeenCalled();
    });

    it('채널 자기 참조 링크는 /rss.xml이다', async () => {
        const xml = await (await GET(request())).text();

        expect(xml).toContain(
            `<atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml"/>`
        );
        expect(xml).toContain('<language>ko</language>');
    });

    it('ai 호스트는 피드가 없다 — 404이고 어떤 소스도 읽지 않는다', async () => {
        const res = await GET(request('ai.siglens.io'));

        expect(res.status).toBe(404);
        expect(mocks.readHubContentStamp).not.toHaveBeenCalled();
        expect(mocks.peekMacroBriefingStatic).not.toHaveBeenCalled();
    });
});

describe('nextConfig RSS rewrite', () => {
    it('공개 /rss.xml을 API 라우트로 보낸다 — 루트 라우트 파일은 [symbol] 동적 라우트에 진다', async () => {
        const rewrites = await nextConfig.rewrites?.();

        expect(rewrites).toContainEqual({
            source: '/rss.xml',
            destination: '/api/rss',
        });
    });

    it('rewrite 출처가 발견 링크가 쓰는 경로 상수와 같다', async () => {
        const rewrites = await nextConfig.rewrites?.();

        expect(rewrites).toContainEqual(
            expect.objectContaining({ source: RSS_FEED_PATH })
        );
    });
});
