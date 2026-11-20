/**
 * 공유 링크 페이지가 `share_opened` 비콘에 id와 분석 종류를 넘긴다. 만료·없는 링크는 404라
 * (`sharePage.notFound.test.tsx`) 이 비콘이 아예 렌더되지 않는다.
 */
import type { ReactElement, ReactNode } from 'react';

const { mockLookup } = vi.hoisted(() => ({ mockLookup: vi.fn() }));

vi.mock('@/entities/shared-analysis/actions/getCachedSharedAnalysis', () => ({
    getCachedSharedAnalysis: mockLookup,
}));
vi.mock('next/navigation', () => ({
    notFound: () => {
        throw new Error('NEXT_NOT_FOUND');
    },
}));
vi.mock('next-intl/server', () => ({
    setRequestLocale: vi.fn(),
    getTranslations: vi.fn(async () => (key: string) => key),
}));
vi.mock('@/app/[locale]/share/[id]/shareKrxTickTable', () => ({
    shareKrxTickTable: vi.fn(async () => undefined),
}));
vi.mock('@/views/share/ShareKindPanel', () => ({
    ShareKindPanel: () => null,
}));
vi.mock('@/features/visitor-ping/ui/ShareOpenedPing', () => ({
    ShareOpenedPing: () => null,
}));

import SharePage from '@/app/[locale]/share/[id]/page';
import { ShareOpenedPing } from '@/features/visitor-ping/ui/ShareOpenedPing';

/** 요소 트리에서 `type`이 같은 요소를 모두 모은다. */
function findAll(node: ReactNode, type: unknown): ReactElement[] {
    if (Array.isArray(node)) return node.flatMap(child => findAll(child, type));
    if (typeof node !== 'object' || node === null || !('props' in node)) {
        return [];
    }
    const element = node as ReactElement<{ children?: ReactNode }>;
    return [
        ...(element.type === type ? [element] : []),
        ...findAll(element.props.children, type),
    ];
}

describe('SharePage share_opened 비콘', () => {
    it('열린 링크의 id와 분석 종류를 넘긴다', async () => {
        mockLookup.mockResolvedValue({
            status: 'found',
            createdAt: new Date('2026-11-20T00:00:00Z'),
            snapshot: {
                kind: 'overall',
                symbol: 'nvda',
                result: {},
                chartBars: null,
                context: { assetClass: 'us_equity' },
                plain: null,
            },
        });

        const tree = await SharePage({
            params: Promise.resolve({ locale: 'ko', id: 'share-id-1' }),
        });

        const pings = findAll(tree, ShareOpenedPing);
        expect(pings).toHaveLength(1);
        expect(pings[0]?.props).toEqual({ id: 'share-id-1', kind: 'overall' });
    });
});
