import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCurrentUser } from '@/entities/auth/lib/getCurrentUser';
import { canAcceptAnalysisStream } from '@/shared/lib/sse/activeStreams';
import {
    DONE_STATUS_PROBE,
    releaseGenerationGate,
    reserveGenerationGate,
    settleGenerationGate,
} from '../../generationQuota';
import { resolveRequestModel } from '../../modelFallback';
import { dispatchHandlerFor } from '../dispatch';
import { handleDispatchedStream } from '../handleDispatchedStream';

const { promptProbe, onPromptAssembled } = vi.hoisted(() => ({
    promptProbe: { onResolved: vi.fn(), onRejected: vi.fn() },
    onPromptAssembled: vi.fn(),
}));

vi.mock('@/entities/auth/lib/getCurrentUser', () => ({
    getCurrentUser: vi.fn(),
}));
vi.mock('@/shared/lib/sse/activeStreams', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@/shared/lib/sse/activeStreams')
    >()),
    canAcceptAnalysisStream: vi.fn(),
}));
vi.mock('next-intl/server', () => ({
    getTranslations: async () => (key: string) => `t:${key}`,
}));
vi.mock('@/shared/lib/byokGate', () => ({
    buildGateError: async () => ({ code: 'unexpected_error' }),
}));
vi.mock('../../generationQuota', () => ({
    createPromptAssemblyTracker: () => ({
        onPromptAssembled,
        probe: promptProbe,
    }),
    DONE_STATUS_PROBE: { onResolved: vi.fn(), onRejected: vi.fn() },
    releaseGenerationGate: vi.fn(),
    reserveGenerationGate: vi.fn(),
    settleGenerationGate: vi.fn(),
}));
vi.mock('../../modelFallback', () => ({
    attachModelFallback: (work: Promise<unknown>) => work,
    resolveRequestModel: vi.fn(),
}));
vi.mock('../dispatch', async importOriginal => ({
    ...(await importOriginal<typeof import('../dispatch')>()),
    dispatchHandlerFor: vi.fn(),
}));
vi.mock('../readerViews', () => ({
    withReaderViews: (work: Promise<unknown>) => work,
}));

const request = (): Request =>
    new Request('http://localhost/api/analysis/stream', { method: 'POST' });

const handler = vi.fn();

describe('handleDispatchedStream', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        handler.mockResolvedValue({ status: 'cached', result: 1 });
        vi.mocked(dispatchHandlerFor).mockReturnValue(handler);
        vi.mocked(resolveRequestModel).mockReturnValue({
            modelId: undefined,
            fallback: null,
        });
        vi.mocked(getCurrentUser).mockResolvedValue({ id: 'u1' } as never);
        vi.mocked(reserveGenerationGate).mockResolvedValue({
            kind: 'allowed',
            refund: async () => {},
        });
        vi.mocked(canAcceptAnalysisStream).mockReturnValue(true);
        vi.mocked(settleGenerationGate).mockImplementation(work => work);
    });

    it('핸들러 결과를 SSE done 이벤트로 흘린다', async () => {
        const res = await handleDispatchedStream(request(), 'fundamental', {
            symbol: 'AAPL',
        });
        expect(res.headers.get('Content-Type')).toBe(
            'text/event-stream; charset=utf-8'
        );
        const text = await res.text();
        expect(text).toContain('event: done');
        expect(text).toContain('"status":"cached"');
    });

    it('핸들러에 params·로케일·한도 컨텍스트를 넘긴다', async () => {
        await (
            await handleDispatchedStream(request(), 'fundamental', {
                symbol: 'AAPL',
                cacheOnly: true,
            })
        ).text();
        expect(handler).toHaveBeenCalledWith(
            { symbol: 'AAPL', cacheOnly: true },
            expect.any(AbortSignal),
            'ko',
            { cacheOnly: true, rateLimited: false, onPromptAssembled }
        );
    });

    it('로그인한 사용자 id로 생성 한도를 예약한다', async () => {
        await (
            await handleDispatchedStream(request(), 'fundamental', {})
        ).text();
        expect(reserveGenerationGate).toHaveBeenCalledWith(
            'u1',
            false,
            expect.any(Headers)
        );
    });

    it('세션 조회가 실패하면 비회원으로 보고 오류를 기록한다', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        const failure = new Error('session down');
        vi.mocked(getCurrentUser).mockRejectedValue(failure);
        await (
            await handleDispatchedStream(request(), 'fundamental', {})
        ).text();
        expect(reserveGenerationGate).toHaveBeenCalledWith(
            null,
            false,
            expect.any(Headers)
        );
        expect(spy).toHaveBeenCalledWith(
            '[streamAnalysisRoute] session lookup failed:',
            failure
        );
        spy.mockRestore();
    });

    it('비회원 사용자도 null id로 예약한다', async () => {
        vi.mocked(getCurrentUser).mockResolvedValue(null);
        await (
            await handleDispatchedStream(request(), 'fundamental', {})
        ).text();
        expect(reserveGenerationGate).toHaveBeenCalledWith(
            null,
            false,
            expect.any(Headers)
        );
    });

    it.each(['briefing', 'macroBriefing', 'marketNewsDigest'] as const)(
        '%s는 한도를 예약하지 않고 exempt로 진행한다',
        async type => {
            await (await handleDispatchedStream(request(), type, {})).text();
            expect(reserveGenerationGate).not.toHaveBeenCalled();
            expect(getCurrentUser).not.toHaveBeenCalled();
            expect(settleGenerationGate).toHaveBeenCalledWith(
                expect.any(Promise),
                { kind: 'exempt' },
                DONE_STATUS_PROBE
            );
        }
    );

    it('한도 초과면 캐시 전용으로 강등하고 재분석 의도를 무시하도록 알린다', async () => {
        vi.mocked(reserveGenerationGate).mockResolvedValue({
            kind: 'rate_limited',
            audience: 'guest',
            reason: 'daily',
            retryAt: 1,
        } as never);
        await (
            await handleDispatchedStream(request(), 'fundamental', {})
        ).text();
        expect(handler).toHaveBeenCalledWith(
            {},
            expect.any(AbortSignal),
            'ko',
            expect.objectContaining({ cacheOnly: true, rateLimited: true })
        );
    });

    it('overall은 프롬프트 조립 추적기로 정산한다', async () => {
        await (await handleDispatchedStream(request(), 'overall', {})).text();
        expect(settleGenerationGate).toHaveBeenCalledWith(
            expect.any(Promise),
            expect.objectContaining({ kind: 'allowed' }),
            promptProbe
        );
    });

    it('overall이 아닌 종류는 done 상태 근사 판정으로 정산한다', async () => {
        await (
            await handleDispatchedStream(request(), 'fundamental', {})
        ).text();
        expect(settleGenerationGate).toHaveBeenCalledWith(
            expect.any(Promise),
            expect.objectContaining({ kind: 'allowed' }),
            DONE_STATUS_PROBE
        );
    });

    it('꺼진 서버 키 모델을 대체했으면 대체한 모델로 위임한다', async () => {
        vi.mocked(resolveRequestModel).mockReturnValue({
            modelId: 'fallback-model',
            fallback: { from: 'off', to: 'fallback-model' },
        } as never);
        await (
            await handleDispatchedStream(request(), 'fundamental', {
                symbol: 'AAPL',
                modelId: 'off',
            })
        ).text();
        expect(handler).toHaveBeenCalledWith(
            { symbol: 'AAPL', modelId: 'fallback-model' },
            expect.any(AbortSignal),
            'ko',
            expect.any(Object)
        );
    });

    it('cacheOnly 요청은 모델 대체 판단에 그대로 알린다', async () => {
        await (
            await handleDispatchedStream(request(), 'fundamental', {
                modelId: 'm',
                cacheOnly: true,
            })
        ).text();
        expect(resolveRequestModel).toHaveBeenCalledWith('m', {
            cacheOnly: true,
        });
    });

    it('동시 분석 상한에 걸리면 한도를 환불하고 Retry-After 503을 낸다', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.mocked(canAcceptAnalysisStream).mockReturnValue(false);
        const res = await handleDispatchedStream(request(), 'fundamental', {});
        expect(res.status).toBe(503);
        expect(res.headers.get('Retry-After')).toBe('30');
        await expect(res.json()).resolves.toEqual({ error: 't:busy' });
        expect(releaseGenerationGate).toHaveBeenCalledTimes(1);
        expect(handler).not.toHaveBeenCalled();
        warn.mockRestore();
    });

    it('스트림 구성 중 예외가 나면 한도를 환불하고 500 sentinel을 낸다', async () => {
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
        vi.mocked(settleGenerationGate).mockImplementation(() => {
            throw new Error('boom');
        });
        const res = await handleDispatchedStream(request(), 'fundamental', {});
        expect(res.status).toBe(500);
        await expect(res.json()).resolves.toEqual({
            status: 'error',
            error: { code: 'unexpected_error' },
        });
        expect(releaseGenerationGate).toHaveBeenCalledTimes(1);
        spy.mockRestore();
    });
});
