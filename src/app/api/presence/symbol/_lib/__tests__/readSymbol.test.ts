import { describe, it, expect } from 'vitest';
import { readSymbol } from '@/app/api/presence/symbol/_lib/readSymbol';

function post(body: string): Request {
    return new Request('https://siglens.io/api/presence/symbol', {
        method: 'POST',
        body,
    });
}

describe('readSymbol', () => {
    it('소문자 심볼을 대문자로 올려 돌려준다', async () => {
        expect(await readSymbol(post('{"symbol":"aapl"}'))).toBe('AAPL');
    });

    it('JSON이 아닌 본문은 null이다', async () => {
        expect(await readSymbol(post('not json'))).toBeNull();
    });

    it('객체가 아닌 JSON은 null이다', async () => {
        expect(await readSymbol(post('"AAPL"'))).toBeNull();
        expect(await readSymbol(post('null'))).toBeNull();
    });

    it('symbol이 문자열이 아니면 null이다', async () => {
        expect(await readSymbol(post('{"symbol":123}'))).toBeNull();
        expect(await readSymbol(post('{}'))).toBeNull();
    });

    it('심볼 형상이 아니면 null이다', async () => {
        expect(await readSymbol(post('{"symbol":"<script>"}'))).toBeNull();
    });
});
