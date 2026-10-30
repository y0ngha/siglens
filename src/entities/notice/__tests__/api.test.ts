import { PgDialect } from 'drizzle-orm/pg-core';
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
        // 사이드카가 꺼져 있으면 원본(한국어)으로 해석되므로 폴백이 아니다.
    };

    it('활성 공지 행들을 그대로 반환한다', async () => {
        const { db } = makeMockDb([baseRow]);
        const repo = new DrizzleNoticeRepository(db);
        const result = await repo.findActive('ko');
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('n1');
        expect(result[0].title).toBe('점검 안내');
        expect(result[0].createdAt).toEqual(baseRow.createdAt);
    });

    it('활성 공지가 없으면 빈 배열을 반환한다', async () => {
        const { db } = makeMockDb([]);
        const repo = new DrizzleNoticeRepository(db);
        expect(await repo.findActive('ko')).toEqual([]);
    });

    it('orderBy가 2개 인수(priority, createdAt)로 호출된다 — 실제 정렬 방향은 E2E가 검증', async () => {
        const { db, orderBySpy } = makeMockDb([baseRow]);
        const repo = new DrizzleNoticeRepository(db);
        await repo.findActive('ko');
        expect(orderBySpy).toHaveBeenCalledTimes(1);
        expect(orderBySpy.mock.calls[0]).toHaveLength(2);
    });

    /**
     * `pickContentLocale`은 빈 문자열을 "없는 값"으로 본다(레거시 컬럼에
     * 분석 실패로 빈 문자열이 들어간 실제 사례 대응). 사이드카가 꺼져 있어
     * 레거시 컬럼만 쓰이는 상태에서 `title`이 빈 문자열이면 해석 결과가
     * `null`이 되므로, 이 클래스는 원본 `row.title`로 폴백해야 한다.
     */
    it('title이 빈 문자열이면 해석 결과 대신 원본으로 폴백한다', async () => {
        const { db } = makeMockDb([{ ...baseRow, title: '' }]);
        const repo = new DrizzleNoticeRepository(db);
        const result = await repo.findActive('ko');
        expect(result[0].title).toBe('');
    });

    it('body가 빈 문자열이면 해석 결과 대신 원본으로 폴백한다', async () => {
        const { db } = makeMockDb([{ ...baseRow, body: '' }]);
        const repo = new DrizzleNoticeRepository(db);
        const result = await repo.findActive('ko');
        expect(result[0].body).toBe('');
    });

    it('linkUrl/linkLabel/pathPattern이 null이면 그대로 null을 유지한다', async () => {
        const { db } = makeMockDb([baseRow]);
        const repo = new DrizzleNoticeRepository(db);
        const result = await repo.findActive('ko');
        expect(result[0].linkUrl).toBeNull();
        expect(result[0].linkLabel).toBeNull();
        expect(result[0].pathPattern).toBeNull();
    });

    it('linkLabel이 채워져 있으면 해석된 값을 그대로 반환한다', async () => {
        const { db } = makeMockDb([
            {
                ...baseRow,
                linkUrl: '/notice/1',
                linkLabel: '자세히 보기',
                pathPattern: '/market/*',
            },
        ]);
        const repo = new DrizzleNoticeRepository(db);
        const result = await repo.findActive('ko');
        expect(result[0].linkUrl).toBe('/notice/1');
        expect(result[0].linkLabel).toBe('자세히 보기');
        expect(result[0].pathPattern).toBe('/market/*');
    });

    it('where 절이 한 번 호출된다', async () => {
        const { db, whereSpy } = makeMockDb([baseRow]);
        const repo = new DrizzleNoticeRepository(db);
        await repo.findActive('ko');
        expect(whereSpy).toHaveBeenCalledTimes(1);
    });

    it('where 절은 활성 여부와 양 끝을 포함하는 시간창을 SQL로 만든다', async () => {
        const { db, whereSpy } = makeMockDb([baseRow]);
        await new DrizzleNoticeRepository(db).findActive('ko');
        expect(whereSpy).toHaveBeenCalledTimes(1);
        const [[condition]] = whereSpy.mock.calls;
        const { sql: text, params } = new PgDialect().sqlToQuery(condition);
        // 바깥 괄호·공백 같은 drizzle 포맷은 고정하지 않고, and/or 결합 구조만 고정한다 —
        // 각 경계는 "null이면 무제한 or 양 끝 포함 비교"이고 세 조건은 and로 묶인다.
        expect(text).toContain('"notices"."is_active" = $1 and (');
        expect(text).toContain(
            '("notices"."starts_at" is null or "notices"."starts_at" <= NOW()) and ('
        );
        expect(text).toContain(
            '("notices"."ends_at" is null or "notices"."ends_at" >= NOW())'
        );
        expect(params).toEqual([true]);
    });
});
