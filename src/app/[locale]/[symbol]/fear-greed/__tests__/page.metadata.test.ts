/**
 * `/[symbol]/fear-greed` 콘텐츠 게이트(2026-09-17 정책 감사 M1).
 *
 * 이 탭의 본문은 사실상 봉에서 나온다 — `FearGreedFactsSummary`(SSR 수치 요약)와
 * 클라 게이지가 같은 봉을 읽는다. 봉이 없으면 크롤러가 받는 건 제목과 정적
 * FAQ뿐이라, 차트 탭과 같은 근거로 `hasPriceData`를 게이트에 넘긴다.
 *
 * 술어는 본문과 **같은** `buildTechnicalFacts !== null`이다(MISTAKES §2).
 */

// MISTAKES §17: all vi.mock + vi.hoisted declarations must come before imports.
const { mockGetAssetInfoResilient, mockGetSeedBarsStatic } = vi.hoisted(() => ({
    mockGetAssetInfoResilient: vi.fn(),
    mockGetSeedBarsStatic: vi.fn(),
}));

vi.mock('@/entities/ticker', () => ({
    buildAssetAboutNode: vi.fn().mockReturnValue(undefined),
    pickAssetName: (info: { name: string }) => info.name,
    buildDisplayName: vi.fn().mockReturnValue('Apple Inc.'),
    getAssetInfoResilient: (ticker: string) =>
        mockGetAssetInfoResilient(ticker),
}));

vi.mock('@/entities/bars', () => ({
    getSeedBarsStatic: mockGetSeedBarsStatic,
    getQuantizedBarsStatic: vi.fn(),
}));

vi.mock('@/entities/seo-snapshot/lib/getSnapshotStatic', () => ({
    getSeoSnapshotsStatic: vi.fn().mockResolvedValue([]),
}));

vi.mock('next/navigation', () => ({ notFound: vi.fn() }));

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { generateMetadata } from '@/app/[locale]/[symbol]/fear-greed/page';

const ASSET_INFO = {
    assetInfo: { symbol: 'AAPL', name: 'Apple Inc.', fmpSymbol: 'AAPL' },
    degraded: false,
};

/** 실제 `getSeedBarsStatic` 산출물과 같은 모양(EMPTY_INDICATOR_RESULT 스프레드). */
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

describe('fear-greed generateMetadata — 가격 데이터 게이트', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetAssetInfoResilient.mockResolvedValue(ASSET_INFO);
    });

    it('봉이 없으면 noindex + canonical null', async () => {
        mockGetSeedBarsStatic.mockResolvedValue({
            bars: [],
            indicators: { rsi: [], macd: [], buySellVolume: [] },
        });

        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expect(metadata.robots).toEqual({ index: false, follow: true });
        expect(metadata.alternates?.canonical).toBeNull();
    });

    it('봉이 1개뿐이면(상장폐지 등) 본문 요약이 안 그려지므로 noindex', async () => {
        // `bars.length > 0`으로 게이트를 두면 새어 나가던 케이스 — 등락률 분모로
        // 직전 봉이 필요해 `buildTechnicalFacts`는 2개 미만이면 null이다.
        mockGetSeedBarsStatic.mockResolvedValue({
            bars: [BARS_WITH_DATA.bars[0]],
            indicators: BARS_WITH_DATA.indicators,
        });

        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expect(metadata.robots).toEqual({ index: false, follow: true });
    });

    it('봉이 있으면 색인 가능(robots 오버라이드 없음)', async () => {
        mockGetSeedBarsStatic.mockResolvedValue(BARS_WITH_DATA);

        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expect(metadata.robots).toBeUndefined();
        expect(metadata.alternates?.canonical).toBe(
            'https://siglens.io/AAPL/fear-greed'
        );
    });

    it('봉 조회가 실패하면(throw) 기존 판정을 유지한다 — 일시 장애가 색인 해제로 번지지 않는다', async () => {
        mockGetSeedBarsStatic.mockRejectedValue(new Error('bars infra down'));

        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expect(metadata.robots).toBeUndefined();
    });
});
