const { mockGetSeoSnapshotsStatic } = vi.hoisted(() => ({
    mockGetSeoSnapshotsStatic: vi.fn(),
}));
vi.mock('@/entities/seo-snapshot/lib/getSnapshotStatic', () => ({
    getSeoSnapshotsStatic: mockGetSeoSnapshotsStatic,
}));

import { loadTabSnapshotMeta } from '../symbolSnapshotDescription';
import {
    buildSnapshotMetaDescription,
    symbolTabDescriptionLabel,
} from '@/shared/lib/seo';

const tSeo = (key: string) => key;

const overallRow = {
    tab: 'overall',
    locale: 'ko',
    content: { headlineKo: '종합 헤드라인입니다.' },
    plain: '쉽게 말하면 이렇습니다.',
};
const congressRow = { ...overallRow, tab: 'congress', plain: null };

describe('loadTabSnapshotMeta', () => {
    beforeEach(() => {
        mockGetSeoSnapshotsStatic.mockReset();
    });

    it('해당 탭 행만 고르고, 본문과 같은 인자로 스냅샷을 읽는다', async () => {
        mockGetSeoSnapshotsStatic.mockResolvedValue([congressRow, overallRow]);
        const { snap } = await loadTabSnapshotMeta({
            symbol: 'AAPL',
            tab: 'overall',
            revalidate: 43200,
            locale: 'ko',
            subject: 'Apple',
            assetClass: 'equity',
            tSeo,
        });
        expect(snap).toBe(overallRow);
        expect(mockGetSeoSnapshotsStatic).toHaveBeenCalledWith(
            'AAPL',
            43200,
            'ko'
        );
    });

    it('description은 기존 인라인 계산과 같다 (preferPlain이면 평이화 산문 우선)', async () => {
        mockGetSeoSnapshotsStatic.mockResolvedValue([overallRow]);
        const input = {
            symbol: 'AAPL',
            tab: 'overall',
            revalidate: 43200,
            locale: 'ko',
            subject: 'Apple',
            assetClass: 'equity',
            tSeo,
        } as const;

        const withPlain = await loadTabSnapshotMeta({
            ...input,
            preferPlain: true,
        });
        expect(withPlain.description).toBe(
            buildSnapshotMetaDescription(
                'overall',
                overallRow.content,
                'Apple',
                overallRow.plain,
                'ko',
                symbolTabDescriptionLabel('overall', 'equity', tSeo)
            )
        );

        const withoutPlain = await loadTabSnapshotMeta(input);
        expect(withoutPlain.description).toBe(
            buildSnapshotMetaDescription(
                'overall',
                overallRow.content,
                'Apple',
                null,
                'ko',
                symbolTabDescriptionLabel('overall', 'equity', tSeo)
            )
        );
    });

    it('스냅샷이 없으면 snap은 undefined, description은 null', async () => {
        mockGetSeoSnapshotsStatic.mockResolvedValue([]);
        await expect(
            loadTabSnapshotMeta({
                symbol: 'AAPL',
                tab: 'news',
                revalidate: 43200,
                locale: 'en',
                subject: 'Apple',
                assetClass: 'equity',
                tSeo,
            })
        ).resolves.toEqual({ snap: undefined, description: null });
    });
});
