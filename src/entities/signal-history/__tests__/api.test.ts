import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import { DrizzleSignalHistoryRepository } from '@/entities/signal-history/api';
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

describe('DrizzleSignalHistoryRepository', () => {
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
        expect(sql).toBe('"signal_events"."last_seen_session" < $1');
        expect(params).toEqual(['2025-10-09']);
    });

    describe('recentCountsByType', () => {
        it('신호 목록·세션 하한으로 거르고 신호별로 묶는다', async () => {
            const groupBy = vi.fn().mockResolvedValue([
                {
                    signalType: 'golden_cross',
                    symbols: 7,
                    latestSession: '2026-11-13',
                },
            ]);
            const where = vi.fn((_condition: unknown) => ({ groupBy }));
            const select = vi.fn((_fields: unknown) => ({
                from: () => ({ where }),
            }));
            const db = { select } as unknown as SiglensDatabase;

            const counts = await new DrizzleSignalHistoryRepository(
                db
            ).recentCountsByType(['golden_cross', 'death_cross'], '2026-10-16');

            expect(counts).toEqual([
                {
                    signalType: 'golden_cross',
                    symbols: 7,
                    latestSession: '2026-11-13',
                },
            ]);
            const { sql, params } = render(onlyCallArg(where));
            expect(sql).toBe(
                '("signal_events"."signal_type" in ($1, $2) and "signal_events"."session_date" >= $3)'
            );
            // 색인 판정은 종목 수(같은 종목의 여러 에피소드는 한 줄), lastmod는 마지막 포착 세션.
            const fields = onlyCallArg(select) as Record<string, unknown>;
            const selection = render(fields['symbols']).sql;
            expect(selection).toBe(
                'count(distinct ("signal_events"."market", "signal_events"."symbol"))::int'
            );
            expect(render(fields['latestSession']).sql).toBe(
                'max("signal_events"."last_seen_session")::text'
            );
            expect(params).toEqual([
                'golden_cross',
                'death_cross',
                '2026-10-16',
            ]);
        });

        it('신호 목록이 비면 쿼리하지 않는다', async () => {
            const select = vi.fn();
            const db = { select } as unknown as SiglensDatabase;

            await expect(
                new DrizzleSignalHistoryRepository(db).recentCountsByType(
                    [],
                    '2026-10-16'
                )
            ).resolves.toEqual([]);
            expect(select).not.toHaveBeenCalled();
        });
    });
    describe('latestRecordedSession', () => {
        it('끝까지 기록된(완료 시각이 있는) 세션 중 가장 최근 날짜를 읽는다 — 마지막 포착 세션의 최댓값이 아니다', async () => {
            const where = vi.fn().mockResolvedValue([{ latest: '2026-11-24' }]);
            const from = vi.fn((_table: unknown) => ({ where }));
            const select = vi.fn((_fields: unknown) => ({ from }));
            const db = { select } as unknown as SiglensDatabase;

            await expect(
                new DrizzleSignalHistoryRepository(db).latestRecordedSession(
                    'kr'
                )
            ).resolves.toBe('2026-11-24');

            const { sql, params } = render(onlyCallArg(where));
            expect(sql).toBe(
                '("signal_scan_sessions"."market" = $1 and "signal_scan_sessions"."completed_at" is not null)'
            );
            expect(params).toEqual(['kr']);
            const fields = onlyCallArg(select) as Record<string, unknown>;
            expect(render(fields['latest']).sql).toBe(
                'max("signal_scan_sessions"."session_date")::text'
            );
        });

        it('완료된 세션이 없으면(최댓값이 null) null이다', async () => {
            const where = vi.fn().mockResolvedValue([{ latest: null }]);
            const db = {
                select: () => ({ from: () => ({ where }) }),
            } as unknown as SiglensDatabase;

            await expect(
                new DrizzleSignalHistoryRepository(db).latestRecordedSession(
                    'us'
                )
            ).resolves.toBeNull();
        });
    });

    describe('findEpisodesStartedOn', () => {
        it('시장과 첫 포착 세션이 같고 신호 유형 목록에 드는 행을 읽는다', async () => {
            const rows = [
                {
                    symbol: 'NVDA',
                    signalType: 'golden_cross',
                    changePercent: 2.5,
                    koreanName: '엔비디아',
                },
            ];
            const orderBy = vi.fn().mockResolvedValue(rows);
            const where = vi.fn((_condition: unknown) => ({ orderBy }));
            const db = {
                select: () => ({ from: () => ({ where }) }),
            } as unknown as SiglensDatabase;

            await expect(
                new DrizzleSignalHistoryRepository(db).findEpisodesStartedOn(
                    'us',
                    '2026-11-24',
                    ['golden_cross', 'death_cross']
                )
            ).resolves.toEqual(rows);

            const { sql, params } = render(onlyCallArg(where));
            // 이어진 에피소드(last_seen_session)가 아니라 그날 시작된 에피소드(session_date 같음)다.
            expect(sql).toBe(
                '("signal_events"."market" = $1 and "signal_events"."session_date" = $2 and "signal_events"."signal_type" in ($3, $4))'
            );
            expect(params).toEqual([
                'us',
                '2026-11-24',
                'golden_cross',
                'death_cross',
            ]);
        });

        it('신호 유형 목록이 비면 쿼리하지 않는다', async () => {
            const select = vi.fn();
            const db = { select } as unknown as SiglensDatabase;

            await expect(
                new DrizzleSignalHistoryRepository(db).findEpisodesStartedOn(
                    'us',
                    '2026-11-24',
                    []
                )
            ).resolves.toEqual([]);
            expect(select).not.toHaveBeenCalled();
        });
    });
    describe('listLatestSessionEpisodes', () => {
        function dbCapturing(rows: unknown[]) {
            const limit = vi.fn().mockResolvedValue(rows);
            const orderBy = vi.fn(() => ({ limit }));
            const where = vi.fn((_condition: unknown) => ({ orderBy }));
            const select = vi.fn((_fields: unknown) => ({
                from: () => ({ where }),
            }));
            return {
                db: { select } as unknown as SiglensDatabase,
                select,
                where,
                limit,
            };
        }

        it('시장·신호 유형으로 거르고, 마지막 포착 세션이 그 시장의 최근 완료 세션인 행만 읽는다', async () => {
            const rows = [
                {
                    symbol: 'NVDA',
                    koreanName: '엔비디아',
                    signalType: 'rsi_oversold',
                    sessionDate: '2026-11-20',
                    changePercent: -3.1,
                },
            ];
            const { db, where, limit } = dbCapturing(rows);

            await expect(
                new DrizzleSignalHistoryRepository(
                    db
                ).listLatestSessionEpisodes(
                    ['rsi_oversold', 'rsi_overbought'],
                    'us',
                    10
                )
            ).resolves.toEqual(rows);

            const { sql, params } = render(onlyCallArg(where));
            expect(sql.replace(/\s+/g, ' ').trim()).toBe(
                '("signal_events"."market" = $1 and "signal_events"."signal_type" in ($2, $3) and "signal_events"."last_seen_session" >= ( SELECT max("signal_scan_sessions"."session_date") FROM "signal_scan_sessions" WHERE "signal_scan_sessions"."market" = $4 AND "signal_scan_sessions"."completed_at" IS NOT NULL ) and "signal_events"."session_date" <= ( SELECT max("signal_scan_sessions"."session_date") FROM "signal_scan_sessions" WHERE "signal_scan_sessions"."market" = $5 AND "signal_scan_sessions"."completed_at" IS NOT NULL ))'
            );
            // 서브쿼리의 시장도 같은 값이어야 한다(다른 시장의 완료 세션을 빌려 오지 않는다).
            expect(params).toEqual([
                'us',
                'rsi_oversold',
                'rsi_overbought',
                'us',
                'us',
            ]);
            expect(limit).toHaveBeenCalledWith(10);
        });

        it('이름 붙인 열만 고른다 — 행 전체를 읽지 않는다', async () => {
            const { db, select } = dbCapturing([]);

            await new DrizzleSignalHistoryRepository(
                db
            ).listLatestSessionEpisodes(['rsi_oversold'], 'kr', 5);

            expect(Object.keys(onlyCallArg(select) as object)).toEqual([
                'symbol',
                'koreanName',
                'signalType',
                'sessionDate',
                'changePercent',
            ]);
        });

        it('신호 유형이 비거나 한도가 0 이하면 쿼리하지 않는다', async () => {
            const select = vi.fn();
            const repo = new DrizzleSignalHistoryRepository({
                select,
            } as unknown as SiglensDatabase);

            await expect(
                repo.listLatestSessionEpisodes([], 'us', 5)
            ).resolves.toEqual([]);
            await expect(
                repo.listLatestSessionEpisodes(['rsi_oversold'], 'us', 0)
            ).resolves.toEqual([]);
            expect(select).not.toHaveBeenCalled();
        });
    });

    describe('countHubSymbols', () => {
        it('시장별 종목 수를 돌려주고, 없는 시장은 0이다', async () => {
            const groupBy = vi
                .fn()
                .mockResolvedValue([{ market: 'us', symbols: 150 }]);
            const where = vi.fn(() => ({ groupBy }));
            const db = {
                select: vi.fn(() => ({ from: () => ({ where }) })),
            } as unknown as SiglensDatabase;

            await expect(
                new DrizzleSignalHistoryRepository(db).countHubSymbols(
                    'golden_cross',
                    '2026-10-24'
                )
            ).resolves.toEqual({ us: 150, kr: 0 });

            const { sql, params } = render(onlyCallArg(where));
            expect(sql).toBe(
                '("signal_events"."signal_type" = $1 and "signal_events"."session_date" >= $2)'
            );
            expect(params).toEqual(['golden_cross', '2026-10-24']);
        });
    });

    describe('loadScanCursors', () => {
        it('종목이 없으면 쿼리하지 않는다', async () => {
            const select = vi.fn();
            const db = { select } as unknown as SiglensDatabase;

            const cursors = await new DrizzleSignalHistoryRepository(
                db
            ).loadScanCursors('us', []);

            expect(cursors.size).toBe(0);
            expect(select).not.toHaveBeenCalled();
        });

        it('시장과 종목으로 거르고 종목을 키로 한 맵을 돌려준다', async () => {
            const where = vi.fn().mockResolvedValue([
                {
                    symbol: 'NVDA',
                    lastSession: '2026-11-19',
                    attemptSession: null,
                    attempts: 0,
                    lastOutcome: 'recorded',
                },
            ]);
            const db = {
                select: vi.fn(() => ({ from: () => ({ where }) })),
            } as unknown as SiglensDatabase;

            const cursors = await new DrizzleSignalHistoryRepository(
                db
            ).loadScanCursors('us', ['NVDA', 'AAPL']);

            expect(cursors.get('NVDA')).toEqual({
                lastSession: '2026-11-19',
                attemptSession: null,
                attempts: 0,
                lastOutcome: 'recorded',
            });
            const { sql, params } = render(onlyCallArg(where));
            expect(sql).toBe(
                '("signal_scan_cursors"."market" = $1 and "signal_scan_cursors"."symbol" in ($2, $3))'
            );
            expect(params).toEqual(['us', 'NVDA', 'AAPL']);
        });
    });

    describe('applySymbolScan', () => {
        it('재계산이 없고 쓸 행도 없으면 표식 upsert 하나만 한 트랜잭션에서 한다', async () => {
            const onConflictDoUpdate = vi.fn().mockResolvedValue(undefined);
            const values = vi.fn(() => ({ onConflictDoUpdate }));
            const tx = {
                insert: vi.fn(() => ({ values })),
                delete: vi.fn(),
                update: vi.fn(),
                execute: vi.fn(),
            };
            const transaction = vi.fn(
                async (run: (tx: unknown) => Promise<void>) => run(tx)
            );
            const db = { transaction } as unknown as SiglensDatabase;

            await new DrizzleSignalHistoryRepository(db).applySymbolScan({
                market: 'us',
                symbol: 'NVDA',
                session: '2026-11-20',
                rebuildFrom: null,
                relabelCutover: null,
                lastSeenUpdates: [],
                inserts: [],
            });

            expect(transaction).toHaveBeenCalledTimes(1);
            expect(tx.delete).not.toHaveBeenCalled();
            expect(tx.update).not.toHaveBeenCalled();
            expect(tx.execute).not.toHaveBeenCalled();
            expect(tx.insert).toHaveBeenCalledTimes(1);
            expect(onlyCallArg(values)).toMatchObject({
                market: 'us',
                symbol: 'NVDA',
                lastSession: '2026-11-20',
                attempts: 0,
                lastOutcome: 'recorded',
            });
        });
    });
});
