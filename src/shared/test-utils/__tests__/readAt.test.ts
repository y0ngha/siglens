import { describe, expect, it } from 'vitest';
import {
    arrayAt,
    keysAt,
    numberAt,
    readAt,
    stringAt,
} from '@/shared/test-utils/readAt';

const sample: unknown = {
    quotes: [{ price: 1.5, name: 'wti', nothing: null, zero: 0 }],
};

describe('readAt', () => {
    it('경로를 따라 값을 읽고 null·0도 그대로 돌려준다', () => {
        expect(readAt(sample, 'quotes', 0, 'name')).toBe('wti');
        expect(readAt(sample, 'quotes', 0, 'nothing')).toBeNull();
        expect(readAt(sample, 'quotes', 0, 'zero')).toBe(0);
        expect(readAt(sample)).toBe(sample);
    });

    it('없는 키는 undefined다', () => {
        expect(readAt(sample, 'quotes', 0, 'missing')).toBeUndefined();
    });

    it('경로 중간이 객체가 아니면 끊긴 위치를 알려 주며 던진다', () => {
        expect(() => readAt(sample, 'quotes', 0, 'name', 'x')).toThrow(
            'expected an object at quotes.0.name'
        );
        expect(() => readAt(sample, 'quotes', 0, 'nothing', 'x')).toThrow(
            'expected an object at quotes.0.nothing'
        );
        expect(() => readAt(null, 'a')).toThrow('expected an object at value');
    });
});

describe('typed readers', () => {
    it('모양이 맞으면 좁혀진 값을 돌려준다', () => {
        expect(numberAt(sample, 'quotes', 0, 'price')).toBe(1.5);
        expect(stringAt(sample, 'quotes', 0, 'name')).toBe('wti');
        expect(arrayAt(sample, 'quotes')).toHaveLength(1);
        expect(keysAt(sample, 'quotes', 0)).toEqual([
            'price',
            'name',
            'nothing',
            'zero',
        ]);
    });

    it('모양이 다르면 던진다', () => {
        expect(() => numberAt(sample, 'quotes', 0, 'name')).toThrow(
            'expected a number at quotes.0.name'
        );
        expect(() => stringAt(sample, 'quotes', 0, 'price')).toThrow(
            'expected a string at quotes.0.price'
        );
        expect(() => arrayAt(sample, 'quotes', 0)).toThrow(
            'expected an array at quotes.0'
        );
        expect(() => keysAt(sample, 'quotes', 0, 'name')).toThrow(
            'expected an object at quotes.0.name'
        );
    });
});
