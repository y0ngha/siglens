/**
 * `/[symbol]/news` thin-content 게이트(2026-09-17 정책 감사 M6).
 *
 * 종목 고유 텍스트는 (a) 렌더 가능한 AI 스냅샷 산문, (b) 감정이 채워진 뉴스 카드
 * 둘에서만 나온다. 둘 다 없으면 남는 건 제목·크롬뿐이라 noindex(단 follow 유지,
 * self-canonical 유지)다 — `congress/page.tsx`와 같은 모양.
 */

// MISTAKES §17: all vi.mock + vi.hoisted declarations must come before imports.
const { mockGetAssetInfoResilient, mockGetNewsList } = vi.hoisted(() => ({
    mockGetAssetInfoResilient: vi.fn(),
    mockGetNewsList: vi.fn(),
}));

vi.mock('@/entities/ticker', () => ({
    buildAssetAboutNode: vi.fn().mockReturnValue(undefined),
    pickAssetName: (info: { name: string }) => info.name,
    buildDisplayName: vi.fn().mockReturnValue('Apple Inc.'),
    getAssetInfoResilient: (ticker: string) =>
        mockGetAssetInfoResilient(ticker),
}));

vi.mock('@/entities/news-article/api', () => ({
    getNewsList: mockGetNewsList,
}));

vi.mock('@/entities/seo-snapshot/lib/getSnapshotStatic', () => ({
    getSeoSnapshotsStatic: vi.fn().mockResolvedValue([]),
}));

vi.mock('next/navigation', () => ({ notFound: vi.fn() }));

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { generateMetadata } from '@/app/[locale]/[symbol]/news/page';
import { getSeoSnapshotsStatic } from '@/entities/seo-snapshot/lib/getSnapshotStatic';
import type { NewsDisplayItem } from '@/shared/lib/types';

type Snapshots = Awaited<ReturnType<typeof getSeoSnapshotsStatic>>;

const ASSET_INFO = {
    assetInfo: { symbol: 'AAPL', name: 'Apple Inc.', fmpSymbol: 'AAPL' },
    degraded: false,
};

const withSentiment = [
    { id: '1', sentiment: 'positive', publishedAt: '2026-09-16T00:00:00.000Z' },
] as unknown as NewsDisplayItem[];
const withoutSentiment = [
    { id: '1', sentiment: null, publishedAt: '2026-09-16T00:00:00.000Z' },
] as unknown as NewsDisplayItem[];

const proseSnapshot = [
    {
        tab: 'news',
        content: { currentDriverKo: '실적 기대가 가격을 끌고 있다.' },
        generatedAt: new Date('2026-09-01'),
    },
] as unknown as Snapshots;

const params = Promise.resolve({ locale: 'ko', symbol: 'aapl' });

describe('news generateMetadata — thin-content 게이트', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetAssetInfoResilient.mockResolvedValue(ASSET_INFO);
        vi.mocked(getSeoSnapshotsStatic).mockResolvedValue([] as Snapshots);
    });

    it('산문만 있어도 색인한다', async () => {
        vi.mocked(getSeoSnapshotsStatic).mockResolvedValue(proseSnapshot);
        mockGetNewsList.mockResolvedValue(withoutSentiment);

        const metadata = await generateMetadata({ params });

        expect(metadata.robots).toBeUndefined();
    });

    it('감정이 채워진 카드만 있어도 색인한다', async () => {
        mockGetNewsList.mockResolvedValue(withSentiment);

        const metadata = await generateMetadata({ params });

        expect(metadata.robots).toBeUndefined();
    });

    it('둘 다 없으면 noindex — self-canonical과 제목은 유지한다', async () => {
        mockGetNewsList.mockResolvedValue(withoutSentiment);

        const metadata = await generateMetadata({ params });

        // follow:true — CrossLinkCards가 뿌리는 형제 탭 링크는 살려 둔다.
        expect(metadata.robots).toEqual({ index: false, follow: true });
        expect(metadata.alternates?.canonical).toBe(
            'https://siglens.io/AAPL/news'
        );
        expect(metadata.title).toBeDefined();
    });

    it('스냅샷 행은 있지만 내용이 비면 산문으로 치지 않는다', async () => {
        // 존재 여부(`snap !== undefined`)로 판정하면 본문은 산문을 안 그리는데
        // 메타만 색인 가능이 되어 갈라진다.
        vi.mocked(getSeoSnapshotsStatic).mockResolvedValue([
            { tab: 'news', content: {}, generatedAt: new Date('2026-09-01') },
        ] as unknown as Snapshots);
        mockGetNewsList.mockResolvedValue(withoutSentiment);

        const metadata = await generateMetadata({ params });

        expect(metadata.robots).toEqual({ index: false, follow: true });
    });
});
