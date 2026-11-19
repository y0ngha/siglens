import { describe, expect, it } from 'vitest';
import { BoundedBodyTooLargeError, readBoundedBody } from '../readBoundedBody';

const encoder = new TextEncoder();

/** 청크를 차례로 내보내고, 취소되면 `cancelled`를 세운다. */
function streamOf(chunks: readonly string[]): {
    stream: ReadableStream<Uint8Array>;
    state: { cancelled: boolean; pulled: number };
} {
    const state = { cancelled: false, pulled: 0 };
    let index = 0;
    const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
            const chunk = chunks[index];
            index += 1;
            if (chunk === undefined) {
                controller.close();
                return;
            }
            state.pulled += 1;
            controller.enqueue(encoder.encode(chunk));
        },
        cancel() {
            state.cancelled = true;
        },
    });
    return { stream, state };
}

describe('readBoundedBody', () => {
    it('joins every chunk of a body under the limit', async () => {
        const { stream } = streamOf(['abc', 'def', 'g']);
        const bytes = await readBoundedBody(new Response(stream), 7);
        expect(new TextDecoder().decode(bytes)).toBe('abcdefg');
    });

    it('returns an empty array for a response without a body', async () => {
        const bytes = await readBoundedBody(
            new Response(null, { status: 204 }),
            10
        );
        expect(bytes.byteLength).toBe(0);
    });

    it('rejects before reading when Content-Length declares more than the limit', async () => {
        const { stream, state } = streamOf(['abcdef']);
        const res = new Response(stream, {
            headers: { 'content-length': '6' },
        });
        await expect(readBoundedBody(res, 5)).rejects.toBeInstanceOf(
            BoundedBodyTooLargeError
        );
        expect(state.pulled).toBe(0);
        expect(state.cancelled).toBe(true);
    });

    it('stops at the limit and cancels the stream when an undeclared body runs long', async () => {
        const { stream, state } = streamOf(['abcd', 'efgh', 'ijkl', 'mnop']);
        await expect(readBoundedBody(new Response(stream), 6)).rejects.toThrow(
            'response body exceeds 6 bytes'
        );
        expect(state.cancelled).toBe(true);
        expect(state.pulled).toBeLessThan(4);
    });

    it('never puts the request URL in the error message', async () => {
        const { stream } = streamOf(['0123456789']);
        const error = await readBoundedBody(new Response(stream), 3).catch(
            (caught: unknown) => caught
        );
        expect(error).toBeInstanceOf(BoundedBodyTooLargeError);
        expect((error as Error).message).not.toContain('http');
    });

    describe('Request 본문', () => {
        const requestOf = (stream: ReadableStream<Uint8Array>): Request =>
            new Request('http://localhost/x', {
                method: 'POST',
                body: stream,
                // Node fetch는 스트림 본문에 duplex를 요구한다.
                duplex: 'half',
            } as RequestInit);

        it('상한 이하 본문을 청크 경계와 무관하게 이어 준다', async () => {
            const { stream } = streamOf(['{"a":', '[1,2]}']);
            const bytes = await readBoundedBody(requestOf(stream), 100);
            expect(new TextDecoder().decode(bytes)).toBe('{"a":[1,2]}');
        });

        it('content-length 없이 chunked로 상한을 넘기면 던지고 나머지를 읽지 않고 스트림을 끊는다', async () => {
            const chunk = 'x'.repeat(60);
            const { stream, state } = streamOf(Array(50).fill(chunk));
            const request = requestOf(stream);
            expect(request.headers.get('content-length')).toBeNull();
            await expect(readBoundedBody(request, 100)).rejects.toBeInstanceOf(
                BoundedBodyTooLargeError
            );
            expect(state.cancelled).toBe(true);
            expect(state.pulled).toBeLessThan(10);
        });

        it('본문이 없으면 빈 배열이다', async () => {
            const request = new Request('http://localhost/x', {
                method: 'POST',
            });
            expect(await readBoundedBody(request, 100)).toEqual(
                new Uint8Array(0)
            );
        });
    });
});
