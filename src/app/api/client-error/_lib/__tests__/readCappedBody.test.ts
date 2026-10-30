import { describe, it, expect } from 'vitest';
import { readCappedBody } from '@/app/api/client-error/_lib/readCappedBody';

function streamRequest(chunks: Uint8Array[], failAfter?: Error): Request {
    let index = 0;
    const body = new ReadableStream<Uint8Array>({
        pull(controller) {
            const chunk = chunks[index];
            if (chunk !== undefined) {
                index += 1;
                controller.enqueue(chunk);
                return;
            }
            if (failAfter) controller.error(failAfter);
            else controller.close();
        },
    });
    return new Request('https://siglens.io/api/client-error', {
        method: 'POST',
        body,
        duplex: 'half',
    } as RequestInit & { duplex: 'half' });
}

describe('readCappedBody', () => {
    it('본문이 없으면 빈 문자열을 돌려준다', async () => {
        const request = new Request('https://siglens.io/x', { method: 'POST' });
        expect(await readCappedBody(request, 10)).toBe('');
    });

    it('상한 이하의 본문을 디코딩해 돌려준다', async () => {
        const request = new Request('https://siglens.io/x', {
            method: 'POST',
            body: 'hello',
        });
        expect(await readCappedBody(request, 5)).toBe('hello');
    });

    it('여러 청크에 걸친 멀티바이트 문자를 깨뜨리지 않는다', async () => {
        const bytes = new TextEncoder().encode('한글');
        const request = streamRequest([bytes.slice(0, 2), bytes.slice(2)]);
        expect(await readCappedBody(request, 100)).toBe('한글');
    });

    it('상한을 넘으면 null을 돌려준다', async () => {
        const request = new Request('https://siglens.io/x', {
            method: 'POST',
            body: 'hello!',
        });
        expect(await readCappedBody(request, 5)).toBeNull();
    });

    it('읽기 중 스트림이 오류를 내면 null을 돌려준다', async () => {
        const request = streamRequest(
            [new Uint8Array([0x61])],
            new Error('network reset')
        );
        expect(await readCappedBody(request, 100)).toBeNull();
    });
});
