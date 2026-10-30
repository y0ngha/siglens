import { describe, expect, it } from 'vitest';
import { parseStreamBody } from '../parseStreamBody';

const post = (raw: string): Request =>
    new Request('http://localhost/api/analysis/stream', {
        method: 'POST',
        body: raw,
    });

const expectBadRequest = async (
    request: Request,
    message: string
): Promise<void> => {
    const outcome = await parseStreamBody(request);
    if (outcome.ok) throw new Error('expected a 400 outcome');
    expect(outcome.response.status).toBe(400);
    await expect(outcome.response.json()).resolves.toEqual({ error: message });
};

describe('parseStreamBody', () => {
    it('JSON이 아니면 400 invalid JSON이다', async () => {
        await expectBadRequest(post('{not json'), 'invalid JSON');
    });

    it('본문이 null이면 TypeError 대신 400이다', async () => {
        await expectBadRequest(
            post('null'),
            'request body must be a JSON object'
        );
    });

    it('본문이 객체가 아닌 원시값이면 400이다', async () => {
        await expectBadRequest(
            post('"technical"'),
            'request body must be a JSON object'
        );
    });

    it('technical에 params가 없으면 400이다', async () => {
        await expectBadRequest(
            post('{"type":"technical"}'),
            'technical requires a params object'
        );
    });

    it('technical의 params가 null이면 400이다', async () => {
        await expectBadRequest(
            post('{"type":"technical","params":null}'),
            'technical requires a params object'
        );
    });

    it('technical의 params가 문자열이면 400이다', async () => {
        await expectBadRequest(
            post('{"type":"technical","params":"AAPL"}'),
            'technical requires a params object'
        );
    });

    it('technical 요청은 params를 그대로 담아 technical 종류로 돌려준다', async () => {
        const outcome = await parseStreamBody(
            post(
                '{"type":"technical","params":{"symbol":"AAPL","timeframe":"1Day"}}'
            )
        );
        expect(outcome).toEqual({
            ok: true,
            body: {
                kind: 'technical',
                params: { symbol: 'AAPL', timeframe: '1Day' },
            },
        });
    });

    it('technical이 아닌 종류에 params가 없으면 400이다', async () => {
        await expectBadRequest(
            post('{"type":"overall"}'),
            'params must be an object'
        );
    });

    it('type이 없고 params도 없으면 params 오류가 먼저다', async () => {
        await expectBadRequest(post('{}'), 'params must be an object');
    });

    it('지원하지 않는 종류는 400이고 종류를 알려 준다', async () => {
        await expectBadRequest(
            post('{"type":"newsCard","params":{}}'),
            'unsupported analysis type: newsCard'
        );
    });

    it('프로토타입 멤버 이름은 지원하지 않는 종류로 400이다', async () => {
        await expectBadRequest(
            post('{"type":"toString","params":{}}'),
            'unsupported analysis type: toString'
        );
    });

    it('문자열이 아닌 type은 400이다', async () => {
        await expectBadRequest(
            post('{"type":5,"params":{}}'),
            'unsupported analysis type: 5'
        );
    });

    it('위임 종류는 type과 params를 담아 dispatch로 돌려준다', async () => {
        const outcome = await parseStreamBody(
            post('{"type":"fundamental","params":{"symbol":"AAPL"}}')
        );
        expect(outcome).toEqual({
            ok: true,
            body: {
                kind: 'dispatch',
                type: 'fundamental',
                params: { symbol: 'AAPL' },
            },
        });
    });
});
