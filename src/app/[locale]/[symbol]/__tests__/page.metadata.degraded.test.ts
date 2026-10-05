/**
 * 차트 탭 `generateMetadata`의 **fail-open 정정**(2026-09-17 정책 감사 M6).
 *
 * 봉 조회가 throw하면 그 렌더의 본문은 지표 요약도 차트도 없는 껍데기다. 예전에는
 * `hasPriceData: undefined`로만 남겨 그 껍데기가 `index, follow`로 크롤됐다.
 * 이제 그 경우를 `degraded`로 넘겨 기존 규칙("degraded → 이 탭의 렌더 가능한
 * 스냅샷이 있을 때만 색인")을 재사용한다 — 새 상태를 만들지 않고, 조회가
 * 회복되면 다음 ISR 재생성에서 자가치유된다.
 */

// MISTAKES §17: all vi.mock + vi.hoisted declarations must come before imports.
const { mockGetAssetInfoResilient, mockGetQuantizedBarsStatic } = vi.hoisted(
    () => ({
        mockGetAssetInfoResilient: vi.fn(),
        mockGetQuantizedBarsStatic: vi.fn(),
    })
);

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
    getQuantizedBarsStatic: mockGetQuantizedBarsStatic,
    getSeedBarsStatic: vi.fn(),
}));

vi.mock('@/entities/seo-snapshot/lib/getSnapshotStatic', () => ({
    getSeoSnapshotsStatic: vi.fn().mockResolvedValue([]),
}));

vi.mock('next/navigation', () => ({ notFound: vi.fn() }));

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { generateMetadata } from '@/app/[locale]/[symbol]/page';
import { getSeoSnapshotsStatic } from '@/entities/seo-snapshot/lib/getSnapshotStatic';

type Snapshots = Awaited<ReturnType<typeof getSeoSnapshotsStatic>>;

const ASSET_INFO = {
    assetInfo: { symbol: 'AAPL', name: 'Apple Inc.', fmpSymbol: 'AAPL' },
    degraded: false,
};

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

const params = Promise.resolve({ locale: 'ko', symbol: 'aapl' });

describe('chart generateMetadata — 봉 조회 실패는 degrade다', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetAssetInfoResilient.mockResolvedValue(ASSET_INFO);
        vi.mocked(getSeoSnapshotsStatic).mockResolvedValue([] as Snapshots);
    });

    it('조회 실패 + 스냅샷 없음 → noindex + self-canonical', async () => {
        mockGetQuantizedBarsStatic.mockRejectedValue(new Error('bars down'));

        const metadata = await generateMetadata({ params });

        expect(metadata.robots).toEqual({ index: false, follow: true });
        // self-canonical(2026-10-05) — `canonical: null`이 아니다.
        expect(metadata.alternates?.canonical).toBe('https://siglens.io/AAPL');
    });

    it('조회 실패 + 렌더 가능한 technical 스냅샷 → 색인 유지(degraded-with-snapshot)', async () => {
        mockGetQuantizedBarsStatic.mockRejectedValue(new Error('bars down'));
        vi.mocked(getSeoSnapshotsStatic).mockResolvedValue([
            {
                tab: 'technical',
                content: { summary: '추세가 유지되고 있다.' },
                generatedAt: new Date('2026-09-01'),
            },
        ] as unknown as Snapshots);

        const metadata = await generateMetadata({ params });

        expect(metadata.robots).toBeUndefined();
    });

    // 2026-10-05: 차트 탭은 렌더 가능한 산문이 있어야 색인한다(SEO_RECOVERY §5 A3). 봉만 있고
    // 스냅샷이 없으면 제목·크롬·수치 요약뿐이라 thin → noindex(no-prose, self-canonical).
    it('조회 성공 + 봉 있음 + 렌더 가능한 technical 산문 → 색인한다', async () => {
        mockGetQuantizedBarsStatic.mockResolvedValue(BARS_WITH_DATA);
        vi.mocked(getSeoSnapshotsStatic).mockResolvedValue([
            {
                tab: 'technical',
                content: { summary: '추세가 유지되고 있다.' },
                generatedAt: new Date('2026-09-01'),
            },
        ] as unknown as Snapshots);

        const metadata = await generateMetadata({ params });

        expect(metadata.robots).toBeUndefined();
    });

    it('조회 성공 + 봉 있음 + 산문 없음 → noindex(no-prose)이고 self-canonical을 유지한다', async () => {
        mockGetQuantizedBarsStatic.mockResolvedValue(BARS_WITH_DATA);

        const metadata = await generateMetadata({ params });

        expect(metadata.robots).toEqual({ index: false, follow: true });
        expect(metadata.alternates?.canonical).toBe('https://siglens.io/AAPL');
    });

    it('스냅샷 읽기 실패(null = 모름) → 색인을 유지한다(fail-open)', async () => {
        mockGetQuantizedBarsStatic.mockResolvedValue(BARS_WITH_DATA);
        vi.mocked(getSeoSnapshotsStatic).mockResolvedValue(null);

        const metadata = await generateMetadata({ params });

        expect(metadata.robots).toBeUndefined();
    });
});
