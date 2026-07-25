import http from 'node:http';
import {
    describe,
    it,
    expect,
    beforeAll,
    afterAll,
    beforeEach,
    afterEach,
    vi,
} from 'vitest';
import {
    isUpstashConfigured,
    zaddGreater,
    zrangeFromScore,
    zremBelowScore,
    expireKey,
    serverTimeMs,
    _resetForTest,
} from '../upstashRest.mjs';

// 이 스위트는 node:http를 mock하지 않는다 — 실제 로컬 서버를 띄워 진짜 전송(헤더 인코딩,
// 바디 직렬화, 상태 처리, 타임아웃)을 검증한다. 이전 버전은 전역 fetch를 mock했는데,
// 그 mock이 실제로는 존재하지 않는 fetch 기반 전송을 검증하고 있었다 — 소스가
// node:http/https로 바뀐 지금은 완전히 무의미하다.

const WRITE_TOKEN = 'write-token';
const READ_TOKEN = 'read-token';

/** 서버가 응답을 아예 보내지 않도록 하는 시그널(타임아웃 테스트 전용). */
const HANG = Symbol('hang');

let server;
let baseUrl;
let requests;
let responder;

function serveJson(res, status, body) {
    const text = typeof body === 'string' ? body : JSON.stringify(body);
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(text);
}

beforeAll(async () => {
    server = http.createServer((req, res) => {
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8');
            let parsedBody;
            try {
                parsedBody = JSON.parse(raw);
            } catch {
                parsedBody = raw;
            }
            requests.push({
                method: req.method,
                path: req.url,
                headers: { ...req.headers },
                body: parsedBody,
            });

            const result = responder(parsedBody);
            if (result === HANG) return; // 응답 없이 연결만 유지
            serveJson(res, result.status ?? 200, result.body);
        });
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
    await new Promise(resolve => server.close(resolve));
});

beforeEach(() => {
    _resetForTest();
    requests = [];
    // 기본 응답은 빈 배열 — zrangeFromScore(읽기 계열 테스트 기본 호출)가 "non-array result"로
    // throw하지 않게 한다. null을 돌려주는 경우를 검증하는 테스트는 각자 responder를 재설정한다.
    responder = () => ({ status: 200, body: { result: [] } });
    vi.stubEnv('UPSTASH_REDIS_REST_URL', baseUrl);
    vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', WRITE_TOKEN);
    vi.stubEnv('UPSTASH_REDIS_REST_READONLY_TOKEN', READ_TOKEN);
    vi.stubEnv('ISR_TAG_SYNC_DISABLED', '');
});

afterEach(() => {
    vi.unstubAllEnvs();
    _resetForTest();
});

describe('upstashRest — 설정 감지', () => {
    it('URL과 토큰이 모두 있으면 설정된 것으로 본다', () => {
        expect(isUpstashConfigured()).toBe(true);
    });

    it('URL이 없으면 미설정 — 빌드 타임 prerender가 여기 해당한다', () => {
        vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
        _resetForTest();
        expect(isUpstashConfigured()).toBe(false);
    });

    it('토큰이 없으면 미설정', () => {
        vi.stubEnv('UPSTASH_REDIS_REST_TOKEN', '');
        _resetForTest();
        expect(isUpstashConfigured()).toBe(false);
    });

    it('ISR_TAG_SYNC_DISABLED가 true면 킬스위치로 미설정 취급한다', () => {
        vi.stubEnv('ISR_TAG_SYNC_DISABLED', 'true');
        _resetForTest();
        expect(isUpstashConfigured()).toBe(false);
    });

    it('URL이 파싱 불가능한 값이면 미설정으로 degrade한다', () => {
        vi.stubEnv('UPSTASH_REDIS_REST_URL', 'not-a-url');
        _resetForTest();
        expect(isUpstashConfigured()).toBe(false);
    });

    it('설정이 안 된 상태에서는 어떤 요청도 서버로 나가지 않는다', () => {
        vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
        _resetForTest();
        expect(isUpstashConfigured()).toBe(false);
        expect(requests).toHaveLength(0);
    });
});

describe('upstashRest — 인증 토큰', () => {
    it('읽기(zrangeFromScore)는 읽기 전용 토큰을 쓴다', async () => {
        await zrangeFromScore('k', 100);
        expect(requests[0].headers.authorization).toBe(`Bearer ${READ_TOKEN}`);
    });

    it('읽기(serverTimeMs)도 읽기 전용 토큰을 쓴다', async () => {
        responder = () => ({
            status: 200,
            body: { result: ['1700000000', '0'] },
        });
        await serverTimeMs();
        expect(requests[0].headers.authorization).toBe(`Bearer ${READ_TOKEN}`);
    });

    it('쓰기(zaddGreater)는 쓰기 토큰을 쓴다', async () => {
        await zaddGreater('k', [[1, 'a']]);
        expect(requests[0].headers.authorization).toBe(`Bearer ${WRITE_TOKEN}`);
    });

    it('쓰기(zremBelowScore)도 쓰기 토큰을 쓴다', async () => {
        await zremBelowScore('k', 5000);
        expect(requests[0].headers.authorization).toBe(`Bearer ${WRITE_TOKEN}`);
    });

    it('쓰기(expireKey)도 쓰기 토큰을 쓴다', async () => {
        await expireKey('k', 30);
        expect(requests[0].headers.authorization).toBe(`Bearer ${WRITE_TOKEN}`);
    });

    it('읽기 전용 토큰이 빈 문자열이면 쓰기 토큰으로 대체한다', async () => {
        vi.stubEnv('UPSTASH_REDIS_REST_READONLY_TOKEN', '');
        _resetForTest();
        await zrangeFromScore('k', 100);
        expect(requests[0].headers.authorization).toBe(`Bearer ${WRITE_TOKEN}`);
    });
});

describe('upstashRest — 요청 형식', () => {
    it('POST + application/json + 정확한 Content-Length로 보낸다', async () => {
        await zaddGreater('k', [[1000, 'a']]);
        const expected = JSON.stringify(['ZADD', 'k', 'GT', '1000', 'a']);
        expect(requests[0].method).toBe('POST');
        expect(requests[0].headers['content-type']).toBe('application/json');
        expect(Number(requests[0].headers['content-length'])).toBe(
            Buffer.byteLength(expected, 'utf8')
        );
    });

    it('바디는 모든 인자를 문자열화한 명령 배열의 JSON이다', async () => {
        await zaddGreater('k', [[1000, 'a']]);
        expect(requests[0].body).toEqual(['ZADD', 'k', 'GT', '1000', 'a']);
        expect(requests[0].body.every(arg => typeof arg === 'string')).toBe(
            true
        );
    });
});

describe('upstashRest — 명령 wire format', () => {
    it('ZADD: [key, GT, score, member, ...]', async () => {
        await zaddGreater('k', [
            [1, 'a'],
            [2, 'b'],
        ]);
        expect(requests[0].body).toEqual([
            'ZADD',
            'k',
            'GT',
            '1',
            'a',
            '2',
            'b',
        ]);
    });

    it('ZRANGE: [key, min, +inf, BYSCORE, WITHSCORES]', async () => {
        await zrangeFromScore('k', 1234);
        expect(requests[0].body).toEqual([
            'ZRANGE',
            'k',
            '1234',
            '+inf',
            'BYSCORE',
            'WITHSCORES',
        ]);
    });

    it('ZREMRANGEBYSCORE: [key, -inf, (max]', async () => {
        await zremBelowScore('k', 5000);
        expect(requests[0].body).toEqual([
            'ZREMRANGEBYSCORE',
            'k',
            '-inf',
            '(5000',
        ]);
    });

    it('EXPIRE: [key, seconds]', async () => {
        await expireKey('k', 30);
        expect(requests[0].body).toEqual(['EXPIRE', 'k', '30']);
    });

    it('TIME: 인자 없음', async () => {
        responder = () => ({
            status: 200,
            body: { result: ['1700000000', '0'] },
        });
        await serverTimeMs();
        expect(requests[0].body).toEqual(['TIME']);
    });
});

describe('upstashRest — zaddGreater 청킹', () => {
    it('501개를 넘기면 정확히 2개 요청으로 나눈다(500 + 1)', async () => {
        const entries = Array.from({ length: 501 }, (_, i) => [i, `t${i}`]);
        await zaddGreater('k', entries);
        expect(requests).toHaveLength(2);
        expect(requests[0].body).toHaveLength(3 + 500 * 2);
        expect(requests[1].body).toHaveLength(3 + 1 * 2);
    });

    it('빈 배열이면 요청을 하나도 보내지 않는다', async () => {
        await zaddGreater('k', []);
        expect(requests).toHaveLength(0);
    });
});

describe('upstashRest — zrangeFromScore 파싱', () => {
    it('평면 배열을 { pairs, rawLength }로 파싱한다', async () => {
        responder = () => ({
            status: 200,
            body: { result: ['a', '100', 'b', '200'] },
        });
        await expect(zrangeFromScore('k', 0)).resolves.toEqual({
            pairs: [
                ['a', 100],
                ['b', 200],
            ],
            rawLength: 4,
        });
    });

    it('score가 이미 숫자여도 파싱한다', async () => {
        responder = () => ({ status: 200, body: { result: ['a', 100] } });
        await expect(zrangeFromScore('k', 0)).resolves.toEqual({
            pairs: [['a', 100]],
            rawLength: 2,
        });
    });

    it('score가 손상된(NaN) 엔트리는 버리지만 rawLength에는 그대로 잡힌다', async () => {
        responder = () => ({
            status: 200,
            body: { result: ['a', 'NaN', 'b', '200'] },
        });
        await expect(zrangeFromScore('k', 0)).resolves.toEqual({
            pairs: [['b', 200]],
            rawLength: 4,
        });
    });

    it('빈 member는 버린다', async () => {
        responder = () => ({
            status: 200,
            body: { result: ['', '100', 'b', '200'] },
        });
        await expect(zrangeFromScore('k', 0)).resolves.toEqual({
            pairs: [['b', 200]],
            rawLength: 4,
        });
    });

    it('짝이 맞지 않는 꼬리 원소는 무시한다', async () => {
        responder = () => ({
            status: 200,
            body: { result: ['a', '100', 'dangling'] },
        });
        await expect(zrangeFromScore('k', 0)).resolves.toEqual({
            pairs: [['a', 100]],
            rawLength: 3,
        });
    });

    it('결과가 배열이 아니면 throw한다(빈 배열로 삼키지 않는다)', async () => {
        responder = () => ({ status: 200, body: { result: null } });
        await expect(zrangeFromScore('k', 0)).rejects.toThrow(
            'non-array result'
        );
    });

    it('RESP3 중첩 배열([[member, score]])은 pairs:[]에 rawLength만 잡힌다(와이어 포맷 변경 신호)', async () => {
        responder = () => ({
            status: 200,
            body: { result: [['a', '100']] },
        });
        await expect(zrangeFromScore('k', 0)).resolves.toEqual({
            pairs: [],
            rawLength: 1,
        });
    });
});

describe('upstashRest — serverTimeMs', () => {
    it('[seconds, micros]를 밀리초로 합산한다', async () => {
        responder = () => ({
            status: 200,
            body: { result: ['1700000000', '500000'] },
        });
        await expect(serverTimeMs()).resolves.toBe(1700000000500);
    });

    it('배열 형태가 아니면 throw한다', async () => {
        responder = () => ({ status: 200, body: { result: '1700000000' } });
        await expect(serverTimeMs()).rejects.toThrow('unexpected shape');
    });

    it('원소가 숫자가 아니면 throw한다', async () => {
        responder = () => ({
            status: 200,
            body: { result: ['abc', '500000'] },
        });
        await expect(serverTimeMs()).rejects.toThrow('non-numeric');
    });
});

describe('upstashRest — 오류 처리', () => {
    it('HTTP 오류는 상태 코드를 담아 throw한다', async () => {
        responder = () => ({ status: 500, body: { result: null } });
        await expect(zrangeFromScore('k', 1)).rejects.toThrow(
            'upstash http 500'
        );
    });

    it('응답 본문의 error 필드도 throw한다', async () => {
        responder = () => ({ status: 200, body: { error: 'WRONGTYPE' } });
        await expect(zrangeFromScore('k', 1)).rejects.toThrow('WRONGTYPE');
    });

    it('JSON이 아닌 본문은 malformed response로 throw한다', async () => {
        responder = () => ({ status: 200, body: 'not-json{' });
        await expect(zrangeFromScore('k', 1)).rejects.toThrow(
            'malformed response'
        );
    });

    it('미설정 상태에서 호출하면 요청을 보내지 않고 throw한다', async () => {
        vi.stubEnv('UPSTASH_REDIS_REST_URL', '');
        _resetForTest();
        await expect(zrangeFromScore('k', 1)).rejects.toThrow('not configured');
        expect(requests).toHaveLength(0);
    });
});

describe('upstashRest — 타임아웃 및 네트워크 오류', () => {
    it('서버가 응답하지 않으면 약 2초 후 reject되고 promise가 반드시 settle된다', async () => {
        responder = () => HANG;
        const start = Date.now();
        await expect(zrangeFromScore('k', 1)).rejects.toThrow();
        const elapsed = Date.now() - start;
        expect(elapsed).toBeGreaterThan(1500);
        expect(elapsed).toBeLessThan(5000);
    }, 8000);

    it('연결이 거부되면(닫힌 포트) hang하지 않고 reject된다', async () => {
        const closed = http.createServer();
        await new Promise(resolve => closed.listen(0, '127.0.0.1', resolve));
        const port = closed.address().port;
        await new Promise(resolve => closed.close(resolve));

        vi.stubEnv('UPSTASH_REDIS_REST_URL', `http://127.0.0.1:${port}`);
        _resetForTest();
        await expect(zrangeFromScore('k', 1)).rejects.toThrow();
    });
});
