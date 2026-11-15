import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { load } = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('@/entities/x-posts/server/getXPosts', () => ({ getXPosts: load }));

import {
    AGENT_X_POST_TEXT_MAX_CHARS,
    AGENT_X_POSTS_MAX,
} from '@y0ngha/siglens-core';
import type { XPostItem, XPostsAccount } from '@/entities/x-posts/model';
import { getXPostsTool } from '@/app/api/ai/chat/tools/getXPosts';
import { guestSubject } from '@/app/api/ai/chat/guestSubject';
import { X_POSTS_RESULT_MAX_CHARS } from '@/app/api/ai/chat/tools/truncate';

const ctx = {
    userId: 'u',
    tier: 'member' as const,
    locale: 'ko' as const,
    signal: new AbortController().signal,
};
const rt = {
    analysisModel: 'deepseek-v4.1-flash' as const,
    ensureSymbolData: async (): Promise<void> => {},
};
const run = (args: Record<string, unknown>, userId = 'u') =>
    getXPostsTool(args, { ...ctx, userId }, rt);

const HANDLE = 'abcdefghijklmno'; // 15자 — X 핸들 최대 길이
const CEO_HANDLE = 'onmlkjihgfedcba';
const handleOf = (role: 'company' | 'ceo') =>
    role === 'company' ? HANDLE : CEO_HANDLE;
const account = (role: 'company' | 'ceo'): XPostsAccount => ({
    handle: handleOf(role),
    name: 'A very long display name for X',
    role,
    followers: 9_999_999,
    loaded: true,
    postsInWindow: 10,
    moreInWindow: true,
});
/** 실제보다 무거운 최악: 600자 본문에 40자마다 줄바꿈과 따옴표(JSON 이스케이프로 길어진다). */
const heavyText = Array.from(
    { length: AGENT_X_POST_TEXT_MAX_CHARS / 40 },
    () => `${'x'.repeat(37)}"\n`
)
    .join('')
    .slice(0, AGENT_X_POST_TEXT_MAX_CHARS);
const post = (i: number, text = heavyText): XPostItem => ({
    handle: i % 2 === 0 ? HANDLE : CEO_HANDLE,
    role: i % 2 === 0 ? 'company' : 'ceo',
    postedAt: new Date(
        Date.UTC(2026, 10, 15, 12) - i * 3_600_000
    ).toISOString(),
    text,
    truncated: true,
    url: `https://x.com/${HANDLE}/status/19000000000000000${String(i).padStart(2, '0')}`, // 19자리
    likes: 9_999_999,
    reposts: 9_999_999,
});

beforeEach(() => {
    load.mockReset();
});

const ok = (posts: XPostItem[]) => ({
    status: 'ok' as const,
    asOf: '2026-11-16T03:00:00.000Z',
    accounts: [account('company'), account('ceo')],
    posts,
});

describe('getXPostsTool', () => {
    it('ok: core 설명이 약속한 모양(asOf·source·accounts·posts)', async () => {
        load.mockResolvedValue({
            ...ok([post(0, 'hello')]),
            accounts: [account('company')],
        });
        expect(await run({ symbol: 'tsla' })).toEqual({
            asOf: '2026-11-16T03:00:00.000Z',
            source: 'X',
            symbol: 'TSLA',
            available: true,
            accounts: [account('company')],
            posts: [post(0, 'hello')],
        });
        expect(load).toHaveBeenCalledWith('TSLA', { guest: false });
    });

    it('게스트 주체면 guest: true로 읽는다(게스트 몫 예산)', async () => {
        load.mockResolvedValue({ status: 'no_known_account' });
        await run({ symbol: 'TSLA' }, guestSubject('abc'));
        expect(load).toHaveBeenCalledWith('TSLA', { guest: true });
    });

    it.each(['no_known_account', 'provider_failed'] as const)(
        '%s → available:false + reason',
        async status => {
            load.mockResolvedValue({ status });
            expect(await run({ symbol: 'IONQ' })).toEqual({
                symbol: 'IONQ',
                available: false,
                reason: status,
            });
        }
    );

    it('하루 예산 초과 → core 계약의 quota/global_day', async () => {
        load.mockResolvedValue({ status: 'quota' });
        expect(await run({ symbol: 'TSLA' })).toEqual({
            error: 'quota',
            scope: 'global_day',
        });
    });

    it(`실측 최악(${AGENT_X_POSTS_MAX}건 × ${AGENT_X_POST_TEXT_MAX_CHARS}자, 이스케이프가 많은 본문)이 상한 안에 들어 자르지 않는다`, async () => {
        load.mockResolvedValue(
            ok(Array.from({ length: AGENT_X_POSTS_MAX }, (_, i) => post(i)))
        );
        const result = (await run({ symbol: 'TSLA' })) as { posts: unknown[] };
        const size = JSON.stringify(result).length;
        expect(result.posts).toHaveLength(AGENT_X_POSTS_MAX);
        expect(size).toBeLessThanOrEqual(X_POSTS_RESULT_MAX_CHARS);
        // 상한이 실측보다 지나치게 크지 않다 — 여유는 실측의 15% 안쪽.
        expect(X_POSTS_RESULT_MAX_CHARS).toBeLessThan(size * 1.15);
    });

    it('상한을 넘으면 글이 많은 계정부터 그 계정의 오래된 글을 빼, 한 계정이 통째로 사라지지 않는다', async () => {
        const huge = '"'.repeat(AGENT_X_POST_TEXT_MAX_CHARS); // 이스케이프로 두 배가 된다
        // CEO 글 10건이 최신, 회사 글 2건이 가장 오래됐다 — 전체에서 오래된 것부터 빼면 회사 글이 먼저 사라진다.
        const posts = [
            ...Array.from({ length: 10 }, (_, i) => ({
                ...post(i, huge),
                handle: CEO_HANDLE,
                role: 'ceo' as const,
            })),
            ...[10, 11].map(i => ({
                ...post(i, huge),
                handle: HANDLE,
                role: 'company' as const,
            })),
        ];
        load.mockResolvedValue(ok(posts));
        const result = (await run({ symbol: 'TSLA' })) as {
            posts: XPostItem[];
        };
        expect(JSON.stringify(result).length).toBeLessThanOrEqual(
            X_POSTS_RESULT_MAX_CHARS
        );
        expect(result.posts.length).toBeLessThan(AGENT_X_POSTS_MAX);
        expect(result.posts.filter(p => p.handle === HANDLE)).toHaveLength(2);
        // 빠진 것은 CEO의 가장 오래된 글들이고, 남은 순서는 그대로다.
        const kept = result.posts.filter(p => p.handle === CEO_HANDLE);
        expect(kept).toEqual(posts.slice(0, kept.length));
    });
});
