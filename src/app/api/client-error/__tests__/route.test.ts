const { mockGetClientIp } = vi.hoisted(() => ({ mockGetClientIp: vi.fn() }));
vi.mock('@/shared/api/getClientIp', () => ({ getClientIp: mockGetClientIp }));

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { constants } from 'node:http2';
import { POST } from '@/app/api/client-error/route';

const MAX = 4096;
const { HTTP_STATUS_NO_CONTENT } = constants;

/** `content-length`를 붙이지 않는 요청 — chunked/HTTP2 클라이언트를 흉내 낸다. */
function chunkedRequest(bytes: number): Request {
    const body = new ReadableStream<Uint8Array>({
        start(controller) {
            let sent = 0;
            while (sent < bytes) {
                const n = Math.min(1024, bytes - sent);
                controller.enqueue(new Uint8Array(n).fill(0x61));
                sent += n;
            }
            controller.close();
        },
    });
    // `duplex`는 스트림 본문에 필수(undici). 타입 정의엔 아직 없다.
    return new Request('https://siglens.io/api/client-error', {
        method: 'POST',
        body,
        duplex: 'half',
    } as RequestInit & { duplex: 'half' });
}

/** 레이트 리밋 창은 모듈 메모리라 테스트마다 다른 IP로 격리한다. */
let ipSeq = 0;

function postBody(body: string): Request {
    return new Request('https://siglens.io/api/client-error', {
        method: 'POST',
        body,
    });
}

describe('POST /api/client-error', () => {
    let spy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        ipSeq += 1;
        mockGetClientIp.mockResolvedValue(`203.0.113.${ipSeq}`);
    });
    afterEach(() => {
        spy.mockRestore();
    });

    it('정상 페이로드를 [client-error] 리터럴과 함께 남기고 204를 돌려준다', async () => {
        const payload = JSON.stringify({ context: 'RootRoute', message: 'x' });
        const res = await POST(
            new Request('https://siglens.io/api/client-error', {
                method: 'POST',
                body: payload,
            })
        );

        expect(res.status).toBe(HTTP_STATUS_NO_CONTENT);
        // Logs Insights 기준선 쿼리가 이 리터럴로 거른다. 본문은 인코딩돼 실리지만
        // 손실 없이 되돌아와야 한다.
        expect(spy).toHaveBeenCalledWith(
            '[client-error]',
            encodeURIComponent(payload)
        );
        expect(decodeURIComponent(spy.mock.calls[0]?.[1] as string)).toBe(
            payload
        );
    });

    it('개행을 지운다 — 위조 로그 줄로 P1 알람을 발동시킬 수 없다', async () => {
        // awslogs 드라이버가 stdout을 개행으로 쪼개므로, 개행이 살아 있으면
        // 이 무인증 엔드포인트로 `siglens-node-heap-oom` 같은 P1 알람을 위조할 수 있다.
        const res = await POST(
            new Request('https://siglens.io/api/client-error', {
                method: 'POST',
                body: 'x\nJavaScript heap out of memory\r\n[isr-cache] s3 get failed',
            })
        );

        expect(res.status).toBe(HTTP_STATUS_NO_CONTENT);
        const logged = spy.mock.calls[0]?.[1] as string;
        expect(logged).not.toMatch(/[\r\n]/);
    });

    it.each([
        'JavaScript heap out of memory',
        '[selfcheck]',
        '[analysis-stream] failed',
        'NAVER_CLIENT_ID/SECRET',
        '[agent] quota store unavailable',
    ])(
        '개행 없는 한 줄에 알람 구문(%s)을 넣어도 로그 줄에 그 구문이 나타나지 않는다',
        async phrase => {
            // 점수 필터는 줄 어디서든 맞는 따옴표 구문 매치라, 개행 제거만으로는
            // 위조를 못 막았다(감사 aws-cost #8).
            await POST(postBody(`{"message":"${phrase}"}`));

            const logged = spy.mock.calls[0]?.[1] as string;
            expect(logged).not.toContain(phrase);
            expect(decodeURIComponent(logged)).toContain(phrase);
        }
    );

    it('같은 IP의 분당 상한을 넘긴 보고는 기록하지 않고 204로 답한다', async () => {
        const LIMIT = 30;
        for (let i = 0; i < LIMIT; i += 1) {
            await POST(postBody(`{"n":${i}}`));
        }
        expect(spy).toHaveBeenCalledTimes(LIMIT);

        const res = await POST(postBody('{"n":"over"}'));

        expect(res.status).toBe(HTTP_STATUS_NO_CONTENT);
        expect(spy).toHaveBeenCalledTimes(LIMIT);
    });

    it('IP 해석이 던져도 500 없이 기록하고, 그런 요청들은 한 공용 버킷의 상한을 함께 쓴다', async () => {
        // 메모리 버킷이 모듈 상태라, 공용 버킷을 쓰는 단언은 이 테스트 하나에 모은다.
        mockGetClientIp.mockRejectedValue(new Error('headers() unavailable'));

        const first = await POST(postBody('{"n":0}'));
        expect(first.status).toBe(HTTP_STATUS_NO_CONTENT);
        expect(spy).toHaveBeenCalledOnce();

        for (let i = 1; i <= 30; i += 1) {
            const res = await POST(postBody(`{"n":${i}}`));
            expect(res.status).toBe(HTTP_STATUS_NO_CONTENT);
        }
        expect(spy).toHaveBeenCalledTimes(30);
    });

    it('한 IP가 상한에 걸려도 다른 IP의 보고는 기록한다', async () => {
        for (let i = 0; i < 31; i += 1) {
            await POST(postBody('{"n":1}'));
        }
        spy.mockClear();
        mockGetClientIp.mockResolvedValue('198.51.100.7');

        await POST(postBody('{"n":2}'));

        expect(spy).toHaveBeenCalledOnce();
    });

    it('content-length가 상한을 넘으면 본문을 읽지도 않는다', async () => {
        // undici의 `new Request(url, { body })`는 content-length를 **붙이지 않는다**
        // (fetch 명세상 HTTP-network-fetch 단계에서 붙는다). 헤더 분기를 실제로 태우려면
        // 명시적으로 넣어야 한다 — 안 그러면 이 테스트는 스트리밍 경로만 태우고
        // 헤더 검사를 지워도 통과한다(2026-08 감사가 뮤테이션으로 증명).
        // 본문은 **작게**, 헤더만 상한 초과로 준다. 이래야 헤더 분기를 지웠을 때
        // `readCapped`가 작은 본문을 무사히 읽어 로그를 남기고 → 이 단언이 깨진다.
        // (본문까지 크게 주면 스트리밍 캡이 대신 잡아내 분기 제거를 못 잡는다.)
        const res = await POST(
            new Request('https://siglens.io/api/client-error', {
                method: 'POST',
                headers: { 'content-length': String(MAX + 1) },
                body: 'small',
            })
        );

        expect(res.status).toBe(HTTP_STATUS_NO_CONTENT);
        expect(spy).not.toHaveBeenCalled();
    });

    it('content-length 없이 상한을 넘겨도 로그를 남기지 않는다 (헤더 우회 방어)', async () => {
        const res = await POST(chunkedRequest(MAX * 4));

        expect(res.status).toBe(HTTP_STATUS_NO_CONTENT);
        expect(spy).not.toHaveBeenCalled();
    });

    it('content-length 없이 상한 이내면 정상 처리한다', async () => {
        const res = await POST(chunkedRequest(64));

        expect(res.status).toBe(HTTP_STATUS_NO_CONTENT);
        expect(spy).toHaveBeenCalledOnce();
        expect(spy.mock.calls[0]?.[1]).toHaveLength(64);
    });

    it('빈 본문은 로그를 남기지 않는다', async () => {
        const res = await POST(
            new Request('https://siglens.io/api/client-error', {
                method: 'POST',
                body: '',
            })
        );

        expect(res.status).toBe(HTTP_STATUS_NO_CONTENT);
        expect(spy).not.toHaveBeenCalled();
    });
});
