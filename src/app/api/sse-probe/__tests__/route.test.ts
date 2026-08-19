import { describe, it, expect, vi, afterEach } from 'vitest';

import { GET } from '@/app/api/sse-probe/route';

const SECRET = 'probe-secret';

afterEach(() => {
    vi.unstubAllEnvs();
});

function call(headers?: HeadersInit): Response {
    return GET(new Request('https://siglens.io/api/sse-probe', { headers }));
}

describe('GET /api/sse-probe', () => {
    it('CRON_SECRET이 설정되지 않았으면 401', () => {
        vi.stubEnv('CRON_SECRET', '');
        expect(call().status).toBe(401);
    });

    it('Bearer 토큰이 틀리면 401', () => {
        vi.stubEnv('CRON_SECRET', SECRET);
        expect(call({ authorization: 'Bearer nope' }).status).toBe(401);
    });

    /**
     * `next.config.ts`가 `compress: true`가 된 뒤로 이 지시어는 CloudFlare만이 아니라
     * **오리진 자신에게도** 걸린다 — Next의 압축 미들웨어가 `no-transform`을 보고
     * 빠진다. 지우면 이 진단 스트림이 gzip 버퍼에 갇혀 tick 간격 측정이 전부
     * 거짓이 된다(이 엔드포인트의 존재 이유가 정확한 타이밍 측정이다).
     *
     * 자매 라우트(`/api/analysis/stream`)의 같은 단언과 짝을 이룬다 — `next.config.ts`의
     * 안전성 근거가 두 라우트 모두를 지목하므로 한쪽만 고정하면 절반만 지켜진다.
     */
    it('SSE 헤더에 no-transform을 붙인다', async () => {
        vi.stubEnv('CRON_SECRET', SECRET);
        const res = call({ authorization: `Bearer ${SECRET}` });

        expect(res.headers.get('Content-Type')).toContain('text/event-stream');
        expect(res.headers.get('Cache-Control')).toContain('no-transform');
        expect(res.headers.get('X-Accel-Buffering')).toBe('no');

        // 스트림을 취소해 interval/hard timeout 타이머를 회수한다.
        await res.body?.cancel();
    });
});
