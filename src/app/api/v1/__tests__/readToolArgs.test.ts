import { readToolArgs } from '@/app/api/v1/readToolArgs';
import { PUBLIC_API_MAX_BODY_CHARS } from '@/shared/config/publicApi';

const post = (body: string, headers: Record<string, string> = {}): Request =>
    new Request('https://siglens.io/api/v1/tools/get_quote', {
        method: 'POST',
        body,
        headers,
    });

describe('readToolArgs', () => {
    it('JSON 객체를 그대로 돌려준다', async () => {
        await expect(
            readToolArgs(post('{"symbols":["AAPL"]}'))
        ).resolves.toEqual({ ok: true, args: { symbols: ['AAPL'] } });
    });

    it.each(['', '   \n'])(
        '본문이 비어 있으면({}) 인자 없음: %j',
        async body => {
            await expect(readToolArgs(post(body))).resolves.toEqual({
                ok: true,
                args: {},
            });
        }
    );

    it.each([
        ['깨진 JSON', '{"a":'],
        ['배열', '[1,2]'],
        ['원시값', '"AAPL"'],
        ['null', 'null'],
        ['숫자', '42'],
    ])('%s은 400 invalid_body', async (_label, body) => {
        const outcome = await readToolArgs(post(body));
        if (outcome.ok) throw new Error('expected failure');
        expect(outcome.response.status).toBe(400);
        await expect(outcome.response.json()).resolves.toMatchObject({
            error: { code: 'invalid_body' },
        });
    });

    it('상한을 넘는 본문은 파싱 전에 413', async () => {
        const body = JSON.stringify({
            q: 'x'.repeat(PUBLIC_API_MAX_BODY_CHARS),
        });
        const outcome = await readToolArgs(post(body));
        if (outcome.ok) throw new Error('expected failure');
        expect(outcome.response.status).toBe(413);
        await expect(outcome.response.json()).resolves.toMatchObject({
            error: { code: 'body_too_large' },
        });
    });

    it('Content-Length가 터무니없이 크면 본문을 읽지 않고 413', async () => {
        const request = post('{}', {
            'content-length': String(PUBLIC_API_MAX_BODY_CHARS * 100),
        });
        const text = vi.spyOn(request, 'text');
        const outcome = await readToolArgs(request);
        if (outcome.ok) throw new Error('expected failure');
        expect(outcome.response.status).toBe(413);
        expect(text).not.toHaveBeenCalled();
    });

    it('상한 길이 그대로의 본문은 받는다', async () => {
        const filler = 'x'.repeat(
            PUBLIC_API_MAX_BODY_CHARS - '{"q":""}'.length
        );
        const outcome = await readToolArgs(post(`{"q":"${filler}"}`));
        expect(outcome.ok).toBe(true);
    });

    describe('chunked(Content-Length 없음) 본문', () => {
        /** 청크가 몇 개 읽혔는지 세는 스트림 본문. 취소되면 `cancelled`가 선다. */
        function chunkedRequest(chunks: string[]) {
            const state = { pulled: 0, cancelled: false };
            const encoder = new TextEncoder();
            const body = new ReadableStream<Uint8Array>({
                pull(controller) {
                    if (state.pulled >= chunks.length) {
                        controller.close();
                        return;
                    }
                    controller.enqueue(encoder.encode(chunks[state.pulled]));
                    state.pulled += 1;
                },
                cancel() {
                    state.cancelled = true;
                },
            });
            const request = new Request(
                'https://siglens.io/api/v1/tools/get_quote',
                {
                    method: 'POST',
                    body,
                    duplex: 'half',
                } as RequestInit
            );
            return { request, state };
        }

        it('상한을 넘는 즉시 읽기를 멈추고 413 (나머지 청크를 끌어오지 않는다)', async () => {
            const chunk = 'x'.repeat(1_000);
            const chunks = Array.from({ length: 200 }, () => chunk);
            const { request, state } = chunkedRequest(chunks);
            expect(request.headers.get('content-length')).toBeNull();

            const outcome = await readToolArgs(request);

            if (outcome.ok) throw new Error('expected failure');
            expect(outcome.response.status).toBe(413);
            expect(state.cancelled).toBe(true);
            // 200개를 다 읽지 않았다 — 상한(8,192자) 직후 몇 개에서 멈춘다.
            expect(state.pulled).toBeLessThan(20);
        });

        it('정상 크기의 chunked 본문은 이어 붙여 파싱한다', async () => {
            const { request, state } = chunkedRequest([
                '{"symbols":',
                '["AAPL",',
                '"MSFT"]}',
            ]);
            await expect(readToolArgs(request)).resolves.toEqual({
                ok: true,
                args: { symbols: ['AAPL', 'MSFT'] },
            });
            expect(state.cancelled).toBe(false);
        });

        it('멀티바이트 문자가 청크 경계에 걸려도 깨지지 않는다', async () => {
            const bytes = new TextEncoder().encode('{"q":"한글"}');
            const split = 7; // '한'의 중간
            const body = new ReadableStream<Uint8Array>({
                start(controller) {
                    controller.enqueue(bytes.slice(0, split));
                    controller.enqueue(bytes.slice(split));
                    controller.close();
                },
            });
            const request = new Request('https://siglens.io/api/v1/x', {
                method: 'POST',
                body,
                duplex: 'half',
            } as RequestInit);
            await expect(readToolArgs(request)).resolves.toEqual({
                ok: true,
                args: { q: '한글' },
            });
        });
    });
});
