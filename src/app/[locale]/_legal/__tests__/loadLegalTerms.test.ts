const { mockGetActiveTerms } = vi.hoisted(() => ({
    mockGetActiveTerms: vi.fn(),
}));

vi.mock('@/entities/terms/api', () => ({
    getActiveTerms: mockGetActiveTerms,
}));
vi.mock('next-intl/server', () => ({
    getTranslations: vi.fn(async () => (key: string) => key),
}));

import { loadLegalTerms } from '@/app/[locale]/_legal/legalPolicy';

const RECORD = {
    id: 'row-1',
    kind: 'tos',
    version: 2,
    effectiveDate: new Date('2026-09-14T00:00:00.000Z'),
    body: '# 약관',
    bodyLocale: 'ko',
    isTranslationFallback: false,
};

describe('loadLegalTerms', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv('SIGLENS_OFFLINE_BUILD', '');
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it('DB 없는 빌드면 DB를 부르지 않고 unavailable이다', async () => {
        vi.stubEnv('NEXT_PHASE', 'phase-production-build');
        vi.stubEnv('DATABASE_URL', '');

        await expect(loadLegalTerms('tos', 'ko')).resolves.toEqual({
            status: 'unavailable',
        });
        expect(mockGetActiveTerms).not.toHaveBeenCalled();
    });

    it('DB가 있는 빌드에서는 활성 약관을 ready로 돌려준다', async () => {
        vi.stubEnv('NEXT_PHASE', 'phase-production-build');
        vi.stubEnv('DATABASE_URL', 'postgres://localhost:5432/testdb');
        mockGetActiveTerms.mockResolvedValue(RECORD);

        await expect(loadLegalTerms('tos', 'ko')).resolves.toEqual({
            status: 'ready',
            terms: RECORD,
        });
    });

    it('활성 버전이 없으면 missing이다', async () => {
        vi.stubEnv('NEXT_PHASE', '');
        vi.stubEnv('DATABASE_URL', 'postgres://localhost:5432/testdb');
        mockGetActiveTerms.mockResolvedValue(null);

        await expect(loadLegalTerms('privacy', 'ko')).resolves.toEqual({
            status: 'missing',
        });
    });

    it('런타임에는 DATABASE_URL이 없어도 unavailable로 바꾸지 않고 조회한다', async () => {
        vi.stubEnv('NEXT_PHASE', '');
        vi.stubEnv('DATABASE_URL', '');
        mockGetActiveTerms.mockResolvedValue(RECORD);

        await expect(loadLegalTerms('tos', 'ko')).resolves.toMatchObject({
            status: 'ready',
        });
        expect(mockGetActiveTerms).toHaveBeenCalledOnce();
    });

    it('DB가 있는 빌드의 조회 오류는 삼키지 않고 던진다(빈 약관을 굽지 않는다)', async () => {
        vi.stubEnv('NEXT_PHASE', 'phase-production-build');
        vi.stubEnv('DATABASE_URL', 'postgres://localhost:5432/testdb');
        mockGetActiveTerms.mockRejectedValue(new Error('neon down'));

        await expect(loadLegalTerms('tos', 'ko')).rejects.toThrow('neon down');
    });
});
