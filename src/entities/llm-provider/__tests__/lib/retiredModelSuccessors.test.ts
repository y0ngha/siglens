import { MODEL_SPECS } from '@y0ngha/siglens-core';
import {
    RETIRED_MODEL_SUCCESSORS,
    resolveRetiredModelId,
} from '@/entities/llm-provider/lib/retiredModelSuccessors';
import { isActiveModelId } from '@/shared/lib/isActiveModelId';

describe('RETIRED_MODEL_SUCCESSORS', () => {
    it.each([...RETIRED_MODEL_SUCCESSORS])(
        '%s의 후속 %s는 활성 모델이다',
        (_retired, successor) => {
            expect(isActiveModelId(successor)).toBe(true);
        }
    );

    it.each([...RETIRED_MODEL_SUCCESSORS.keys()])(
        '키 %s는 활성 모델이 아니다',
        retired => {
            expect(isActiveModelId(retired)).toBe(false);
        }
    );
});

describe('resolveRetiredModelId', () => {
    it.each([...RETIRED_MODEL_SUCCESSORS])(
        '퇴역 모델 %s를 후속 %s로 바꾼다',
        (retired, successor) => {
            expect(resolveRetiredModelId(retired)).toBe(successor);
        }
    );

    it.each(Object.keys(MODEL_SPECS))('활성 모델 %s는 그대로 둔다', id => {
        expect(resolveRetiredModelId(id)).toBe(id);
    });

    it.each(['', 'not-a-model', 'constructor', '__proto__'])(
        '모르는 값 %j는 그대로 둔다',
        id => {
            expect(resolveRetiredModelId(id)).toBe(id);
        }
    );
});
