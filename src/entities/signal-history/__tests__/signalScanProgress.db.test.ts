import { drizzle } from 'drizzle-orm/postgres-js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';
import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import * as schema from '@/shared/db/schema';
import { describeTarget } from '../../../../db/scripts/lib/dbTarget';
import { DrizzleSignalHistoryRepository } from '../api';
import type { ScanEpisodeInsert } from '../types';

vi.mock('server-only', () => ({}));

/**
 * 신호 기록 진행 표식과 신호 페이지 목록 쿼리를 진짜 Postgres에서 본다(TESTING.md#TE-55): 한 트랜잭션 쓰기
 * (실패하면 행도 표식도 그대로), 재계산 구간 삭제와 옛 골든·데드크로스 이름 바꾸기, 시도 횟수 세션별 초기화,
 * 시장별 상한과 정렬, 완료 시각 보존, 가이드 라이브 블록의 "최근 완료 세션" 읽기. 모킹된 DB로는 `ON CONFLICT`·`DISTINCT ON`·윈도 함수·트랜잭션
 * 롤백이 보이지 않는다. `TEST_DATABASE_URL`이 없으면 건너뛴다. 로컬 실행:
 *   docker run -d --name <unique> -e POSTGRES_PASSWORD=x -e POSTGRES_USER=siglens -e POSTGRES_DB=siglens_test \
 *     -p 127.0.0.1:55433:5432 --pull never postgres:17-alpine
 *   TEST_DATABASE_URL=postgres://siglens:x@127.0.0.1:55433/siglens_test yarn test signalScanProgress.db.test.ts
 * 접속 대상이 로컬이 아니면 거부하고, 임시 스키마에 실제 마이그레이션(`0056`의 신호 이력 표와
 * `0064_signal_scan_progress.sql`)을 적용한 뒤 끝나면 스키마를 지운다.
 */
const URL = process.env.TEST_DATABASE_URL;
const SCHEMA = `signal_scan_test_${process.pid}`;

const migration = (file: string): string[] =>
    readFileSync(path.join(process.cwd(), 'drizzle', file), 'utf8')
        .split('--> statement-breakpoint')
        .map(statement => statement.replaceAll('"public".', ''));

/** 옛 코드가 기록한 행의 시각. */
const COMPUTED_AT = '2026-11-20T21:20:00.000Z';
/** 새 기록 코드 배포 시각 — 이보다 먼저 기록된 골든·데드크로스만 옛 20/50 행이다. */
const CUTOVER = '2026-11-21T00:00:00.000Z';
/** 새 코드가 기록한 행의 시각. */
const NEW_CODE_COMPUTED_AT = '2026-11-25T21:20:00.000Z';

function episode(
    overrides: Partial<ScanEpisodeInsert> &
        Pick<ScanEpisodeInsert, 'sessionDate' | 'signalType'>
): ScanEpisodeInsert {
    return {
        market: 'us',
        symbol: 'NVDA',
        direction: 'bullish',
        changePercent: 1,
        priceAtDetection: 100,
        koreanName: null,
        computedAt: COMPUTED_AT,
        lastSeenSession: overrides.sessionDate,
        ...overrides,
    };
}

describe.skipIf(!URL)(
    '신호 기록 진행 저장소가 진짜 Postgres에서 규칙대로 동작한다',
    () => {
        const admin = postgres(URL as string, { max: 1 });
        const client = postgres(URL as string, {
            max: 4,
            connection: { search_path: SCHEMA },
        });
        const db = drizzle(client, { schema });
        const repo = new DrizzleSignalHistoryRepository(db);

        async function runInOrder(
            statements: readonly string[]
        ): Promise<void> {
            await statements.reduce(
                (previous, statement) =>
                    previous.then(() =>
                        client.unsafe(statement).then(() => {})
                    ),
                Promise.resolve()
            );
        }

        async function eventRows(symbol: string, market = 'us') {
            return client<
                {
                    session_date: string;
                    last_seen_session: string;
                    signal_type: string;
                }[]
            >`SELECT session_date::text, last_seen_session::text, signal_type
              FROM signal_events WHERE market = ${market} AND symbol = ${symbol}
              ORDER BY session_date, signal_type`;
        }

        async function seedEvent(
            row: Omit<ScanEpisodeInsert, 'signalType'> & { signalType: string }
        ): Promise<void> {
            await client`INSERT INTO signal_events
                (market, session_date, last_seen_session, symbol, signal_type, direction, change_percent, computed_at)
                VALUES (${row.market}, ${row.sessionDate}, ${row.lastSeenSession}, ${row.symbol},
                        ${row.signalType}, ${row.direction}, ${row.changePercent}, ${row.computedAt})`;
        }

        beforeAll(async () => {
            const target = describeTarget(URL as string);
            if (!target.isLocal || target.viaTunnel) {
                throw new Error(
                    `refusing to run against a non-local database: ${target.host}`
                );
            }
            await admin.unsafe(`CREATE SCHEMA "${SCHEMA}"`);
            await runInOrder(migration('0056_signal_events.sql'));
            await client.unsafe(
                'ALTER TABLE "signal_events" ADD COLUMN "price_at_detection" double precision'
            );
            await runInOrder(migration('0064_signal_scan_progress.sql'));
        });

        afterAll(async () => {
            await admin?.unsafe(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
            await client?.end();
            await admin?.end();
        });

        describe('recordScanFailure / loadScanCursors', () => {
            it('같은 세션이면 시도가 늘고, 세션이 바뀌면 1부터 다시 센다', async () => {
                await repo.recordScanFailure(
                    'us',
                    'AAA',
                    '2026-11-19',
                    'failed'
                );
                await repo.recordScanFailure(
                    'us',
                    'AAA',
                    '2026-11-19',
                    'stale'
                );
                const sameSession = (
                    await repo.loadScanCursors('us', ['AAA'])
                ).get('AAA');
                expect(sameSession).toEqual({
                    lastSession: null,
                    attemptSession: '2026-11-19',
                    attempts: 2,
                    lastOutcome: 'stale',
                });

                await repo.recordScanFailure(
                    'us',
                    'AAA',
                    '2026-11-20',
                    'failed'
                );
                const nextSession = (
                    await repo.loadScanCursors('us', ['AAA'])
                ).get('AAA');
                expect(nextSession?.attempts).toBe(1);
                expect(nextSession?.attemptSession).toBe('2026-11-20');
            });

            it('기록된 세션(last_session)은 실패가 건드리지 않는다', async () => {
                await repo.applySymbolScan({
                    market: 'us',
                    symbol: 'BBB',
                    session: '2026-11-19',
                    rebuildFrom: null,
                    relabelCutover: null,
                    lastSeenUpdates: [],
                    inserts: [],
                });
                await repo.recordScanFailure(
                    'us',
                    'BBB',
                    '2026-11-20',
                    'stale'
                );

                const cursor = (await repo.loadScanCursors('us', ['BBB'])).get(
                    'BBB'
                );
                expect(cursor?.lastSession).toBe('2026-11-19');
                expect(cursor?.attempts).toBe(1);
            });

            it('없는 종목은 맵에 없고, 빈 목록은 쿼리 없이 빈 맵이다', async () => {
                const cursors = await repo.loadScanCursors('us', ['NOPE']);
                expect(cursors.size).toBe(0);
                expect((await repo.loadScanCursors('us', [])).size).toBe(0);
            });

            it('시장이 다르면 같은 심볼도 다른 표식이다', async () => {
                await repo.recordScanFailure(
                    'kr',
                    'AAA',
                    '2026-11-20',
                    'failed'
                );
                expect((await repo.loadScanCursors('kr', ['AAA'])).size).toBe(
                    1
                );
                expect(
                    (await repo.loadScanCursors('us', ['AAA'])).get('AAA')
                        ?.attemptSession
                ).toBe('2026-11-20');
            });
        });

        describe('applySymbolScan', () => {
            it('새 행을 넣고 표식을 기록 완료로 바꾸며 시도를 0으로 되돌린다', async () => {
                await repo.recordScanFailure(
                    'us',
                    'CCC',
                    '2026-11-20',
                    'failed'
                );

                await repo.applySymbolScan({
                    market: 'us',
                    symbol: 'CCC',
                    session: '2026-11-20',
                    rebuildFrom: null,
                    relabelCutover: null,
                    lastSeenUpdates: [],
                    inserts: [
                        episode({
                            symbol: 'CCC',
                            sessionDate: '2026-11-18',
                            lastSeenSession: '2026-11-20',
                            signalType: 'rsi_oversold',
                        }),
                    ],
                });

                expect(await eventRows('CCC')).toEqual([
                    {
                        session_date: '2026-11-18',
                        last_seen_session: '2026-11-20',
                        signal_type: 'rsi_oversold',
                    },
                ]);
                const cursor = (await repo.loadScanCursors('us', ['CCC'])).get(
                    'CCC'
                );
                expect(cursor).toEqual({
                    lastSession: '2026-11-20',
                    attemptSession: null,
                    attempts: 0,
                    lastOutcome: 'recorded',
                });
            });

            it('이어진 에피소드의 마지막 포착 세션은 늘리기만 하고 줄이지 않는다', async () => {
                await seedEvent(
                    episode({
                        symbol: 'DDD',
                        sessionDate: '2026-11-10',
                        lastSeenSession: '2026-11-12',
                        signalType: 'macd_bullish_cross',
                    })
                );

                await repo.applySymbolScan({
                    market: 'us',
                    symbol: 'DDD',
                    session: '2026-11-13',
                    rebuildFrom: null,
                    relabelCutover: null,
                    lastSeenUpdates: [
                        {
                            signalType: 'macd_bullish_cross',
                            sessionDate: '2026-11-10',
                            lastSeenSession: '2026-11-13',
                        },
                    ],
                    inserts: [],
                });
                expect((await eventRows('DDD'))[0]?.last_seen_session).toBe(
                    '2026-11-13'
                );

                await repo.applySymbolScan({
                    market: 'us',
                    symbol: 'DDD',
                    session: '2026-11-13',
                    rebuildFrom: null,
                    relabelCutover: null,
                    lastSeenUpdates: [
                        {
                            signalType: 'macd_bullish_cross',
                            sessionDate: '2026-11-10',
                            lastSeenSession: '2026-11-11',
                        },
                    ],
                    inserts: [],
                });
                expect((await eventRows('DDD'))[0]?.last_seen_session).toBe(
                    '2026-11-13'
                );
            });

            it('같은 기본키 입력은 하나만 넣고, 이미 있는 행과 겹쳐도 던지지 않는다', async () => {
                const row = episode({
                    symbol: 'EEE',
                    sessionDate: '2026-11-18',
                    signalType: 'rsi_overbought',
                });

                await repo.applySymbolScan({
                    market: 'us',
                    symbol: 'EEE',
                    session: '2026-11-18',
                    rebuildFrom: null,
                    relabelCutover: null,
                    lastSeenUpdates: [],
                    inserts: [row, row],
                });
                await repo.applySymbolScan({
                    market: 'us',
                    symbol: 'EEE',
                    session: '2026-11-18',
                    rebuildFrom: null,
                    relabelCutover: null,
                    lastSeenUpdates: [],
                    inserts: [row],
                });

                expect(await eventRows('EEE')).toHaveLength(1);
            });

            it('재계산 구간 이후 행을 지우고, 그 이전의 옛 골든·데드크로스만 새 이름으로 바꾼다', async () => {
                await seedEvent(
                    episode({
                        symbol: 'FFF',
                        sessionDate: '2026-05-01',
                        signalType: 'golden_cross',
                    })
                );
                await seedEvent(
                    episode({
                        symbol: 'FFF',
                        sessionDate: '2026-05-02',
                        signalType: 'death_cross',
                        direction: 'bearish',
                    })
                );
                await seedEvent(
                    episode({
                        symbol: 'FFF',
                        sessionDate: '2026-05-03',
                        signalType: 'rsi_oversold',
                    })
                );
                // 재계산 구간 안의 옛 20/50 행은 지워지고 새 규칙으로 다시 들어간다.
                await seedEvent(
                    episode({
                        symbol: 'FFF',
                        sessionDate: '2026-11-05',
                        signalType: 'golden_cross',
                    })
                );
                // 다른 종목·다른 시장은 건드리지 않는다.
                await seedEvent(
                    episode({
                        symbol: 'GGG',
                        sessionDate: '2026-05-01',
                        signalType: 'golden_cross',
                    })
                );
                await seedEvent(
                    episode({
                        market: 'kr',
                        symbol: 'FFF',
                        sessionDate: '2026-11-05',
                        signalType: 'golden_cross',
                    })
                );

                await repo.applySymbolScan({
                    market: 'us',
                    symbol: 'FFF',
                    session: '2026-11-20',
                    rebuildFrom: '2026-06-01',
                    relabelCutover: CUTOVER,
                    lastSeenUpdates: [],
                    inserts: [
                        episode({
                            symbol: 'FFF',
                            sessionDate: '2026-11-19',
                            signalType: 'golden_cross',
                        }),
                    ],
                });

                expect(await eventRows('FFF')).toEqual([
                    {
                        session_date: '2026-05-01',
                        last_seen_session: '2026-05-01',
                        signal_type: 'short_ma_bullish_cross',
                    },
                    {
                        session_date: '2026-05-02',
                        last_seen_session: '2026-05-02',
                        signal_type: 'short_ma_bearish_cross',
                    },
                    {
                        session_date: '2026-05-03',
                        last_seen_session: '2026-05-03',
                        signal_type: 'rsi_oversold',
                    },
                    {
                        session_date: '2026-11-19',
                        last_seen_session: '2026-11-19',
                        signal_type: 'golden_cross',
                    },
                ]);
                expect((await eventRows('GGG'))[0]?.signal_type).toBe(
                    'golden_cross'
                );
                expect(await eventRows('FFF', 'kr')).toHaveLength(1);
            });

            it('새 이름 행이 이미 같은 자리에 있으면 이름 바꾸기를 건너뛰고 실패하지 않는다', async () => {
                await seedEvent(
                    episode({
                        symbol: 'HHH',
                        sessionDate: '2026-05-01',
                        signalType: 'golden_cross',
                    })
                );
                // 새 이름은 core 릴리스 전이라 `SignalType`에 아직 없다 — 저장소는 문자열로 다룬다.
                await seedEvent({
                    ...episode({
                        symbol: 'HHH',
                        sessionDate: '2026-05-01',
                        signalType: 'golden_cross',
                    }),
                    signalType: 'short_ma_bullish_cross',
                });

                await repo.applySymbolScan({
                    market: 'us',
                    symbol: 'HHH',
                    session: '2026-11-20',
                    rebuildFrom: '2026-06-01',
                    relabelCutover: CUTOVER,
                    lastSeenUpdates: [],
                    inserts: [],
                });

                expect(
                    (await eventRows('HHH')).map(row => row.signal_type)
                ).toEqual(['golden_cross', 'short_ma_bullish_cross']);
            });

            it('새 코드가 쓴 50/200 골든·데드크로스 행은 다시 처음 기록해도 이름이 바뀌지 않는다', async () => {
                await seedEvent({
                    ...episode({
                        symbol: 'KKK',
                        sessionDate: '2026-05-01',
                        signalType: 'golden_cross',
                    }),
                    computedAt: NEW_CODE_COMPUTED_AT,
                });
                await seedEvent(
                    episode({
                        symbol: 'KKK',
                        sessionDate: '2026-05-02',
                        signalType: 'golden_cross',
                    })
                );

                await repo.applySymbolScan({
                    market: 'us',
                    symbol: 'KKK',
                    session: '2026-11-20',
                    rebuildFrom: '2026-06-01',
                    relabelCutover: CUTOVER,
                    lastSeenUpdates: [],
                    inserts: [],
                });

                expect(
                    (await eventRows('KKK')).map(
                        row => `${row.session_date}:${row.signal_type}`
                    )
                ).toEqual([
                    '2026-05-01:golden_cross',
                    '2026-05-02:short_ma_bullish_cross',
                ]);
            });

            it('이름 바꾸기 기준 시각이 없으면 옛 행도 그대로 둔다', async () => {
                await seedEvent(
                    episode({
                        symbol: 'LLL',
                        sessionDate: '2026-05-01',
                        signalType: 'golden_cross',
                    })
                );

                await repo.applySymbolScan({
                    market: 'us',
                    symbol: 'LLL',
                    session: '2026-11-20',
                    rebuildFrom: '2026-06-01',
                    relabelCutover: null,
                    lastSeenUpdates: [],
                    inserts: [],
                });

                expect((await eventRows('LLL'))[0]?.signal_type).toBe(
                    'golden_cross'
                );
            });

            it('쓰는 도중 실패하면 삭제·이름 바꾸기·삽입·표식이 모두 그대로다', async () => {
                await seedEvent(
                    episode({
                        symbol: 'III',
                        sessionDate: '2026-05-01',
                        signalType: 'golden_cross',
                    })
                );
                await seedEvent(
                    episode({
                        symbol: 'III',
                        sessionDate: '2026-11-05',
                        signalType: 'rsi_oversold',
                    })
                );
                const poisoned = {
                    ...episode({
                        symbol: 'III',
                        sessionDate: '2026-11-10',
                        signalType: 'rsi_overbought',
                    }),
                    // varchar(8) 초과 방향 값 — 삽입 단계에서 DB가 거부한다.
                    direction: 'way-too-long-direction' as 'bullish',
                };

                await expect(
                    repo.applySymbolScan({
                        market: 'us',
                        symbol: 'III',
                        session: '2026-11-20',
                        rebuildFrom: '2026-06-01',
                        relabelCutover: CUTOVER,
                        lastSeenUpdates: [],
                        inserts: [poisoned],
                    })
                ).rejects.toThrow();

                expect(
                    (await eventRows('III')).map(row => row.signal_type)
                ).toEqual(['golden_cross', 'rsi_oversold']);
                expect((await repo.loadScanCursors('us', ['III'])).size).toBe(
                    0
                );
            });
        });

        describe('openEpisodesSince', () => {
            it('그 종목의 마지막 포착 세션이 기준 이상인 에피소드만 돌려준다', async () => {
                await seedEvent(
                    episode({
                        symbol: 'JJJ',
                        sessionDate: '2026-11-01',
                        lastSeenSession: '2026-11-02',
                        signalType: 'rsi_oversold',
                    })
                );
                await seedEvent(
                    episode({
                        symbol: 'JJJ',
                        sessionDate: '2026-11-18',
                        lastSeenSession: '2026-11-19',
                        signalType: 'macd_bullish_cross',
                    })
                );

                expect(
                    await repo.openEpisodesSince('us', 'JJJ', '2026-11-19')
                ).toEqual([
                    {
                        signalType: 'macd_bullish_cross',
                        sessionDate: '2026-11-18',
                        lastSeenSession: '2026-11-19',
                    },
                ]);
            });
        });

        describe('openEpisodesSince 이름 바꾸기 조회', () => {
            it('기준 시각 이전에 기록된 옛 행만 새 이름으로 돌려주고, 쓰지 않은 조회는 이름 그대로다', async () => {
                await seedEvent(
                    episode({
                        symbol: 'MMM',
                        sessionDate: '2026-11-18',
                        lastSeenSession: '2026-11-19',
                        signalType: 'death_cross',
                        direction: 'bearish',
                    })
                );
                await seedEvent({
                    ...episode({
                        symbol: 'MMM',
                        sessionDate: '2026-11-26',
                        lastSeenSession: '2026-11-27',
                        signalType: 'golden_cross',
                    }),
                    computedAt: NEW_CODE_COMPUTED_AT,
                });
                await seedEvent(
                    episode({
                        symbol: 'MMM',
                        sessionDate: '2026-11-19',
                        lastSeenSession: '2026-11-19',
                        signalType: 'rsi_oversold',
                    })
                );

                const relabelled = await repo.openEpisodesSince(
                    'us',
                    'MMM',
                    '2026-11-19',
                    { relabelCutover: CUTOVER }
                );
                const plain = await repo.openEpisodesSince(
                    'us',
                    'MMM',
                    '2026-11-19'
                );

                const types = (rows: readonly { signalType: string }[]) =>
                    rows.map(row => row.signalType).sort();
                expect(types(relabelled)).toEqual([
                    'golden_cross',
                    'rsi_oversold',
                    'short_ma_bearish_cross',
                ]);
                expect(types(plain)).toEqual([
                    'death_cross',
                    'golden_cross',
                    'rsi_oversold',
                ]);
            });
        });

        describe('세션 완료 표식', () => {
            it('완료 시각이 없으면 완료로 치지 않고, 완료 뒤 미완료 집계가 와도 지우지 않는다', async () => {
                const base = {
                    market: 'kr' as const,
                    universeSize: 350,
                    recorded: 100,
                    failed: 0,
                    stale: 0,
                };
                await repo.upsertScanSession({
                    ...base,
                    sessionDate: '2026-11-19',
                    completedAt: null,
                });
                expect(await repo.latestCompletedSession('kr')).toBeNull();

                await repo.upsertScanSession({
                    ...base,
                    sessionDate: '2026-11-19',
                    recorded: 350,
                    completedAt: '2026-11-19T12:00:00.000Z',
                });
                expect(await repo.latestCompletedSession('kr')).toBe(
                    '2026-11-19'
                );

                await repo.upsertScanSession({
                    ...base,
                    sessionDate: '2026-11-19',
                    recorded: 351,
                    completedAt: null,
                });
                expect(await repo.latestCompletedSession('kr')).toBe(
                    '2026-11-19'
                );
                const [stored] = await client<
                    { recorded: number; completed_utc: string | null }[]
                >`SELECT recorded,
                         to_char(completed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS') AS completed_utc
                  FROM signal_scan_sessions
                  WHERE market = 'kr' AND session_date = '2026-11-19'`;
                expect(stored?.recorded).toBe(351);
                expect(stored?.completed_utc).toBe('2026-11-19T12:00:00');
            });

            it('완료 시각은 처음 정한 값이 유지되고 나중 완료 호출이 덮어쓰지 않는다', async () => {
                const base = {
                    market: 'kr' as const,
                    sessionDate: '2026-11-17',
                    universeSize: 350,
                    recorded: 350,
                    failed: 0,
                    stale: 0,
                };
                await repo.upsertScanSession({
                    ...base,
                    completedAt: '2026-11-17T12:00:00.000Z',
                });
                await repo.upsertScanSession({
                    ...base,
                    completedAt: '2026-11-17T13:30:00.000Z',
                });

                const [stored] = await client<
                    { completed_utc: string | null }[]
                >`SELECT to_char(completed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS') AS completed_utc
                  FROM signal_scan_sessions
                  WHERE market = 'kr' AND session_date = '2026-11-17'`;
                expect(stored?.completed_utc).toBe('2026-11-17T12:00:00');
            });

            it('가장 최근 완료 세션을 시장별로 돌려준다', async () => {
                await repo.upsertScanSession({
                    market: 'us',
                    sessionDate: '2026-11-18',
                    universeSize: 500,
                    recorded: 500,
                    failed: 0,
                    stale: 0,
                    completedAt: '2026-11-18T23:00:00.000Z',
                });
                await repo.upsertScanSession({
                    market: 'us',
                    sessionDate: '2026-11-20',
                    universeSize: 500,
                    recorded: 10,
                    failed: 0,
                    stale: 0,
                    completedAt: null,
                });

                expect(await repo.latestCompletedSession('us')).toBe(
                    '2026-11-18'
                );
            });
        });

        describe('pruneScanProgress', () => {
            it('오래된 세션 집계를 지우고, 대상에서 빠진 지 30일이 넘은 종목 표식만 지운다', async () => {
                await repo.upsertScanSession({
                    market: 'us',
                    sessionDate: '2025-01-02',
                    universeSize: 1,
                    recorded: 1,
                    failed: 0,
                    stale: 0,
                    completedAt: '2025-01-02T23:00:00.000Z',
                });
                await client`INSERT INTO signal_scan_cursors (market, symbol, last_outcome, updated_at)
                    VALUES ('us', 'OLDOUT', 'recorded', now() - interval '40 days'),
                           ('us', 'OLDIN', 'recorded', now() - interval '40 days'),
                           ('us', 'NEWOUT', 'recorded', now() - interval '2 days'),
                           ('kr', 'KROLD', 'recorded', now() - interval '40 days')`;

                const result = await repo.pruneScanProgress('2026-01-01', {
                    us: ['OLDIN'],
                    kr: [],
                });

                expect(result.sessions).toBeGreaterThanOrEqual(1);
                const left = await client<
                    { symbol: string }[]
                >`SELECT symbol FROM signal_scan_cursors
                  WHERE symbol IN ('OLDOUT','OLDIN','NEWOUT','KROLD')
                  ORDER BY symbol`;
                expect(left.map(row => row.symbol)).toEqual([
                    'NEWOUT',
                    'OLDIN',
                ]);
                expect(
                    await client`SELECT 1 FROM signal_scan_sessions WHERE session_date = '2025-01-02'`
                ).toHaveLength(0);
            });
        });

        describe('listHubRows / countHubSymbols', () => {
            const TYPE = 'new_52w_high';

            async function seedHub(): Promise<void> {
                const us = Array.from({ length: 5 }, (_, i) => ({
                    symbol: `U${i}`,
                    sessionDate: `2026-11-${String(10 + i).padStart(2, '0')}`,
                    changePercent: i,
                }));
                await Promise.all([
                    ...us.map(row =>
                        seedEvent(
                            episode({ ...row, market: 'us', signalType: TYPE })
                        )
                    ),
                    seedEvent(
                        episode({
                            market: 'kr',
                            symbol: '005930.KS',
                            sessionDate: '2026-11-12',
                            signalType: TYPE,
                        })
                    ),
                    // 같은 종목의 오래된 에피소드 — 최근 것만 남아야 한다.
                    seedEvent(
                        episode({
                            symbol: 'U4',
                            sessionDate: '2026-11-01',
                            signalType: TYPE,
                        })
                    ),
                    // 기간 밖·다른 신호는 세지 않는다.
                    seedEvent(
                        episode({
                            symbol: 'OUTSIDE',
                            sessionDate: '2026-09-01',
                            signalType: TYPE,
                        })
                    ),
                    seedEvent(
                        episode({
                            symbol: 'OTHER',
                            sessionDate: '2026-11-12',
                            signalType: 'new_52w_low',
                        })
                    ),
                ]);
            }

            it('종목마다 최근 에피소드 한 줄, 시장 안 최신순으로 상한까지 돌려주고 전체 수는 상한과 무관하다', async () => {
                await seedHub();

                const rows = await repo.listHubRows(TYPE, '2026-11-01', 3);

                expect(rows.map(row => `${row.market}:${row.symbol}`)).toEqual([
                    'us:U4',
                    'us:U3',
                    'us:U2',
                    'kr:005930.KS',
                ]);
                expect(rows.find(row => row.symbol === 'U4')?.sessionDate).toBe(
                    '2026-11-14'
                );
                expect(await repo.countHubSymbols(TYPE, '2026-11-01')).toEqual({
                    us: 5,
                    kr: 1,
                });
            });

            it('같은 날이면 등락률 크기순, 한 시장이 다른 시장을 밀어내지 않는다', async () => {
                const rows = await repo.listHubRows(TYPE, '2026-11-01', 1);

                expect(rows.map(row => row.market)).toEqual(['us', 'kr']);
            });

            it('해당하는 종목이 없으면 빈 목록과 0이다', async () => {
                expect(
                    await repo.listHubRows(
                        'bollinger_squeeze_bullish',
                        '2026-11-01',
                        100
                    )
                ).toEqual([]);
                expect(
                    await repo.countHubSymbols(
                        'bollinger_squeeze_bullish',
                        '2026-11-01'
                    )
                ).toEqual({ us: 0, kr: 0 });
            });
        });
        describe('listLatestSessionEpisodes', () => {
            const TYPE = 'rsi_oversold';
            const OTHER_TYPE = 'rsi_overbought';

            /** 이 describe는 파일 끝이라 앞선 describe가 남긴 행과 표식을 지우고 시작해도 된다. */
            beforeEach(async () => {
                await client`DELETE FROM signal_events`;
                await client`DELETE FROM signal_scan_sessions`;
            });

            const complete = (market: 'us' | 'kr', sessionDate: string) =>
                repo.upsertScanSession({
                    market,
                    sessionDate,
                    universeSize: 10,
                    recorded: 10,
                    failed: 0,
                    stale: 0,
                    completedAt: `${sessionDate}T22:00:00.000Z`,
                });

            const incomplete = (market: 'us' | 'kr', sessionDate: string) =>
                repo.upsertScanSession({
                    market,
                    sessionDate,
                    universeSize: 10,
                    recorded: 3,
                    failed: 0,
                    stale: 0,
                    completedAt: null,
                });

            /** 기록기가 쓰는 길(`applySymbolScan`)로 에피소드를 넣는다. */
            const record = (
                market: 'us' | 'kr',
                symbol: string,
                firstSeen: string,
                lastSeen: string,
                extra: Partial<ScanEpisodeInsert> = {}
            ) =>
                repo.applySymbolScan({
                    market,
                    symbol,
                    session: lastSeen,
                    rebuildFrom: null,
                    relabelCutover: null,
                    lastSeenUpdates: [],
                    inserts: [
                        episode({
                            market,
                            symbol,
                            sessionDate: firstSeen,
                            lastSeenSession: lastSeen,
                            signalType: TYPE,
                            ...extra,
                        }),
                    ],
                });

            const symbolsOf = (
                rows: readonly { readonly symbol: string }[]
            ): string[] => rows.map(row => row.symbol);

            it('완료 표식이 없는 세션은 쓰지 않는다 — 더 새 미완료 세션이 있어도 가장 최근 완료 세션이 이긴다', async () => {
                await complete('us', '2026-11-18');
                await incomplete('us', '2026-11-20');
                await record('us', 'OLD', '2026-11-18', '2026-11-18');
                await record('us', 'NEW', '2026-11-20', '2026-11-20');

                const rows = await repo.listLatestSessionEpisodes(
                    [TYPE],
                    'us',
                    10
                );

                expect(symbolsOf(rows)).toEqual(['OLD']);
            });

            it('완료 세션이 하나도 없는 시장은 빈 목록이다(미완료 세션만 있어도)', async () => {
                await record('kr', '005930.KS', '2026-11-18', '2026-11-18');
                expect(
                    await repo.listLatestSessionEpisodes([TYPE], 'kr', 10)
                ).toEqual([]);

                await incomplete('kr', '2026-11-18');
                expect(
                    await repo.listLatestSessionEpisodes([TYPE], 'kr', 10)
                ).toEqual([]);
            });

            it('시장끼리 섞이지 않는다 — 다른 시장의 완료 세션을 빌려 오지 않는다', async () => {
                await complete('us', '2026-11-20');
                await complete('kr', '2026-11-18');
                await record('us', 'AAPL', '2026-11-20', '2026-11-20');
                await record('kr', '005930.KS', '2026-11-18', '2026-11-18');

                expect(
                    symbolsOf(
                        await repo.listLatestSessionEpisodes([TYPE], 'kr', 10)
                    )
                ).toEqual(['005930.KS']);
                expect(
                    symbolsOf(
                        await repo.listLatestSessionEpisodes([TYPE], 'us', 10)
                    )
                ).toEqual(['AAPL']);
            });

            it('마지막 포착 세션이 완료 세션보다 이른(이미 끊긴) 에피소드는 뺀다', async () => {
                await complete('us', '2026-11-20');
                await record('us', 'ENDED', '2026-11-10', '2026-11-12');
                await record('us', 'OPEN', '2026-11-10', '2026-11-20');

                expect(
                    symbolsOf(
                        await repo.listLatestSessionEpisodes([TYPE], 'us', 10)
                    )
                ).toEqual(['OPEN']);
            });

            it('다음 세션이 일부만 기록된 동안에도 이어진 에피소드는 사라지지 않고, 그 세션에 새로 열린 행은 아직 안 나온다', async () => {
                await complete('us', '2026-11-20');
                await incomplete('us', '2026-11-21');
                // 11-21을 이미 만나 늘어난 에피소드(last_seen = 11-21).
                await record('us', 'EXTENDED', '2026-11-18', '2026-11-20');
                await repo.applySymbolScan({
                    market: 'us',
                    symbol: 'EXTENDED',
                    session: '2026-11-21',
                    rebuildFrom: null,
                    relabelCutover: null,
                    lastSeenUpdates: [
                        {
                            signalType: TYPE,
                            sessionDate: '2026-11-18',
                            lastSeenSession: '2026-11-21',
                        },
                    ],
                    inserts: [],
                });
                // 아직 못 만난 에피소드(last_seen = 11-20).
                await record('us', 'PENDING', '2026-11-18', '2026-11-20');
                // 11-21에 새로 열린 행 — 미완료 세션의 것이다.
                await record('us', 'FRESH', '2026-11-21', '2026-11-21');

                const rows = await repo.listLatestSessionEpisodes(
                    [TYPE],
                    'us',
                    10
                );

                expect(symbolsOf(rows).toSorted()).toEqual([
                    'EXTENDED',
                    'PENDING',
                ]);
            });

            it('신호 유형으로 거르고, 첫 포착 최신순 → 등락률 크기순 → 종목순으로 limit개를 돌려준다', async () => {
                await complete('us', '2026-11-20');
                await record('us', 'Z1', '2026-11-20', '2026-11-20', {
                    changePercent: -5,
                });
                await record('us', 'Z2', '2026-11-20', '2026-11-20', {
                    changePercent: 9,
                });
                await record('us', 'Z0', '2026-11-20', '2026-11-20', {
                    changePercent: -9,
                });
                await record('us', 'Z3', '2026-11-19', '2026-11-20', {
                    changePercent: 20,
                });
                await record('us', 'Z4', '2026-11-20', '2026-11-20', {
                    changePercent: 99,
                    signalType: OTHER_TYPE,
                });

                const all = await repo.listLatestSessionEpisodes(
                    [TYPE],
                    'us',
                    10
                );
                expect(symbolsOf(all)).toEqual(['Z0', 'Z2', 'Z1', 'Z3']);
                expect(all[0]).toEqual({
                    symbol: 'Z0',
                    koreanName: null,
                    signalType: TYPE,
                    sessionDate: '2026-11-20',
                    changePercent: -9,
                });

                const limited = await repo.listLatestSessionEpisodes(
                    [TYPE],
                    'us',
                    3
                );
                expect(symbolsOf(limited)).toEqual(['Z0', 'Z2', 'Z1']);

                const both = await repo.listLatestSessionEpisodes(
                    [TYPE, OTHER_TYPE],
                    'us',
                    10
                );
                expect(symbolsOf(both)).toEqual(['Z4', 'Z0', 'Z2', 'Z1', 'Z3']);
            });

            it('0064 표가 아직 없는 스키마에서는 42P01을 던진다(호출부가 스캐너로 대신한다)', async () => {
                const bareSchema = `${SCHEMA}_bare`;
                await admin.unsafe(`CREATE SCHEMA "${bareSchema}"`);
                const bare = postgres(URL as string, {
                    max: 1,
                    connection: { search_path: bareSchema },
                });
                try {
                    await migration('0056_signal_events.sql').reduce(
                        (previous, statement) =>
                            previous.then(() =>
                                bare.unsafe(statement).then(() => {})
                            ),
                        Promise.resolve()
                    );
                    const bareRepo = new DrizzleSignalHistoryRepository(
                        drizzle(bare, { schema })
                    );

                    const error: unknown = await bareRepo
                        .listLatestSessionEpisodes([TYPE], 'us', 10)
                        .then(
                            () => null,
                            (thrown: unknown) => thrown
                        );

                    // drizzle이 드라이버 오류를 감싸므로 코드는 원인에 있을 수 있다.
                    const code = [error, (error as Error | null)?.cause]
                        .map(e => (e as { code?: string } | null)?.code)
                        .find(Boolean);
                    expect(code).toBe('42P01');
                } finally {
                    await bare.end();
                    await admin.unsafe(
                        `DROP SCHEMA IF EXISTS "${bareSchema}" CASCADE`
                    );
                }
            });
        });
    }
);
