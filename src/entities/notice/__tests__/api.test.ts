import { DrizzleNoticeRepository } from '@/entities/notice/api';
import type { SiglensDatabase } from '@/shared/db/types';
import type { NoticeRecord } from '@/entities/notice/model/types';

interface MockDbResult {
    db: SiglensDatabase;
    whereSpy: ReturnType<typeof vi.fn>;
    orderBySpy: ReturnType<typeof vi.fn>;
}

function makeMockDb(rows: NoticeRecord[]): MockDbResult {
    const orderBySpy = vi.fn().mockResolvedValue(rows);
    const whereSpy = vi.fn().mockReturnValue({ orderBy: orderBySpy });
    const builder = {
        from: () => builder,
        where: whereSpy,
    };
    const db = {
        select: () => builder,
    } as unknown as SiglensDatabase;
    return { db, whereSpy, orderBySpy };
}

describe('DrizzleNoticeRepository.findActive', () => {
    const baseRow: NoticeRecord = {
        id: 'n1',
        title: '점검 안내',
        body: '## 점검',
        linkUrl: null,
        linkLabel: null,
        pathPattern: null,
        createdAt: new Date('2026-06-03T00:00:00+09:00'),
    };

    it('활성 공지 행들을 그대로 반환한다', async () => {
        const { db } = makeMockDb([baseRow]);
        const repo = new DrizzleNoticeRepository(db);
        const result = await repo.findActive();
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('n1');
        expect(result[0].title).toBe('점검 안내');
        expect(result[0].createdAt).toEqual(baseRow.createdAt);
    });

    it('활성 공지가 없으면 빈 배열을 반환한다', async () => {
        const { db } = makeMockDb([]);
        const repo = new DrizzleNoticeRepository(db);
        expect(await repo.findActive()).toEqual([]);
    });

    it('priority DESC, created_at DESC 순으로 정렬을 요청한다', async () => {
        const { db, orderBySpy } = makeMockDb([baseRow]);
        const repo = new DrizzleNoticeRepository(db);
        await repo.findActive();
        expect(orderBySpy).toHaveBeenCalledTimes(1);
        expect(orderBySpy.mock.calls[0]).toHaveLength(2);
    });

    it('where 절이 한 번 호출된다', async () => {
        const { db, whereSpy } = makeMockDb([baseRow]);
        const repo = new DrizzleNoticeRepository(db);
        await repo.findActive();
        expect(whereSpy).toHaveBeenCalledTimes(1);
        expect(whereSpy.mock.calls[0][0]).toBeTruthy();
    });
});
