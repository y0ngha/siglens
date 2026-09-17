/**
 * 만료·미존재 공유 링크는 **진짜 404**여야 한다.
 *
 * 예전에는 200 + 친절한 만료 안내였다. 화면은 "없음"인데 상태 코드가 200이라
 * GSC가 soft-404로 분류했고(2026-09 구글 정책 감사 L), 그 라벨이 사이트 품질
 * 신호를 깎았다. 문구는 `[locale]/NotFoundMessage`가 경로를 보고 그린다.
 */
const { mockLookup, mockNotFound } = vi.hoisted(() => ({
    mockLookup: vi.fn(),
    mockNotFound: vi.fn(() => {
        throw new Error('NEXT_NOT_FOUND');
    }),
}));

vi.mock('@/entities/shared-analysis/actions/getCachedSharedAnalysis', () => ({
    getCachedSharedAnalysis: mockLookup,
}));
vi.mock('next/navigation', () => ({ notFound: mockNotFound }));
vi.mock('next-intl/server', () => ({
    setRequestLocale: vi.fn(),
    getTranslations: vi.fn(async () => (key: string) => key),
}));

import SharePage from '@/app/[locale]/share/[id]/page';

describe('SharePage', () => {
    beforeEach(() => vi.clearAllMocks());

    it.each(['expired', 'not_found'])(
        'lookup.status가 %s면 notFound()를 던진다',
        async status => {
            mockLookup.mockResolvedValue({ status });

            await expect(
                SharePage({
                    params: Promise.resolve({ locale: 'ko', id: 'abc' }),
                })
            ).rejects.toThrow('NEXT_NOT_FOUND');
            expect(mockNotFound).toHaveBeenCalled();
        }
    );
});
