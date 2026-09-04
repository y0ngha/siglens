import { constants } from 'node:http2';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { HTTP_STATUS_NO_CONTENT, HTTP_STATUS_INTERNAL_SERVER_ERROR } = constants;

const HUMAN_UA = 'Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/140.0.0.0';
const BOT_UA =
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

const recordVisit = vi.fn().mockResolvedValue(undefined);
const pruneOlderThan = vi.fn().mockResolvedValue(undefined);
let requestHeaders = new Headers();

vi.mock('next/headers', () => ({
    headers: () => Promise.resolve(requestHeaders),
}));

/**
 * `after()`만 갈아끼운다. 모듈을 통째로 대체하면 `isBot`이 쓰는
 * `userAgent`가 함께 사라져 봇 판정이 던진다.
 */
vi.mock('next/server', async importOriginal => {
    const actual = await importOriginal<typeof import('next/server')>();
    return {
        ...actual,
        // 콜백을 즉시 실행해 prune 경로를 테스트에서 관찰 가능하게 만든다.
        after: (fn: () => unknown) => {
            void fn();
        },
    };
});

const getDatabaseClient = vi.fn(() => ({ db: {} }));

vi.mock('@/shared/db/client', () => ({
    getDatabaseClient: () => getDatabaseClient(),
}));

vi.mock('@/entities/visitor', () => ({
    DrizzleVisitorRepository: class {
        recordVisit = recordVisit;
        pruneOlderThan = pruneOlderThan;
    },
    buildVisitorHash: (pepper: string, ip: string, ua: string) =>
        `hash(${pepper}|${ip}|${ua})`,
}));

/**
 * 라우트가 모듈 스코프에 마지막 prune 날짜를 들고 있다. 테스트마다
 * 새로 import해야 그 상태가 격리된다.
 */
async function importRoute() {
    vi.resetModules();
    return import('@/app/api/presence/route');
}

describe('POST /api/presence', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // `Date.now()`를 고정한다 — 진단 컬럼 저장이 방침 발효일에 걸려 있어
        // 실제 시각으로 돌면 발효 전후에 따라 결과가 뒤집힌다.
        vi.useFakeTimers({ shouldAdvanceTime: true });
        getDatabaseClient.mockReturnValue({ db: {} });
        vi.stubEnv('NODE_ENV', 'production');
        vi.stubEnv('VISITOR_HASH_PEPPER', 'test-pepper');
        requestHeaders = new Headers({
            'user-agent': HUMAN_UA,
            'x-forwarded-for': '203.0.113.10, 10.0.0.1',
            'cf-ipcountry': 'KR',
            // same-origin fetch라 비콘이 뜬 페이지 URL이 그대로 실린다.
            referer: 'https://siglens.io/ko/AAPL?tab=chart',
        });
        // 진단 컬럼은 개인정보처리방침 v3 발효(2026-09-19 KST) 후에만 저장된다.
        // 대부분의 케이스가 그 이후를 전제하므로 시각을 고정한다.
        vi.setSystemTime(new Date('2026-09-20T03:00:00.000Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllEnvs();
    });

    it('사람 요청을 하루 1행으로 기록하고 204를 준다', async () => {
        const { POST } = await importRoute();
        const res = await POST();

        expect(res.status).toBe(HTTP_STATUS_NO_CONTENT);
        // x-forwarded-for의 첫 값만 쓴다(체인의 뒤쪽은 우리 인프라다).
        expect(recordVisit).toHaveBeenCalledWith({
            visitorHash: `hash(test-pepper|203.0.113.10|${HUMAN_UA})`,
            date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
            userAgent: HUMAN_UA,
            country: 'KR',
            // 쿼리스트링은 버린다.
            landingPath: '/ko/AAPL',
        });
    });

    it('방침 v3 발효 전에는 진단 컬럼을 저장하지 않는다', async () => {
        // 코드가 방침보다 먼저 배포돼도 고지되지 않은 항목을 수집하지 않는다.
        vi.setSystemTime(new Date('2026-09-18T14:59:59.000Z'));
        const { POST } = await importRoute();
        await POST();

        expect(recordVisit).toHaveBeenCalledWith(
            expect.objectContaining({
                userAgent: null,
                country: null,
                landingPath: null,
            })
        );
        // 방문 자체는 종전대로 기록된다.
        expect(recordVisit).toHaveBeenCalledWith(
            expect.objectContaining({
                visitorHash: `hash(test-pepper|203.0.113.10|${HUMAN_UA})`,
            })
        );
    });

    it('헤더가 없으면 진단 컬럼을 null로 남긴다', async () => {
        requestHeaders = new Headers({
            'user-agent': HUMAN_UA,
            'x-forwarded-for': '203.0.113.10',
        });
        const { POST } = await importRoute();
        // 발효 후이므로 헤더가 있었다면 저장됐을 시점이다.
        await POST();

        expect(recordVisit).toHaveBeenCalledWith(
            expect.objectContaining({ country: null, landingPath: null })
        );
    });

    it('AI 크롤러 User-Agent도 기록하지 않는다', async () => {
        // Next 내장 isBot 정규식이 잡지 못하는 토큰이다.
        requestHeaders.set(
            'user-agent',
            'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)'
        );
        const { POST } = await importRoute();

        expect((await POST()).status).toBe(HTTP_STATUS_NO_CONTENT);
        expect(recordVisit).not.toHaveBeenCalled();
    });

    it('봇 User-Agent는 기록하지 않는다', async () => {
        requestHeaders.set('user-agent', BOT_UA);
        const { POST } = await importRoute();
        const res = await POST();

        expect(res.status).toBe(HTTP_STATUS_NO_CONTENT);
        expect(recordVisit).not.toHaveBeenCalled();
    });

    it('프로덕션이 아니면 기록하지 않는다', async () => {
        vi.stubEnv('NODE_ENV', 'development');
        const { POST } = await importRoute();
        const res = await POST();

        expect(res.status).toBe(HTTP_STATUS_NO_CONTENT);
        expect(recordVisit).not.toHaveBeenCalled();
    });

    it('pepper가 없으면 500과 함께 로그를 남긴다', async () => {
        vi.stubEnv('VISITOR_HASH_PEPPER', '');
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const { POST } = await importRoute();
        const res = await POST();

        // 조용히 0이 찍히는 것이 최악이다. 프로덕션 로그에 남아야 한다.
        expect(res.status).toBe(HTTP_STATUS_INTERNAL_SERVER_ERROR);
        expect(spy).toHaveBeenCalledWith(
            expect.stringContaining('VISITOR_HASH_PEPPER')
        );
        expect(recordVisit).not.toHaveBeenCalled();
        spy.mockRestore();
    });

    it('DB 쓰기가 실패해도 204를 준다', async () => {
        recordVisit.mockRejectedValueOnce(new Error('neon down'));
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const { POST } = await importRoute();
        const res = await POST();

        // 집계 실패가 사용자 화면을 깨뜨리면 안 된다.
        expect(res.status).toBe(HTTP_STATUS_NO_CONTENT);
        expect(spy).toHaveBeenCalled();
        spy.mockRestore();
    });

    it('보존 기간을 넘긴 행을 하루 한 번만 지운다', async () => {
        const { POST } = await importRoute();
        await POST();
        await POST();

        // 같은 날 두 번째 요청은 prune을 다시 돌리지 않는다.
        expect(pruneOlderThan).toHaveBeenCalledTimes(1);
    });

    it('정리 기준일은 오늘로부터 400일 전이다', async () => {
        vi.setSystemTime(new Date('2026-09-02T03:00:00.000Z'));

        const { POST } = await importRoute();
        await POST();

        // KST 2026-09-02 기준 400일 전 = 2025-07-29
        expect(pruneOlderThan).toHaveBeenCalledWith('2025-07-29');
    });

    it('DB 클라이언트 생성이 던져도 204를 주고 정리를 소진하지 않는다', async () => {
        getDatabaseClient.mockImplementationOnce(() => {
            throw new Error('DATABASE_URL is not set');
        });
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const { POST } = await importRoute();
        // 첫 요청은 DB 클라이언트 단계에서 실패한다.
        expect((await POST()).status).toBe(HTTP_STATUS_NO_CONTENT);
        expect(spy).toHaveBeenCalled();
        expect(pruneOlderThan).not.toHaveBeenCalled();

        // 실패가 `lastPrunedDate`를 소진하지 않았으므로 다음 성공 요청이
        // 그날의 정리를 여전히 돌린다.
        expect((await POST()).status).toBe(HTTP_STATUS_NO_CONTENT);
        expect(pruneOlderThan).toHaveBeenCalledTimes(1);
        spy.mockRestore();
    });
});
