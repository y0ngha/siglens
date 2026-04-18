import {
    asArray,
    asBoolean,
    asEnum,
    asNumber,
    asObject,
    asOptionalEnum,
    asString,
    compact,
} from '@/domain/analysis/normalizePrimitives';

describe('asString', () => {
    it('문자열이면 그대로 반환한다', () => {
        expect(asString('hello')).toBe('hello');
    });

    it('문자열이 아니면 기본값을 반환한다', () => {
        expect(asString(123)).toBe('');
        expect(asString({})).toBe('');
        expect(asString(null)).toBe('');
        expect(asString(undefined)).toBe('');
    });

    it('fallback 인자를 사용한다', () => {
        expect(asString(null, 'fallback')).toBe('fallback');
    });
});

describe('asNumber', () => {
    it('유한한 숫자면 그대로 반환한다', () => {
        expect(asNumber(42)).toBe(42);
        expect(asNumber(0)).toBe(0);
        expect(asNumber(-1.5)).toBe(-1.5);
    });

    it('숫자가 아니면 undefined를 반환한다', () => {
        expect(asNumber('42')).toBeUndefined();
        expect(asNumber(null)).toBeUndefined();
        expect(asNumber({})).toBeUndefined();
    });

    it('NaN과 Infinity는 undefined로 처리한다', () => {
        expect(asNumber(NaN)).toBeUndefined();
        expect(asNumber(Infinity)).toBeUndefined();
        expect(asNumber(-Infinity)).toBeUndefined();
    });
});

describe('asBoolean', () => {
    it('불리언이면 그대로 반환한다', () => {
        expect(asBoolean(true)).toBe(true);
        expect(asBoolean(false)).toBe(false);
    });

    it('불리언이 아니면 기본값을 반환한다', () => {
        expect(asBoolean('true')).toBe(false);
        expect(asBoolean(1)).toBe(false);
        expect(asBoolean(null)).toBe(false);
    });

    it('fallback 인자를 사용한다', () => {
        expect(asBoolean(null, true)).toBe(true);
    });
});

describe('asEnum', () => {
    const colors = ['red', 'green', 'blue'] as const;

    it('유효한 값이면 그대로 반환한다', () => {
        expect(asEnum('red', colors, 'green')).toBe('red');
    });

    it('유효하지 않으면 fallback을 반환한다', () => {
        expect(asEnum('purple', colors, 'green')).toBe('green');
        expect(asEnum(null, colors, 'green')).toBe('green');
    });
});

describe('asOptionalEnum', () => {
    const colors = ['red', 'green', 'blue'] as const;

    it('유효한 값이면 그대로 반환한다', () => {
        expect(asOptionalEnum('red', colors)).toBe('red');
    });

    it('유효하지 않으면 undefined를 반환한다', () => {
        expect(asOptionalEnum('purple', colors)).toBeUndefined();
        expect(asOptionalEnum(null, colors)).toBeUndefined();
    });
});

describe('asObject', () => {
    it('일반 객체는 그대로 반환한다', () => {
        const obj = { foo: 'bar' };
        expect(asObject(obj)).toBe(obj);
    });

    it('null은 null을 반환한다', () => {
        expect(asObject(null)).toBeNull();
    });

    it('undefined는 null을 반환한다', () => {
        expect(asObject(undefined)).toBeNull();
    });

    it('배열은 null을 반환한다', () => {
        expect(asObject([])).toBeNull();
        expect(asObject([1, 2])).toBeNull();
    });

    it('원시 값은 null을 반환한다', () => {
        expect(asObject('string')).toBeNull();
        expect(asObject(42)).toBeNull();
        expect(asObject(true)).toBeNull();
    });
});

describe('asArray', () => {
    it('배열이면 그대로 반환한다', () => {
        const arr = [1, 2, 3];
        expect(asArray(arr)).toBe(arr);
    });

    it('배열이 아니면 빈 배열을 반환한다', () => {
        expect(asArray(null)).toEqual([]);
        expect(asArray({})).toEqual([]);
        expect(asArray('not array')).toEqual([]);
    });
});

describe('compact', () => {
    it('null을 제거한다', () => {
        expect(compact([1, null, 2, null, 3])).toEqual([1, 2, 3]);
    });

    it('null이 없으면 그대로 반환한다', () => {
        expect(compact([1, 2, 3])).toEqual([1, 2, 3]);
    });

    it('모두 null이면 빈 배열을 반환한다', () => {
        expect(compact([null, null])).toEqual([]);
    });

    it('빈 배열은 빈 배열을 반환한다', () => {
        expect(compact([])).toEqual([]);
    });
});
