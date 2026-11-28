import { drizzle } from 'drizzle-orm/postgres-js';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { MS_PER_DAY } from '@/shared/config/time';
import * as schema from '@/shared/db/schema';
import { defined } from '@/shared/test-utils/defined';
import { describeTarget } from '../../../../../db/scripts/lib/dbTarget';
import { DrizzleChatConversationRepository } from '../../api';
import { stripExpiredWebSearchBodies } from '../../server/stripExpiredWebSearchBodies';

vi.mock('server-only', () => ({}));

/**
 * 웹 검색 결과 보존 기간 작업의 SQL(어느 행을 고르고, 어느 행을 건드리지 않는지)을 진짜 Postgres에서 본다
 * (TESTING.md#TE-55). 모킹된 DB로는 `LIKE` 표식 조건, 생성 시각 경계, 키셋 페이지네이션이 맞는 행만 고르는지 보이지 않는다.
 * `TEST_DATABASE_URL`이 없으면 건너뛴다. 로컬 실행:
 *   docker run -d --name <unique> -e POSTGRES_PASSWORD=x -e POSTGRES_USER=siglens -e POSTGRES_DB=siglens_test \
 *     -p 127.0.0.1:<random-port>:5432 --pull never postgres:17-alpine
 *   TEST_DATABASE_URL=postgres://siglens:x@127.0.0.1:<random-port>/siglens_test yarn test stripExpiredWebSearchBodies.db.test.ts
 * 접속 대상이 로컬이 아니면 거부하고, 임시 스키마에 `0035_agent_chat.sql`부터 `chat_messages`를 바꾼 마이그레이션(0057, 0058, 0068)까지 차례로 적용하고, 끝나면 스키마를 지운다.
 * 행은 실제 쓰기 경로(`appendMessages`)로 넣고 생성 시각만 SQL로 옮긴다.
 */
const URL = process.env.TEST_DATABASE_URL;
const SCHEMA = `web_search_retention_test_${process.pid}`;
const DAY_MS = MS_PER_DAY;

const migration = (file: string): string[] =>
    readFileSync(path.join(process.cwd(), 'drizzle', file), 'utf8')
        .split('--> statement-breakpoint')
        .map(statement =>
            statement
                .replaceAll('"public"."users"', '"users"')
                .replaceAll(
                    '"public"."chat_conversations"',
                    '"chat_conversations"'
                )
                .replaceAll('"public"."chat_messages"', '"chat_messages"')
        );

const searchResult = (label: string) =>
    JSON.stringify({
        asOf: '2026-11-01T00:00:00.000Z',
        source: 'Brave Search',
        results: [
            {
                title: `title ${label}`,
                url: `https://example.com/${label}`,
                snippet: `SNIPPET-${label}`,
                age: '3 days ago',
                excerpt: `EXCERPT-${label}`,
                publishedAt: '2026-10-30T00:00:00.000Z',
            },
        ],
    });

describe.skipIf(!URL)(
    '웹 검색 결과 보존 기간 작업이 진짜 Postgres에서 맞는 행만 줄인다',
    () => {
        const admin = postgres(URL as string, { max: 1 });
        const client = postgres(URL as string, {
            max: 4,
            connection: { search_path: SCHEMA },
        });
        const repo = new DrizzleChatConversationRepository(
            drizzle(client, { schema })
        );
        let conversationId = '';
        /** 라벨 → 행 id. */
        const ids = new Map<string, string>();

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

        /** 실제 쓰기 경로로 도구 행을 넣고, 생성 시각만 `ageMs` 전으로 옮긴다. */
        async function seedTool(
            label: string,
            toolName: string,
            content: string,
            ageMs: number
        ): Promise<void> {
            const [row] = await repo.appendMessages(conversationId, [
                {
                    role: 'tool',
                    content,
                    toolName,
                    toolCallId: `call-${label}`,
                },
            ]);
            ids.set(label, row.id);
            await client`UPDATE chat_messages
                SET created_at = now() - make_interval(secs => ${ageMs / 1000})
                WHERE id = ${row.id}`;
        }

        async function contentOf(label: string): Promise<string> {
            const [row] = await client<{ content: string }[]>`
                SELECT content FROM chat_messages WHERE id = ${defined(ids.get(label))}`;
            return row.content;
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
                `CREATE TYPE "content_locale" AS ENUM ('ko','en','ja','zh')`
            );
            await client.unsafe(
                'CREATE TABLE "users" ("id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL)'
            );
            await runInOrder(migration('0035_agent_chat.sql'));
            await runInOrder(migration('0057_agent_chat_chart.sql'));
            await runInOrder(migration('0058_agent_chat_images.sql'));
            await runInOrder(migration('0068_chat_message_turn_at.sql'));
            const [user] = await client<{ id: string }[]>`
                INSERT INTO users DEFAULT VALUES RETURNING id`;
            const conversation = await repo.create({
                userId: user.id,
                firstMessage: 'q',
                locale: 'ko',
                modelId: 'm',
            });
            conversationId = conversation.id;

            // 경계 바깥을 비대칭으로 둔다: 7일 안쪽 둘(6일 23시간, 방금), 바깥 하나(7일 + 1시간).
            await seedTool(
                'recent-a',
                'web_search',
                searchResult('ra'),
                7 * DAY_MS - 3_600_000
            );
            await seedTool('recent-b', 'web_search', searchResult('rb'), 1_000);
            await seedTool(
                'old',
                'web_search',
                searchResult('old'),
                7 * DAY_MS + 3_600_000
            );
            await seedTool(
                'old-envelope',
                'web_search',
                JSON.stringify({
                    truncated: true,
                    preview: '{"results":[{"snippet":"ENVELOPE-SNIPPET"',
                }),
                30 * DAY_MS
            );
            await seedTool(
                'old-other-tool',
                'get_fundamentals',
                searchResult('other'),
                30 * DAY_MS
            );
            await seedTool(
                'old-error',
                'web_search',
                JSON.stringify({ error: 'search_failed' }),
                30 * DAY_MS
            );
            await seedTool(
                'old-stripped',
                'web_search',
                JSON.stringify({
                    results: [{ title: 't', url: 'https://x.example' }],
                    bodiesOmitted: true,
                }),
                30 * DAY_MS
            );
        });

        afterAll(async () => {
            await admin?.unsafe(`DROP SCHEMA IF EXISTS "${SCHEMA}" CASCADE`);
            await client?.end();
            await admin?.end();
        });

        it('줄인 행은 제목과 URL만 남고, 7일 안쪽 행과 다른 도구·오류 행은 그대로다', async () => {
            const before = {
                recentA: await contentOf('recent-a'),
                recentB: await contentOf('recent-b'),
                other: await contentOf('old-other-tool'),
                error: await contentOf('old-error'),
                stripped: await contentOf('old-stripped'),
            };

            const result = await stripExpiredWebSearchBodies({
                repo,
                batchSize: 1,
            });

            expect(result).toMatchObject({ rewritten: 2, failed: false });
            const old = JSON.parse(await contentOf('old'));
            expect(old.results).toEqual([
                { title: 'title old', url: 'https://example.com/old' },
            ]);
            expect(Object.keys(old).sort()).toEqual([
                'bodiesOmitted',
                'results',
            ]);
            expect(await contentOf('old')).not.toMatch(/SNIPPET|EXCERPT/);
            const envelope = await contentOf('old-envelope');
            expect(JSON.parse(envelope)).toEqual({ bodiesOmitted: true });
            expect(envelope).not.toContain('ENVELOPE-SNIPPET');
            expect(await contentOf('recent-a')).toBe(before.recentA);
            expect(await contentOf('recent-b')).toBe(before.recentB);
            expect(await contentOf('old-other-tool')).toBe(before.other);
            expect(await contentOf('old-error')).toBe(before.error);
            expect(await contentOf('old-stripped')).toBe(before.stripped);
        });

        it('다시 돌려도 읽을 행이 없고 아무 행도 바뀌지 않는다', async () => {
            const snapshot = await client`
                SELECT id, content FROM chat_messages ORDER BY id`;

            const second = await stripExpiredWebSearchBodies({
                repo,
            });

            expect(second).toMatchObject({
                scanned: 0,
                rewritten: 0,
                batches: 0,
            });
            expect(
                await client`SELECT id, content FROM chat_messages ORDER BY id`
            ).toEqual(snapshot);
        });

        it('시각이 7일을 넘어가는 행은 다음 실행에서 새로 줄어든다', async () => {
            // recent-a를 7일 + 1시간 전으로 옮긴다(DB 시계 기준). recent-b는 그대로 둔다.
            await client`UPDATE chat_messages
                SET created_at = now() - make_interval(days => 7, hours => 1)
                WHERE id = ${defined(ids.get('recent-a'))}`;

            const result = await stripExpiredWebSearchBodies({ repo });

            expect(result.rewritten).toBe(1);
            expect(await contentOf('recent-a')).not.toMatch(/SNIPPET|EXCERPT/);
            expect(await contentOf('recent-b')).toMatch(/SNIPPET-rb/);
        });
    }
);
