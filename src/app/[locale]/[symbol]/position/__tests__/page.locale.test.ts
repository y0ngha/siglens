/**
 * "내 위치" 탭 본문의 로케일 정합성 — 형제 탭과 같은 로케일별 이름을 쓰고, 가이드 제목이 한 메시지로
 * 번역되는지 고정한다. `@/entities/ticker/lib/ticker`는 목킹하지 않는다(실제 `pickAssetName`이 대상이다).
 */
vi.mock('@/entities/ticker/server/getAssetInfoResilient', () => ({
    getAssetInfoResilient: vi.fn(),
}));
vi.mock('@/entities/ticker/lib/assetClassification', () => ({
    buildAssetAboutNode: vi.fn(() => undefined),
}));
vi.mock('@/entities/ticker/api', () => ({
    isTabAllowedForSymbol: vi.fn().mockResolvedValue(true),
}));
vi.mock('@/entities/bars/server/sessionBarsStaticCache', () => ({
    getSessionBarsStatic: vi.fn(),
}));
vi.mock('@/views/symbol/ui/SymbolPageHeading', () => ({
    SymbolPageHeading: ({ children }: { children: React.ReactNode }) =>
        children,
}));
vi.mock('@/widgets/portfolio-position/ui/PositionTabContent', () => ({
    PositionTabContent: () => null,
}));
vi.mock('next/navigation', () => ({
    notFound: vi.fn(() => {
        throw new Error('NEXT_NOT_FOUND');
    }),
}));

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { findElementByType } from '@/__tests__/utils/findElementByType';
import PositionPage from '@/app/[locale]/[symbol]/position/page';
import { getSessionBarsStatic } from '@/entities/bars/server/sessionBarsStaticCache';
import { buildAssetAboutNode } from '@/entities/ticker/lib/assetClassification';
import { getAssetInfoResilient } from '@/entities/ticker/server/getAssetInfoResilient';

const AAPL_ASSET_INFO = {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    koreanName: '애플',
    fmpSymbol: 'AAPL',
};

// 봉 2개 이상 + 직전 종가가 0이 아니어야 52주 범위가 나온다.
const SESSION_BARS = {
    bars: [
        { time: 1, open: 90, high: 95, low: 85, close: 90, volume: 1 },
        { time: 2, open: 100, high: 110, low: 95, close: 100, volume: 1 },
    ],
    indicators: { rsi: [null, null], macd: [{ histogram: null }] },
};

describe('PositionPage — 로케일', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getAssetInfoResilient).mockResolvedValue({
            assetInfo: AAPL_ASSET_INFO,
            degraded: false,
        } as never);
        vi.mocked(getSessionBarsStatic).mockResolvedValue(
            SESSION_BARS as never
        );
    });

    it('영어 페이지의 WebPage about 노드는 한국어명이 아니라 영문 법인명을 쓴다', async () => {
        await PositionPage({
            params: Promise.resolve({ locale: 'en', symbol: 'AAPL' }),
        });

        expect(buildAssetAboutNode).toHaveBeenCalledWith(
            'AAPL',
            'Apple Inc.',
            'AAPL',
            'equity'
        );
    });

    it('한국어 페이지의 about 노드는 한국어명을 쓴다', async () => {
        await PositionPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'AAPL' }),
        });

        expect(buildAssetAboutNode).toHaveBeenCalledWith(
            'AAPL',
            '애플',
            'AAPL',
            'equity'
        );
    });

    it('가이드 제목은 종목명과 문구를 한 번역 메시지(텍스트 노드 하나)로 만든다', async () => {
        const tree = await PositionPage({
            params: Promise.resolve({ locale: 'ko', symbol: 'AAPL' }),
        });

        // 두 조각(`{displayName} {문구}`)으로 이으면 children이 배열이 되고 어순이 한국어에 고정된다.
        const heading = findElementByType(tree, 'h2');
        expect(
            (heading?.props as { children: unknown } | undefined)?.children
        ).toBe('애플, Apple Inc. (AAPL) 지금 가격은 이 아파트 몇 층?');
    });
});
