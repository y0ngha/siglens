import { cleanupExpiredSessionsAction } from '@/entities/auth/actions/cleanupExpiredSessionsAction';
import { CleanupUnauthorizedError } from '@/entities/auth/actions/cleanupTypes';

const { mockDeleteExpiredSessions, mockHeadersGet } = vi.hoisted(() => ({
    mockDeleteExpiredSessions: vi.fn(),
    mockHeadersGet: vi.fn(),
}));

vi.mock('next/headers', () => ({
    headers: vi.fn(async () => ({ get: mockHeadersGet })),
}));

vi.mock('@/entities/auth/api', () => ({
    DrizzleSessionRepository: vi.fn().mockImplementation(function () {
        return {
            deleteExpiredSessions: mockDeleteExpiredSessions,
        };
    }),
}));

vi.mock('@/entities/auth/lib/db', () => ({
    getAuthDatabaseClient: vi.fn(() => ({ db: {} })),
}));

describe('cleanupExpiredSessionsAction', () => {
    const ORIGINAL_ENV = process.env;

    beforeEach(() => {
        process.env = { ...ORIGINAL_ENV };
        mockDeleteExpiredSessions.mockReset();
        mockHeadersGet.mockReset();
    });

    afterAll(() => {
        process.env = ORIGINAL_ENV;
    });

    it('throws CleanupUnauthorizedError when CRON_SECRET env is missing', async () => {
        delete process.env.CRON_SECRET;
        mockHeadersGet.mockReturnValue('Bearer anything');

        await expect(cleanupExpiredSessionsAction()).rejects.toBeInstanceOf(
            CleanupUnauthorizedError
        );
        expect(mockDeleteExpiredSessions).not.toHaveBeenCalled();
    });

    it('throws CleanupUnauthorizedError when authorization header is absent', async () => {
        process.env.CRON_SECRET = 'super-secret';
        mockHeadersGet.mockReturnValue(null);

        await expect(cleanupExpiredSessionsAction()).rejects.toBeInstanceOf(
            CleanupUnauthorizedError
        );
        expect(mockDeleteExpiredSessions).not.toHaveBeenCalled();
    });

    it('throws CleanupUnauthorizedError when bearer mismatches', async () => {
        process.env.CRON_SECRET = 'super-secret';
        mockHeadersGet.mockReturnValue('Bearer wrong');

        await expect(cleanupExpiredSessionsAction()).rejects.toBeInstanceOf(
            CleanupUnauthorizedError
        );
        expect(mockDeleteExpiredSessions).not.toHaveBeenCalled();
    });

    it('returns deleted count when bearer matches', async () => {
        process.env.CRON_SECRET = 'super-secret';
        mockHeadersGet.mockReturnValue('Bearer super-secret');
        mockDeleteExpiredSessions.mockResolvedValue(7);

        const result = await cleanupExpiredSessionsAction();

        expect(result).toEqual({ deleted: 7 });
        expect(mockDeleteExpiredSessions).toHaveBeenCalledTimes(1);
    });
});
