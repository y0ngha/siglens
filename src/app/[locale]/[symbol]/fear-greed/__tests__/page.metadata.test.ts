/**
 * `/[symbol]/fear-greed`는 **항상 noindex**다(2026-09-17 운영 렌더 감사).
 *
 * 종목 간 본문이 숫자만 바뀌는 템플릿이라(공통 문장 92%) 색인 코퍼스에서 뺐다.
 * 봉이 있어 본문이 온전히 그려지는 종목도 noindex여야 한다 — 그게 이 결정의 요점이다.
 * 공유 카드용 title은 남아야 하고, follow는 유지돼야 한다.
 */

// MISTAKES §17: all vi.mock + vi.hoisted declarations must come before imports.
const { mockGetAssetInfoResilient } = vi.hoisted(() => ({
    mockGetAssetInfoResilient: vi.fn(),
}));

vi.mock('@/entities/ticker', () => ({
    buildAssetAboutNode: vi.fn().mockReturnValue(undefined),
    pickAssetName: (info: { name: string }) => info.name,
    buildDisplayName: vi.fn().mockReturnValue('Apple Inc.'),
    getAssetInfoResilient: (ticker: string) =>
        mockGetAssetInfoResilient(ticker),
}));

vi.mock('@/entities/bars', () => ({
    getSeedBarsStatic: vi.fn(),
    getQuantizedBarsStatic: vi.fn(),
}));

vi.mock('@/entities/seo-snapshot/lib/getSnapshotStatic', () => ({
    getSeoSnapshotsStatic: vi.fn().mockResolvedValue([]),
}));

vi.mock('next/navigation', () => ({ notFound: vi.fn() }));

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { generateMetadata } from '@/app/[locale]/[symbol]/fear-greed/page';

describe('fear-greed generateMetadata — 항상 noindex', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetAssetInfoResilient.mockResolvedValue({
            assetInfo: {
                symbol: 'AAPL',
                name: 'Apple Inc.',
                fmpSymbol: 'AAPL',
            },
            degraded: false,
        });
    });

    it('인기 종목도 noindex, follow + canonical null', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expect(metadata.robots).toEqual({ index: false, follow: true });
        expect(metadata.alternates?.canonical).toBeNull();
    });

    it('공유 카드용 title은 남긴다', async () => {
        const metadata = await generateMetadata({
            params: Promise.resolve({ locale: 'ko', symbol: 'aapl' }),
        });

        expect(JSON.stringify(metadata.title)).toContain('AAPL');
    });
});
