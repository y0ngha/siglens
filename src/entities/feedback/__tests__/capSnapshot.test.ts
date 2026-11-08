import { capSnapshot } from '../lib/capSnapshot';

const bytes = (value: unknown): number =>
    new TextEncoder().encode(JSON.stringify(value)).byteLength;

describe('capSnapshot', () => {
    it('상한 이하이면 원본을 truncated:false 래퍼로 감싼다', () => {
        expect(capSnapshot({ a: 'x', b: [1, 2] }, 1000)).toEqual({
            truncated: false,
            value: { a: 'x', b: [1, 2] },
        });
    });

    it('상한을 넘으면 truncated:true 이고 직렬화 크기가 상한 이하이다', () => {
        const input = { long: 'a'.repeat(5000), short: 'keep' };
        const result = capSnapshot(input, 1000);
        expect(result.truncated).toBe(true);
        expect(bytes(result.value)).toBeLessThanOrEqual(1000);
    });

    it('긴 문자열부터 절단하고 짧은 문자열은 보존한다', () => {
        const result = capSnapshot(
            { long: 'a'.repeat(5000), short: 'keep me' },
            1000
        );
        const value = result.value as { long: string; short: string };
        expect(value.short).toBe('keep me');
        expect(value.long.length).toBeLessThan(5000);
        expect(value.long.endsWith('…')).toBe(true);
    });

    it('긴 문자열 여러 개는 같은 수준으로 깎여 한 필드가 독식하지 않는다', () => {
        const result = capSnapshot(
            { a: 'a'.repeat(4000), b: 'b'.repeat(4000) },
            2000
        );
        const value = result.value as { a: string; b: string };
        expect(value.a.length).toBeGreaterThan(500);
        expect(Math.abs(value.a.length - value.b.length)).toBeLessThanOrEqual(
            1
        );
    });

    it('다바이트(한글) 문자열도 UTF-8 바이트 기준 상한 안에 들어간다', () => {
        const result = capSnapshot({ text: '가'.repeat(5000) }, 1000);
        expect(result.truncated).toBe(true);
        expect(bytes(result.value)).toBeLessThanOrEqual(1000);
    });

    it('배열 안의 문자열도 절단한다(대화 기록)', () => {
        const input = [
            { role: 'user', content: 'q'.repeat(3000) },
            { role: 'assistant', content: 'a'.repeat(3000) },
        ];
        const result = capSnapshot(input, 1500);
        expect(result.truncated).toBe(true);
        expect(bytes(result.value)).toBeLessThanOrEqual(1500);
        expect((result.value as typeof input)[0]!.role).toBe('user');
    });

    it('서로게이트 쌍 중간에서 자르지 않는다', () => {
        const result = capSnapshot({ text: '😀'.repeat(3000) }, 1000);
        const text = (result.value as { text: string }).text;
        expect(text).not.toMatch(/[\ud800-\udbff](?![\udc00-\udfff])/);
    });

    it('문자열로 줄일 수 없는 구조는 value null 과 truncated:true 를 돌려준다', () => {
        const result = capSnapshot(
            Array.from({ length: 5000 }, () => 123456),
            100
        );
        expect(result).toEqual({ truncated: true, value: null });
    });

    it('직렬화할 수 없는 값(undefined)은 null 로 저장하고 truncated:true 를 표시한다', () => {
        expect(capSnapshot(undefined)).toEqual({
            truncated: true,
            value: null,
        });
    });

    it('순환 참조도 던지지 않는다', () => {
        const cyclic: Record<string, unknown> = {};
        cyclic.self = cyclic;
        expect(capSnapshot(cyclic)).toEqual({ truncated: true, value: null });
    });

    it('기본 상한은 256KB 이다', () => {
        const under = capSnapshot({ t: 'a'.repeat(200 * 1024) });
        const over = capSnapshot({ t: 'a'.repeat(300 * 1024) });
        expect(under.truncated).toBe(false);
        expect(over.truncated).toBe(true);
        expect(bytes(over.value)).toBeLessThanOrEqual(256 * 1024);
    });
});
