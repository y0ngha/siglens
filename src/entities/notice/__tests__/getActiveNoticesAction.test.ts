vi.mock('@/shared/db/client', () => ({
    tryGetDatabaseClient: vi.fn(),
}));

import { getActiveNoticesAction } from '@/entities/notice/actions/getActiveNoticesAction';
import { tryGetDatabaseClient } from '@/shared/db/client';
import type { SiglensDatabase } from '@/shared/db/types';

const mockedTryGet = vi.mocked(tryGetDatabaseClient);

function dbReturning(rows: unknown[]): SiglensDatabase {
    const builder = {
        from: () => builder,
        where: () => ({ orderBy: () => Promise.resolve(rows) }),
    };
    return { select: () => builder } as unknown as SiglensDatabase;
}

describe('getActiveNoticesAction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('DB 클라이언트가 없으면 빈 배열을 반환한다', async () => {
        mockedTryGet.mockReturnValue(null);
        expect(await getActiveNoticesAction()).toEqual([]);
    });

    it('활성 공지 행을 반환한다', async () => {
        const row = {
            id: 'n1',
            title: '점검',
            body: 'b',
            linkUrl: null,
            linkLabel: null,
            pathPattern: null,
            createdAt: new Date('2026-06-03T00:00:00+09:00'),
        };
        mockedTryGet.mockReturnValue({
            db: dbReturning([row]),
            sql: {} as never,
        });
        const result = await getActiveNoticesAction();
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('n1');
    });

    it('조회 중 예외가 나면 빈 배열로 흡수한다', async () => {
        const throwingDb = {
            select: () => {
                throw new Error('db down');
            },
        } as unknown as SiglensDatabase;
        mockedTryGet.mockReturnValue({ db: throwingDb, sql: {} as never });
        const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
        expect(await getActiveNoticesAction()).toEqual([]);
        expect(errSpy).toHaveBeenCalled();
        errSpy.mockRestore();
    });
});
