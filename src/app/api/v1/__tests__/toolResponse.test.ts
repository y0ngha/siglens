import { describe, expect, it } from 'vitest';
import type { PublicToolOutcome } from '../publicToolOutcome';
import { toolOutcomeResponse } from '../toolResponse';

const LIMIT = {
    'X-RateLimit-Limit': '60',
    'X-RateLimit-Remaining': '59',
    'X-RateLimit-Reset': '1700000000',
};
const signal = new AbortController().signal;

describe('toolOutcomeResponse', () => {
    describe('성공', () => {
        it('{ data, meta } 봉투로 200을 낸다', async () => {
            const res = toolOutcomeResponse(
                { ok: true, data: { a: 1 }, truncated: false },
                'get_quote',
                LIMIT,
                signal
            );
            expect(res.status).toBe(200);
            await expect(res.json()).resolves.toEqual({
                data: { a: 1 },
                meta: { tool: 'get_quote' },
            });
        });

        it('data 버킷 한도 헤더와 no-store를 싣는다', () => {
            const res = toolOutcomeResponse(
                { ok: true, data: 1, truncated: false },
                'get_quote',
                LIMIT,
                signal
            );
            expect(res.headers.get('X-RateLimit-Remaining')).toBe('59');
            expect(res.headers.get('Cache-Control')).toBe('no-store');
        });

        it('접힌 결과는 meta.truncated를 true로 표시한다', async () => {
            const res = toolOutcomeResponse(
                { ok: true, data: 1, truncated: true },
                'get_news',
                LIMIT,
                signal
            );
            await expect(res.json()).resolves.toMatchObject({
                meta: { tool: 'get_news', truncated: true },
            });
        });

        it('분석 도구의 source·model을 meta에 싣는다', async () => {
            const res = toolOutcomeResponse(
                {
                    ok: true,
                    data: 1,
                    truncated: false,
                    meta: { source: 'cache', model: 'm1' },
                },
                'run_fresh_analysis',
                LIMIT,
                signal
            );
            await expect(res.json()).resolves.toEqual({
                data: 1,
                meta: {
                    tool: 'run_fresh_analysis',
                    source: 'cache',
                    model: 'm1',
                },
            });
        });
    });

    describe('실패', () => {
        const failure: PublicToolOutcome = {
            ok: false,
            status: 404,
            code: 'bars_not_found',
            message: 'No bars.',
            details: { symbol: 'AAPL' },
        };

        it('도구가 정한 상태 코드와 { error } 봉투를 낸다', async () => {
            const res = toolOutcomeResponse(
                failure,
                'get_quote',
                LIMIT,
                signal
            );
            expect(res.status).toBe(404);
            await expect(res.json()).resolves.toEqual({
                error: {
                    code: 'bars_not_found',
                    message: 'No bars.',
                    details: { symbol: 'AAPL' },
                },
            });
        });

        it('details가 없으면 error에 details 키를 두지 않는다', async () => {
            const res = toolOutcomeResponse(
                { ok: false, status: 500, code: 'tool_failed', message: 'x' },
                'get_quote',
                LIMIT,
                signal
            );
            await expect(res.json()).resolves.toEqual({
                error: { code: 'tool_failed', message: 'x' },
            });
        });

        it('결과가 싣는 헤더가 data 버킷 헤더를 덮는다', () => {
            const res = toolOutcomeResponse(
                {
                    ok: false,
                    status: 429,
                    code: 'rate_limited',
                    message: 'x',
                    headers: {
                        'X-RateLimit-Remaining': '0',
                        'Retry-After': '12',
                    },
                },
                'run_fresh_analysis',
                LIMIT,
                signal
            );
            expect(res.headers.get('X-RateLimit-Remaining')).toBe('0');
            expect(res.headers.get('Retry-After')).toBe('12');
            expect(res.headers.get('X-RateLimit-Limit')).toBe('60');
        });
    });

    describe('긴 생성 스트림', () => {
        it('200 스트리밍 JSON으로 시작하고 두 버킷의 한도 헤더를 싣는다', async () => {
            const res = toolOutcomeResponse(
                {
                    streaming: true,
                    headers: { 'X-RateLimit-AI-Remaining': '4' },
                    completion: Promise.resolve({
                        ok: true,
                        data: 1,
                        truncated: false,
                    }),
                },
                'run_fresh_analysis',
                LIMIT,
                signal
            );
            expect(res.status).toBe(200);
            expect(res.headers.get('Cache-Control')).toBe(
                'no-store, no-transform'
            );
            expect(res.headers.get('X-RateLimit-Remaining')).toBe('59');
            expect(res.headers.get('X-RateLimit-AI-Remaining')).toBe('4');
            await res.text();
        });

        it('성공하면 첫 공백 뒤에 { data, meta } 본문을 쓴다', async () => {
            const res = toolOutcomeResponse(
                {
                    streaming: true,
                    completion: Promise.resolve({
                        ok: true,
                        data: { a: 1 },
                        truncated: true,
                        meta: { source: 'fresh', model: 'm1' },
                    }),
                },
                'run_fresh_analysis',
                LIMIT,
                signal
            );
            expect(JSON.parse(await res.text())).toEqual({
                data: { a: 1 },
                meta: {
                    tool: 'run_fresh_analysis',
                    truncated: true,
                    source: 'fresh',
                    model: 'm1',
                },
            });
        });

        it('생성이 실패하면 200 본문의 { error }로 낸다', async () => {
            const res = toolOutcomeResponse(
                {
                    streaming: true,
                    completion: Promise.resolve({
                        ok: false,
                        status: 502,
                        code: 'provider_error',
                        message: 'upstream',
                        details: { provider: 'openai' },
                    }),
                },
                'run_fresh_analysis',
                LIMIT,
                signal
            );
            expect(res.status).toBe(200);
            expect(JSON.parse(await res.text())).toEqual({
                error: {
                    code: 'provider_error',
                    message: 'upstream',
                    details: { provider: 'openai' },
                },
            });
        });

        it('completion이 reject되면 일반 internal_error 봉투로 닫는다', async () => {
            const res = toolOutcomeResponse(
                {
                    streaming: true,
                    completion: Promise.reject(new Error('SECRET detail')),
                },
                'run_fresh_analysis',
                LIMIT,
                signal
            );
            const text = await res.text();
            expect(JSON.parse(text)).toEqual({
                error: {
                    code: 'internal_error',
                    message: 'Unexpected server error.',
                },
            });
            expect(text).not.toContain('SECRET');
        });
    });
});
