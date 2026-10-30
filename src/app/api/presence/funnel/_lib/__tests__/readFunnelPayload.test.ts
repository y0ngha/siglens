import { describe, it, expect } from 'vitest';
import { readFunnelPayload } from '@/app/api/presence/funnel/_lib/readFunnelPayload';
import { FUNNEL_BODY_MAX_BYTES } from '@/shared/lib/funnel/funnelEvents';

const VALID = { event: 'meter_clicked', context: { state: 'revealed' } };

function post(body: string, headers?: HeadersInit): Request {
    return new Request('https://siglens.io/api/presence/funnel', {
        method: 'POST',
        body,
        headers,
    });
}

describe('readFunnelPayload', () => {
    it('카탈로그에 맞는 본문을 그대로 돌려준다', async () => {
        expect(await readFunnelPayload(post(JSON.stringify(VALID)))).toEqual(
            VALID
        );
    });

    it('content-length가 상한을 넘으면 본문을 읽지 않고 null이다', async () => {
        const request = post(JSON.stringify(VALID), {
            'content-length': String(FUNNEL_BODY_MAX_BYTES + 1),
        });
        expect(await readFunnelPayload(request)).toBeNull();
        expect(request.bodyUsed).toBe(false);
    });

    it('헤더가 거짓이어도 실제 바이트가 상한을 넘으면 null이다', async () => {
        const padded = JSON.stringify({
            ...VALID,
            pad: 'x'.repeat(FUNNEL_BODY_MAX_BYTES),
        });
        expect(await readFunnelPayload(post(padded))).toBeNull();
    });

    it('JSON이 아니면 null이다', async () => {
        expect(await readFunnelPayload(post('{oops'))).toBeNull();
    });

    it('카탈로그 밖의 이벤트는 null이다', async () => {
        const body = JSON.stringify({ event: 'page_view', context: {} });
        expect(await readFunnelPayload(post(body))).toBeNull();
    });

    it('여분 키가 있으면 null이다', async () => {
        const body = JSON.stringify({ ...VALID, extra: 1 });
        expect(await readFunnelPayload(post(body))).toBeNull();
    });
});
