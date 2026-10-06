const { mockPruneExpiredSessions, mockPruneExpiredShares } = vi.hoisted(() => ({
    mockPruneExpiredSessions: vi.fn(),
    mockPruneExpiredShares: vi.fn(),
}));

// 리포지토리의 SQL은 각 엔티티 테스트가 덮는다 — 여기선 격리·집계 계약만 본다.
vi.mock('@/entities/auth/api', () => ({
    DrizzleSessionRepository: vi.fn().mockImplementation(function () {
        return { pruneExpiredSessions: mockPruneExpiredSessions };
    }),
}));
vi.mock('@/entities/shared-analysis/api', () => ({
    DrizzleSharedAnalysisRepository: vi.fn().mockImplementation(function () {
        return { pruneExpired: mockPruneExpiredShares };
    }),
}));

import { pruneExpiredRows } from '@/app/api/cron/seo-prewarm/pruneExpiredRows';
import type { SiglensDatabase } from '@/shared/db/types';

const db = {} as SiglensDatabase;
const NOW = new Date('2026-10-06T00:00:00.000Z');

describe('pruneExpiredRows', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('두 테이블을 같은 now로 정리하고 지운 수를 돌려준다', async () => {
        mockPruneExpiredSessions.mockResolvedValue(4);
        mockPruneExpiredShares.mockResolvedValue(2);

        await expect(pruneExpiredRows(db, NOW)).resolves.toEqual({
            sessionsDeleted: 4,
            sharedAnalysesDeleted: 2,
        });
        expect(mockPruneExpiredSessions).toHaveBeenCalledWith(NOW);
        expect(mockPruneExpiredShares).toHaveBeenCalledWith(NOW);
    });

    it('세션 정리가 실패해도 공유 정리는 돌고, 실패한 쪽은 null로 표시한다', async () => {
        mockPruneExpiredSessions.mockRejectedValue(new Error('db down'));
        mockPruneExpiredShares.mockResolvedValue(1);
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await expect(pruneExpiredRows(db, NOW)).resolves.toEqual({
            sessionsDeleted: null,
            sharedAnalysesDeleted: 1,
        });
        expect(errSpy).toHaveBeenCalledWith(
            '[seo-prewarm] expiry prune sessions failed:',
            expect.any(Error)
        );
        errSpy.mockRestore();
    });

    it('둘 다 실패해도 throw하지 않는다', async () => {
        mockPruneExpiredSessions.mockRejectedValue(new Error('a'));
        mockPruneExpiredShares.mockRejectedValue(new Error('b'));
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        await expect(pruneExpiredRows(db, NOW)).resolves.toEqual({
            sessionsDeleted: null,
            sharedAnalysesDeleted: null,
        });
        expect(errSpy).toHaveBeenCalledWith(
            '[seo-prewarm] expiry prune shared_analyses failed:',
            expect.any(Error)
        );
        errSpy.mockRestore();
    });
});
