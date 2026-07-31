import { describe, it, expect } from 'vitest';
import { MODEL_SPECS } from '@y0ngha/siglens-core';
import { isActiveModelId } from '@/shared/lib/isActiveModelId';

describe('isActiveModelId', () => {
    it('true for every own key of MODEL_SPECS', () => {
        for (const key of Object.keys(MODEL_SPECS)) {
            expect(isActiveModelId(key)).toBe(true);
        }
    });

    it('false for an unrecognized model string', () => {
        expect(isActiveModelId('totally-fake-model')).toBe(false);
    });

    it('false for an empty string', () => {
        expect(isActiveModelId('')).toBe(false);
    });

    // `MODEL_SPECS`는 일반 객체 리터럴이라 `'constructor' in MODEL_SPECS`는
    // `Object.prototype`을 통해 상속된 값 때문에 `true`가 된다. `isActiveModelId`가
    // `in` 대신 `Object.hasOwn`을 쓰는 이유가 바로 이것 — own-property가 아닌
    // 프로토타입 체인의 키는 여전히 거부되어야 한다.
    it.each(['constructor', 'toString', 'valueOf', '__proto__'])(
        "false for the prototype-chain key '%s' (own-property check must reject it)",
        prototypeKey => {
            // Sanity check that the naive `in` operator WOULD wrongly accept
            // this key — otherwise this test wouldn't be exercising anything.
            expect(prototypeKey in MODEL_SPECS).toBe(true);
            expect(isActiveModelId(prototypeKey)).toBe(false);
        }
    );
});
