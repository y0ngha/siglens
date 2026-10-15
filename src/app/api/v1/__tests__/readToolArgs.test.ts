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
});
