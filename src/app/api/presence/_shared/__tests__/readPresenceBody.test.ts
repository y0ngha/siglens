import { describe, expect, it } from 'vitest';
import { readPresenceBody } from '@/app/api/presence/_shared/readPresenceBody';

function request(body: string, headers: Record<string, string> = {}): Request {
    return new Request('https://siglens.io/api/presence', {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body,
    });
}

const VISIT = { first: 'd7_13', last: 'd7_13', days: 'n2', window: 'd7' };

describe('readPresenceBody', () => {
    it('요청이 없으면 null이다', async () => {
        await expect(readPresenceBody(undefined)).resolves.toBeNull();
    });

    it('옛 클라이언트의 필드 두 개짜리 본문도 받는다', async () => {
        await expect(
            readPresenceBody(
                request(
                    JSON.stringify({
                        referrerHost: 'www.google.com',
                        utmSource: 'chatgpt.com',
                    })
                )
            )
        ).resolves.toEqual({
            referrerHost: 'www.google.com',
            utmSource: 'chatgpt.com',
            utmMedium: null,
            adClick: false,
            visit: null,
        });
    });

    it('전체 본문을 읽는다', async () => {
        await expect(
            readPresenceBody(
                request(
                    JSON.stringify({
                        referrerHost: 'www.google.com',
                        utmSource: null,
                        utmMedium: 'cpc',
                        adClick: true,
                        visit: VISIT,
                    })
                )
            )
        ).resolves.toEqual({
            referrerHost: 'www.google.com',
            utmSource: null,
            utmMedium: 'cpc',
            adClick: true,
            visit: VISIT,
        });
    });

    it('adClick은 리터럴 true일 때만 true다', async () => {
        const read = async (adClick: unknown) =>
            (await readPresenceBody(request(JSON.stringify({ adClick }))))
                ?.adClick;
        await expect(read('true')).resolves.toBe(false);
        await expect(read(1)).resolves.toBe(false);
        await expect(read(null)).resolves.toBe(false);
        await expect(read(true)).resolves.toBe(true);
    });

    it('모양이 틀린 visit은 null로 버리고 나머지는 남긴다', async () => {
        await expect(
            readPresenceBody(
                request(
                    JSON.stringify({
                        referrerHost: 'chatgpt.com',
                        visit: { ...VISIT, days: 'n99' },
                    })
                )
            )
        ).resolves.toMatchObject({ referrerHost: 'chatgpt.com', visit: null });
        await expect(
            readPresenceBody(
                request(JSON.stringify({ visit: { ...VISIT, extra: 1 } }))
            )
        ).resolves.toMatchObject({ visit: null });
    });

    it('문자열이 아니거나 비었거나 너무 긴 필드는 null이다', async () => {
        await expect(
            readPresenceBody(
                request(
                    JSON.stringify({
                        referrerHost: 42,
                        utmSource: '',
                        utmMedium: 'x'.repeat(254),
                    })
                )
            )
        ).resolves.toMatchObject({
            referrerHost: null,
            utmSource: null,
            utmMedium: null,
        });
    });

    it('깨진 JSON, 배열, 원시값은 null이다', async () => {
        await expect(
            readPresenceBody(request('{not json'))
        ).resolves.toBeNull();
        await expect(readPresenceBody(request('[]'))).resolves.toBeNull();
        await expect(readPresenceBody(request('42'))).resolves.toBeNull();
        await expect(readPresenceBody(request('null'))).resolves.toBeNull();
    });

    it('빈 본문은 null이다', async () => {
        await expect(readPresenceBody(request(''))).resolves.toBeNull();
    });

    it('content-length가 상한을 넘으면 읽지 않고 null이다', async () => {
        await expect(
            readPresenceBody(
                request(JSON.stringify({ referrerHost: 'chatgpt.com' }), {
                    'content-length': '2048',
                })
            )
        ).resolves.toBeNull();
    });

    it('실제 바이트 수가 상한을 넘으면 null이다', async () => {
        await expect(
            readPresenceBody(
                request(
                    JSON.stringify({
                        referrerHost: 'chatgpt.com',
                        pad: 'x'.repeat(2048),
                    })
                )
            )
        ).resolves.toBeNull();
    });
});
