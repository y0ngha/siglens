import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import { DrizzleSignalHistoryRepository } from '@/entities/signal-history/api';
import type { SignalEpisodeInsert } from '@/entities/signal-history/types';
import type { SiglensDatabase } from '@/shared/db/types';

vi.mock('server-only', () => ({}));
vi.mock('@/shared/lib/sleep', () => ({
    sleep: vi.fn().mockResolvedValue(undefined),
}));

const dialect = new PgDialect();

/** 이 목이 받은 단 하나의 호출 인자. 호출 수까지 함께 고정한다(인덱스로 집으면 다른 호출이 끼어도 모른다). */
function onlyCallArg(fn: { mock: { calls: unknown[][] } }): unknown {
    expect(fn.mock.calls).toHaveLength(1);
    return fn.mock.calls.find(Boolean)?.[0];
}

/** where 절을 SQL 문자열·파라미터로 펼친다 — 범위 경계(gte/lt)와 쌍 조건을 글자로 확인한다. */
function render(condition: unknown): { sql: string; params: unknown[] } {
    const query = dialect.sqlToQuery(condition as SQL);
    return { sql: query.sql, params: query.params };
}

const ROW: SignalEpisodeInsert = {
    market: 'us',
    sessionDate: '2026-11-13',
    symbol: 'NVDA',
    signalType: 'golden_cross',
    direction: 'bullish',
    changePercent: 2.5,
    koreanName: '엔비디아',
    computedAt: '2026-11-13T21:20:00.000Z',
};

describe('DrizzleSignalHistoryRepository', () => {
    describe('openEpisodeKeys', () => {
        it('시장·종목·마지막 포착 세션 하한(이상)으로 거른다', async () => {
            const where = vi
                .fn()
                .mockResolvedValue([
                    { symbol: 'NVDA', signalType: 'golden_cross' },
                ]);
            const db = {
                selectDistinct: vi.fn(() => ({ from: () => ({ where }) })),
            } as unknown as SiglensDatabase;

            const keys = await new DrizzleSignalHistoryRepository(
                db
            ).openEpisodeKeys('kr', ['005930.KS'], '2026-11-12');

            expect(keys).toEqual([
                { symbol: 'NVDA', signalType: 'golden_cross' },
            ]);
            const { sql, params } = render(onlyCallArg(where));
            expect(sql).toContain('"market" = $1');
            expect(sql).toContain('"last_seen_session" >= $3');
            expect(params).toEqual(['kr', '005930.KS', '2026-11-12']);
        });

        it('종목이 없으면 쿼리하지 않는다', async () => {
            const selectDistinct = vi.fn();
            const db = { selectDistinct } as unknown as SiglensDatabase;

            await expect(
                new DrizzleSignalHistoryRepository(db).openEpisodeKeys(
                    'us',
                    [],
                    '2026-11-12'
                )
            ).resolves.toEqual([]);
            expect(selectDistinct).not.toHaveBeenCalled();
        });
    });

    describe('insertEpisodes', () => {
        it('마지막 포착 세션을 첫 세션과 같게 열고, 충돌은 무시하며, 넣은 행 수를 센다', async () => {
            const returning = vi.fn().mockResolvedValue([{ symbol: 'NVDA' }]);
            const onConflictDoNothing = vi.fn(() => ({ returning }));
            const values = vi.fn(() => ({ onConflictDoNothing }));
            const db = {
                insert: vi.fn(() => ({ values })),
            } as unknown as SiglensDatabase;

            const inserted = await new DrizzleSignalHistoryRepository(
                db
            ).insertEpisodes([ROW]);

            expect(inserted).toBe(1);
            expect(values).toHaveBeenCalledWith([
                {
                    ...ROW,
                    lastSeenSession: '2026-11-13',
                    computedAt: new Date('2026-11-13T21:20:00.000Z'),
                },
            ]);
            expect(onConflictDoNothing).toHaveBeenCalledTimes(1);
        });

        it('행이 없으면 쓰지 않는다', async () => {
            const insert = vi.fn();
            const db = { insert } as unknown as SiglensDatabase;

            await expect(
                new DrizzleSignalHistoryRepository(db).insertEpisodes([])
            ).resolves.toBe(0);
            expect(insert).not.toHaveBeenCalled();
        });
    });

    describe('extendEpisodes', () => {
        it('(종목, 신호) 쌍 그대로, 이어진(하한 이상·오늘 미만) 에피소드만 오늘로 늘린다', async () => {
            const returning = vi.fn().mockResolvedValue([{ symbol: 'NVDA' }]);
            const where = vi.fn((_condition: unknown) => ({ returning }));
            const set = vi.fn(() => ({ where }));
            const db = {
                update: vi.fn(() => ({ set })),
            } as unknown as SiglensDatabase;

            const extended = await new DrizzleSignalHistoryRepository(
                db
            ).extendEpisodes(
                'us',
                [
                    { symbol: 'NVDA', signalType: 'golden_cross' },
                    { symbol: 'AAPL', signalType: 'rsi_oversold' },
                ],
                '2026-11-13',
                '2026-11-12'
            );

            expect(extended).toBe(1);
            expect(set).toHaveBeenCalledWith({ lastSeenSession: '2026-11-13' });
            const { sql, params } = render(onlyCallArg(where));
            expect(sql).toContain('"last_seen_session" >= $2');
            expect(sql).toContain('"last_seen_session" < $3');
            // 종목 목록 × 신호 목록이 아니라 쌍 목록이다.
            expect(sql).toMatch(
                /\("[^"]+"\."symbol", "[^"]+"\."signal_type"\) in \(\(\$4, \$5\), \(\$6, \$7\)\)/
            );
            expect(params).toEqual([
                'us',
                '2026-11-12',
                '2026-11-13',
                'NVDA',
                'golden_cross',
                'AAPL',
                'rsi_oversold',
            ]);
        });

        it('키가 없으면 쓰지 않는다', async () => {
            const update = vi.fn();
            const db = { update } as unknown as SiglensDatabase;

            await expect(
                new DrizzleSignalHistoryRepository(db).extendEpisodes(
                    'us',
                    [],
                    '2026-11-13',
                    '2026-11-12'
                )
            ).resolves.toBe(0);
            expect(update).not.toHaveBeenCalled();
        });
    });

    it('pruneOlderThan은 마지막 포착 세션이 기준일보다 이른 행을 지우고 그 수를 센다', async () => {
        const returning = vi.fn().mockResolvedValue([{}, {}]);
        const where = vi.fn((_condition: unknown) => ({ returning }));
        const db = {
            delete: vi.fn(() => ({ where })),
        } as unknown as SiglensDatabase;

        const deleted = await new DrizzleSignalHistoryRepository(
            db
        ).pruneOlderThan('2025-10-09');

        expect(deleted).toBe(2);
        const { sql, params } = render(onlyCallArg(where));
        expect(sql).toContain('"last_seen_session" < $1');
        expect(params).toEqual(['2025-10-09']);
    });
});
