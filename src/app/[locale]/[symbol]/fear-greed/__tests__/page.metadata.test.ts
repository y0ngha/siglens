/**
 * `/[symbol]/fear-greed`는 **색인한다**(2026-10-01 사용자 결정, `SEO_RECOVERY_2026_09.md` §10).
 *
 * 2026-09-17 운영 렌더 감사는 이 탭을 항상 noindex로 돌렸으나(본문 92%가 공통 문장),
 * 롱테일 수요를 받을 페이지가 사라져 되돌렸다. 대신 차트 라우트와 같은 콘텐츠 게이트를
 * 탄다 — 봉 조회 실패는 degrade, 봉 부족(`buildTechnicalFacts` null)은 `no-price-data`,
 * 화이트리스트 밖 롱테일은 중앙 게이트로 noindex다. 공유 카드용 title과 follow는
 * 모든 경로에서 유지된다.
 */

// MISTAKES §17: all vi.mock + vi.hoisted declarations must come before imports.
const { mockGetAssetInfoResilient, mockGetSeedBarsStatic } = vi.hoisted(() => ({
    mockGetAssetInfoResilient: vi.fn(),
    mockGetSeedBarsStatic: vi.fn(),
}));

vi.mock('@/entities/ticker/lib/assetClassification', () => ({
    buildAssetAboutNode: vi.fn().mockReturnValue(undefined),
}));
vi.mock('@/entities/ticker/lib/ticker', () => ({
    pickAssetName: (info: { name: string }) => info.name,
    buildDisplayName: vi.fn().mockReturnValue('Apple Inc.'),
}));
vi.mock('@/entities/ticker/lib/getAssetInfoResilient', () => ({
    getAssetInfoResilient: (ticker: string) =>
        mockGetAssetInfoResilient(ticker),
}));

vi.mock('@/entities/bars/lib/barsStaticCache', () => ({
    getSeedBarsStatic: mockGetSeedBarsStatic,
    getQuantizedBarsStatic: vi.fn(),
}));

vi.mock('@/entities/seo-snapshot/lib/getSnapshotStatic', () => ({
    getSeoSnapshotsStatic: vi.fn().mockResolvedValue([]),
}));

vi.mock('next/navigation', () => ({ notFound: vi.fn() }));

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { generateMetadata } from '@/app/[locale]/[symbol]/fear-greed/page';

const BARS_WITH_DATA = {
    bars: [
        { time: 1, open: 1, high: 2, low: 0.5, close: 1.5, volume: 100 },
        { time: 2, open: 1.5, high: 2.5, low: 1, close: 2, volume: 120 },
    ],
    indicators: {
        rsi: [50, 55],
        macd: [{ histogram: 0.1 }, { histogram: 0.2 }],
        buySellVolume: [],
    },
};

const ASSET_INFO = {
    assetInfo: {
        symbol: 'AAPL',
        name: 'Apple Inc.',
        fmpSymbol: 'AAPL',
    },
    degraded: false,
};

describe('fear-greed generateMetadata — 색인 대상 (콘텐츠 게이트 통과 시)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetAssetInfoResilient.mockResolvedValue(ASSET_INFO);
        mockGetSeedBarsStatic.mockResolvedValue(BARS_WITH_DATA);
    });

    it('인기 종목은 색인 가능 + self-canonical (소문자 입력도 대문자로 정규화)', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expect(metadata.robots).toBeUndefined();
        expect(metadata.alternates?.canonical).toBe(
            'https://siglens.io/AAPL/fear-greed'
        );
    });

    it('공유 카드용 title은 남긴다', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expect(JSON.stringify(metadata.title)).toContain('AAPL');
    });

    it('봉 조회가 실패하면 degrade로 보고 noindex(follow 유지)', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        mockGetSeedBarsStatic.mockRejectedValue(new Error('bars infra down'));

        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expect(metadata.robots).toEqual({ index: false, follow: true });
        expect(metadata.alternates?.canonical).toBeNull();
        spy.mockRestore();
    });

    it('봉이 모자라 요약이 안 그려지면(no-price-data) noindex', async () => {
        mockGetSeedBarsStatic.mockResolvedValue({
            bars: [BARS_WITH_DATA.bars[0]],
            indicators: BARS_WITH_DATA.indicators,
        });

        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expect(metadata.robots).toEqual({ index: false, follow: true });
        expect(metadata.alternates?.canonical).toBeNull();
    });

    it('화이트리스트 밖 롱테일 종목은 noindex', async () => {
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: { symbol: 'ZZZQ', name: 'Zzzq Corp', fmpSymbol: 'ZZZQ' },
            degraded: false,
        });

        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko', symbol: 'zzzq' }),
        });

        expect(metadata.robots).toEqual({ index: false, follow: true });
        expect(metadata.alternates?.canonical).toBeNull();
    });
});
