/**
 * 페이지 ↔ sitemap parity (2026-10-05).
 *
 * 차트(`technical`)·뉴스(`news`) 탭은 렌더 가능한 산문이 없으면 페이지가 noindex(`no-prose`)이고,
 * sitemap은 같은 판정으로 그 URL을 뺀다. 두 쪽이 **같은 픽스처**에서 같은 결론을 내는지 고정한다 —
 * 어긋나면 "sitemap에 있는데 noindex"(GSC 오류) 또는 "색인되는데 sitemap에 없음"이 생긴다.
 *
 * 페이지 쪽은 실제 `evaluateSymbolIndexability`·`getBlockedSymbolMetadata`를, sitemap 쪽은 실제
 * 저장소(`listFreshSymbolTabs`)·`buildPopularEntries`를 쓴다. SQL 투영(`jsonb_build_object`)만
 * `PROSE_SOURCE_FIELDS`로 고른 필드를 흉내 낸다.
 */
const { mockGetSeoSnapshotsStatic } = vi.hoisted(() => ({
    mockGetSeoSnapshotsStatic: vi.fn(),
}));

vi.mock('@/entities/seo-snapshot/lib/getSnapshotStatic', () => ({
    getSeoSnapshotsStatic: mockGetSeoSnapshotsStatic,
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getBlockedSymbolMetadata } from '@/app/[locale]/[symbol]/symbolIndexabilityMetadata';
import { DrizzleSeoSnapshotRepository } from '@/entities/seo-snapshot/api';
import { PROSE_SOURCE_FIELDS } from '@/entities/seo-snapshot/lib/hasProseForTab';
import type { SeoSnapshotTab } from '@/entities/seo-snapshot/model';
import { buildPopularEntries } from '@/entities/sitemap-entry/lib/buildPopularEntries';
import {
    PROSE_GATED_SITEMAP_TABS,
    snapshotKey,
    type ProseGatedSitemapTab,
} from '@/entities/sitemap-entry/lib/proseGate';
import type { SiglensDatabase } from '@/shared/db/types';
import { SITE_URL } from '@/shared/lib/seo';
import type { AssetInfo } from '@/shared/lib/types';

const NOW = new Date('2026-10-05T12:00:00Z');
const SYMBOL = 'AAPL';
const ASSET_INFO = { symbol: SYMBOL, name: 'Apple Inc.' } as AssetInfo;

const FIXTURES: ReadonlyArray<{
    name: string;
    tab: ProseGatedSitemapTab;
    content: unknown;
    indexed: boolean;
}> = [
    {
        name: 'technical 산문 있음',
        tab: 'technical',
        content: { summary: '추세가 유지되고 있다.' },
        indexed: true,
    },
    {
        name: 'technical 필드는 있으나 비어 있음',
        tab: 'technical',
        content: { summary: '   ', patternSummaries: [], strategyResults: [] },
        indexed: false,
    },
    {
        name: 'technical 손상 JSONB(객체 아님)',
        tab: 'technical',
        content: 'garbage',
        indexed: false,
    },
    {
        name: 'news 산문 있음',
        tab: 'news',
        content: { currentDriverKo: '실적 기대가 가격을 끌고 있다.' },
        indexed: true,
    },
    {
        name: 'news 이벤트 목록만 있어도 산문이다',
        tab: 'news',
        content: { keyEventsKo: ['실적 발표'] },
        indexed: true,
    },
    {
        name: 'news 서사 필드가 비어 있음',
        tab: 'news',
        content: { currentDriverKo: '', keyEventsKo: [], upcomingEventsKo: [] },
        indexed: false,
    },
];

/** 페이지 쪽: 실제 게이트가 이 픽스처를 색인 대상으로 보는가. */
async function pageIsIndexable(
    tab: SeoSnapshotTab,
    content: unknown
): Promise<boolean> {
    mockGetSeoSnapshotsStatic.mockResolvedValue([
        { symbol: SYMBOL, tab, content },
    ]);
    const blocked = await getBlockedSymbolMetadata({
        symbol: SYMBOL,
        assetInfo: ASSET_INFO,
        degraded: false,
        revalidateSeconds: 21600,
        locale: 'ko',
        tab,
    });
    return blocked === null;
}

/** sitemap 쪽: 실제 저장소 판정 → 로더와 같은 맵 구성 → 실제 빌더가 URL을 싣는가. */
async function sitemapIncludes(
    tab: ProseGatedSitemapTab,
    content: unknown
): Promise<boolean> {
    const fields: readonly string[] = PROSE_SOURCE_FIELDS[tab];
    // SQL의 jsonb_build_object 투영을 흉내 낸다 — content가 객체가 아니면 모든 필드가 NULL이다.
    const record =
        typeof content === 'object' && content !== null
            ? (content as Record<string, unknown>)
            : {};
    const prose = Object.fromEntries(
        fields.map(field => [field, record[field] ?? null])
    );
    const where = vi
        .fn()
        .mockResolvedValue([
            { symbol: SYMBOL, tab, locale: 'ko', generatedAt: NOW, prose },
        ]);
    const db = {
        select: () => ({ from: () => ({ where }) }),
    } as unknown as SiglensDatabase;
    const rows = await new DrizzleSeoSnapshotRepository(db).listFreshSymbolTabs(
        PROSE_GATED_SITEMAP_TABS,
        'ko',
        new Date(0)
    );
    // `loadUncachedPopularSitemapInputs`와 같은 구성 — 렌더 가능한 산문 행만 맵에 넣는다.
    const snapshotGeneratedAt = new Map(
        rows
            .filter(row => row.hasProse)
            .map(row => [
                snapshotKey(row.symbol, row.tab as ProseGatedSitemapTab),
                row.generatedAt,
            ])
    );
    const url =
        tab === 'technical'
            ? `${SITE_URL}/${SYMBOL}`
            : `${SITE_URL}/${SYMBOL}/${tab}`;
    return buildPopularEntries(NOW, { snapshotGeneratedAt }).some(
        entry => entry.url === url
    );
}

describe('페이지 ↔ sitemap parity — 같은 픽스처, 같은 결론', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each(FIXTURES)('$name', async ({ tab, content, indexed }) => {
        const page = await pageIsIndexable(tab, content);
        const sitemap = await sitemapIncludes(tab, content);

        expect(page).toBe(indexed);
        expect(sitemap).toBe(indexed);
        expect(page).toBe(sitemap);
    });

    it('스냅샷 행이 아예 없어도 두 쪽이 같다(둘 다 제외)', async () => {
        mockGetSeoSnapshotsStatic.mockResolvedValue([]);
        const page =
            (await getBlockedSymbolMetadata({
                symbol: SYMBOL,
                assetInfo: ASSET_INFO,
                degraded: false,
                revalidateSeconds: 21600,
                locale: 'ko',
                tab: 'technical',
            })) === null;
        const sitemap = buildPopularEntries(NOW, {
            snapshotGeneratedAt: new Map(),
        }).some(entry => entry.url === `${SITE_URL}/${SYMBOL}`);

        expect(page).toBe(false);
        expect(sitemap).toBe(false);
    });

    it('로더 실패 — 페이지는 unknown으로 색인을 유지하고 sitemap은 전부 싣는다(둘 다 fail-open)', async () => {
        mockGetSeoSnapshotsStatic.mockResolvedValue(null);
        const page =
            (await getBlockedSymbolMetadata({
                symbol: SYMBOL,
                assetInfo: ASSET_INFO,
                degraded: false,
                revalidateSeconds: 21600,
                locale: 'ko',
                tab: 'news',
            })) === null;
        const sitemap = buildPopularEntries(NOW).some(
            entry => entry.url === `${SITE_URL}/${SYMBOL}/news`
        );

        expect(page).toBe(true);
        expect(sitemap).toBe(true);
    });
});
