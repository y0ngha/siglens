vi.mock('server-only', () => ({}));

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    fetchXTimelinePage,
    fetchXUsersByUsernames,
    XApiError,
    xBearerToken,
} from '../xClient';

const fetchSpy = vi.fn(
    async (input: unknown, _init?: RequestInit): Promise<Response> => {
        throw new Error(`unexpected fetch: ${String(input)}`);
    }
);

beforeEach(() => {
    vi.stubGlobal('fetch', fetchSpy);
    vi.stubEnv('X_BEARER_TOKEN', 'test-token');
});
afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    fetchSpy.mockReset();
    fetchSpy.mockImplementation(async input => {
        throw new Error(`unexpected fetch: ${String(input)}`);
    });
});

const lastUrl = (): URL => new URL(String(fetchSpy.mock.calls.at(-1)![0]));

describe('xBearerToken', () => {
    it('비었거나 없으면 null', () => {
        vi.stubEnv('X_BEARER_TOKEN', '');
        expect(xBearerToken()).toBeNull();
        vi.stubEnv('X_BEARER_TOKEN', 't');
        expect(xBearerToken()).toBe('t');
    });
});

describe('fetchXUsersByUsernames', () => {
    it('모양이 맞는 핸들만 한 요청에 묶고, 응답을 사용자로 바꾼다', async () => {
        fetchSpy.mockResolvedValueOnce(
            Response.json({
                data: [
                    {
                        id: '44196397',
                        username: 'elonmusk',
                        name: 'Elon Musk',
                        public_metrics: { followers_count: 200_000_000 },
                    },
                    { id: 'not-numeric', username: 'x' },
                ],
            })
        );
        expect(
            await fetchXUsersByUsernames(['elonmusk', 'bad handle!'])
        ).toEqual({
            users: [
                {
                    id: '44196397',
                    username: 'elonmusk',
                    name: 'Elon Musk',
                    followers: 200_000_000,
                },
            ],
            // 모양이 틀려 버린 항목도 X는 돌려줬으므로 과금 단위에 든다.
            billedItems: 2,
        });
        expect(lastUrl().pathname).toBe('/2/users/by');
        expect(lastUrl().searchParams.get('usernames')).toBe('elonmusk');
        const init = fetchSpy.mock.calls.at(-1)![1];
        expect((init?.headers as Record<string, string>).Authorization).toBe(
            'Bearer test-token'
        );
        expect(init?.signal).toBeInstanceOf(AbortSignal);
    });

    it('유효한 핸들이 없으면 요청하지 않는다', async () => {
        expect(await fetchXUsersByUsernames(['bad handle!', ''])).toEqual({
            users: [],
            billedItems: 0,
        });
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('HTTP 오류는 과금 없음(none), 연결 실패는 과금 불명(unknown) — 메시지에 토큰·URL이 없다', async () => {
        fetchSpy.mockResolvedValueOnce(new Response('{}', { status: 429 }));
        const http = await fetchXUsersByUsernames(['elonmusk']).catch(
            (e: unknown) => e
        );
        expect(http).toBeInstanceOf(XApiError);
        expect(http).toMatchObject({ status: 429, billing: 'none' });
        fetchSpy.mockRejectedValueOnce(
            new TypeError(
                'fetch failed https://api.x.com/2/users/by?usernames=elonmusk'
            )
        );
        const network = await fetchXUsersByUsernames(['elonmusk']).catch(
            (e: unknown) => e
        );
        expect(network).toMatchObject({ status: null, billing: 'unknown' });
        for (const error of [http, network]) {
            const { message } = error as Error;
            expect(message).not.toContain('test-token');
            expect(message).not.toContain('api.x.com');
        }
    });

    it('토큰이 없으면 요청하지 않고 던진다', async () => {
        vi.stubEnv('X_BEARER_TOKEN', '');
        await expect(
            fetchXUsersByUsernames(['elonmusk'])
        ).rejects.toMatchObject({ name: 'XApiError', billing: 'none' });
        expect(fetchSpy).not.toHaveBeenCalled();
    });
});

describe('fetchXTimelinePage', () => {
    const startTime = new Date('2026-11-02T12:00:00.123Z');
    const page = () =>
        fetchXTimelinePage('44196397', { startTime, pageSize: 10 });

    it('답글·리포스트 제외, 초 단위 start_time, 한 페이지 크기로 요청한다', async () => {
        fetchSpy.mockResolvedValueOnce(
            Response.json({ meta: { result_count: 0 } })
        );
        expect(await page()).toEqual({
            posts: [],
            hasMore: false,
            billedItems: 0,
        });
        const url = lastUrl();
        expect(url.pathname).toBe('/2/users/44196397/tweets');
        expect(url.searchParams.get('exclude')).toBe('replies,retweets');
        expect(url.searchParams.get('max_results')).toBe('10');
        expect(url.searchParams.get('start_time')).toBe('2026-11-02T12:00:00Z');
    });

    it('긴 글은 note_tweet 전문을 쓰고, 다음 페이지 토큰이 있으면 hasMore', async () => {
        fetchSpy.mockResolvedValueOnce(
            Response.json({
                data: [
                    {
                        id: '1900000000000000001',
                        text: 'short…',
                        note_tweet: { text: 'the full long post' },
                        created_at: '2026-11-15T10:00:00.000Z',
                        public_metrics: { like_count: 5, retweet_count: 2 },
                    },
                    {
                        id: '1900000000000000002',
                        text: 'plain',
                        created_at: '2026-11-14T10:00:00.000Z',
                    },
                    { id: '3', text: 'no date' },
                ],
                meta: { next_token: 'abc' },
            })
        );
        expect(await page()).toEqual({
            posts: [
                {
                    id: '1900000000000000001',
                    text: 'the full long post',
                    createdAt: '2026-11-15T10:00:00.000Z',
                    likes: 5,
                    reposts: 2,
                },
                {
                    id: '1900000000000000002',
                    text: 'plain',
                    createdAt: '2026-11-14T10:00:00.000Z',
                    likes: 0,
                    reposts: 0,
                },
            ],
            hasMore: true,
            billedItems: 3,
        });
    });

    it('data 없이 errors만 온 200(정지·비공개 계정)은 빈 페이지가 아니라 실패다', async () => {
        fetchSpy.mockResolvedValueOnce(
            Response.json({
                errors: [
                    {
                        title: 'Authorization Error',
                        detail: 'Sorry, you are not authorized to see the user.',
                    },
                ],
            })
        );
        await expect(page()).rejects.toMatchObject({
            name: 'XApiError',
            status: 200,
        });
    });

    it('200인데 JSON이 아니면 과금 여부를 알 수 없는 실패다', async () => {
        fetchSpy.mockResolvedValueOnce(new Response('<html>', { status: 200 }));
        await expect(page()).rejects.toMatchObject({ billing: 'unknown' });
    });

    it('숫자가 아닌 사용자 ID는 요청하지 않고 던진다', async () => {
        await expect(
            fetchXTimelinePage('../me', { startTime, pageSize: 10 })
        ).rejects.toMatchObject({ name: 'XApiError', billing: 'none' });
        expect(fetchSpy).not.toHaveBeenCalled();
    });
});
