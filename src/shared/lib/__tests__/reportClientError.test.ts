import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
    reportClientError,
    __resetReportCountForTests,
} from '@/shared/lib/reportClientError';

/** 비콘 본문은 Blob이라 텍스트로 되돌려야 검사할 수 있다. */
async function bodiesOf(beacon: ReturnType<typeof vi.fn>): Promise<unknown[]> {
    return Promise.all(
        beacon.mock.calls.map(async ([, blob]) =>
            JSON.parse(await (blob as Blob).text())
        )
    );
}

describe('reportClientError', () => {
    let beacon: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        __resetReportCountForTests();
        beacon = vi.fn(() => true);
        vi.stubGlobal('navigator', { sendBeacon: beacon });
        vi.stubGlobal('window', { location: { pathname: '/AAPL' } });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('Error의 name·message·stack과 경로를 보낸다', async () => {
        const error = new TypeError('boom');
        reportClientError(error, 'RootRoute', 'abc123');

        const [body] = (await bodiesOf(beacon)) as Record<string, unknown>[];
        expect(body).toMatchObject({
            context: 'RootRoute',
            digest: 'abc123',
            path: '/AAPL',
            message: 'TypeError: boom',
        });
        expect(body.stack).toContain('TypeError: boom');
    });

    it('문자열 reason은 그대로 담는다 (unhandledrejection 경로)', async () => {
        reportClientError('plain string reason', 'unhandledrejection');

        const [body] = (await bodiesOf(beacon)) as Record<string, unknown>[];
        expect(body.message).toBe('plain string reason');
        expect(body.stack).toBeUndefined();
    });

    it('문자열이 아닌 reason의 toString은 절대 호출하지 않는다', async () => {
        const toString = vi.fn(() => 'should never run');
        reportClientError({ toString }, 'unhandledrejection');

        expect(toString).not.toHaveBeenCalled();
        const [body] = (await bodiesOf(beacon)) as Record<string, unknown>[];
        expect(body.message).toBe('[non-string: object]');
    });

    it('쿼리스트링은 싣지 않는다 (개인정보 유출 방지)', async () => {
        vi.stubGlobal('window', {
            location: { pathname: '/share', search: '?token=secret' },
        });
        reportClientError(new Error('x'), 'ShareRoute');

        const [body] = (await bodiesOf(beacon)) as Record<string, unknown>[];
        expect(body.path).toBe('/share');
        expect(JSON.stringify(body)).not.toContain('secret');
    });

    it('메시지·스택 안의 URL 쿼리스트링도 지운다 (path와 같은 규칙)', async () => {
        const error = new Error(
            'fetch failed: https://api.example.com/v1/me?token=SECRET123&email=a@b.c'
        );
        error.stack =
            'Error: boom\n    at f (https://siglens.io/_next/x.js?sig=SECRET456:1:1)';
        reportClientError(error, 'RootRoute');

        const [body] = (await bodiesOf(beacon)) as Record<string, unknown>[];
        expect(JSON.stringify(body)).not.toContain('SECRET123');
        expect(JSON.stringify(body)).not.toContain('SECRET456');
        // 경로 자체는 남아야 원인 파악이 된다.
        expect(body.message).toContain('https://api.example.com/v1/me');
    });

    it('정규식은 이미 잘린 입력만 본다 (2차식 폭발 방지)', () => {
        // 벽시계 시간으로 재지 않는다 — CI 러너의 GC나 부하로 흔들리고, "빠르다"는
        // 사실이 "자르기가 정규식 앞에 있다"를 증명하지도 못한다(정규식을 통째로
        // 없앤 리팩토링도 통과해 버린다). 대신 `stripQueryStrings`가 실제로 부르는
        // `String.prototype.replace`를 감시해 **입력 길이**를 직접 단언한다.
        const seen: number[] = [];
        const replace = String.prototype.replace;
        const spy = vi
            .spyOn(String.prototype, 'replace')
            .mockImplementation(function (this: string, ...args) {
                seen.push(this.length);
                return replace.apply(this, args as Parameters<typeof replace>);
            });

        const error = new Error('https://a'.repeat(50_000));
        error.stack = 'https://b'.repeat(50_000);
        reportClientError(error, 'RootRoute');
        spy.mockRestore();

        expect(seen.length).toBeGreaterThan(0);
        // 500(메시지) / 1200(스택) — 둘 중 큰 값을 넘는 입력이 정규식에 들어가면 안 된다.
        expect(Math.max(...seen)).toBeLessThanOrEqual(1200);
    });

    it('페이지 로드당 5건에서 멈춘다 — 렌더 루프가 비콘 폭풍이 되지 않도록', () => {
        for (let i = 0; i < 400; i += 1) {
            reportClientError(new Error(`loop ${i}`), 'RootRoute');
        }
        expect(beacon).toHaveBeenCalledTimes(5);
    });

    it('sendBeacon이 없는 환경(SSR 등)에서는 조용히 무시한다', () => {
        vi.stubGlobal('navigator', {});
        expect(() =>
            reportClientError(new Error('x'), 'RootRoute')
        ).not.toThrow();
    });

    it('sendBeacon이 throw해도 호출부로 전파하지 않는다', () => {
        beacon.mockImplementation(() => {
            throw new Error('beacon blew up');
        });
        expect(() =>
            reportClientError(new Error('x'), 'RootRoute')
        ).not.toThrow();
    });
});
