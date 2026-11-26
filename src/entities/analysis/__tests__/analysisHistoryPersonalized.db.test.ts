import { readFileSync } from 'node:fs';
import path from 'node:path';
import { drizzle } from 'drizzle-orm/postgres-js';
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
import { describeTarget } from '../../../../db/scripts/lib/dbTarget';
import * as schema from '@/shared/db/schema';
import { MS_PER_DAY } from '@/shared/config/time';
import { DrizzleAnalysisHistoryRepository } from '../analysisHistoryRepository';

vi.mock('server-only', () => ({}));

/**
 * 보유 맞춤 표시(`analysis_history.personalized`)가 읽기에서 실제로 걸러지는지 진짜 Postgres에서
 * 본다(TESTING.md#TE-55). 맞춤 분석은 한 회원의 보유 상태를 드러내므로 다른 사람에게 보이는 읽기
 * (이전 분석 `findRecentForPrompt`, 공유 가능한 최신 분석 `findLatestShareable`)가 쓰면 안 된다.
 * 모킹된 DB로는 `NULL` 3값 논리(`personalized = false`가 `NULL`을 거르는지)와 `DISTINCT ON`이 보이지
 * 않는다. 맞춤 행은 실제 쓰기 경로(`saveAnalysisHistory`)로 넣고, 옛 행(`NULL`)만 직접 INSERT한다.
 * `TEST_DATABASE_URL`이 없으면 건너뛴다. 로컬 실행:
 *   docker run -d --name <unique> -e POSTGRES_PASSWORD=x -e POSTGRES_USER=siglens -e POSTGRES_DB=siglens_test \
 *     -p 127.0.0.1:55434:5432 --pull never postgres:17-alpine
 *   TEST_DATABASE_URL=postgres://siglens:x@127.0.0.1:55434/siglens_test yarn test analysisHistoryPersonalized.db.test.ts
 * 접속 대상이 로컬이 아니면 거부하고, 임시 스키마에 실제 마이그레이션(0033, 0061, 0066)을 적용한 뒤
 * 끝나면 스키마를 지운다.
 */
const URL = process.env.TEST_DATABASE_URL;
const SCHEMA = `analysis_history_personalized_test_${process.pid}`;

const migration = (file: string): string[] =>
    readFileSync(path.join(process.cwd(), 'drizzle', file), 'utf8')
        .split('--> statement-breakpoint')
        .map(statement => statement.replaceAll('"public".', ''));

const NOW = new Date('2026-11-26T00:00:00.000Z');
const at = (daysAgo: number): Date =>
    new Date(NOW.getTime() - daysAgo * MS_PER_DAY);
const RESULT = { trend: 'bullish', riskLevel: 'medium' };
const RESULT_JSON = JSON.stringify(RESULT);

describe.skipIf(!URL)(
    '보유 맞춤 분석은 다른 사람에게 보이는 읽기에서 빠진다(진짜 Postgres)',
    () => {
        const admin = postgres(URL as string, { max: 1 });
        const client = postgres(URL as string, {
            max: 4,
            connection: { search_path: SCHEMA },
        });
        const db = drizzle(client, { schema });
        const repo = new DrizzleAnalysisHistoryRepository(db);

        async function runInOrder(statements: readonly string[]) {
            await statements.reduce(
                (previous, statement) =>
                    previous.then(() =>
                        client.unsafe(statement).then(() => {})
                    ),
                Promise.resolve()
            );
        }

        /** 실제 쓰기 경로로 한 행을 남긴다. */
        function save(
            symbol: string,
            generatedAt: Date,
            personalized: boolean,
            tier: 'free' | 'member' = 'member'
        ) {
            return repo.saveAnalysisHistory({
                symbol,
                timeframe: '1Day',
                tab: 'technical',
                modelId: 'analysis-worker',
                tier,
                personalized,
                locale: 'ko',
                result: RESULT,
                generatedAt,
                prompt: {
                    system: 'sys',
                    stable: 'stable',
                    dynamic: 'dyn',
                    promptVersion: 'v1',
                },
            });
        }

        /** 이 컬럼이 생기기 전 행 — `personalized`가 `NULL`. */
        function seedLegacy(
            symbol: string,
            generatedAt: Date,
            tier: string | null
        ) {
            return client`INSERT INTO analysis_history
                (symbol, timeframe, tab, model_id, tier, locale, result, generated_at)
                VALUES (${symbol}, '1Day', 'technical', 'analysis-worker', ${tier}, 'ko',
                        ${RESULT_JSON}::jsonb, ${generatedAt.toISOString()}::timestamptz)`;
        }

        async function recentDates(symbol: string): Promise<number[]> {
            const rows = await repo.findRecentForPrompt({
                symbol,
                timeframe: '1Day',
                tab: 'technical',
                includeCurrentWindow: true,
                now: NOW,
            });
            return rows.map(row => row.generatedAt.getTime()).sort();
        }

        beforeAll(async () => {
            const target = describeTarget(URL as string);
            if (!target.isLocal || target.viaTunnel) {
                throw new Error(
                    `refusing to run against a non-local database: ${target.host}`
                );
            }
            await admin.unsafe(`CREATE SCHEMA "${SCHEMA}"`);
            await client.unsafe(
                `CREATE TYPE content_locale AS ENUM ('ko', 'en', 'ja', 'zh')`
            );
            await runInOrder(migration('0033_analysis_history.sql'));
            await runInOrder(
                migration('0061_signal_price_analysis_tier.sql').slice(0, 1)
            );
            await runInOrder(
                migration('0066_analysis_history_personalized.sql')
            );
        });

        beforeEach(async () => {
            await client.unsafe('TRUNCATE analysis_history');
        });

        afterAll(async () => {
            await admin?.unsafe(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
            await client?.end();
            await admin?.end();
        });

        describe('findRecentForPrompt', () => {
            it('맞춤 행은 읽지 않고, 맞춤이 아닌 행은 읽는다', async () => {
                await save('AAPL', at(3), true);
                await save('AAPL', at(2), false);
                expect(await recentDates('AAPL')).toEqual([at(2).getTime()]);
            });

            it('옛 행(NULL)은 free tier가 만든 것만 읽고, 회원 tier·tier 미상은 버린다', async () => {
                await seedLegacy('AAPL', at(5), 'free');
                await seedLegacy('AAPL', at(4), 'member');
                await seedLegacy('AAPL', at(3), 'pro');
                await seedLegacy('AAPL', at(2), null);
                expect(await recentDates('AAPL')).toEqual([at(5).getTime()]);
            });

            it('새 free 행(false)과 옛 free 행(NULL)이 함께 읽힌다', async () => {
                await seedLegacy('AAPL', at(6), 'free');
                await save('AAPL', at(1), false, 'free');
                expect(await recentDates('AAPL')).toEqual([
                    at(6).getTime(),
                    at(1).getTime(),
                ]);
            });
        });

        describe('findLatestShareable', () => {
            const query = (symbols: string[], notBefore: Date) =>
                repo.findLatestShareable({
                    symbols,
                    timeframe: '1Day',
                    tab: 'technical',
                    notBefore,
                });

            it('심볼마다 맞춤이 아닌 가장 최근 행 하나만 돌려준다', async () => {
                await save('AAPL', at(5), false);
                await save('AAPL', at(2), false);
                await save('AAPL', at(1), true);
                await save('MSFT', at(4), false);
                const found = await query(['AAPL', 'MSFT', 'TSLA'], at(30));
                expect([...found.keys()].sort()).toEqual(['AAPL', 'MSFT']);
                expect(found.get('AAPL')?.generatedAt.getTime()).toBe(
                    at(2).getTime()
                );
                expect(found.get('AAPL')?.tier).toBe('member');
                expect(found.get('AAPL')?.result).toEqual(RESULT);
                expect(found.get('MSFT')?.generatedAt.getTime()).toBe(
                    at(4).getTime()
                );
            });

            it('옛 행(NULL)은 free tier여도 쓰지 않는다', async () => {
                await seedLegacy('AAPL', at(2), 'free');
                await seedLegacy('AAPL', at(3), null);
                expect((await query(['AAPL'], at(30))).size).toBe(0);
            });

            it('notBefore 경계: 그 시각 행은 포함, 1ms 앞 행은 제외', async () => {
                await save('AAPL', at(10), false);
                await save('MSFT', new Date(at(10).getTime() - 1), false);
                const found = await query(['AAPL', 'MSFT'], at(10));
                expect([...found.keys()]).toEqual(['AAPL']);
            });

            it('다른 timeframe과 tab은 읽지 않는다', async () => {
                await client`INSERT INTO analysis_history
                    (symbol, timeframe, tab, model_id, tier, personalized, locale, result, generated_at)
                    VALUES ('AAPL', '1Hour', 'technical', 'm', 'free', false, 'ko', ${RESULT_JSON}::jsonb, ${at(1).toISOString()}::timestamptz),
                           ('AAPL', '1Day', 'overall', 'm', 'free', false, 'ko', ${RESULT_JSON}::jsonb, ${at(1).toISOString()}::timestamptz)`;
                expect((await query(['AAPL'], at(30))).size).toBe(0);
            });

            it('심볼이 비어 있으면 쿼리 없이 빈 맵', async () => {
                expect((await query([], at(30))).size).toBe(0);
            });
        });
    }
);
