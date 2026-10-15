import {
    apiError,
    apiJson,
    apiOk,
    withApiErrorBoundary,
} from '@/app/api/v1/apiResponse';

describe('apiJson / apiOk / apiError', () => {
    it('모든 응답에 Cache-Control: no-store를 붙인다', () => {
        expect(apiOk({}).headers.get('Cache-Control')).toBe('no-store');
        expect(
            apiError(400, 'invalid_args', 'x').headers.get('Cache-Control')
        ).toBe('no-store');
        expect(apiJson(201, {}).headers.get('Cache-Control')).toBe('no-store');
    });

    it('호출자가 공유 캐시 헤더를 넘겨도 no-store로 덮어쓴다', () => {
        const response = apiJson(
            200,
            {},
            { 'Cache-Control': 'public, s-maxage=60' }
        );
        expect(response.headers.get('Cache-Control')).toBe('no-store');
    });

    it('추가 헤더는 보존한다', () => {
        const response = apiOk({}, {}, { 'X-RateLimit-Remaining': '7' });
        expect(response.headers.get('X-RateLimit-Remaining')).toBe('7');
    });

    it('성공 본문은 { data, meta }', async () => {
        const response = apiOk({ a: 1 }, { tool: 'get_quote' });
        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            data: { a: 1 },
            meta: { tool: 'get_quote' },
        });
    });

    it('실패 본문은 { error: { code, message } }이고 details는 있을 때만', async () => {
        const plain = apiError(404, 'unknown_tool', 'No such tool.');
        expect(plain.status).toBe(404);
        await expect(plain.json()).resolves.toEqual({
            error: { code: 'unknown_tool', message: 'No such tool.' },
        });
        const detailed = apiError(400, 'invalid_args', 'bad', {
            details: { issues: [{ path: 'symbol', message: 'required' }] },
        });
        await expect(detailed.json()).resolves.toEqual({
            error: {
                code: 'invalid_args',
                message: 'bad',
                details: { issues: [{ path: 'symbol', message: 'required' }] },
            },
        });
    });
});

describe('withApiErrorBoundary', () => {
    it('핸들러 응답을 그대로 돌려준다', async () => {
        const response = await withApiErrorBoundary('t', async () => apiOk({}));
        expect(response.status).toBe(200);
    });

    it('던지면 내부 상세 없이 500 JSON으로 바꾸고 로그를 남긴다', async () => {
        const spy = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined);
        const response = await withApiErrorBoundary('t', async () => {
            throw new Error('postgres://user:secret@host/db exploded');
        });
        expect(response.status).toBe(500);
        expect(response.headers.get('Cache-Control')).toBe('no-store');
        const text = await response.text();
        expect(text).not.toContain('secret');
        expect(JSON.parse(text)).toEqual({
            error: {
                code: 'internal_error',
                message: 'Unexpected server error.',
            },
        });
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });
});
