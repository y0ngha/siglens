import { getTranslations } from 'next-intl/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildGateError } from '@/shared/lib/byokGate';
import {
    busyResponse,
    gateDeniedResponse,
    gateMessage,
    SSE_HEADERS,
    sseResponse,
    streamMessages,
    unexpectedErrorResponse,
} from '../streamResponses';

vi.mock('next-intl/server', () => ({
    getTranslations: vi.fn(),
}));
vi.mock('@/shared/lib/byokGate', () => ({
    buildGateError: vi.fn(),
}));

const translator = (key: string): string => `t:${key}`;

describe('streamMessages / gateMessage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getTranslations).mockResolvedValue(translator as never);
    });

    it('streamMessages는 app.api.stream 네임스페이스를 요청 로케일로 연다', async () => {
        const t = await streamMessages('ja');
        expect(getTranslations).toHaveBeenCalledWith({
            locale: 'ja',
            namespace: 'app.api.stream',
        });
        expect(t('busy')).toBe('t:busy');
    });

    it('gateMessage는 shared.lib.byokGate 카탈로그를 코드로 조회한다', async () => {
        await expect(gateMessage('en', 'tier_premium_blocked')).resolves.toBe(
            't:tier_premium_blocked'
        );
        expect(getTranslations).toHaveBeenCalledWith({
            locale: 'en',
            namespace: 'shared.lib.byokGate',
        });
    });
});

describe('SSE_HEADERS', () => {
    it('압축 미들웨어가 빠지도록 no-transform을 건다', () => {
        expect(SSE_HEADERS).toEqual({
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-store, no-transform',
            'X-Accel-Buffering': 'no',
        });
    });
});

describe('busyResponse', () => {
    it('Retry-After 30초를 단 503 JSON이다', async () => {
        const res = busyResponse(key => `t:${key}` as string);
        expect(res.status).toBe(503);
        expect(res.headers.get('Retry-After')).toBe('30');
        await expect(res.json()).resolves.toEqual({ error: 't:busy' });
    });
});

describe('unexpectedErrorResponse', () => {
    it('내부 상세 없이 게이트 sentinel만 담은 500이다', async () => {
        vi.mocked(buildGateError).mockResolvedValue({
            code: 'unexpected_error',
            message: 'm',
        } as never);
        const res = await unexpectedErrorResponse('ko');
        expect(buildGateError).toHaveBeenCalledWith('unexpected_error', 'ko');
        expect(res.status).toBe(500);
        await expect(res.json()).resolves.toEqual({
            status: 'error',
            error: { code: 'unexpected_error', message: 'm' },
        });
    });
});

describe('sseResponse', () => {
    it('SSE 헤더를 달고 결과를 done 이벤트로 흘린다', async () => {
        const res = sseResponse(Promise.resolve({ a: 1 }), 'generic');
        expect(res.headers.get('Content-Type')).toBe(
            'text/event-stream; charset=utf-8'
        );
        const text = await res.text();
        expect(text).toContain('event: done');
        expect(text).toContain('"a":1');
    });

    it('내부 오류는 generic 문구로 가린다', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const res = sseResponse(
            Promise.reject(new Error('SECRET_KEY missing')),
            'generic'
        );
        const text = await res.text();
        expect(text).toContain('generic');
        expect(text).not.toContain('SECRET_KEY');
        spy.mockRestore();
    });
});

describe('gateDeniedResponse', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(getTranslations).mockResolvedValue(translator as never);
    });

    it('현지화한 게이트 문구를 error 이벤트로 흘린다', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const res = await gateDeniedResponse(
            'en',
            'tier_premium_blocked',
            'generic'
        );
        expect(res.status).toBe(200);
        const text = await res.text();
        expect(text).toContain('event: error');
        expect(text).toContain('t:tier_premium_blocked');
        warn.mockRestore();
    });

    it('가용성 장애 알람 마커를 찍지 않고 gate-denied로 구분해 로깅한다', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        const res = await gateDeniedResponse(
            'ko',
            'tier_premium_blocked',
            'generic'
        );
        await res.text();
        expect(warn).toHaveBeenCalledWith(
            '[analysis-stream] gate-denied:',
            'tier_premium_blocked'
        );
        expect(error).not.toHaveBeenCalled();
        warn.mockRestore();
        error.mockRestore();
    });
});
