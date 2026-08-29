import { TEST_STREAM_MESSAGES } from '@/shared/test-utils/streamMessagesFixture';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runAnalysisStream } from '@/shared/hooks/useAnalysisStream';

/**
 * SSE 프레임을 임의의 청크 경계로 쪼개 흘려보내는 가짜 Response.
 *
 * 청크 분할이 이 테스트의 핵심이다 — 네트워크는 `\n\n` 경계를 존중하지 않으므로,
 * 프레임 중간에서 잘린 청크를 버퍼링하지 못하면 실전에서만 깨진다.
 */
function sseResponse(chunks: readonly string[], status = 200): Response {
    const body = new ReadableStream<Uint8Array>({
        start(controller) {
            const encoder = new TextEncoder();
            for (const chunk of chunks) {
                controller.enqueue(encoder.encode(chunk));
            }
            controller.close();
        },
    });
    return new Response(body, { status });
}

const fetchMock = vi.fn();

beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
});

describe('runAnalysisStream', () => {
    it('done 이벤트의 result를 반환한다', async () => {
        fetchMock.mockResolvedValue(
            sseResponse([
                'event: open\ndata: {}\n\n',
                'event: done\ndata: {"result":{"status":"done","value":42}}\n\n',
            ])
        );

        await expect(
            runAnalysisStream({
                type: 'technical',
                params: { symbol: 'AAPL' },
                messages: TEST_STREAM_MESSAGES,
            })
        ).resolves.toEqual({ status: 'done', value: 42 });
    });

    it('프레임이 청크 중간에서 잘려도 재조립한다', async () => {
        // `event: done\ndata: {...}\n\n` 하나를 5조각으로 쪼갠다.
        fetchMock.mockResolvedValue(
            sseResponse([
                'event: op',
                'en\ndata: {}\n\nevent: do',
                'ne\ndata: {"resu',
                'lt":{"ok":true}}',
                '\n\n',
            ])
        );

        await expect(
            runAnalysisStream({
                type: 'technical',
                params: {},
                messages: TEST_STREAM_MESSAGES,
            })
        ).resolves.toEqual({ ok: true });
    });

    it('heartbeat는 조용히 버리고 계속 읽는다', async () => {
        fetchMock.mockResolvedValue(
            sseResponse([
                'event: open\ndata: {}\n\n',
                'event: heartbeat\ndata: {}\n\n',
                'event: heartbeat\ndata: {}\n\n',
                'event: done\ndata: {"result":"finished"}\n\n',
            ])
        );

        await expect(
            runAnalysisStream({
                type: 'technical',
                params: {},
                messages: TEST_STREAM_MESSAGES,
            })
        ).resolves.toBe('finished');
    });

    it('error 이벤트는 서버 메시지로 throw한다', async () => {
        fetchMock.mockResolvedValue(
            sseResponse([
                'event: open\ndata: {}\n\n',
                'event: error\ndata: {"message":"분석 시간이 초과되었습니다."}\n\n',
            ])
        );

        await expect(
            runAnalysisStream({
                type: 'technical',
                params: {},
                messages: TEST_STREAM_MESSAGES,
            })
        ).rejects.toThrow('분석 시간이 초과되었습니다.');
    });

    it('done/error 없이 스트림이 끝나면 중도 절단으로 구분해 알린다', async () => {
        // ALB가 연결을 자르거나 서버가 죽으면 이 모양이 된다 — 조용히 undefined를
        // 반환하면 호출부가 "결과 없음"을 정상으로 오인한다.
        fetchMock.mockResolvedValue(
            sseResponse([
                'event: open\ndata: {}\n\n',
                'event: heartbeat\ndata: {}\n\n',
            ])
        );

        await expect(
            runAnalysisStream({
                type: 'technical',
                params: {},
                messages: TEST_STREAM_MESSAGES,
            })
        ).rejects.toThrow(/disconnected/);
    });

    it('done 프레임의 data가 깨진 JSON이면 로케일 메시지로 실패한다', async () => {
        // 프록시가 본문을 건드리거나 프레임이 잘리면 발생한다. 가드가 없으면
        // `Unexpected token …`(영문 SyntaxError)이 사용자에게 그대로 노출된다.
        fetchMock.mockResolvedValue(
            sseResponse(['event: done\ndata: {"result":\n\n'])
        );

        await expect(
            runAnalysisStream({
                type: 'technical',
                params: {},
                messages: TEST_STREAM_MESSAGES,
            })
        ).rejects.toThrow('unreadable');
    });

    it('error 프레임의 data가 깨져도 로케일 메시지로 실패한다', async () => {
        fetchMock.mockResolvedValue(
            sseResponse(['event: error\ndata: not-json\n\n'])
        );

        await expect(
            runAnalysisStream({
                type: 'technical',
                params: {},
                messages: TEST_STREAM_MESSAGES,
            })
        ).rejects.toThrow('generic');
    });

    it('503은 서버가 준 한국어 안내를 그대로 전달한다 — 실패가 아니라 재시도 안내다', async () => {
        fetchMock.mockResolvedValue(
            new Response(
                JSON.stringify({
                    error: '지금 분석 요청이 많습니다. 잠시 후 다시 시도해 주세요.',
                }),
                { status: 503, headers: { 'Retry-After': '30' } }
            )
        );

        await expect(
            runAnalysisStream({
                type: 'technical',
                params: {},
                messages: TEST_STREAM_MESSAGES,
            })
        ).rejects.toThrow(
            '지금 분석 요청이 많습니다. 잠시 후 다시 시도해 주세요.'
        );
    });

    it('503 본문이 깨져 있어도 한국어 안내로 폴백한다', async () => {
        fetchMock.mockResolvedValue(new Response('not-json', { status: 503 }));

        await expect(
            runAnalysisStream({
                type: 'technical',
                params: {},
                messages: TEST_STREAM_MESSAGES,
            })
        ).rejects.toThrow('busy');
    });

    it('non-2xx 응답은 상태 코드를 담아 throw한다', async () => {
        fetchMock.mockResolvedValue(
            new Response('{"error":"bad request"}', { status: 400 })
        );

        await expect(
            runAnalysisStream({
                type: 'technical',
                params: {},
                messages: TEST_STREAM_MESSAGES,
            })
        ).rejects.toThrow(/400/);
    });

    it('body가 없는 응답도 실패로 처리한다', async () => {
        fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

        await expect(
            runAnalysisStream({
                type: 'technical',
                params: {},
                messages: TEST_STREAM_MESSAGES,
            })
        ).rejects.toThrow(/failed/);
    });

    it('type과 params를 POST 본문으로 보낸다', async () => {
        fetchMock.mockResolvedValue(
            sseResponse(['event: done\ndata: {"result":null}\n\n'])
        );

        await runAnalysisStream({
            type: 'overall',
            params: { symbol: 'TSLA', timeframe: '1Day' },
            messages: TEST_STREAM_MESSAGES,
        });

        expect(fetchMock).toHaveBeenCalledWith(
            '/api/analysis/stream',
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({
                    type: 'overall',
                    params: { symbol: 'TSLA', timeframe: '1Day' },
                }),
            })
        );
    });

    it('signal을 fetch에 그대로 전달한다', async () => {
        const controller = new AbortController();
        fetchMock.mockResolvedValue(
            sseResponse(['event: done\ndata: {"result":null}\n\n'])
        );

        await runAnalysisStream({
            type: 'technical',
            params: {},
            signal: controller.signal,
            messages: TEST_STREAM_MESSAGES,
        });

        expect(fetchMock).toHaveBeenCalledWith(
            '/api/analysis/stream',
            expect.objectContaining({ signal: controller.signal })
        );
    });

    it('abort된 fetch의 거부를 그대로 전파한다', async () => {
        fetchMock.mockRejectedValue(
            new DOMException('The operation was aborted.', 'AbortError')
        );

        await expect(
            runAnalysisStream({
                type: 'technical',
                params: {},
                messages: TEST_STREAM_MESSAGES,
            })
        ).rejects.toThrow(/aborted/i);
    });
});
