/**
 * Overall page (narrative seed) 테스트. async 서버 컴포넌트는 RTL로 직접 렌더할
 * 수 없으므로(Promise<JSX.Element> 반환), 반환된 element 트리를 순회해
 * OverallContent에 전달된 initialAnalysis prop을 검증한다.
 */

// vi.mock은 hoist되지만 import/first와 가독성을 위해 모든 import 위에 둔다.
vi.mock('@/widgets/overall/OverallContent', () => ({
    OverallContent: () => null,
}));
vi.mock('@/widgets/symbol-page', () => ({
    CrossLinkCards: () => null,
}));
vi.mock('@/shared/ui/JsonLd', () => ({ JsonLd: () => null }));
vi.mock('@/shared/config/market', () => ({
    DEFAULT_TIMEFRAME: '1Day',
    isValidTimeframe: vi.fn().mockReturnValue(false),
    VALID_TICKER_RE: /^[A-Z]{1,5}$/,
}));
vi.mock('@/entities/ticker', () => ({
    buildAssetAboutNode: vi.fn().mockReturnValue(undefined),
    buildDisplayName: vi.fn().mockReturnValue('Apple Inc.'),
    getAssetInfoCached: vi.fn(),
}));
vi.mock('@/shared/lib/seo', () => ({
    buildBreadcrumbJsonLd: vi.fn().mockReturnValue({}),
    buildSymbolSeoContent: vi
        .fn()
        .mockReturnValue({ url: 'https://siglens.io/AAPL' }),
    buildSymbolOverallSeoContent: vi.fn().mockReturnValue({
        title: 'AAPL 종합 분석',
        fullTitle: 'AAPL 종합 분석 | Siglens',
        description: 'desc',
        url: 'https://siglens.io/AAPL/overall',
        keywords: ['AAPL'],
    }),
    SITE_NAME: 'Siglens',
    SITE_URL: 'https://siglens.io',
}));
vi.mock('@y0ngha/siglens-core', () => ({
    GEMINI_2_5_FLASH_LITE_MODEL: 'gemini-2.5-flash-lite',
    peekOverallAnalysisCache: vi.fn(),
}));
vi.mock('next/navigation', () => ({
    notFound: vi.fn(),
}));

import { default as OverallPage } from '@/app/[symbol]/overall/page';
import { getAssetInfoCached } from '@/entities/ticker';
import { peekOverallAnalysisCache } from '@y0ngha/siglens-core';
import { OverallContent } from '@/widgets/overall/OverallContent';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import type { MockedFunction } from 'vitest';

const mockGetAssetInfoCached = getAssetInfoCached as MockedFunction<
    typeof getAssetInfoCached
>;
const mockPeekOverall = peekOverallAnalysisCache as MockedFunction<
    typeof peekOverallAnalysisCache
>;

/** 렌더 없이 RSC element 트리를 재귀 순회해 주어진 타입의 첫 element를 찾는다. */
function findElementByType(
    node: ReactNode,
    type: unknown
): ReactElement | null {
    if (Array.isArray(node)) {
        for (const child of node) {
            const found = findElementByType(child, type);
            if (found !== null) return found;
        }
        return null;
    }
    if (!isValidElement(node)) return null;
    if (node.type === type) return node;
    const childProps = node.props as { children?: ReactNode };
    return findElementByType(childProps.children, type);
}

interface OverallSeedProps {
    initialAnalysis: unknown;
}

async function getOverallProps(): Promise<OverallSeedProps> {
    const tree = await OverallPage({
        params: Promise.resolve({ symbol: 'aapl' }),
        searchParams: Promise.resolve({}),
    });
    const content = findElementByType(tree, OverallContent);
    if (content === null) {
        throw new Error('OverallContent not found in tree');
    }
    return content.props as OverallSeedProps;
}

describe('Overall page (narrative seed)', () => {
    beforeEach(() => {
        mockGetAssetInfoCached.mockReset();
        mockPeekOverall.mockReset();
        mockGetAssetInfoCached.mockResolvedValue({
            name: 'Apple Inc.',
            koreanName: '애플',
            fmpSymbol: 'AAPL',
        } as never);
    });

    it('peek HIT 시 캐시된 종합 분석을 initialAnalysis로 전달한다', async () => {
        const cached = { headlineKo: 'cached overall' };
        mockPeekOverall.mockResolvedValue(cached as never);

        const props = await getOverallProps();

        expect(mockPeekOverall).toHaveBeenCalledWith(
            'AAPL',
            'Apple Inc.',
            '1Day',
            'gemini-2.5-flash-lite'
        );
        expect(props.initialAnalysis).toEqual(cached);
    });

    it('peek MISS(null) 시 initialAnalysis로 undefined를 전달한다', async () => {
        mockPeekOverall.mockResolvedValue(null);

        const props = await getOverallProps();

        expect(props.initialAnalysis).toBeUndefined();
    });

    it('peek가 throw해도 크래시 없이 undefined로 degrade한다', async () => {
        mockPeekOverall.mockRejectedValue(new Error('redis down'));

        const props = await getOverallProps();

        expect(props.initialAnalysis).toBeUndefined();
    });
});
