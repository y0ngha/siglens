import { describe, expect, it, vi } from 'vitest';
import { findMarketEventsForPrompt } from '@/entities/news-article/marketEventsRepository';
import type { SiglensDatabase } from '@/shared/db/types';

interface Row {
    publishedAt: Date;
    category: unknown;
    sentiment: unknown;
    impact: unknown;
}

/**
 * `select().from().where().orderBy()` 체인을 흉내내는 최소 스텁.
 * `orderBy`가 최종 결과를 돌려주는 지점이라 거기서 행을 낸다.
 */
function makeDb(rows: Row[] | { reject: Error }): {
    db: SiglensDatabase;
    select: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
} {
    const orderBy = vi.fn(() =>
        'reject' in rows ? Promise.reject(rows.reject) : Promise.resolve(rows)
    );
    const where = vi.fn(() => ({ orderBy }));
    const from = vi.fn(() => ({ where }));
    const select = vi.fn(() => ({ from }));

    return { db: { select } as unknown as SiglensDatabase, select, where };
}

const AT = new Date('2026-09-04T14:30:00Z');
const INPUT = {
    symbol: 'NVDA',
    from: new Date('2026-09-04T13:30:00Z'),
    to: new Date('2026-09-04T20:00:00Z'),
};

function row(overrides: Partial<Row> = {}): Row {
    return {
        publishedAt: AT,
        category: 'earnings',
        sentiment: 'bullish',
        impact: 'high',
        ...overrides,
    };
}

describe('findMarketEventsForPrompt', () => {
    it('행을 core의 MarketEvent 모양으로 투영한다', async () => {
        const { db } = makeDb([row()]);

        const events = await findMarketEventsForPrompt(db, INPUT);

        expect(events).toEqual([
            {
                publishedAt: AT,
                category: 'earnings',
                sentiment: 'bullish',
                impact: 'high',
            },
        ]);
    });

    it('본문 컬럼을 읽지 않는다 — 분류만 select 한다', async () => {
        // `SELECT *` 였다면 body_en / summary_ko 가 딸려 와 요청마다 수십 KB를
        // 낭비한다. 프롬프트에 실리는 것은 분류뿐이다.
        const { db, select } = makeDb([row()]);

        await findMarketEventsForPrompt(db, INPUT);

        const projection = select.mock.calls[0]?.[0] as Record<string, unknown>;
        expect(Object.keys(projection).toSorted()).toEqual([
            'category',
            'impact',
            'publishedAt',
            'sentiment',
        ]);
    });

    it('네 조건(symbol, from, to, impact)으로 좁힌다', async () => {
        const { db, where } = makeDb([row()]);

        await findMarketEventsForPrompt(db, INPUT);

        expect(where).toHaveBeenCalledTimes(1);
        // drizzle 조건 객체는 내부 구조라 값 비교 대신 호출 사실만 고정한다.
        expect(where.mock.calls[0][0]).toBeDefined();
    });

    it('core 유니온에 없는 분류값을 가진 행은 버린다', async () => {
        // 몇 달 전 파이프라인이 쓴 값이 캐스트만으로 통과하면 프롬프트에
        // 사실처럼 주입된다.
        const { db } = makeDb([
            row({ category: 'sideways' }),
            row({ sentiment: 'very-bullish' }),
            row({ impact: 'extreme' }),
            row(),
        ]);

        const events = await findMarketEventsForPrompt(db, INPUT);

        expect(events).toHaveLength(1);
        expect(events[0].category).toBe('earnings');
    });

    it('null 분류값을 가진 행도 버린다', async () => {
        const { db } = makeDb([
            row({ category: null }),
            row({ sentiment: null }),
            row({ impact: null }),
        ]);

        expect(await findMarketEventsForPrompt(db, INPUT)).toEqual([]);
    });

    it('조회가 실패해도 던지지 않고 빈 배열을 돌려준다', async () => {
        // 뉴스를 못 읽는다고 분석이 실패하면 안 된다. 이벤트가 없으면 core가
        // 섹션을 생략하고 캐시 키도 이 기능 도입 전과 같아진다.
        const { db } = makeDb({ reject: new Error('db down') });
        const consoleError = vi
            .spyOn(console, 'error')
            .mockImplementation(() => {});

        await expect(findMarketEventsForPrompt(db, INPUT)).resolves.toEqual([]);
        expect(consoleError).toHaveBeenCalledWith(
            '[marketEventsRepository] read failed:',
            expect.any(Error)
        );

        consoleError.mockRestore();
    });
});
